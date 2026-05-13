// Reframes a background image to match a target banner format using
// Ideogram v3 reframe (TURBO rendering speed for low latency).
// Returns the reframed image as a base64 data URL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";

// Officially supported Ideogram v3 reframe resolutions.
const V3_RESOLUTIONS: Array<[number, number]> = [
  [512,1536],[576,1408],[576,1472],[576,1536],
  [640,1344],[640,1408],[640,1472],[640,1536],
  [704,1152],[704,1216],[704,1280],[704,1344],[704,1408],[704,1472],
  [736,1312],[768,1088],[768,1216],[768,1280],[768,1344],[800,1280],
  [832,960],[832,1024],[832,1088],[832,1152],[832,1216],[832,1248],
  [864,1152],[896,960],[896,1024],[896,1088],[896,1120],[896,1152],
  [960,832],[960,896],[960,1024],[960,1088],
  [1024,832],[1024,896],[1024,960],[1024,1024],
  [1088,768],[1088,832],[1088,896],[1088,960],
  [1120,896],[1152,704],[1152,832],[1152,864],[1152,896],
  [1216,704],[1216,768],[1216,832],
  [1248,832],[1280,704],[1280,768],[1280,800],
  [1312,736],[1344,640],[1344,704],[1344,768],
  [1408,576],[1408,640],[1408,704],
  [1472,576],[1472,640],[1472,704],
  [1536,512],[1536,576],[1536,640],
];

function pickClosestResolution(targetW: number, targetH: number): { w: number; h: number; key: string } {
  const targetRatio = targetW / targetH;
  let best = V3_RESOLUTIONS[0];
  let bestScore = Infinity;
  for (const [w, h] of V3_RESOLUTIONS) {
    const r = w / h;
    const ratioDiff = Math.abs(Math.log(r / targetRatio));
    if (ratioDiff < bestScore) { bestScore = ratioDiff; best = [w, h]; }
  }
  const [w, h] = best;
  return { w, h, key: `${w}x${h}` };
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
    const renderingSpeed: string = String(body?.renderingSpeed ?? "TURBO").toUpperCase();
    if (!imageDataUrl) return errorResponse("imageDataUrl required", 400);
    if (!targetWidth || !targetHeight) return errorResponse("targetWidth/targetHeight required", 400);

    const apiKey = await getSecret("IDEOGRAM_API_KEY");
    if (!apiKey) return errorResponse("IDEOGRAM_API_KEY missing", 500);

    const m = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return errorResponse("invalid imageDataUrl", 400);
    const inMime = m[1];
    const inB64 = m[2];
    const inBytes = Uint8Array.from(atob(inB64), (c) => c.charCodeAt(0));

    const picked = pickClosestResolution(targetWidth, targetHeight);

    const buildForm = () => {
      const form = new FormData();
      form.append(
        "image",
        new Blob([inBytes], { type: inMime }),
        "input." + (inMime.split("/")[1] || "jpg"),
      );
      form.append("resolution", picked.key);
      form.append("rendering_speed", renderingSpeed);
      return form;
    };

    // v3+TURBO is fast (~5-15s). Strict total budget so we can return a clean 503
    // before the platform's 150s idle timeout turns this into a hard 504.
    let r: Response | null = null;
    let lastErr = "";
    let lastStatus = 0;
    const startedAt = Date.now();
    const MAX_ATTEMPTS = 2;
    const TOTAL_BUDGET_MS = 120_000;
    const SAFETY_MARGIN_MS = 6_000;
    const MAX_ATTEMPT_MS = 50_000;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt) - SAFETY_MARGIN_MS;
      if (remaining <= 5_000) break;
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), Math.min(MAX_ATTEMPT_MS, remaining));
      try {
        const resp = await fetch("https://api.ideogram.ai/v1/ideogram-v3/reframe", {
          method: "POST",
          headers: { "Api-Key": apiKey },
          body: buildForm(),
          signal: ctrl.signal,
        });
        clearTimeout(to);
        if (resp.ok) { r = resp; break; }
        lastStatus = resp.status;
        lastErr = (await resp.text()).slice(0, 200);
        console.warn(`ideogram v3 attempt ${attempt} failed ${resp.status}: ${lastErr}`);
        if (![502, 503, 504, 524, 408, 429].includes(resp.status)) {
          return errorResponse(`ideogram error ${resp.status}: ${lastErr}`, 502);
        }
      } catch (e) {
        clearTimeout(to);
        lastErr = e instanceof Error ? e.message : String(e);
        console.warn(`ideogram v3 attempt ${attempt} threw`, lastErr);
      }
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((res) => setTimeout(res, 1200 * attempt));
      }
    }
    if (!r) {
      return new Response(
        JSON.stringify({
          error: `Ideogram-Dienst aktuell nicht erreichbar (${lastStatus || "timeout"}). Bitte gleich nochmal versuchen oder „Manuell" nutzen.`,
          retryable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const json = await r.json();
    const url: string | undefined = json?.data?.[0]?.url;
    if (!url) return errorResponse("ideogram returned no url", 502);

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
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    console.error("reframe-banner-image error", e);
    return errorResponse(e instanceof Error ? e.message : "unknown error", 500);
  }
});
