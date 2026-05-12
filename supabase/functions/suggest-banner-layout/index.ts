// Suggests banner layout settings from a background image using Gemini Vision.
// Returns ONLY JSON. No image generation. No text overlay generation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";

const ALLOWED_OVERLAY = ["none", "left", "right", "top", "bottom", "full-soft"];
const ALLOWED_POS = ["top-left", "top-right", "top-center", "center", "bottom-left", "bottom-right", "bottom-center"];

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;
  if (req.method !== "POST") return errorResponse("method not allowed", 405);

  try {
    // Auth via getClaims
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return errorResponse("missing auth token", 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: claimsData, error: claimsErr } = await sb.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return errorResponse("unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const imageDataUrl: string | undefined = body?.imageDataUrl;
    const imageUrl: string | undefined = body?.imageUrl;
    if (!imageDataUrl && !imageUrl) return errorResponse("imageDataUrl or imageUrl required", 400);

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY missing", 500);

    // Convert URL to base64 if needed (Gemini inline data path)
    let mimeType = "image/jpeg";
    let base64 = "";
    if (imageDataUrl) {
      const m = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return errorResponse("invalid imageDataUrl", 400);
      mimeType = m[1];
      base64 = m[2];
    } else if (imageUrl) {
      const r = await fetch(imageUrl);
      if (!r.ok) return errorResponse("failed to fetch imageUrl", 400);
      mimeType = r.headers.get("content-type") ?? "image/jpeg";
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      base64 = btoa(bin);
    }

    const prompt = `Analyse dieses Banner-Hintergrundbildes für Werbeanzeigen. 
Das Bild wird als Hintergrund für einen Banner verwendet, auf den später Texte (Headline, Preis, CTA) und ein Logo gelegt werden.
Gib NUR ein JSON-Objekt zurück mit folgenden Feldern:
- recommendedOverlay: einer von ${ALLOWED_OVERLAY.join(", ")}
- headlinePosition: einer von ${ALLOWED_POS.join(", ")}
- pricePosition: einer von ${ALLOWED_POS.join(", ")}
- ctaPosition: einer von ${ALLOWED_POS.join(", ")}
- logoPosition: einer von ${ALLOWED_POS.join(", ")}
- reason: eine kurze deutsche Begründung (max 200 Zeichen)
Wähle die Positionen so, dass Texte auf einer ruhigen Bildregion liegen und das Hauptmotiv (z.B. Fahrzeug) sichtbar bleibt.`;

    const model = "gemini-2.5-flash";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("gemini error", r.status, t);
      return errorResponse(`gemini error ${r.status}`, 502);
    }
    const data = await r.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(txt); } catch { parsed = {}; }

    // Defensive validation
    const safe = {
      recommendedOverlay: ALLOWED_OVERLAY.includes(parsed.recommendedOverlay) ? parsed.recommendedOverlay : "bottom",
      headlinePosition: ALLOWED_POS.includes(parsed.headlinePosition) ? parsed.headlinePosition : "top-left",
      pricePosition: ALLOWED_POS.includes(parsed.pricePosition) ? parsed.pricePosition : "bottom-left",
      ctaPosition: ALLOWED_POS.includes(parsed.ctaPosition) ? parsed.ctaPosition : "bottom-right",
      logoPosition: ALLOWED_POS.includes(parsed.logoPosition) ? parsed.logoPosition : "top-right",
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 240) : "",
    };

    return jsonResponse(safe);
  } catch (e) {
    console.error("suggest-banner-layout error", e);
    return errorResponse(e instanceof Error ? e.message : "unknown error", 500);
  }
});
