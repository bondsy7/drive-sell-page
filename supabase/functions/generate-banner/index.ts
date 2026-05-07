// generate-banner v4 – structured logging + stage tracking
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

// ---- Structured logger ----------------------------------------------------
// Every log line carries a request id + stage so failures are easy to trace
// in Supabase function logs. The same payload is also returned to the client
// in error responses (debug field) so the UI can show "where it broke".
type LogLevel = "info" | "warn" | "error";
function makeLogger(reqId: string) {
  const t0 = Date.now();
  const log = (level: LogLevel, stage: string, msg: string, extra: Record<string, unknown> = {}) => {
    const line = {
      reqId,
      stage,
      level,
      ms: Date.now() - t0,
      msg,
      ...extra,
    };
    const text = `[banner] ${JSON.stringify(line)}`;
    if (level === "error") console.error(text);
    else if (level === "warn") console.warn(text);
    else console.log(text);
  };
  return {
    info:  (stage: string, msg: string, extra?: Record<string, unknown>) => log("info",  stage, msg, extra),
    warn:  (stage: string, msg: string, extra?: Record<string, unknown>) => log("warn",  stage, msg, extra),
    error: (stage: string, msg: string, extra?: Record<string, unknown>) => log("error", stage, msg, extra),
    elapsed: () => Date.now() - t0,
  };
}
type Logger = ReturnType<typeof makeLogger>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModelConfig {
  engine: "gemini" | "openai";
  model: string;
  cost: number;
  supportsSize?: boolean;
}

const MODEL_MAP: Record<string, ModelConfig> = {
  schnell:   { engine: "gemini", model: "gemini-2.5-flash-image", cost: 3 },
  qualitaet: { engine: "gemini", model: "gemini-3.1-flash-image-preview", cost: 5 },
  premium:   { engine: "gemini", model: "gemini-3-pro-image-preview", cost: 8 },
  turbo:     { engine: "openai", model: "gpt-image-1", cost: 6, supportsSize: true },
  ultra:     { engine: "openai", model: "gpt-image-1", cost: 10, supportsSize: true },
  neu:       { engine: "openai", model: "gpt-image-2", cost: 8, supportsSize: true },
  // Fallbacks
  standard:  { engine: "gemini", model: "gemini-3.1-flash-image-preview", cost: 5 },
  pro:       { engine: "gemini", model: "gemini-3-pro-image-preview", cost: 8 },
};

const EDGE_DEADLINE_MS = 145_000;
const GEMINI_FAST_FALLBACK = "gemini-2.5-flash-image";

const PROFESSIONAL_BANNER_IMAGE_LOCK = `

PROFESSIONAL VEHICLE INTEGRATION LOCK (MANDATORY):
- Treat the uploaded vehicle photo as identity/reference only. Re-render all lighting, shadows and reflections so the vehicle belongs naturally in the NEW banner scene.
- ZERO old reflections: remove every trace of the source-photo environment from paint, windows, mirrors, chrome, headlights, taillights, rims, glossy trim and sunroof. Forbidden: trees, sky, clouds, old buildings, old showroom, other cars, people, photographer, asphalt, parking lines, old dealer logos, watermarks, price tags or text — not even faintly.
- NEW light-source proof: ceiling LEDs, window bands, studio softboxes, sun direction, streetlights or scene lights must create visible natural highlights on hood, roof, windshield, side glass, side panels, chrome and rims.
- Grounding: tires must visibly touch the floor/ground with soft contact shadows and ambient occlusion. On polished/wet floors, add a faint realistic lower-body reflection.
- Reflections must be subtle, physically plausible and curved by body geometry — not mirror-perfect CGI and not absent. If any old reflection remains, regenerate those surfaces from scratch.
`;

// Map requested dimensions to closest OpenAI-supported size
function getOpenAISize(w: number, h: number): string {
  if (w === h) return "1024x1024";
  if (w > h) return "1536x1024";
  return "1024x1536";
}

// Supported aspect ratios for gemini-3-pro-image-preview / gemini-3.1-flash-image-preview
const GEMINI_SUPPORTED_RATIOS: Array<{ label: string; value: number }> = [
  { label: "1:1",  value: 1 / 1 },
  { label: "2:3",  value: 2 / 3 },
  { label: "3:2",  value: 3 / 2 },
  { label: "3:4",  value: 3 / 4 },
  { label: "4:3",  value: 4 / 3 },
  { label: "4:5",  value: 4 / 5 },
  { label: "5:4",  value: 5 / 4 },
  { label: "9:16", value: 9 / 16 },
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
];

