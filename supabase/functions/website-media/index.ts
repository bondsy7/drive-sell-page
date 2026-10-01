// Read-only delivery API for dealer websites (server-to-server).
// GET /functions/v1/website-media?target=autoschmitt&source=auto3&externalVehicleId=<id>
// Header: x-website-key: <WEBSITE_MEDIA_KEY_<TARGET>>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-website-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const target = (url.searchParams.get("target") || "").toLowerCase();
  const source = (url.searchParams.get("source") || "auto3").toLowerCase();
  const extId = (url.searchParams.get("externalVehicleId") || "").trim();
  if (!/^[a-z0-9_-]{2,40}$/.test(target) || !/^[a-z0-9_-]{2,40}$/.test(source) || !extId || extId.length > 100) {
    return json({ error: "invalid_parameters" }, 400);
  }

  const envKey = Deno.env.get(`WEBSITE_MEDIA_KEY_${target.toUpperCase().replace(/-/g, "_")}`);
  const provided = req.headers.get("x-website-key") || "";
  if (!envKey || !provided || !safeEqual(provided, envKey)) return json({ error: "unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let q = admin.from("website_publications")
    .select("external_vehicle_id, live_snapshot, published_at")
    .eq("target", target).eq("source_system", source).eq("external_vehicle_id", extId)
    .eq("status", "live");
  const dealerUser = Deno.env.get(`WEBSITE_MEDIA_DEALER_${target.toUpperCase().replace(/-/g, "_")}`);
  if (dealerUser) q = q.eq("user_id", dealerUser);
  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: "server_error" }, 500);
  if (!data || !data.live_snapshot) return json({ error: "not_published" }, 404, { "Cache-Control": "no-store" });

  const s = data.live_snapshot as any;
  return json({
    externalVehicleId: data.external_vehicle_id,
    coverMode: s.coverMode,
    galleryMode: s.galleryMode,
    coverImageUrl: s.coverMode === "ai" ? s.coverImageUrl ?? null : null,
    images: s.galleryMode === "auto3" ? [] : (s.images || []).map((i: any) => ({ url: i.url, sortOrder: i.sortOrder })),
    updatedAt: data.published_at,
  }, 200, { "Cache-Control": "public, max-age=60" });
});
