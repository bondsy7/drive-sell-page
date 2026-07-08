// Generates a platform-tailored social media caption using Gemini.
// Uses the user's profile + optional vehicle record + banner image as context.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getSecret } from "../_shared/get-secret.ts";

type Platform = "instagram" | "facebook";
type Format = "image" | "video" | "reel" | "carousel";
type Tone = "seriös" | "verkaufsstark" | "kurz" | "locker" | "premium";

interface Payload {
  platform: Platform;
  format?: Format;
  tone?: Tone;
  imageUrl?: string;
  vehicleId?: string | null;
  bannerName?: string;
}

const TONE_HINTS: Record<Tone, string> = {
  "seriös": "Sachlich, seriös, vertrauensvoll. Keine Marktschreierei.",
  "verkaufsstark": "Verkaufsstark, überzeugend, mit klarem Nutzenversprechen und starkem CTA.",
  "kurz": "Extrem knapp, maximal 2-3 kurze Sätze plus Hashtags. Direkt auf den Punkt.",
  "locker": "Locker, freundlich, nahbar. Duzen erlaubt, aber nicht albern.",
  "premium": "Hochwertig, elegant, exklusiv. Wortwahl wie in Premium-Automobilmarketing.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsErr || !userId) return json({ error: "unauthorized" }, 401);

    const body = (await req.json().catch(() => null)) as Payload | null;
    if (!body?.platform) return json({ error: "missing_platform" }, 400);

    const platform: Platform = body.platform;
    const format: Format = body.format ?? "image";
    const tone: Tone = body.tone ?? "verkaufsstark";

    // ── Gather context ───────────────────────────────────────
    const [profileRes, vehicleRes] = await Promise.all([
      admin.from("profiles").select(
        "company_name, contact_name, phone, website, address, postal_code, city, whatsapp_number, facebook_url, instagram_url",
      ).eq("id", userId).maybeSingle(),
      body.vehicleId
        ? admin.from("vehicles").select("*").eq("id", body.vehicleId).eq("user_id", userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const profile = profileRes.data ?? {};
    const vehicle: any = (vehicleRes as any).data ?? null;
    const v = vehicle?.vehicle_data ?? vehicle ?? {};

    const dealerLines: string[] = [];
    if (profile.company_name) dealerLines.push(`Firma: ${profile.company_name}`);
    if (profile.city) dealerLines.push(`Standort: ${[profile.postal_code, profile.city].filter(Boolean).join(" ")}`);
    if (profile.website) dealerLines.push(`Website: ${profile.website}`);
    if (profile.phone) dealerLines.push(`Telefon: ${profile.phone}`);
    if (profile.whatsapp_number) dealerLines.push(`WhatsApp: ${profile.whatsapp_number}`);

    const vehicleLines: string[] = [];
    const push = (k: string, val: any) => { if (val !== undefined && val !== null && String(val).trim()) vehicleLines.push(`${k}: ${val}`); };
    push("Marke", v.make || v.brand);
    push("Modell", v.model);
    push("Variante", v.variant || v.trim);
    push("Erstzulassung", v.first_registration || v.registration_date);
    push("Kilometerstand", v.mileage);
    push("Leistung", v.power_kw ? `${v.power_kw} kW` : v.power_hp ? `${v.power_hp} PS` : null);
    push("Kraftstoff", v.fuel_type || v.fuel);
    push("Getriebe", v.transmission);
    push("Farbe", v.color || v.exterior_color);
    push("Preis", v.price);

    // ── Prompt ───────────────────────────────────────────────
    const platformRules = platform === "instagram"
      ? `INSTAGRAM (${format}):
- Kurz, aufmerksamkeitsstark, erste Zeile ist ein starker Hook.
- 4-8 relevante Hashtags am Ende (Automobil-/Standort-/Modell-Tags).
- Klarer CTA (z. B. "Jetzt anfragen", "Link in Bio", "DM für Details").
- Keine URLs im Fließtext, Instagram klickt sie nicht.
- ${format === "reel" || format === "video" ? "Erste Zeile knallharter Hook (max. 6 Wörter). Danach 2-3 kurze Sätze." : "Maximal ~150 Wörter."}`
      : `FACEBOOK (${format}):
- Etwas ausführlicher, informativ, mit klarem Anfrage-CTA.
- Fahrzeug-Highlights aufzählen (Bulletpoints mit Emojis wie ✅ oder •).
- Website-Link/Kontakt am Ende einbinden.
- 2-4 dezente Hashtags am Ende.
- ${format === "reel" || format === "video" ? "Erste Zeile ist der Hook, dann 3-4 Sätze mit Details." : "Maximal ~220 Wörter."}`;

    const promptText = `Du bist ein erfahrener Automotive-Social-Media-Manager. Erstelle EINEN fertigen Post auf Deutsch.

TONE: ${tone.toUpperCase()} — ${TONE_HINTS[tone]}

${platformRules}

FAHRZEUGDATEN (bevorzugt gegenüber Bildanalyse verwenden, wenn vorhanden):
${vehicleLines.length ? vehicleLines.join("\n") : "(keine strukturierten Daten – nutze sichtbare Infos aus dem Bild)"}

HÄNDLER-KONTEXT:
${dealerLines.length ? dealerLines.join("\n") : "(kein Händlerprofil hinterlegt)"}

BILD/BANNER: ${body.bannerName ?? "Marketing-Banner"} — beachte auch sichtbare Details im angehängten Bild, aber erfinde keine Fakten.

REGELN:
- Keine erfundenen Fakten, Preise oder Ausstattungen.
- Keine Emojis übertreiben (max. 4-6 sinnvolle).
- Keine Anführungszeichen um den Post.
- Antwort ist AUSSCHLIESSLICH der fertige Post-Text, kein Vor-/Nachspann, keine Erklärungen.`;

    const parts: any[] = [{ text: promptText }];
    if (body.imageUrl && /^https?:\/\//i.test(body.imageUrl)) {
      // fetch and inline
      try {
        const imgRes = await fetch(body.imageUrl);
        if (imgRes.ok) {
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          const mime = imgRes.headers.get("content-type") || "image/jpeg";
          // Base64 encode
          let bin = "";
          const chunk = 0x8000;
          for (let i = 0; i < buf.length; i += chunk) {
            bin += String.fromCharCode(...buf.subarray(i, i + chunk));
          }
          const b64 = btoa(bin);
          parts.push({ inline_data: { mime_type: mime, data: b64 } });
        }
      } catch { /* image is optional context */ }
    }

    const geminiKey = await getSecret("GEMINI_API_KEY", admin);
    if (!geminiKey) return json({ error: "gemini_key_missing" }, 500);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 800 },
        }),
      },
    );
    const gj = await geminiRes.json().catch(() => ({}));
    if (!geminiRes.ok) {
      console.error("[generate-social-caption] gemini error", gj);
      return json({ error: "gemini_failed", detail: gj?.error?.message ?? "unknown" }, 502);
    }

    const caption: string = gj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("").trim() ?? "";
    if (!caption) return json({ error: "empty_response" }, 502);

    return json({ caption, platform, format, tone });
  } catch (e) {
    console.error("[generate-social-caption]", e);
    return json({ error: "internal_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
