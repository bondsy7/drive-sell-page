// Reframes a background image to match (or closely match) a target banner format
// using the Ideogram V_2 reframe API. Returns the reframed image as a base64 data URL.
//
// ISOLATION NOTE:
// - This edge function is dedicated to the Canvas Banner Studio.
// - It does not touch any existing banner or remastering logic.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";

// Supported Ideogram V_2 reframe resolutions (subset, broad coverage of aspect ratios).
const SUPPORTED: Array<[number, number]> = [
  [512, 1536], [576, 1408], [640, 1408], [704, 1408], [704, 1472],
  [720, 1280], [736, 1312], [768, 1280], [768, 1408], [800, 1280],
  [832, 1248], [832, 1280], [864, 1152], [896, 1152], [896, 1280],
  [960, 1088], [960, 1280],
  [1024, 1024], [1024, 640], [1024, 768], [1024, 832], [1024, 896], [1024, 960],
  [1088, 960], [1120, 896], [1152, 864], [1152, 896],
  [1216, 832], [1232, 848], [1248, 832],
  [1280, 704], [1280, 720], [1280, 768], [1280, 800], [1280, 832], [1280, 864], [1280, 896], [1280, 960],
  [1312, 736], [1344, 704], [1344, 768],
  [1408, 576], [1408, 640], [1408, 704], [1408, 768],
  [1472, 704], [1536, 512],
];

function pickClosestResolution(targetW: number, targetH: number): { w: number; h: number; key: string } {
  const targetRatio = targetW / targetH;
  let best = SUPPORTED[0];
  let bestScore = Infinity;
  for (const [w, h] of SUPPORTED) {
    const r = w / h;
    const ratioDiff = Math.abs(Math.log(r / targetRatio));
    const score = ratioDiff;
    if (score < bestScore) { bestScore = score; best = [w, h]; }
  }
  const [w, h] = best;
  return { w, h, key: `RESOLUTION_${w}_${h}` };
}

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
    const imageDataUrl: string | undefined = body?.imageDataUrl;
    const targetWidth: number = Number(body?.targetWidth);
    const targetHeight: number = Number(body?.targetHeight);
    if (!imageDataUrl) return errorResponse("imageDataUrl required", 400);
    if (!targetWidth || !targetHeight) return errorResponse("targetWidth/targetHeight required", 400);

    const apiKey = await getSecret("IDEOGRAM_API_KEY");
    if (!apiKey) return errorResponse("IDEOGRAM_API_KEY missing", 500);

    // Decode incoming data URL
    const m = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return errorResponse("invalid imageDataUrl", 400);
    const inMime = m[1];
    const inB64 = m[2];
    const inBytes = Uint8Array.from(atob(inB64), (c) => c.charCodeAt(0));

    const picked = pickClosestResolution(targetWidth, targetHeight);

    // Build multipart form for Ideogram
    const form = new FormData();
    form.append(
      "image_file",
      new Blob([inBytes], { type: inMime }),
      "input." + (inMime.split("/")[1] || "jpg"),
    );
    form.append("resolution", picked.key);
    form.append("model", "V_2");

    const r = await fetch("https://api.ideogram.ai/reframe", {
      method: "POST",
      headers: { "Api-Key": apiKey },
      body: form,
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("ideogram reframe error", r.status, t);
      return errorResponse(`ideogram error ${r.status}: ${t.slice(0, 300)}`, 502);
    }
    const json = await r.json();
    const url: string | undefined = json?.data?.[0]?.url;
    if (!url) return errorResponse("ideogram returned no url", 502);

    // Download and return as base64 data URL so client can use it directly without CORS.
    const imgRes = await fetch(url);
    if (!imgRes.ok) return errorResponse("failed to fetch ideogram result", 502);
    const outBuf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < outBuf.length; i++) bin += String.fromCharCode(outBuf[i]);
    const outB64 = btoa(bin);
    const outMime = imgRes.headers.get("content-type") || "image/png";

    return jsonResponse({
      imageDataUrl: `data:${outMime};base64,${outB64}`,
      width: picked.w,
      height: picked.h,
      resolution: picked.key,
      targetWidth,
      targetHeight,
    });
  } catch (e) {
    console.error("reframe-banner-image error", e);
    return errorResponse(e instanceof Error ? e.message : "unknown error", 500);
  }
});
