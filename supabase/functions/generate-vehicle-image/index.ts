import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModelConfig {
  engine: "gemini" | "openai";
  model: string;
  defaultCost: number;
}

const MODEL_MAP: Record<string, ModelConfig> = {
  schnell:   { engine: "gemini", model: "gemini-2.5-flash-image", defaultCost: 3 },
  qualitaet: { engine: "gemini", model: "gemini-3.1-flash-image-preview", defaultCost: 5 },
  premium:   { engine: "gemini", model: "gemini-3-pro-image-preview", defaultCost: 8 },
  turbo:     { engine: "openai", model: "gpt-image-1", defaultCost: 6 },
  ultra:     { engine: "openai", model: "gpt-image-1", defaultCost: 10 },
  neu:       { engine: "openai", model: "gpt-image-2", defaultCost: 12 },
  // Legacy fallbacks
  standard:  { engine: "gemini", model: "gemini-2.5-flash-image", defaultCost: 3 },
  pro:       { engine: "gemini", model: "gemini-3-pro-image-preview", defaultCost: 8 },
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getCreditCost(actionType: string, modelTier: string, defaultCost: number): Promise<number> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "credit_costs").single();
    const costs = data?.value as Record<string, Record<string, number>> | null;
    return costs?.[actionType]?.[modelTier] ?? defaultCost;
  } catch { return defaultCost; }
}

async function authenticateAndDeductCredits(req: Request, actionType: string, cost: number): Promise<{ userId: string } | Response> {
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
    _user_id: user.id, _amount: cost, _action_type: actionType, _description: `${actionType} (serverseitig)`,
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
    const { imagePrompt, imagePrompts, modelTier } = await req.json();
    
    const config = MODEL_MAP[modelTier] || MODEL_MAP["schnell"];
    const costPerImage = await getCreditCost("image_generate", modelTier || "schnell", config.defaultCost);

    const totalImages = imagePrompts ? imagePrompts.length : 1;
    const totalCost = totalImages * costPerImage;

    const authResult = await authenticateAndDeductCredits(req, "image_generate", totalCost);
    if (authResult instanceof Response) return authResult;

    if (imagePrompt && !imagePrompts) {
      const result = await generateImage(imagePrompt, config);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (imagePrompts && Array.isArray(imagePrompts)) {
      const results: { imageBase64: string | null; error?: string }[] = [];
      for (const prompt of imagePrompts) {
        try {
          const result = await generateImage(prompt, config);
          results.push(result);
        } catch (e) {
          console.error("Image gen error for prompt:", e);
          results.push({ imageBase64: null, error: e instanceof Error ? e.message : "Unknown error" });
        }
      }
      return new Response(JSON.stringify({ images: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No image prompt(s) provided");
  } catch (e) {
    console.error("generate-vehicle-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateImage(prompt: string, config: ModelConfig, retries = 2): Promise<{ imageBase64: string | null; error?: string }> {
  if (config.engine === "openai") {
    return generateImageOpenAI(prompt, config.model, retries);
  }
  return generateImageGemini(prompt, config.model, retries);
}

async function generateImageGemini(prompt: string, model: string, retries: number): Promise<{ imageBase64: string | null; error?: string }> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Gemini attempt ${attempt + 1}:`, response.status, errText);
        if (response.status === 429 && attempt < retries) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`Gemini error: ${response.status}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts;
      if (!parts) { if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; } throw new Error("No image generated (Gemini)"); }

      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          return { imageBase64: `data:${mimeType};base64,${part.inlineData.data}` };
        }
      }

      if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw new Error("No image data in Gemini response");
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error("No image generated after retries (Gemini)");
}

async function generateImageOpenAI(prompt: string, model: string, retries: number): Promise<{ imageBase64: string | null; error?: string }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const url = "https://api.openai.com/v1/images/generations";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024", output_format: "b64_json" }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`OpenAI attempt ${attempt + 1}:`, response.status, errText);
        if (response.status === 429 && attempt < retries) { await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); continue; }
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`OpenAI error: ${response.status}`);
      }

      const data = await response.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) { if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; } throw new Error("No image data in OpenAI response"); }

      return { imageBase64: `data:image/png;base64,${b64}` };
    } catch (e) {
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error("No image generated after retries (OpenAI)");
}
