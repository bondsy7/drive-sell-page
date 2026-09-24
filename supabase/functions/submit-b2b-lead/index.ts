import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Schritt 1 des B2B-Funnels.
 * funnel_type=vehicle_test  → E-Mail, Firma, Ziel(e), Fahrzeugbild
 * funnel_type=process_check → E-Mail, Firma, Standorte, Volumen (ohne Upload, für Gruppen)
 * Name, Rolle usw. folgen in Schritt 2 (update-b2b-lead-step2).
 */

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const VOLUME_SCORE: Record<string, number> = {
  "1-10": 5, "11-25": 10, "26-50": 15, "51-100": 20, "101-200": 25, "200+": 30,
};
export const LOCATION_SCORE: Record<string, number> = {
  "1": 5, "2-5": 10, "6-10": 15, "11-25": 20, "26-50": 25, "50+": 30,
};

const ALLOWED_GOALS = [
  "fahrzeugbilder", "showroom", "schneller-online", "social-banner",
  "video", "landingpages", "spin360", "multi-standort",
];

const ATTR_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "gclid", "gbraid", "wbraid", "msclkid", "fbclid", "li_fat_id",
  "landing_page", "first_referrer",
];

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email) && email.length <= 255;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();

    const honeypot = clean(form.get("company_website_confirm"), 200);
    if (honeypot) return json({ success: true });

    const funnelType = clean(form.get("funnel_type"), 30) === "process_check" ? "process_check" : "vehicle_test";
    const companyName = clean(form.get("company_name"), 160);
    const businessEmail = clean(form.get("business_email"), 255).toLowerCase();
    const volume = clean(form.get("monthly_vehicle_volume"), 20);
    const locations = clean(form.get("location_count"), 20);

    let goals: string[] = [];
    try {
      const parsed = JSON.parse(clean(form.get("goals"), 600) || "[]");
      if (Array.isArray(parsed)) {
        goals = parsed.filter((g): g is string => typeof g === "string" && ALLOWED_GOALS.includes(g));
      }
    } catch { goals = []; }

    const errors: string[] = [];
    if (!companyName) errors.push("Autohaus / Unternehmen fehlt.");
    if (!isValidEmail(businessEmail)) errors.push("Geschäftliche E-Mail ist ungültig.");

    const file = form.get("image");
    if (funnelType === "vehicle_test") {
      if (goals.length === 0) errors.push("Bitte mindestens ein Ziel auswählen.");
      if (!(file instanceof File)) {
        errors.push("Fahrzeugbild fehlt.");
      } else {
        if (!ALLOWED_MIME[file.type]) errors.push("Bildformat muss JPG, PNG oder WebP sein.");
        if (file.size > MAX_IMAGE_BYTES) errors.push("Bild ist größer als 8 MB.");
        if (file.size === 0) errors.push("Bilddatei ist leer.");
      }
    } else {
      if (!VOLUME_SCORE[volume]) errors.push("Fahrzeugvolumen ist ungültig.");
      if (!LOCATION_SCORE[locations]) errors.push("Anzahl Standorte ist ungültig.");
    }

    if (errors.length > 0) return json({ error: errors.join(" ") }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("b2b_marketing_leads")
      .select("id", { count: "exact", head: true })
      .eq("business_email", businessEmail)
      .gte("created_at", since);
    if ((recentCount ?? 0) >= 3) {
      return json({ error: "Zu viele Einsendungen. Bitte versuchen Sie es später erneut." }, 429);
    }

    let storagePath: string | null = null;
    if (funnelType === "vehicle_test") {
      const image = file as File;
      const ext = ALLOWED_MIME[image.type];
      storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await image.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: "Bild ist größer als 8 MB." }, 400);
      const { error: uploadError } = await supabase.storage
        .from("b2b-test-uploads")
        .upload(storagePath, bytes, { contentType: image.type, upsert: false });
      if (uploadError) {
        console.error("[submit-b2b-lead] upload failed", uploadError);
        return json({ error: "Bild konnte nicht gespeichert werden." }, 500);
      }
    }

    let score = (VOLUME_SCORE[volume] ?? 0) + (LOCATION_SCORE[locations] ?? 0);
    score = Math.min(score, 85);
    const leadClass = score >= 65 ? "hot" : score >= 40 ? "warm" : "standard";

    const attr: Record<string, string | null> = {};
    for (const k of ATTR_KEYS) attr[k] = clean(form.get(k), 300) || null;

    let lastTouch: Record<string, string> | null = null;
    try {
      const raw = clean(form.get("last_touch"), 2000);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          lastTouch = {};
          for (const k of [...ATTR_KEYS, "captured_at"]) {
            const v = (parsed as Record<string, unknown>)[k];
            if (typeof v === "string" && v) lastTouch[k] = v.slice(0, 300);
          }
        }
      }
    } catch { lastTouch = null; }

    const { data: inserted, error: insertError } = await supabase
      .from("b2b_marketing_leads")
      .insert({
        funnel_type: funnelType,
        company_name: companyName,
        first_name: "",
        last_name: "",
        business_email: businessEmail,
        monthly_vehicle_volume: volume,
        location_count: locations,
        role: "",
        goals,
        uploaded_image_path: storagePath,
        lead_score: score,
        lead_class: leadClass,
        ...attr,
        last_touch: lastTouch,
        source_label: clean(form.get("source_label"), 60) || "paid_funnel",
      })
      .select("id, step2_token")
      .single();

    if (insertError) {
      console.error("[submit-b2b-lead] insert failed", insertError);
      return json({ error: "Anfrage konnte nicht gespeichert werden." }, 500);
    }

    await supabase.from("marketing_events").insert({
      event_name: "generate_lead",
      event_id: `generate_lead:${inserted.id}`,
      lead_id: inserted.id,
      source: "server",
      page: attr.landing_page,
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
      utm_content: attr.utm_content,
      utm_term: attr.utm_term,
      has_click_id: !!(attr.gclid || attr.gbraid || attr.wbraid || attr.msclkid || attr.fbclid || attr.li_fat_id),
      metadata: { funnel_type: funnelType },
    });

    console.log(`[submit-b2b-lead] event=created lead=${inserted.id} type=${funnelType}`);
    return json({ success: true, leadId: inserted.id, token: inserted.step2_token });
  } catch (err) {
    console.error("[submit-b2b-lead] unexpected error", err);
    return json({ error: "Serverfehler." }, 500);
  }
});