function getGeminiAspectRatio(w: number, h: number): string {
  if (!w || !h) return "1:1";
  const target = w / h;
  // Gemini's native imageConfig only supports fixed ratios; extreme display-ad
  // ratios like 160×600 must be described textually instead of snapped to 9:16,
  // otherwise the model composes a short centered poster with empty caps.
  if (target < 0.4 || target > 2.6) return `${w}:${h}`;
  let best = GEMINI_SUPPORTED_RATIOS[0];
  let bestDiff = Math.abs(Math.log(target / best.value));
  for (const r of GEMINI_SUPPORTED_RATIOS) {
    const diff = Math.abs(Math.log(target / r.value));
    if (diff < bestDiff) { bestDiff = diff; best = r; }
  }
  return best.label;
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function authenticateAndCheckCredits(req: Request, cost: number): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await sb.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const serviceSb = createServiceClient();
  const { data: balanceRow, error: balanceError } = await serviceSb
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (balanceError) {
    return new Response(JSON.stringify({ error: "Credit-Fehler: " + balanceError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const balance = balanceRow?.balance ?? 10;
  if (balance < cost) {
    return new Response(JSON.stringify({ error: "insufficient_credits", balance, cost }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId };
}

async function deductCreditsAfterSuccess(userId: string, cost: number, model: string) {
  const serviceSb = createServiceClient();
  const { data: result, error } = await serviceSb.rpc("deduct_credits", {
    _user_id: userId,
    _amount: cost,
    _action_type: "image_generate",
    _model: model,
    _description: `Banner-Generierung (${cost} Cr.)`,
  });
  if (error) throw new Error(`Credit deduction failed: ${error.message}`);
  const r = result as any;
  if (!r?.success) throw new Error(r?.error === "insufficient_credits" ? "insufficient_credits" : r?.error || "Credit deduction failed");
  return r;
}

function getGeminiModelChain(model: string): string[] {
  const chains: Record<string, string[]> = {
    "gemini-3-pro-image-preview": ["gemini-3-pro-image-preview", GEMINI_FAST_FALLBACK],
    "gemini-3.1-flash-image-preview": ["gemini-3.1-flash-image-preview", GEMINI_FAST_FALLBACK],
    [GEMINI_FAST_FALLBACK]: [GEMINI_FAST_FALLBACK, "gemini-3.1-flash-image-preview"],
  };
  return Array.from(new Set(chains[model] || [model, GEMINI_FAST_FALLBACK])).slice(0, 2);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = crypto.randomUUID().slice(0, 8);
  const log = makeLogger(reqId);
  const requestStartedAt = Date.now();
  let currentStage = "init";
  let usedModel = "unknown";
  let usedTier = "unknown";
  let usedAspect = "unknown";
  let authedUserId = "";

  try {
    currentStage = "parse_body";
    const { prompt, imageBase64, logoBase64, modelTier, width, height, vehicleFileRef, logoFileRef } = await req.json();
    if (!prompt) throw new Error("No prompt provided");

    const requestedTier = typeof modelTier === "string" ? modelTier : "qualitaet";
    const tier = requestedTier === "standard" ? "qualitaet" : requestedTier;
    const config = MODEL_MAP[tier] || MODEL_MAP["qualitaet"];
    usedModel = config.model;
    usedTier = tier;
    usedAspect = width && height ? getGeminiAspectRatio(width, height) : "1:1";
    log.info("config", "tier+model resolved", {
      tier, engine: config.engine, model: config.model, cost: config.cost,
      width, height, aspect: usedAspect,
      hasImage: !!imageBase64, hasLogo: !!logoBase64,
      vehicleFileUri: vehicleFileRef?.fileUri || null,
      logoFileUri: logoFileRef?.fileUri || null,
      promptChars: prompt.length,
    });

    currentStage = "auth_credits";
    const authResult = await authenticateAndCheckCredits(req, config.cost);
    if (authResult instanceof Response) {
      log.warn("auth_credits", "auth/credits failed", { status: authResult.status });
      return authResult;
    }
    authedUserId = authResult.userId;
    log.info("auth_credits", "ok - credits checked, charge after success", { userId: authedUserId });

    let resultImage: string | null = null;
    const maxRetries = 0;
    const lockedPrompt = `${prompt}${PROFESSIONAL_BANNER_IMAGE_LOCK}`;

    if (config.engine === "gemini") {
      currentStage = "gemini_call";
      // Reliability-first same-engine fallback: first try the selected tier, then a fast Gemini fallback.
      // This avoids minutes of waiting when both Gemini 3 preview models are overloaded.
      const geminiModels = getGeminiModelChain(config.model);
      log.info("gemini_call", "model chain", { selectedModel: config.model, chain: geminiModels });
      let lastGeminiError = "";
      for (const geminiModel of geminiModels) {
        try {
          usedModel = geminiModel;
          resultImage = await generateGemini(lockedPrompt, imageBase64, logoBase64, geminiModel, maxRetries, width, height, requestStartedAt, log, vehicleFileRef, logoFileRef);
          if (resultImage) break;
        } catch (err) {
          lastGeminiError = err instanceof Error ? err.message : "Gemini error";
          const hasNext = geminiModels.indexOf(geminiModel) < geminiModels.length - 1;
          log.warn("gemini_call", hasNext ? "model failed, trying next" : "model failed, no fallback left", { model: geminiModel, error: lastGeminiError });
        }
      }
      if (!resultImage && lastGeminiError) throw new Error(lastGeminiError);
    } else {
      currentStage = "openai_call";
      resultImage = await generateOpenAI(lockedPrompt, imageBase64, logoBase64, config.model, width, height, tier === "ultra" || tier === "neu", maxRetries);
    }

    if (!resultImage) throw new Error("Kein Banner generiert. Bitte versuche es erneut.");

    currentStage = "credit_capture";
    const charge = await deductCreditsAfterSuccess(authedUserId, config.cost, usedModel);
    log.info("credit_capture", "charged after successful generation", { cost: config.cost, balance: charge?.balance, model: usedModel });

    currentStage = "done";
    log.info("done", "banner generated", { totalMs: log.elapsed() });
    return new Response(JSON.stringify({ imageBase64: resultImage, debug: { reqId, model: usedModel, tier: usedTier, aspect: usedAspect, totalMs: log.elapsed() } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const is503 = /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(msg);
    const isTimeout = /timeout|aborted/i.test(msg);
    log.error(currentStage, "request failed", {
      error: msg, is503, isTimeout, totalMs: Date.now() - requestStartedAt,
      model: usedModel, tier: usedTier,
    });
    const userMsg = is503
      ? "Der Bild-Generator ist gerade überlastet. Bitte in 1–2 Minuten erneut versuchen."
      : isTimeout
      ? `Zeitüberschreitung beim Modell ${usedModel} (${Math.round((Date.now()-requestStartedAt)/1000)}s). Bitte erneut versuchen oder ein anderes Modell wählen.`
      : msg;
    const status = is503 ? 503 : isTimeout ? 504 : 500;
    return new Response(
      JSON.stringify({
        error: userMsg,
        debug: {
          reqId,
          stage: currentStage,
          model: usedModel,
          tier: usedTier,
          aspect: usedAspect,
          totalMs: Date.now() - requestStartedAt,
          rawError: msg,
        },
      }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function toInlineData(input: string | null | undefined, fallbackMime = "image/jpeg"): Promise<{ mimeType: string; data: string } | null> {
  if (!input) return null;
  if (/^https?:\/\//i.test(input)) {
    try {
      const r = await fetch(input);
      if (!r.ok) { console.error("toInlineData fetch failed", r.status, input); return null; }
      const ct = r.headers.get("content-type") || fallbackMime;
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return { mimeType: ct.split(";")[0], data: btoa(bin) };
    } catch (e) {
      console.error("toInlineData fetch error", e);
      return null;
    }
  }
  const mime = input.startsWith("data:image/png") ? "image/png"
    : input.startsWith("data:image/webp") ? "image/webp"
    : input.startsWith("data:image/jpeg") || input.startsWith("data:image/jpg") ? "image/jpeg"
    : input.startsWith("data:image/svg") ? "image/png"
    : fallbackMime;
  const data = input.includes(",") ? input.split(",")[1] : input;
  return { mimeType: mime, data };
}

interface FileRef { fileUri: string; mimeType: string }
async function generateGemini(prompt: string, imageBase64: string | null, logoBase64: string | null, model: string, retries: number, width?: number, height?: number, requestStartedAt = Date.now(), log?: Logger, vehicleFileRef?: FileRef | null, logoFileRef?: FileRef | null): Promise<string | null> {
  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  log?.info("gemini.prep", "preparing request", { model });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const aspectLabel = width && height ? getGeminiAspectRatio(width, height) : "1:1";
  const isLandscape = width && height ? width > height : false;
  const isPortrait  = width && height ? height > width : false;
  const orientationWord = isLandscape ? "LANDSCAPE (wider than tall)"
                        : isPortrait  ? "PORTRAIT (taller than wide)"
                        : "SQUARE";

  const parts: any[] = [];

  // 1) FORMAT-Direktive ZUERST (Gemini gewichtet frühe Instruktionen stark)
  if (width && height) {
    const targetRatio = width / height;
    const isExtremePortrait = isPortrait && targetRatio < 0.4;
    const isExtremeLandscape = isLandscape && targetRatio > 2.6;
    const fillRule = isExtremePortrait
      ? `- EXTREME VERTICAL DISPLAY AD: use 100% of the ${width}×${height} canvas from top edge to bottom edge. NO centered mini-poster, NO phone-story crop, NO blank white/cream top cap, NO blank white/cream bottom cap. Vehicle large in the central 55-65% of height, logo/headline/price in compact top zone, CTA in compact bottom zone, and the scene/background must remain visible behind every zone edge-to-edge.`
      : isExtremeLandscape
      ? `- EXTREME HORIZONTAL DISPLAY AD: use 100% of the ${width}×${height} canvas from left edge to right edge. NO centered mini-banner, NO blank side caps. Vehicle and copy must fill the full strip with edge-to-edge background.`
      : isPortrait
      ? `- The vehicle MUST fill ~70% of the canvas HEIGHT and be horizontally centered. NO empty cream/white zones above or below the vehicle. Background scene must extend edge-to-edge to all 4 borders.`
      : isLandscape
      ? `- The vehicle MUST fill ~75% of the canvas WIDTH. Background scene extends edge-to-edge. NO flat empty bands on left/right sides.`
      : `- The vehicle MUST fill ~70% of the canvas. Background scene extends edge-to-edge. NO empty borders.`;
    parts.push({
      text:
`OUTPUT CANVAS (HARD CONSTRAINT — HIGHEST PRIORITY):
- Aspect ratio: EXACTLY ${aspectLabel} (${width}×${height}px, ${orientationWord}).
- DO NOT default to 1:1 / square. DO NOT mirror the aspect ratio of the reference vehicle photo.
- Compose the entire scene (background, vehicle placement, headline, logo, negative space) NATIVELY for a ${aspectLabel} ${orientationWord} canvas.
- If the reference vehicle image has a different aspect ratio, IGNORE its framing — only its identity matters.

COMPOSITION FILL RULE (NO EMPTY ZONES):
${fillRule}
- The padded blurred areas of the reference image are NOT part of the output — they exist only to hint at the target ratio. DO NOT reproduce flat blurred or flat colored bands in the final banner.
- Every pixel of the output must contribute to the composition: scene, vehicle, typography, lighting or accent. ZERO dead space.`
    });
  }

  // 2) Hauptprompt
  parts.push({ text: prompt });

  // 3) Referenz-Fahrzeug klar als Identitäts-Referenz markieren
  const hasVehicleRef = !!vehicleFileRef?.fileUri || !!imageBase64;
  if (hasVehicleRef) {
    parts.push({ text:
`VEHICLE REFERENCE IMAGE (identity only):
The next image shows the vehicle. Use it ONLY for identity (model, color, trim, wheels, proportions).
DO NOT copy its background, lighting, reflections, framing or aspect ratio.
The image may have blurred padding bands around the vehicle — IGNORE those bands, they are only an aspect-ratio hint and are NOT part of the vehicle or final composition.` });
    if (vehicleFileRef?.fileUri) {
      parts.push({ fileData: { fileUri: vehicleFileRef.fileUri, mimeType: vehicleFileRef.mimeType || "image/jpeg" } });
      log?.info("gemini.ref", "vehicle via Files API", { uri: vehicleFileRef.fileUri });
    } else {
      const vehicleInline = await toInlineData(imageBase64, "image/jpeg");
      if (vehicleInline) parts.push({ inlineData: vehicleInline });
    }
  }

  const hasLogoRef = !!logoFileRef?.fileUri || !!logoBase64;
  if (hasLogoRef) {
    parts.push({ text: `LOGO LOCK (MANDATORY — READ CAREFULLY):
The next image is the OFFICIAL CURRENT manufacturer logo that MUST appear in the banner.
- Use EXACTLY this provided logo file as a 1:1 visual reference. Do NOT redraw, restyle, recolor, simplify or "improve" it.
- Reproduce it pixel-faithfully: same shape, same proportions, same colors, same modern flat design as supplied.
- DO NOT use any logo from your training data or memory. Manufacturer logos in your memory are OUTDATED.
- FORBIDDEN: old/historical/legacy/vintage/chrome/3D/gradient/embossed versions of this brand logo. No retro variants. No older wordmarks. No discontinued emblems.
- Examples of what is FORBIDDEN: old chrome VW logo, old 3D BMW roundel with depth, old Mercedes star with gradients, old Audi rings with chrome, any pre-2019 manufacturer logo style.
- If the provided logo is flat 2D, the rendered logo MUST stay flat 2D. If it is monochrome, keep it monochrome.
- Place it cleanly and prominently (corner or near headline), correctly sized, fully legible, no distortion, no rotation, no drop shadow, no extra effects.
The logo image follows now:` });
    if (logoFileRef?.fileUri) {
      parts.push({ fileData: { fileUri: logoFileRef.fileUri, mimeType: logoFileRef.mimeType || "image/png" } });
      log?.info("gemini.ref", "logo via Files API", { uri: logoFileRef.fileUri });
    } else {
      const logoInline = await toInlineData(logoBase64, "image/png");
      if (logoInline) parts.push({ inlineData: logoInline });
    }
  }

  // D) Activate native aspectRatio control on gemini-3* preview models via imageConfig.
  // gemini-3* DO honour imageConfig.aspectRatio. The fast fallback gemini-2.5-flash-image
  // still ignores it, so the pre-padded blurred reference image (B) remains as a visual anchor.
  const supportsAspectField = /^gemini-3/.test(model);
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
    temperature: 0.55,
  };
  if (supportsAspectField && width && height) {
    (generationConfig as any).imageConfig = { aspectRatio: aspectLabel };
  }

  // Fail fast on overloaded preview models, then move to the stable Gemini fallback.
  // Give Gemini-3 preview models more headroom — they regularly need 35–55s for 9:16 with reference image.
  // Falling back too early forces use of gemini-2.5-flash-image which ignores aspect ratio.
  const modelBudgetMs = model === GEMINI_FAST_FALLBACK ? 55_000 : /^gemini-3/.test(model) ? 60_000 : 45_000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutMs = modelBudgetMs;
    const callStart = Date.now();
    try {
      const remainingMs = EDGE_DEADLINE_MS - (Date.now() - requestStartedAt);
      if (remainingMs < 12_000) throw new Error("Banner generation deadline reached before model fallback");
      timeoutMs = Math.max(8_000, Math.min(modelBudgetMs, remainingMs - 5_000));
      log?.info("gemini.fetch", "calling Gemini", { model, attempt: attempt + 1, timeoutMs, aspect: aspectLabel, hasAspectField: false, supportsAspectField, parts: parts.length });
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      }, timeoutMs);

      if (!response.ok) {
        const errText = await response.text();
        log?.error("gemini.http", "non-OK response", { model, attempt: attempt + 1, status: response.status, durationMs: Date.now() - callStart, body: errText.slice(0, 500) });
        if ([400, 401, 403].includes(response.status) && /API_KEY_INVALID|API Key not found|invalid api key/i.test(errText)) {
          throw new Error("GEMINI_API_KEY ungültig oder nicht für Gemini freigeschaltet");
        }
        if ((response.status === 429 || response.status === 503 || response.status === 500) && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
        throw new Error(`Gemini ${response.status}: ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const respParts = data.candidates?.[0]?.content?.parts;
      const finishReason = data.candidates?.[0]?.finishReason;
      log?.info("gemini.parse", "response received", { model, durationMs: Date.now() - callStart, finishReason, hasParts: !!respParts, partsCount: respParts?.length || 0 });
      if (!respParts) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
        throw new Error(`Kein Bild von Gemini (finishReason=${finishReason || "unknown"})`);
      }

      for (const part of respParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          log?.info("gemini.success", "image extracted", { model, mime, bytes: part.inlineData.data.length });
          return `data:${mime};base64,${part.inlineData.data}`;
        }
      }

      if (attempt < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
      throw new Error("Gemini-Antwort enthält kein Bild");
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      log?.error("gemini.exception", isAbort ? "timeout" : "exception", { model, attempt: attempt + 1, durationMs: Date.now() - callStart, error: e?.message, isAbort });
      if (attempt >= retries) throw isAbort ? new Error(`Gemini timeout (${Math.round(timeoutMs/1000)}s) bei Modell ${model}`) : e;
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
}

async function generateOpenAI(prompt: string, imageBase64: string | null, logoBase64: string | null, model: string, width: number, height: number, isUltra: boolean, retries: number): Promise<string | null> {
  const apiKey = await getSecret("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const size = getOpenAISize(width, height);
  const useEdits = !!imageBase64;
  const url = useEdits
    ? "https://api.openai.com/v1/images/edits"
    : "https://api.openai.com/v1/images/generations";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let response: Response;

      if (useEdits) {
        const vehicleInline = await toInlineData(imageBase64, "image/png");
        if (!vehicleInline) throw new Error("Failed to load vehicle image");
        const binaryStr = atob(vehicleInline.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: vehicleInline.mimeType });

        const form = new FormData();
        form.append("model", model);
        form.append("image", blob, "vehicle.png");

        let logoPromptAddition = "";
        const logoInline = await toInlineData(logoBase64, "image/png");
        if (logoInline) {
          const logoBinaryStr = atob(logoInline.data);
          const logoBytes = new Uint8Array(logoBinaryStr.length);
          for (let j = 0; j < logoBinaryStr.length; j++) logoBytes[j] = logoBinaryStr.charCodeAt(j);
          const logoBlob = new Blob([logoBytes], { type: logoInline.mimeType });
          form.append("image", logoBlob, "logo.png");
          logoPromptAddition = "\n\nLOGO LOCK (MANDATORY): A second image is provided — this is the OFFICIAL CURRENT manufacturer logo. Reproduce it 1:1 pixel-faithfully (same shape, proportions, colors, flat modern design). DO NOT use any logo from memory/training data — those are OUTDATED. FORBIDDEN: old/historical/legacy/vintage/chrome/3D/gradient versions (no old chrome VW logo, no old 3D BMW roundel, no old gradient Mercedes star, no old chrome Audi rings, no pre-2019 brand marks). Place prominently (corner or near headline), no rotation, no distortion, no extra effects.";
        }
        
        form.append("prompt", `${prompt}\n\nIMPORTANT: Use the provided vehicle image as the central hero element. Keep vehicle identity, shape, colour, trim, wheels and proportions accurate, but re-render lighting, shadows and all reflections to match the NEW scene only.${logoPromptAddition}`);
        form.append("n", "1");
        form.append("size", size);
        if (isUltra) form.append("quality", "high");

        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        }, 90_000);
      } else {
        const body: any = { model, prompt, n: 1, size };
        if (isUltra) body.quality = "high";

        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, 90_000);
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`OpenAI banner attempt ${attempt + 1}:`, response.status, errText);
        if ([400, 401, 403].includes(response.status) && /invalid_api_key|Incorrect API key|Unauthorized|forbidden/i.test(errText)) {
          throw new Error("OPENAI_API_KEY ungültig oder nicht freigeschaltet");
        }
        // Auto-fallback: gpt-image-2 requires verified org → fall back to gpt-image-1
        if (response.status === 403 && model === "gpt-image-2" && /must be verified|verify organization/i.test(errText)) {
          console.warn("[banner][openai] gpt-image-2 nicht freigeschaltet → Fallback auf gpt-image-1");
          model = "gpt-image-1";
          continue;
        }
        if (response.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`OpenAI error: ${response.status}`);
      }

      const data = await response.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error("No image data in OpenAI response");
      }

      return `data:image/png;base64,${b64}`;
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}
