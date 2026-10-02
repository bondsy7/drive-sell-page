// Read-only delivery API for dealer websites (server-to-server).
// GET  /functions/v1/website-media?target=autoschmitt&source=auto3&externalVehicleId=<id>
// POST /functions/v1/website-media  {target, source, externalVehicleIds: [...]}  (max 100 unique)
// Header: x-website-key: <WEBSITE_MEDIA_KEY_<TARGET>>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { collectUrls, parseBatchBody, serializePublication, type PublicationRow } from "./serialize.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-website-key, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const envSuffix = (t: string) => t.toUpperCase().replace(/-/g, "_");
function authorized(req: Request, target: string) {
  const envKey = Deno.env.get(`WEBSITE_MEDIA_KEY_${envSuffix(target)}`);
  const provided = req.headers.get("x-website-key") || "";
  return !!envKey && !!provided && safeEqual(provided, envKey);
}

const SELECT = "external_vehicle_id, live_snapshot, published_at, live_updated_at, updated_at, version";

async function loadLive(target: string, source: string, ids: string[]) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let q = admin.from("website_publications").select(SELECT)
    .eq("target", target).eq("source_system", source).in("external_vehicle_id", ids).eq("status", "live");
  const dealerUser = Deno.env.get(`WEBSITE_MEDIA_DEALER_${envSuffix(target)}`);
  if (dealerUser) q = q.eq("user_id", dealerUser);
  const { data, error } = await q;
  if (error) throw error;
  const rows = ((data || []) as PublicationRow[]).filter((r) => r.live_snapshot);
  // Internal storage metadata check (no external HEAD requests): drop assets that no longer exist.
  let missing = new Set<string>();
  const urls = collectUrls(rows);
  if (urls.length) {
    const { data: m, error: mErr } = await admin.rpc("website_media_missing_urls", { _urls: urls });
    if (!mErr && Array.isArray(m)) missing = new Set(m as string[]);
    else if (mErr) console.log(`[website-media] event=missing_check_failed`);
  }
  return rows.map((r) => serializePublication(r, missing));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (req.method === "POST") {
    const raw = await req.text().catch(() => "");
    const parsed = parseBatchBody(raw);
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status);
    if (!authorized(req, parsed.target)) return json({ error: "unauthorized" }, 401);
    try {
      const pubs = parsed.ids.length ? await loadLive(parsed.target, parsed.source, parsed.ids) : [];
      const found = new Set(pubs.map((p) => p.externalVehicleId));
      console.log(`[website-media] event=batch target=${parsed.target} requested=${parsed.ids.length} live=${pubs.length}`);
      return json({ publications: pubs, notPublished: parsed.ids.filter((id) => !found.has(id)) }, 200,
        { "Cache-Control": "private, max-age=60" });
    } catch {
      return json({ error: "server_error" }, 500);
    }
  }

  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const url = new URL(req.url);
  const target = (url.searchParams.get("target") || "").toLowerCase();
  const source = (url.searchParams.get("source") || "auto3").toLowerCase();
  const extId = (url.searchParams.get("externalVehicleId") || "").trim();
  if (!/^[a-z0-9_-]{2,40}$/.test(target) || !/^[a-z0-9_-]{2,40}$/.test(source) || !extId || extId.length > 100) {
    return json({ error: "invalid_parameters" }, 400);
  }
  if (!authorized(req, target)) return json({ error: "unauthorized" }, 401);

  try {
    const [pub] = await loadLive(target, source, [extId]);
    if (!pub) return json({ error: "not_published" }, 404, { "Cache-Control": "no-store" });
    return json(pub, 200, { "Cache-Control": "public, max-age=60", ETag: `"v${pub.version}"` });
  } catch {
    return json({ error: "server_error" }, 500);
  }
});
