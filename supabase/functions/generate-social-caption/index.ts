// Generates a platform-tailored social media caption using Gemini.
// Uses the user's profile + optional vehicle record + banner image as context.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getSecret } from "../_shared/get-secret.ts";

type Platform = "instagram" | "facebook" | "x";
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
    const companyName = (profile as any).company_name?.trim() || "";
    const cityLine = [(profile as any).postal_code, (profile as any).city].filter(Boolean).join(" ").trim();
    const locationLabel = companyName && cityLine
      ? `${companyName} in ${cityLine}`
      : companyName || cityLine || "";

    const platformRules = platform === "instagram"
      ? `INSTAGRAM (${format}):
- Erste Zeile: knallharter Hook (max. 8 Wörter), emotional oder mit Zahl/Nutzen.
- Danach 2-4 kurze, kraftvolle Sätze mit klarem Verkaufsnutzen (Fahrgefühl, Ausstattung, Vorteil).
- Fahrzeug-Highlights mit Emojis wie ✅ ⚡️ 🔥 einbauen, aber sparsam (max. 4-6).
- Klarer CTA-Satz am Ende (z. B. "Jetzt Probefahrt sichern bei ${locationLabel || "uns"}", "DM für Details", "Link in Bio").
- 5-8 relevante Hashtags: Marke, Modell, Standort/Stadt, #Autohaus, #Gebrauchtwagen o. ä.
- Keine URLs im Fließtext.
- ${format === "reel" || format === "video" ? "Reel-Modus: Hook + max. 3 Sätze, extrem knackig." : "Post-Modus: max. ~150 Wörter."}`
      : `FACEBOOK (${format}):
- Erste Zeile: starker Aufmacher, der Neugier weckt.
- 3-5 Sätze Fließtext mit Verkaufsargumenten (Zustand, Ausstattung, Fahrspaß, Sicherheit).
- Danach Bulletpoint-Liste der wichtigsten Ausstattungs-Highlights (mit ✅ oder •).
- Klarer CTA-Absatz mit Firma + Standort: "Jetzt anfragen oder Probefahrt vereinbaren bei ${locationLabel || "uns"}."
- Website/Telefon/WhatsApp aus dem Händlerprofil am Ende einbinden, falls vorhanden.
- 3-5 dezente Hashtags am Ende.
- ${format === "reel" || format === "video" ? "Video-Modus: Hook + 3-5 Sätze + CTA." : "Post-Modus: max. ~220 Wörter."}`;

    const promptText = `Du bist ein Top-Automotive-Social-Media-Copywriter. Erstelle EINEN fertigen, verkaufsstarken Post auf Deutsch, der Aufmerksamkeit erzeugt, klar verkauft und den Leser zur Anfrage bewegt.

TONE: ${tone.toUpperCase()} — ${TONE_HINTS[tone]}

${platformRules}

FAHRZEUGDATEN (bevorzugt gegenüber Bildanalyse verwenden, wenn vorhanden):
${vehicleLines.length ? vehicleLines.join("\n") : "(keine strukturierten Daten – nutze sichtbare Infos aus dem Bild)"}

HÄNDLER-KONTEXT (MUSS im Post genannt werden):
${dealerLines.length ? dealerLines.join("\n") : "(kein Händlerprofil hinterlegt)"}

PFLICHT-ANGABE:
- Firma und Ort MÜSSEN im Post vorkommen, mindestens einmal in der Form "${locationLabel || "Firmenname in Stadt"}" (oder sehr ähnlich).
- Der Ort/Standort taucht zusätzlich in mindestens einem Hashtag auf (z. B. #${((profile as any).city || "Standort").toString().replace(/\s+/g, "")}).
- Wenn das Händlerprofil unvollständig ist, verwende die vorhandenen Angaben so wörtlich wie möglich und erfinde nichts.

BILD/BANNER: ${body.bannerName ?? "Marketing-Banner"} — beachte auch sichtbare Details im angehängten Bild, aber erfinde keine Fakten.

REGELN:
- Der Post muss verkaufsstark sein: konkreter Nutzen, klare Kaufmotive, aktive Sprache. KEINE laue "schauen Sie mal"-Formulierung.
- Keine erfundenen Fakten, Preise, Kilometerstände oder Ausstattungen.
- Emojis gezielt einsetzen (max. 4-6, keine Emoji-Wand).
- Keine Anführungszeichen um den Post.
- Antwort ist AUSSCHLIESSLICH der fertige Post-Text, kein Vor-/Nachspann, keine Erklärungen, keine Markdown-Fences.`;


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
