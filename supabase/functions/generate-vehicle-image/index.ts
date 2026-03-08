import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const model = modelTier === 'pro' ? 'google/gemini-3-pro-image-preview' : 'google/gemini-2.5-flash-image';

    // Calculate total cost based on number of images
    const totalImages = imagePrompts ? imagePrompts.length : 1;
    const costPerImage = modelTier === 'pro' ? 8 : 3;
    const totalCost = totalImages * costPerImage;

    // Auth & credits
    const authResult = await authenticateAndDeductCredits(req, "image_generate", totalCost);
    if (authResult instanceof Response) return authResult;

    // Single image mode (backward compat)
    if (imagePrompt && !imagePrompts) {
      const result = await generateImage(imagePrompt, LOVABLE_API_KEY, model);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multi image mode
    if (imagePrompts && Array.isArray(imagePrompts)) {
      const results: { imageBase64: string | null; error?: string }[] = [];
      for (const prompt of imagePrompts) {
        try {
          const result = await generateImage(prompt, LOVABLE_API_KEY, model);
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

async function generateImage(prompt: string, apiKey: string, model: string = "google/gemini-2.5-flash-image", retries = 2): Promise<{ imageBase64: string | null; error?: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
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
        if (response.status === 402) throw new Error("AI Credits aufgebraucht.");
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`Image gen error: ${response.status}`);
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imageUrl) {
        console.warn(`Attempt ${attempt + 1}: No image in response`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error("No image generated after retries");
      }

      return { imageBase64: imageUrl };
    } catch (e) {
      if (attempt >= retries) throw e;
      console.warn(`Attempt ${attempt + 1} failed, retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error("No image generated after retries");
}
