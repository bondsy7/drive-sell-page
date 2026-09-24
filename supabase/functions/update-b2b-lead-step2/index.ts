import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOLUME_SCORE: Record<string, number> = {
  "1-10": 5, "11-25": 10, "26-50": 15, "51-100": 20, "101-200": 25, "200+": 30,
};
const LOCATION_SCORE: Record<string, number> = {
  "1": 5, "2-5": 10, "6-10": 15, "11-25": 20, "26-50": 25, "50+": 30,
};
const ROLE_SCORE: Record<string, number> = {
  geschaeftsfuehrung: 15, gebrauchtwagenleitung: 15, ecommerce: 15,
  verkaufsleitung: 12, marketing: 12, disposition: 8, sonstiges: 5,
};

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function normalizeWebsite(raw: string): string | null {
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString().slice(0, 300) : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const b = await req.json().catch(() => ({}));
    const leadId = clean(b.leadId, 40);
    const token = clean(b.token, 40);
    if (!UUID_RE.test(leadId) || !UUID_RE.test(token)) return json({ error: "Ungültige Anfrage." }, 400);

    const firstName = clean(b.first_name, 80);
    const lastName = clean(b.last_name, 80);
    const role = clean(b.role, 40);
    const volume = clean(b.monthly_vehicle_volume, 20);
    const locations = clean(b.location_count, 20);
    const phone = clean(b.phone, 40);
    const note = clean(b.note, 500);
    const websiteRaw = clean(b.website, 300);

    const errors: string[] = [];
    if (!firstName) errors.push("Vorname fehlt.");
    if (!lastName) errors.push("Nachname fehlt.");
    if (!ROLE_SCORE[role]) errors.push("Rolle ist ungültig.");
    if (volume && !VOLUME_SCORE[volume]) errors.push("Fahrzeugvolumen ist ungültig.");
    if (locations && !LOCATION_SCORE[locations]) errors.push("Anzahl Standorte ist ungültig.");
    const website = normalizeWebsite(websiteRaw);
    if (websiteRaw && !website) errors.push("Website ist ungültig.");
    if (errors.length) return json({ error: errors.join(" ") }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: lead } = await supabase
      .from("b2b_marketing_leads")
      .select("id, step2_token, monthly_vehicle_volume, location_count, step2_completed_at")
      .eq("id", leadId)
      .maybeSingle();
    if (!lead || lead.step2_token !== token) return json({ error: "Anfrage nicht gefunden." }, 404);
    if (lead.step2_completed_at) return json({ success: true, alreadyCompleted: true });

    const finalVolume = volume || lead.monthly_vehicle_volume;
    const finalLocations = locations || lead.location_count;
    let score = (VOLUME_SCORE[finalVolume] ?? 0) + (LOCATION_SCORE[finalLocations] ?? 0) + ROLE_SCORE[role];
    if (website) score += 5;
    if (phone) score += 5;
    score = Math.min(score, 85);
    const leadClass = score >= 65 ? "hot" : score >= 40 ? "warm" : "standard";

    const { error } = await supabase.from("b2b_marketing_leads").update({
      first_name: firstName,
      last_name: lastName,
      role,
      monthly_vehicle_volume: finalVolume,
      location_count: finalLocations,
      website,
      phone: phone || null,
      note: note || null,
      lead_score: score,
      lead_class: leadClass,
      step2_completed_at: new Date().toISOString(),
    }).eq("id", leadId);
    if (error) {
      console.error("[update-b2b-lead-step2] update failed", error);
      return json({ error: "Angaben konnten nicht gespeichert werden." }, 500);
    }

    await supabase.from("marketing_events").insert({
      event_name: "lead_details_completed",
      event_id: `lead_details_completed:${leadId}`,
      lead_id: leadId,
      source: "server",
      metadata: { lead_class: leadClass },
    });

    return json({ success: true });
  } catch (err) {
    console.error("[update-b2b-lead-step2] unexpected error", err);
    return json({ error: "Serverfehler." }, 500);
  }
});
