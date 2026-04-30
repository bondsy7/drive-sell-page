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
  qualitaet: { engine: "gemini", model: "gemini-3.1-flash-image-preview", cost: 5 },
  premium:   { engine: "gemini", model: "gemini-3-pro-image-preview", cost: 8 },
  turbo:     { engine: "openai", model: "gpt-image-1", cost: 6, supportsSize: true },
  ultra:     { engine: "openai", model: "gpt-image-1", cost: 10, supportsSize: true },
  // Fallbacks
  standard:  { engine: "gemini", model: "gemini-3-pro-image-preview", cost: 8 },
  pro:       { engine: "gemini", model: "gemini-3-pro-image-preview", cost: 8 },
};

// Map requested dimensions to closest OpenAI-supported size
function getOpenAISize(w: number, h: number): string {
  if (w === h) return "1024x1024";
  if (w > h) return "1536x1024";
  return "1024x1536";
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

    const config = MODEL_MAP[modelTier] || MODEL_MAP["premium"];

    // Auth & credits
    const authResult = await authenticateAndDeductCredits(req, config.cost);
    if (authResult instanceof Response) return authResult;

    let resultImage: string | null = null;
    const maxRetries = 1;

    if (config.engine === "gemini") {
      resultImage = await generateGemini(prompt, imageBase64, logoBase64, config.model, maxRetries);
    } else {
      resultImage = await generateOpenAI(prompt, imageBase64, logoBase64, config.model, width, height, modelTier === "ultra", maxRetries);
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

async function generateGemini(prompt: string, imageBase64: string | null, logoBase64: string | null, model: string, retries: number): Promise<string | null> {
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

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }, 55_000);

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
      if (attempt >= retries) throw isAbort ? new Error("Gemini timeout (55s)") : e;
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
        
        form.append("prompt", `${prompt}\n\nIMPORTANT: Use the provided vehicle image as the central hero element. Keep it 100% identical.${logoPromptAddition}`);
        form.append("n", "1");
        form.append("size", size);
        if (isUltra) form.append("quality", "high");

        response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
      } else {
        const body: any = { model, prompt, n: 1, size };
        if (isUltra) body.quality = "high";

        response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`OpenAI banner attempt ${attempt + 1}:`, response.status, errText);
        if ([400, 401, 403].includes(response.status) && /invalid_api_key|Incorrect API key|Unauthorized|forbidden/i.test(errText)) {
          throw new Error("OPENAI_API_KEY ungültig oder nicht freigeschaltet");
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
