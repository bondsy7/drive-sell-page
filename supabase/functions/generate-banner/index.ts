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
      const geminiModels = Array.from(new Set([
        config.model,
        ...(config.model === "gemini-3.1-flash-image-preview" ? ["gemini-2.5-flash-image"] : []),
        ...(config.model === "gemini-3-pro-image-preview" ? ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"] : []),
      ]));
      let lastGeminiError = "";
      for (const geminiModel of geminiModels) {
        try {
          resultImage = await generateGemini(lockedPrompt, imageBase64, logoBase64, geminiModel, maxRetries, width, height);
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

async function generateGemini(prompt: string, imageBase64: string | null, logoBase64: string | null, model: string, retries: number, width?: number, height?: number): Promise<string | null> {
  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeType = imageBase64.startsWith("data:image/png") ? "image/png"
      : imageBase64.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    parts.push({ inlineData: { mimeType, data: base64Data } });
  }
  if (logoBase64) {
    const logoData = logoBase64.includes(",") ? logoBase64.split(",")[1] : logoBase64;
    const logoMime = logoBase64.startsWith("data:image/png") ? "image/png"
      : logoBase64.startsWith("data:image/svg") ? "image/png" : "image/png";
    parts.push({ text: "The following image is the LOGO to be placed in the banner:" });
    parts.push({ inlineData: { mimeType: logoMime, data: logoData } });
  }

  // Inject explicit format instruction so the model composes for the target ratio
  const aspectLabel = width && height ? getGeminiAspectRatio(width, height) : "1:1";
  if (width && height) {
    parts.unshift({
      text: `OUTPUT FORMAT (STRICT): Generate the banner with an aspect ratio of EXACTLY ${aspectLabel} (target ${width}×${height}px). Compose, crop and frame the entire scene to fill this ${aspectLabel} canvas — do NOT default to a square. Layout, vehicle placement and text must be designed specifically for this ${aspectLabel} format.`,
    });
  }

  // gemini-3* image models support imageConfig.aspectRatio; older 2.5 ignores it
  const supportsAspectField = /^gemini-3/.test(model);
  const generationConfig: Record<string, unknown> = { responseModalities: ["TEXT", "IMAGE"] };
  if (supportsAspectField && width && height) {
    (generationConfig as any).imageConfig = { aspectRatio: aspectLabel };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      }, 45_000);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini banner attempt ${attempt + 1}:`, response.status, errText);
        if ([400, 401, 403].includes(response.status) && /API_KEY_INVALID|API Key not found|invalid api key/i.test(errText)) {
          throw new Error("GEMINI_API_KEY ungültig oder nicht für Gemini freigeschaltet");
        }
        if (response.status === 429 && attempt < retries) {
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
      if (attempt >= retries) throw isAbort ? new Error("Gemini timeout (45s)") : e;
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
        // Convert base64 to Blob for multipart upload
        const raw = imageBase64!.includes(",") ? imageBase64!.split(",")[1] : imageBase64!;
        const binaryStr = atob(raw);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: "image/png" });

        const form = new FormData();
        form.append("model", model);
        form.append("image", blob, "vehicle.png");
        
        // Add logo as additional image if provided
        let logoPromptAddition = "";
        if (logoBase64) {
          const logoRaw = logoBase64.includes(",") ? logoBase64.split(",")[1] : logoBase64;
          const logoBinaryStr = atob(logoRaw);
          const logoBytes = new Uint8Array(logoBinaryStr.length);
          for (let j = 0; j < logoBinaryStr.length; j++) logoBytes[j] = logoBinaryStr.charCodeAt(j);
          const logoBlob = new Blob([logoBytes], { type: "image/png" });
          form.append("image", logoBlob, "logo.png");
          logoPromptAddition = "\n\nA LOGO image is also provided. Place it prominently in the banner (corner or near headline). Keep the logo 100% identical.";
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
