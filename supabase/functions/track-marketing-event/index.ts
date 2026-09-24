import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/** Nimmt anonyme Funnel-Ereignisse entgegen. Keine personenbezogenen Daten. */
const ALLOWED = new Set([
  "page_view", "cta_click", "form_start", "vehicle_test_started",
  "demo_requested", "process_check_started",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  return s || null;
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const name = clean(b.event_name, 60);
    const eventId = clean(b.event_id, 120);
    if (!name || !ALLOWED.has(name) || !eventId) return json({ error: "Ungültiges Ereignis." }, 400);
    const leadId = clean(b.lead_id, 40);

    // Nur bekannte, nicht-personenbezogene Metadaten übernehmen
    const meta: Record<string, string> = {};
    const m = (b.metadata && typeof b.metadata === "object") ? b.metadata as Record<string, unknown> : {};
    for (const k of ["cta_id", "cta_label", "funnel_type", "step", "source"]) {
      const v = clean(m[k], 80);
      if (v) meta[k] = v;
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await supabase.from("marketing_events").insert({
      event_name: name,
      event_id: eventId,
      lead_id: leadId && UUID_RE.test(leadId) ? leadId : null,
      session_id: clean(b.session_id, 60),
      page: clean(b.page, 300),
      utm_source: clean(b.utm_source, 200),
      utm_medium: clean(b.utm_medium, 200),
      utm_campaign: clean(b.utm_campaign, 200),
      utm_content: clean(b.utm_content, 200),
      utm_term: clean(b.utm_term, 200),
      has_click_id: b.has_click_id === true,
      consent_analytics: b.consent_analytics === true,
      consent_marketing: b.consent_marketing === true,
      metadata: meta,
    });
    // Duplikat (gleiche event_id) ist kein Fehler
    if (error && error.code !== "23505") {
      console.error("[track-marketing-event] insert failed", error);
      return json({ error: "Ereignis nicht gespeichert." }, 500);
    }
    return json({ success: true });
  } catch (err) {
    console.error("[track-marketing-event] unexpected", err);
    return json({ error: "Serverfehler." }, 500);
  }
});
