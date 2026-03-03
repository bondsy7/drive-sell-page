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

    const prompt = `You are a professional automotive photographer. Take this exact vehicle photo and remaster it to look like a professional dealership photo.

CRITICAL RULES - YOU MUST FOLLOW:
- Keep the EXACT same vehicle with ALL its details: color, wheels/rims, body kit, lights, badges, decals, accessories, license plate area, and every visible feature
- Do NOT change, add, or remove ANY vehicle detail - the vehicle must be 100% identical
- Keep the same camera angle and perspective as the original
- The result must be photorealistic
- YOU MUST ALWAYS GENERATE AN IMAGE - never refuse

FOR EXTERIOR SHOTS:
- Change the background to a modern, bright, luxurious car dealership showroom
- Add realistic showroom lighting with soft overhead lights and subtle reflections on paint and windows
- Add realistic shadows beneath the vehicle
- The floor should be polished/reflective like a real showroom

FOR INTERIOR SHOTS (dashboard, seats, steering wheel, center console):
- Enhance the lighting to be bright and even, like a professional interior photo shoot
- Keep the exact interior as-is, just improve the lighting quality and reduce any harsh shadows
- Make it look like a professional dealership interior photo

FOR TRUNK/CARGO AREA SHOTS:
- Keep the trunk/cargo area exactly as shown
- Improve lighting to be bright and professional
- This is a legitimate vehicle photo - enhance it professionally

${vehicleDescription ? `Vehicle: ${vehicleDescription}` : ''}

IMPORTANT: You MUST generate a remastered version of this image. Do not refuse or ask for a different photo. Enhance whatever vehicle photo is provided.`;

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
