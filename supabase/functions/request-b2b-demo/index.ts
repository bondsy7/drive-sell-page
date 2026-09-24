import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
    const preferredContact = typeof body.preferredContact === "string"
      ? body.preferredContact.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 300)
      : "";

    if (!UUID_RE.test(leadId)) return json({ error: "Ungültige Anfrage." }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lead } = await supabase
      .from("b2b_marketing_leads")
      .select("id, note, status")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) return json({ error: "Anfrage nicht gefunden." }, 404);

    const noteSuffix = preferredContact ? `\n[Demo-Wunsch] ${preferredContact}` : "";
    const { error } = await supabase
      .from("b2b_marketing_leads")
      .update({
        demo_requested: true,
        // Nur ein Wunsch – "demo_booked" setzt erst der Vertrieb mit Termin.
        ...(["new", "validated", "contacted"].includes(lead.status) ? { status: "demo_requested" } : {}),
        note: `${lead.note ?? ""}${noteSuffix}`.trim().slice(0, 1200) || null,
      })
      .eq("id", leadId);

    if (error) {
      console.error("[request-b2b-demo] update failed", error);
      return json({ error: "Demo-Anfrage konnte nicht gespeichert werden." }, 500);
    }

    await supabase.from("marketing_events").insert({
      event_name: "demo_requested",
      event_id: `demo_requested:${leadId}`,
      lead_id: leadId,
      source: "server",
    });

    console.log(`[request-b2b-demo] event=demo_requested lead=${leadId}`);
    return json({ success: true });
  } catch (err) {
    console.error("[request-b2b-demo] unexpected error", err);
    return json({ error: "Serverfehler." }, 500);
  }
});
