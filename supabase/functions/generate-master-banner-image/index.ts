// Generates a single, ad-quality MASTER banner image from a source vehicle photo
// and a marketing-style prompt, using the user's Gemini API key (Nano Banana).
//
// ISOLATION: dedicated to Canvas Banner Studio. No interaction with other generators.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";

const SYSTEM_GUARDRAIL = `You re-stage an EXISTING vehicle photo into a new ad-worthy scene.
ABSOLUTE RULES:
- Preserve the exact vehicle: same make, model, year, body shape, wheels, colour and trim.
- Do NOT change the vehicle angle/perspective drastically; keep it recognisable from the source frame.
- Remove any visible license plate text or replace with a clean blank plate.
- No text, no logos, no watermarks anywhere in the image.
- Output a single, photoreal, advertising-grade image.`;

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
    const sourceImageUrl: string | undefined = body?.sourceImageUrl;
    const promptText: string | undefined = body?.promptText;
    const extraInstruction: string | undefined = body?.extraInstruction;
    if (!sourceImageUrl) return errorResponse("sourceImageUrl required", 400);
    if (!promptText) return errorResponse("promptText required", 400);

    const apiKey = await getSecret("GEMINI_API_KEY");
    if (!apiKey) return errorResponse("GEMINI_API_KEY missing", 500);

    // Resolve source image to base64 + mime
    let inMime = "image/jpeg";
    let inB64 = "";
    if (sourceImageUrl.startsWith("data:")) {
      const m = sourceImageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return errorResponse("invalid sourceImageUrl data url", 400);
      inMime = m[1];
      inB64 = m[2];
    } else {
      // remote/storage URL → fetch
      const r = await fetch(sourceImageUrl);
      if (!r.ok) return errorResponse(`fetch source failed ${r.status}`, 502);
      inMime = r.headers.get("content-type") || "image/jpeg";
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      inB64 = btoa(bin);
    }

    const fullPrompt = [SYSTEM_GUARDRAIL, "", promptText, extraInstruction ? `\nAdditional notes: ${extraInstruction}` : ""].join("\n");

    const model = "gemini-2.5-flash-image";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: fullPrompt },
            { inline_data: { mime_type: inMime, data: inB64 } },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("gemini master-image error", r.status, t.slice(0, 400));
      return errorResponse(`gemini ${r.status}: ${t.slice(0, 300)}`, 502);
    }
    const json = await r.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p: any) => p?.inline_data?.data || p?.inlineData?.data);
    const data = imgPart?.inline_data?.data || imgPart?.inlineData?.data;
    const mime = imgPart?.inline_data?.mime_type || imgPart?.inlineData?.mimeType || "image/png";
    if (!data) {
      console.error("gemini returned no image", JSON.stringify(json).slice(0, 500));
      return errorResponse("no image returned", 502);
    }

    return jsonResponse({ imageDataUrl: `data:${mime};base64,${data}` });
  } catch (e) {
    console.error("generate-master-banner-image error", e);
    return errorResponse(e instanceof Error ? e.message : "unknown error", 500);
  }
});
