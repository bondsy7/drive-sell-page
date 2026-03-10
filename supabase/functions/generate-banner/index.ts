import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const serviceSb = createServiceClient();
  const { data: result, error: deductError } = await serviceSb.rpc("deduct_credits", {
    _user_id: user.id, _amount: cost, _action_type: "image_generate",
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
  return { userId: user.id };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, imageBase64, modelTier, width, height } = await req.json();
    if (!prompt) throw new Error("No prompt provided");

    const config = MODEL_MAP[modelTier] || MODEL_MAP["premium"];

    // Auth & credits
    const authResult = await authenticateAndDeductCredits(req, config.cost);
    if (authResult instanceof Response) return authResult;

    let resultImage: string | null = null;
    const maxRetries = 3;

    if (config.engine === "gemini") {
      resultImage = await generateGemini(prompt, imageBase64, config.model, maxRetries);
    } else {
      resultImage = await generateOpenAI(prompt, imageBase64, config.model, width, height, modelTier === "ultra", maxRetries);
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

async function generateGemini(prompt: string, imageBase64: string | null, model: string, retries: number): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    // Strip data URL prefix if present
    const base64Data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const mimeType = imageBase64.startsWith("data:image/png") ? "image/png"
      : imageBase64.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    parts.push({ inlineData: { mimeType, data: base64Data } });
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini banner attempt ${attempt + 1}:`, response.status, errText);
        if (response.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
          continue;
        }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`Gemini error: ${response.status}`);
      }

      const data = await response.json();
      const respParts = data.candidates?.[0]?.content?.parts;
      if (!respParts) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error("No banner generated (Gemini)");
      }

      for (const part of respParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return `data:${mime};base64,${part.inlineData.data}`;
        }
      }

      if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw new Error("No image data in Gemini response");
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  return null;
}

async function generateOpenAI(prompt: string, imageBase64: string | null, model: string, width: number, height: number, isUltra: boolean, retries: number): Promise<string | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const size = getOpenAISize(width, height);
  const url = "https://api.openai.com/v1/images/generations";

  // For OpenAI, we can include the vehicle image reference in the prompt
  const fullPrompt = imageBase64
    ? `${prompt}\n\nIMPORTANT: Incorporate the provided vehicle exactly as shown.`
    : prompt;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const body: any = {
        model,
        prompt: fullPrompt,
        n: 1,
        size,
      };
      if (isUltra) body.quality = "high";

      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`OpenAI banner attempt ${attempt + 1}:`, response.status, errText);
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
