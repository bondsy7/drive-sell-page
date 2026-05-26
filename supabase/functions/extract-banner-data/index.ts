// Extracts banner-relevant fields (headline, subline, price, …) from a single
// vehicle data-sheet image (PNG/JPG/WebP). For PDFs, the frontend invokes the
// existing `analyze-pdf` function and maps its richer output – this endpoint is
// intentionally lean and image-only.
//
// ISOLATION: dedicated to Canvas Banner Studio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";

const PROMPT = `Du bist Werbetexter:in für Auto-Banner. Du erhältst das Foto/Scan eines Fahrzeug-Datenblatts oder Angebots.
Ziel: kompakter, verkaufsfördernder Banner – auf einen Blick muss klar sein, worum es geht (Marke/Modell, Angebotsart, Preis-Hook, CTA).

Erkenne zuerst:
- Angebotsart: Leasing | Finanzierung | Barkauf (Kauf/Hauspreis). Hinweise: "mtl.", "monatlich", "Rate", "Leasingsonderzahlung", "Restwert", "Sollzins", "eff. Jahreszins", "Anzahlung", "Hauspreis".
- Kundentyp: private (brutto, "inkl. MwSt.") oder business (netto, "zzgl. MwSt.", "Gewerbeleasing").

Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown.

Schema:
{
  "brand": "Marke (z.B. 'Volkswagen', 'BMW') – nie das Modell. Offizieller Name (Volkswagen statt VW).",
  "headline": "MARKE MODELL in GROSSBUCHSTABEN, knapp & werblich, max 28 Zeichen.",
  "subline": "Angebots-Hook mit Anbieter. Nutze Shortcode {{firma}} statt eines erfundenen Händlernamens. Beispiele: 'Leasingangebot von {{firma}}', 'Top-Finanzierung von {{firma}}', 'Hauspreis bei {{firma}}', 'Jahreswagen-Deal bei {{firma}}'. Max 50 Zeichen.",
  "price": "Stärkste Preisaussage in 1 Zeile. Leasing/Finanzierung: 'ab 249 € mtl.' – bei Gewerbe IMMER ' zzgl. MwSt.' anhängen, bei Privat OHNE Zusatz. Barkauf: '29.990 €' (oder 'nur 29.990 €'). Max 36 Zeichen.",
  "cta": "Kurzer aktiver Call-to-Action, max 22 Zeichen. Beispiele: 'Jetzt Probefahrt!', 'Jetzt sichern', 'Heute anfragen', 'Termin sichern'. Kein Punkt am Ende, gerne Ausrufezeichen.",
  "smallInfo": "Faktencluster mit ' · ' getrennt. Leasing/Finanzierung: 'Laufzeit · km/Jahr · Anzahlung' z.B. '48 Mon. · 10.000 km · 0 € Anzahlung'. Barkauf: 'EZ · km · Leistung' z.B. 'EZ 2022 · 35.000 km · 150 PS'. Max 70 Zeichen.",
  "legalText": "Einzeilige Pflichtangabe in Kurzform. Reihenfolge: Verbrauch komb. X l/100km · CO₂ Y g/km · Klasse Z. Bei PHEV zusätzlich Stromverbrauch. Max 240 Zeichen."
}

Regeln:
- Keine generischen Floskeln ('Top-Angebot', 'Sensationspreis' alleine). Immer konkret mit Zahl/Modell.
- Niemals Felder erfinden – fehlt eine Information, liefere "" für genau dieses Feld.
- Verwende Shortcodes wenn sinnvoll: {{firma}}, {{telefon}}, {{stadt}}. Niemals Platzhalter wie '[Händler]'.
- Keine Markdown-Sterne, keine Emojis, keine Anführungszeichen um Werte.`;

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return errorResponse("missing auth token", 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: claims, error: authErr } = await sb.auth.getClaims(token);
    if (authErr || !claims?.claims?.sub) return errorResponse("unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const fileDataUrl: string | undefined = body?.fileDataUrl;
    if (!fileDataUrl) return errorResponse("fileDataUrl required", 400);

    const m = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return errorResponse("invalid fileDataUrl", 400);
    const inMime = m[1];
    const inB64 = m[2];

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY missing", 500);

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: inMime, data: inB64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
    let r: Response | null = null;
    let lastStatus = 0;
    let lastBody = "";
    outer: for (const model of models) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (resp.ok) { r = resp; break outer; }
        lastStatus = resp.status;
        lastBody = await resp.text();
        console.warn(`gemini ${model} attempt ${attempt + 1} -> ${resp.status}`);
        if (resp.status !== 429 && resp.status < 500) break;
        await new Promise((res) => setTimeout(res, 600 * (attempt + 1)));
      }
    }
    if (!r) {
      console.error("gemini extract-banner-data exhausted", lastStatus, lastBody.slice(0, 400));
      return jsonResponse({
        fallback: true,
        error: lastStatus >= 500 || lastStatus === 429 ? "GEMINI_UNAVAILABLE" : `gemini_${lastStatus}`,
        fields: {
          brand: "", headline: "", subline: "", price: "", cta: "", smallInfo: "", legalText: "",
        },
      });
    }
    const json = await r.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "{}";

    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/```json|```/g, "").trim();
      try { parsed = JSON.parse(cleaned); } catch {
        return errorResponse("could not parse model response", 502);
      }
    }

    const out = {
      brand: String(parsed.brand ?? "").slice(0, 40).trim(),
      headline: String(parsed.headline ?? "").slice(0, 60),
      subline: String(parsed.subline ?? "").slice(0, 80),
      price: String(parsed.price ?? "").slice(0, 40),
      cta: String(parsed.cta ?? "").slice(0, 40),
      smallInfo: String(parsed.smallInfo ?? "").slice(0, 80),
      legalText: String(parsed.legalText ?? "").slice(0, 240),
    };

    return jsonResponse({ fields: out });
  } catch (e) {
    console.error("extract-banner-data error", e);
    return errorResponse(e instanceof Error ? e.message : "unknown error", 500);
  }
});
