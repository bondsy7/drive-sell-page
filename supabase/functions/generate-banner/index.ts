// generate-banner v3 – uses /v1/images/edits for image input
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

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

const EDGE_DEADLINE_MS = 115_000;

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

async function authenticateAndDeductCredits(req: Request, cost: number): Promise<{ userId: string } | Response> {
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
  const { data: result, error: deductError } = await serviceSb.rpc("deduct_credits", {
    _user_id: userId, _amount: cost, _action_type: "image_generate",
    _description: `Banner-Generierung (${cost} Cr.)`,
  });
  if (deductError) {
    return new Response(JSON.stringify({ error: "Credit-Fehler: " + deductError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const r = result as any;
  if (!r?.success) {
    return new Response(JSON.stringify({ error: "insufficient_credits", balance: r?.balance || 0, cost: r?.cost || cost }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const requestStartedAt = Date.now();

  try {
    const { prompt, imageBase64, logoBase64, modelTier, width, height } = await req.json();
    if (!prompt) throw new Error("No prompt provided");

    const requestedTier = typeof modelTier === "string" ? modelTier : "qualitaet";
    const tier = requestedTier === "standard" ? "qualitaet" : requestedTier;
    const config = MODEL_MAP[tier] || MODEL_MAP["qualitaet"];
    console.log(`[banner] Engine=${config.engine} Model=${config.model} Tier=${tier} (user-selected, binding)`);

    // Auth & credits
    const authResult = await authenticateAndDeductCredits(req, config.cost);
    if (authResult instanceof Response) return authResult;

    let resultImage: string | null = null;
    const maxRetries = 0;

    const lockedPrompt = `${prompt}${PROFESSIONAL_BANNER_IMAGE_LOCK}`;

    if (config.engine === "gemini") {
      // STRICT: only use the requested model. Fallback to 2.5-flash-image is
      // disabled because that model ignores aspectRatio and returns squares,
      // which breaks user-selected formats (9:16, 16:9, 4:15, etc.).
      const geminiModels = [config.model];
      let lastGeminiError = "";
      for (const geminiModel of geminiModels) {
        try {
          resultImage = await generateGemini(lockedPrompt, imageBase64, logoBase64, geminiModel, maxRetries, width, height, requestStartedAt);
          if (resultImage) break;
        } catch (err) {
          lastGeminiError = err instanceof Error ? err.message : "Gemini error";
          console.warn(`Banner model ${geminiModel} failed, trying fallback if available:`, lastGeminiError);
        }
      }
      if (!resultImage && lastGeminiError) throw new Error(lastGeminiError);
    } else {
      resultImage = await generateOpenAI(lockedPrompt, imageBase64, logoBase64, config.model, width, height, tier === "ultra" || tier === "neu", maxRetries);
    }

    if (!resultImage) throw new Error("Kein Banner generiert. Bitte versuche es erneut.");

    return new Response(JSON.stringify({ imageBase64: resultImage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-banner error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const is503 = /\b503\b|UNAVAILABLE|overloaded|high demand/i.test(msg);
    return new Response(
      JSON.stringify({
        error: is503
          ? "Der Bild-Generator ist gerade überlastet. Bitte in 1–2 Minuten erneut versuchen."
          : msg,
      }),
      { status: is503 ? 503 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

async function generateGemini(prompt: string, imageBase64: string | null, logoBase64: string | null, model: string, retries: number, width?: number, height?: number, requestStartedAt = Date.now()): Promise<string | null> {
  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

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
    parts.push({
      text:
`OUTPUT CANVAS (HARD CONSTRAINT — HIGHEST PRIORITY):
- Aspect ratio: EXACTLY ${aspectLabel} (${width}×${height}px, ${orientationWord}).
- DO NOT default to 1:1 / square. DO NOT mirror the aspect ratio of the reference vehicle photo.
- Compose the entire scene (background, vehicle placement, headline, logo, negative space) NATIVELY for a ${aspectLabel} ${orientationWord} canvas.
- If the reference vehicle image has a different aspect ratio, IGNORE its framing — only its identity matters.`
    });
  }

  // 2) Hauptprompt
  parts.push({ text: prompt });

  // 3) Referenz-Fahrzeug klar als Identitäts-Referenz markieren
  const vehicleInline = await toInlineData(imageBase64, "image/jpeg");
  if (vehicleInline) {
    parts.push({ text:
`VEHICLE REFERENCE IMAGE (identity only):
The next image shows the vehicle. Use it ONLY for identity (model, color, trim, wheels, proportions).
DO NOT copy its background, lighting, reflections, framing or aspect ratio.` });
    parts.push({ inlineData: vehicleInline });
  }

  const logoInline = await toInlineData(logoBase64, "image/png");
  if (logoInline) {
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
    parts.push({ inlineData: logoInline });
  }

  // Format-Direktive ist bereits als ERSTER Part platziert (siehe oben).

  // gemini-3* image models support imageConfig.aspectRatio; older 2.5 ignores it
  const supportsAspectField = /^gemini-3/.test(model);
  const generationConfig: Record<string, unknown> = {
    responseModalities: ["TEXT", "IMAGE"],
    temperature: 0.7,
  };
  if (supportsAspectField && width && height) {
    (generationConfig as any).imageConfig = { aspectRatio: aspectLabel };
  }

  // Stay well below Lovable Cloud's 150s idle limit so fallbacks can run instead of causing a hard 504.
  const modelBudgetMs = /^gemini-3-pro/.test(model) ? 38_000 : /^gemini-3/.test(model) ? 34_000 : 28_000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutMs = modelBudgetMs;
    try {
      const remainingMs = EDGE_DEADLINE_MS - (Date.now() - requestStartedAt);
      if (remainingMs < 12_000) throw new Error("Banner generation deadline reached before model fallback");
      timeoutMs = Math.max(8_000, Math.min(modelBudgetMs, remainingMs - 5_000));
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
        console.error(`Gemini banner attempt ${attempt + 1}:`, response.status, errText);
        if ([400, 401, 403].includes(response.status) && /API_KEY_INVALID|API Key not found|invalid api key/i.test(errText)) {
          throw new Error("GEMINI_API_KEY ungültig oder nicht für Gemini freigeschaltet");
        }
        if ((response.status === 429 || response.status === 503 || response.status === 500) && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
        throw new Error(`Gemini error: ${response.status}`);
      }

      const data = await response.json();
      const respParts = data.candidates?.[0]?.content?.parts;
      if (!respParts) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
        throw new Error("No banner generated (Gemini)");
      }

      for (const part of respParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return `data:${mime};base64,${part.inlineData.data}`;
        }
      }

      if (attempt < retries) { await new Promise(r => setTimeout(r, 1500)); continue; }
      throw new Error("No image data in Gemini response");
    } catch (e: any) {
      const isAbort = e?.name === "AbortError";
      console.error(`Gemini banner attempt ${attempt + 1} failed${isAbort ? " (timeout)" : ""}:`, e?.message);
      if (attempt >= retries) throw isAbort ? new Error(`Gemini timeout (${Math.round(timeoutMs/1000)}s)`) : e;
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
