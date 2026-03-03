import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, vehicleDescription } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!imageBase64) throw new Error("No image provided");

    const prompt = `You are a professional automotive photographer. Take this exact vehicle photo and remaster it into a premium car dealership showroom setting.

CRITICAL RULES - YOU MUST FOLLOW:
- Keep the EXACT same vehicle with ALL its details: color, wheels/rims, body kit, lights, badges, decals, accessories, license plate area, and every visible feature
- Do NOT change, add, or remove ANY vehicle detail - the car must be 100% identical
- Only change the ENVIRONMENT/BACKGROUND to a modern, bright, luxurious car dealership showroom
- Add realistic new lighting: soft overhead showroom lights, subtle reflections on the paint and windows
- Add realistic shadows beneath the vehicle matching the new lighting
- The floor should be polished/reflective (like a real showroom)
- Make it look like a professional dealership photo shoot
- Keep the same camera angle and perspective as the original
- The result must be photorealistic

${vehicleDescription ? `Vehicle: ${vehicleDescription}` : ''}

Remaster this vehicle photo into a luxury showroom setting while preserving every single detail of the car.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageBase64 },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Remaster error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte warte kurz." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI Credits aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Remaster error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Remaster response structure:", JSON.stringify({
      hasChoices: !!data.choices,
      messageKeys: data.choices?.[0]?.message ? Object.keys(data.choices[0].message) : [],
      contentType: typeof data.choices?.[0]?.message?.content,
      contentPreview: typeof data.choices?.[0]?.message?.content === 'string' 
        ? data.choices[0].message.content.substring(0, 200) 
        : Array.isArray(data.choices?.[0]?.message?.content)
          ? JSON.stringify(data.choices[0].message.content.map((p: any) => ({ type: p.type })))
          : 'unknown',
      hasImages: !!data.choices?.[0]?.message?.images,
    }));

    // Try multiple response structures
    let resultImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // Fallback: check if image is in content array
    if (!resultImage && Array.isArray(data.choices?.[0]?.message?.content)) {
      const imgPart = data.choices[0].message.content.find((p: any) => p.type === 'image_url');
      resultImage = imgPart?.image_url?.url;
    }

    if (!resultImage) {
      console.error("No image found in remaster response. Full response:", JSON.stringify(data).substring(0, 1000));
      throw new Error("Kein Bild generiert. Bitte versuche es erneut.");
    }

    return new Response(JSON.stringify({ imageBase64: resultImage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("remaster-vehicle-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
