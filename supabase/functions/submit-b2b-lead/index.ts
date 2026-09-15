import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const VOLUME_SCORE: Record<string, number> = {
  "1-10": 5,
  "11-25": 10,
  "26-50": 15,
  "51-100": 20,
  "101-200": 25,
  "200+": 30,
};

const LOCATION_SCORE: Record<string, number> = {
  "1": 5,
  "2-5": 10,
  "6-10": 15,
  "11-25": 20,
  "26-50": 25,
  "50+": 30,
};

const ROLE_SCORE: Record<string, number> = {
  geschaeftsfuehrung: 15,
  gebrauchtwagenleitung: 15,
  ecommerce: 15,
  verkaufsleitung: 12,
  marketing: 12,
  disposition: 8,
  sonstiges: 5,
};

const ALLOWED_GOALS = [
  "fahrzeugbilder",
  "showroom",
  "schneller-online",
  "social-banner",
  "video",
  "landingpages",
  "spin360",
  "multi-standort",
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

function normalizeWebsite(raw: string): { valid: boolean; value: string } {
  if (!raw) return { valid: false, value: "" };
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) return { valid: false, value: candidate };
    return { valid: true, value: url.toString().slice(0, 300) };
  } catch {
    return { valid: false, value: candidate.slice(0, 300) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();

    // Honeypot – silently accept but do not store
    const honeypot = clean(form.get("company_website_confirm"), 200);
    if (honeypot) return json({ success: true });

    const companyName = clean(form.get("company_name"), 160);
    const firstName = clean(form.get("first_name"), 80);
    const lastName = clean(form.get("last_name"), 80);
    const businessEmail = clean(form.get("business_email"), 255).toLowerCase();
    const websiteRaw = clean(form.get("website"), 300);
    const phone = clean(form.get("phone"), 40);
    const volume = clean(form.get("monthly_vehicle_volume"), 20);
    const locations = clean(form.get("location_count"), 20);
    const role = clean(form.get("role"), 40);
    const note = clean(form.get("note"), 500);
    // Datenschutzhinweis ist Information, keine Einwilligung (Art. 6 Abs. 1 lit. b/f DSGVO).
    // Der Wert wird nur noch als neutraler Audit-Hinweis übernommen, falls das Formular ihn sendet.
    const privacyNoticeShown = clean(form.get("privacy_consent"), 10) === "true";
    void privacyNoticeShown;

    let goals: string[] = [];
    try {
      const parsed = JSON.parse(clean(form.get("goals"), 600) || "[]");
      if (Array.isArray(parsed)) {
        goals = parsed
          .filter((g): g is string => typeof g === "string" && ALLOWED_GOALS.includes(g))
          .slice(0, ALLOWED_GOALS.length);
      }
    } catch {
      goals = [];
    }

    const errors: string[] = [];
    if (!companyName) errors.push("Autohaus / Unternehmen fehlt.");
    if (!firstName) errors.push("Vorname fehlt.");
    if (!lastName) errors.push("Nachname fehlt.");
    if (!isValidEmail(businessEmail)) errors.push("Geschäftliche E-Mail ist ungültig.");
    if (!VOLUME_SCORE[volume]) errors.push("Fahrzeugvolumen ist ungültig.");
    if (!LOCATION_SCORE[locations]) errors.push("Anzahl Standorte ist ungültig.");
    if (!ROLE_SCORE[role]) errors.push("Rolle ist ungültig.");

    const website = normalizeWebsite(websiteRaw);
    if (!website.valid) errors.push("Website ist ungültig.");

    const file = form.get("image");
    if (!(file instanceof File)) {
      errors.push("Fahrzeugbild fehlt.");
    } else {
      if (!ALLOWED_MIME[file.type]) errors.push("Bildformat muss JPG, PNG oder WebP sein.");
      if (file.size > MAX_IMAGE_BYTES) errors.push("Bild ist größer als 8 MB.");
      if (file.size === 0) errors.push("Bilddatei ist leer.");
    }

    if (errors.length > 0) return json({ error: errors.join(" ") }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Simple abuse brake: max 3 submissions per e-mail within 15 minutes
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("b2b_marketing_leads")
      .select("id", { count: "exact", head: true })
      .eq("business_email", businessEmail)
      .gte("created_at", since);
    if ((recentCount ?? 0) >= 3) {
      return json({ error: "Zu viele Einsendungen. Bitte versuchen Sie es später erneut." }, 429);
    }

    // Upload image with a server-generated file name
    const image = file as File;
    const ext = ALLOWED_MIME[image.type];
    const storagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await image.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return json({ error: "Bild ist größer als 8 MB." }, 400);
    }

    const { error: uploadError } = await supabase.storage
      .from("b2b-test-uploads")
      .upload(storagePath, bytes, { contentType: image.type, upsert: false });
    if (uploadError) {
      console.error("[submit-b2b-lead] upload failed", uploadError);
      return json({ error: "Bild konnte nicht gespeichert werden." }, 500);
    }

    let score = VOLUME_SCORE[volume] + LOCATION_SCORE[locations] + ROLE_SCORE[role];
    if (website.valid) score += 5;
    if (phone) score += 5;
    score = Math.min(score, 85);
    const leadClass = score >= 65 ? "hot" : score >= 40 ? "warm" : "standard";

    const attribution = (key: string) => clean(form.get(key), 300) || null;

    const { data: inserted, error: insertError } = await supabase
      .from("b2b_marketing_leads")
      .insert({
        company_name: companyName,
        first_name: firstName,
        last_name: lastName,
        business_email: businessEmail,
        website: website.value,
        phone: phone || null,
        monthly_vehicle_volume: volume,
        location_count: locations,
        role,
        goals,
        note: note || null,
        uploaded_image_path: storagePath,
        lead_score: score,
        lead_class: leadClass,
        utm_source: attribution("utm_source"),
        utm_medium: attribution("utm_medium"),
        utm_campaign: attribution("utm_campaign"),
        utm_content: attribution("utm_content"),
        utm_term: attribution("utm_term"),
        gclid: attribution("gclid"),
        msclkid: attribution("msclkid"),
        fbclid: attribution("fbclid"),
        li_fat_id: attribution("li_fat_id"),
        landing_page: attribution("landing_page"),
        first_referrer: attribution("first_referrer"),
        source_label: clean(form.get("source_label"), 60) || "paid_funnel",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[submit-b2b-lead] insert failed", insertError);
      return json({ error: "Anfrage konnte nicht gespeichert werden." }, 500);
    }

    console.log(`[submit-b2b-lead] event=created lead=${inserted.id} class=${leadClass} score=${score}`);
    return json({ success: true, leadId: inserted.id });
  } catch (err) {
    console.error("[submit-b2b-lead] unexpected error", err);
    return json({ error: "Serverfehler." }, 500);
  }
});
