import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imagePrompt, imagePrompts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Single image mode (backward compat)
    if (imagePrompt && !imagePrompts) {
      const result = await generateImage(imagePrompt, LOVABLE_API_KEY);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Multi image mode
    if (imagePrompts && Array.isArray(imagePrompts)) {
      const results: { imageBase64: string | null; error?: string }[] = [];
      for (const prompt of imagePrompts) {
        try {
          const result = await generateImage(prompt, LOVABLE_API_KEY);
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

async function generateImage(prompt: string, apiKey: string): Promise<{ imageBase64: string | null; error?: string }> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Image generation error:", response.status, errText);
    if (response.status === 429) throw new Error("Rate limit erreicht. Bitte warte kurz.");
    if (response.status === 402) throw new Error("AI Credits aufgebraucht.");
    throw new Error(`Image gen error: ${response.status}`);
  }

  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!imageUrl) throw new Error("No image generated");

  return { imageBase64: imageUrl };
}
