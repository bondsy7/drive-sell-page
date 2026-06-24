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

ABSOLUT KRITISCH – KEINE BEISPIELZAHLEN ÜBERNEHMEN:
- Verwende AUSSCHLIESSLICH Zahlen, Preise, Raten und Laufzeiten, die du tatsächlich im Bild siehst.
- NIEMALS Beispielwerte wie "249", "199", "5.000", "3.500" o.ä. aus dieser Anleitung übernehmen – das sind nur Formatbeispiele.
- Wenn eine Zahl im Bild fehlt, liefere für das betroffene Feld einen leeren String "" oder eine Formulierung ohne Zahl.

Erkenne zuerst die ANGEBOTSART (sehr sorgfältig, NICHT raten):
- Leasing → NUR wenn klar "Leasing", "Leasingrate", "Leasingsonderzahlung", "Restwert" im Bild steht UND eine monatliche Rate sichtbar ist.
- Finanzierung → NUR wenn "Finanzierung", "Sollzins", "eff. Jahreszins", "Kredit", "Schlussrate" sichtbar ist UND eine monatliche Rate steht.
- Barkauf → STANDARD, wenn nur ein Gesamt-/Hauspreis sichtbar ist (z.B. "Preis: 114.100 €", "Barpreis", "Kaufpreis", "€ 29.990,-") und KEINE monatliche Rate. Im Zweifel IMMER Barkauf.

Kundentyp: private (brutto) oder business (netto, "zzgl. MwSt.", "Gewerbeleasing").

Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown.

Schema:
{
  "brand": "Marke wie 'Volkswagen', 'BMW' – nie das Modell. Offizieller Name (Volkswagen statt VW).",
  "headline": "MARKE MODELL in GROSSBUCHSTABEN, knapp & werblich, max 28 Zeichen.",
  "subline": "Kontextabhängiger Hook mit ECHTEN Daten aus dem Bild. Nutze {{firma}} statt erfundener Händlernamen. Format-Vorlagen (Zahlen NUR ersetzen wenn im Bild vorhanden, sonst Variante ohne Zahl wählen):\\n• Leasing mit Rate+Laufzeit: 'Leasing ab <RATE> mtl. bei <N> Monaten'\\n• Leasing mit Anzahlung: 'Leasing mit <ANZAHLUNG> Anzahlung bei {{firma}}'\\n• Leasing ohne Daten: 'Attraktives Leasingangebot von {{firma}}'\\n• Finanzierung mit Rate+Laufzeit: 'Finanzierung ab <RATE> mtl. bei <N> Monaten'\\n• Finanzierung mit Zins: 'Finanzierung ab <X>% eff. Jahreszins'\\n• Finanzierung ohne Daten: 'Finanzierung mit starken Konditionen bei {{firma}}'\\n• Barkauf mit Preisvorteil: 'Jetzt mit <BETRAG> Preisvorteil bei {{firma}}'\\n• Barkauf mit Listenpreis: 'Statt <UVP> Listenpreis bei {{firma}}'\\n• Barkauf Standard: 'Sofort verfügbar bei {{firma}}'\\nMax 60 Zeichen.",
  "price": "Stärkste Preisaussage in 1 Zeile, NUR mit Zahlen aus dem Bild. Leasing/Finanzierung: 'ab <RATE> mtl.' (bei Gewerbe ' zzgl. MwSt.' anhängen). Barkauf: 'Barpreis <PREIS>' (z.B. den im Bild gezeigten Gesamtpreis). Max 36 Zeichen.",
  "cta": "Kurzer aktiver CTA, max 22 Zeichen. Leasing: 'Jetzt Rate sichern' / 'Leasing anfragen'. Finanzierung: 'Jetzt finanzieren' / 'Rate berechnen'. Barkauf: 'Jetzt sichern' / 'Verfügbarkeit prüfen' / 'Probefahrt anfragen'. Kein Punkt am Ende.",
  "smallInfo": "Faktencluster mit ' · ' aus echten Werten. Leasing/Finanzierung: 'Laufzeit · km/Jahr · Anzahlung'. Barkauf: 'EZ · km · Leistung' (z.B. 'EZ 2023 · 12.500 km · 530 PS'). Max 70 Zeichen.",
  "legalText": "Einzeilige Pflichtangabe in Kurzform aus den echten Verbrauchsdaten. Reihenfolge: Verbrauch komb. X l/100km · CO₂ Y g/km · Klasse Z. Max 240 Zeichen."
}

Regeln:
- Niemals Felder oder Zahlen erfinden – fehlt eine Information, liefere "" oder eine Variante ohne Zahl.
- Bei reinem Barkauf-Exposé NIEMALS eine Leasing- oder Finanzierungs-Subline/Preisaussage liefern.
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

    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-pro",
    ];
    let r: Response | null = null;
    let lastStatus = 0;
    let lastBody = "";
    outer: for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
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
        // 503 (overloaded) / 429 (rate limit) -> try next model immediately, don't waste time retrying same
        if (resp.status === 503 || resp.status === 429) break;
        if (resp.status < 500) break;
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
      }
    }

    // Fallback: OpenAI Vision (gpt-4o-mini) when all Gemini models overloaded
    let openaiText: string | null = null;
    if (!r) {
      const openaiKey = await getSecret("OPENAI_API_KEY");
      if (openaiKey) {
        try {
          console.warn("gemini exhausted, falling back to OpenAI gpt-4o-mini vision");
          const oResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: PROMPT },
                    { type: "image_url", image_url: { url: fileDataUrl } },
                  ],
                },
              ],
            }),
          });
          if (oResp.ok) {
            const oj = await oResp.json();
            openaiText = oj?.choices?.[0]?.message?.content ?? null;
          } else {
            const ob = await oResp.text();
            console.error("openai fallback failed", oResp.status, ob.slice(0, 300));
          }
        } catch (e) {
          console.error("openai fallback threw", e);
        }
      }
    }

    if (!r && !openaiText) {
      console.error("extract-banner-data all providers exhausted", lastStatus, lastBody.slice(0, 400));
      return jsonResponse({
        fallback: true,
        error: lastStatus >= 500 || lastStatus === 429 ? "AI_UNAVAILABLE" : `gemini_${lastStatus}`,
        fields: {
          brand: "", headline: "", subline: "", price: "", cta: "", smallInfo: "", legalText: "",
        },
      });
    }

    const json = r ? await r.json() : null;
    const text: string = openaiText
      ?? (json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "{}");


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
