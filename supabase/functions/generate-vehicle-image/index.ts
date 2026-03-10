import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL_MAP: Record<string, string> = {
  schnell: "gemini-2.5-flash-image",
  qualitaet: "gemini-3.1-flash-image-preview",
  premium: "gemini-3-pro-image-preview",
  // Legacy fallbacks
  standard: "gemini-2.5-flash-image",
  pro: "gemini-3-pro-image-preview",
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const modelName = MODEL_MAP[modelTier] || MODEL_MAP["schnell"];

    // Calculate total cost based on number of images and tier
    const totalImages = imagePrompts ? imagePrompts.length : 1;
    const costMap: Record<string, number> = { schnell: 3, qualitaet: 5, premium: 8, standard: 3, pro: 8 };
    const costPerImage = costMap[modelTier] || 3;
    const totalCost = totalImages * costPerImage;

    // Auth & credits
    const authResult = await authenticateAndDeductCredits(req, "image_generate", totalCost);
    if (authResult instanceof Response) return authResult;

    // Single image mode (backward compat)
    if (imagePrompt && !imagePrompts) {
      const result = await generateImage(imagePrompt, GEMINI_API_KEY, modelName);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multi image mode
    if (imagePrompts && Array.isArray(imagePrompts)) {
      const results: { imageBase64: string | null; error?: string }[] = [];
      for (const prompt of imagePrompts) {
        try {
          const result = await generateImage(prompt, GEMINI_API_KEY, modelName);
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

async function generateImage(prompt: string, apiKey: string, model: string = "gemini-2.5-flash-image", retries = 2): Promise<{ imageBase64: string | null; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Attempt ${attempt + 1}: Image generation error:`, response.status, errText);
        if (response.status === 429) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
            continue;
          }
          throw new Error("Rate limit erreicht. Bitte warte kurz.");
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`Image gen error: ${response.status}`);
      }

      const data = await response.json();
      
      // Native Gemini API response format: candidates[0].content.parts[]
      const parts = data.candidates?.[0]?.content?.parts;
      if (!parts) {
        console.warn(`Attempt ${attempt + 1}: No parts in response`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error("No image generated after retries");
      }

      // Find the image part (inlineData)
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          const base64DataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
          return { imageBase64: base64DataUrl };
        }
      }

      console.warn(`Attempt ${attempt + 1}: No image data in parts`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw new Error("No image generated after retries");
    } catch (e) {
      if (attempt >= retries) throw e;
      console.warn(`Attempt ${attempt + 1} failed, retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error("No image generated after retries");
}
