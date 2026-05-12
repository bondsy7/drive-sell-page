// Extracts banner-relevant fields (headline, subline, price, …) from a single
// vehicle data-sheet image (PNG/JPG/WebP). For PDFs, the frontend invokes the
// existing `analyze-pdf` function and maps its richer output – this endpoint is
// intentionally lean and image-only.
//
// ISOLATION: dedicated to Canvas Banner Studio.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";

const PROMPT = `Du erhältst das Foto/Scan eines Fahrzeug-Datenblatts oder Angebots.
Extrahiere die wichtigsten Werbe-Felder für einen kompakten Werbebanner.
Antworte AUSSCHLIESSLICH mit gültigem JSON, ohne Markdown.

Schema:
{
  "headline": "Marke + Modell, kurz und werblich (max. 40 Zeichen)",
  "subline": "Knackiger Untertitel, z.B. 'Jetzt sichern' oder Highlight-Ausstattung (max. 60 Zeichen)",
  "price": "Z.B. 'ab 249 € mtl.' oder '29.990 € Barpreis' (max. 30 Zeichen)",
  "cta": "Call-to-Action, z.B. 'Jetzt Probefahrt sichern' (max. 30 Zeichen)",
  "smallInfo": "Kurze Zusatzinfo, z.B. Laufzeit/Leasingfaktor (optional, max. 60 Zeichen)",
  "legalText": "Pflichtangaben-Kurzform mit Verbrauch und CO₂ falls erkennbar (1 Zeile)"
}

Fehlende Felder als leeren String "" ausgeben. Kein zusätzlicher Text.`;

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

    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("gemini extract-banner-data error", r.status, t.slice(0, 400));
      return errorResponse(`gemini ${r.status}: ${t.slice(0, 300)}`, 502);
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
