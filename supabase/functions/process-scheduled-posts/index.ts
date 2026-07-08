// Cron-invoked processor: publishes scheduled social posts whose time has come.
// Called every minute by pg_cron. Uses the service role to bypass RLS and
// invokes `social-publish` internally on behalf of each row's owner.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const nowIso = new Date().toISOString();

  // Claim due rows atomically (pending → processing)
  const { data: due, error: dueErr } = await admin
    .from("scheduled_social_posts")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (dueErr) {
    console.error("[process-scheduled-posts] fetch failed", dueErr);
    return new Response(JSON.stringify({ error: dueErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const processed: Array<{ id: string; status: string }> = [];

  for (const row of due ?? []) {
    // Mark processing (skip if already claimed by another run)
    const { data: claimed, error: claimErr } = await admin
      .from("scheduled_social_posts")
      .update({ status: "processing", attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) continue;

    try {
      const publishRes = await fetch(`${SUPABASE_URL}/functions/v1/social-publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          internalUserId: row.user_id,
          mediaPath: row.media_path,
          mediaName: row.media_name,
          mediaUrl: row.media_url,
          mediaType: row.media_type,
          caption: row.caption,
          platforms: row.platforms,
          vehicleId: row.vehicle_id,
        }),
      });
      const payload = await publishRes.json().catch(() => ({}));
      const results = Array.isArray(payload?.results) ? payload.results : [];
      const anySuccess = results.some((r: any) => r.status === "success");

      await admin
        .from("scheduled_social_posts")
        .update({
          status: anySuccess ? "published" : "failed",
          results,
          last_error: anySuccess ? null : (payload?.error || payload?.detail || "publish_failed"),
          published_at: anySuccess ? new Date().toISOString() : null,
        })
        .eq("id", row.id);

      processed.push({ id: row.id, status: anySuccess ? "published" : "failed" });
    } catch (e) {
      console.error("[process-scheduled-posts] publish error", row.id, e);
      await admin
        .from("scheduled_social_posts")
        .update({ status: "failed", last_error: String((e as Error)?.message ?? e) })
        .eq("id", row.id);
      processed.push({ id: row.id, status: "failed" });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
