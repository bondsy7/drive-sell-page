import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PROMPT = `You are a professional automotive photographer. Take this exact vehicle photo and remaster it to look like a professional dealership photo.

CRITICAL RULES - YOU MUST FOLLOW:
- Keep the EXACT same vehicle with ALL its details: color, wheels/rims, body kit, lights, badges, decals, accessories, license plate area, and every visible feature
- Do NOT change, add, or remove ANY vehicle detail - the vehicle must be 100% identical
- DO NOT ROTATE the image. The output must have the EXACT same orientation as the input
- Keep the same camera angle and perspective as the original
- The result must be photorealistic
- YOU MUST ALWAYS GENERATE AN IMAGE - never refuse

FOR EXTERIOR SHOTS:
- Change the background to a modern, bright, luxurious car dealership showroom
- Add realistic showroom lighting with soft overhead lights and subtle reflections on paint and windows
- Add realistic shadows beneath the vehicle
- The floor should be polished/reflective like a real showroom

FOR INTERIOR SHOTS (dashboard, seats, steering wheel, center console):
- CRITICAL: Do NOT rotate, flip, or change the orientation/angle of the photo in any way
- The camera perspective must remain EXACTLY as in the original photo
- Do NOT add or remove ANY interior elements (seats, buttons, screens, trim, steering wheel, etc.)
- Only enhance the lighting to be bright, even, and professional
- Remove any harsh shadows and make it look like a professional dealership interior photo
- The interior must look clean and tidy but with ALL original details preserved exactly
- If the photo is taken from the front seat looking back, keep that exact perspective
- If the photo is taken from the back seat looking forward, keep that exact perspective

FOR TRUNK/CARGO AREA SHOTS:
- Keep the trunk/cargo area exactly as shown
- Improve lighting to be bright and professional
- This is a legitimate vehicle photo - enhance it professionally

IMPORTANT: You MUST generate a remastered version of this image. Do not refuse or ask for a different photo. Enhance whatever vehicle photo is provided. DO NOT ROTATE THE IMAGE.`;

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function getCustomPrompt(key: string, defaultPrompt: string): Promise<string> {
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
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
    // 1. Auth & credits
    const bodyText = await req.text();
    const { imageBase64, additionalImages, vehicleDescription, modelTier, dynamicPrompt, customShowroomBase64, customPlateImageBase64, dealerLogoUrl, manufacturerLogoUrl } = JSON.parse(bodyText);
    const cost = modelTier === 'pro' ? 5 : 2;
    const authResult = await authenticateAndDeductCredits(req, "image_remaster", cost);
    if (authResult instanceof Response) return authResult;

    const model = modelTier === 'pro' ? 'google/gemini-3-pro-image-preview' : 'google/gemini-2.5-flash-image';
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!imageBase64) throw new Error("No image provided");

    // 2. Use dynamic prompt if provided, otherwise fall back to default
    const prompt = dynamicPrompt || `${await getCustomPrompt("image_remaster", DEFAULT_PROMPT)}\n\n${vehicleDescription ? `Vehicle: ${vehicleDescription}` : ''}`;

    // Build content array with all reference images
    const contentParts: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imageBase64 } },
    ];
    // Add additional reference images (other perspectives of the same vehicle)
    if (Array.isArray(additionalImages)) {
      for (const img of additionalImages.slice(0, 4)) { // max 4 extra to avoid token limits
        contentParts.push({ type: "image_url", image_url: { url: img } });
      }
    }
    // Add showroom, plate references
    if (customShowroomBase64) contentParts.push({ type: "image_url", image_url: { url: customShowroomBase64 } });
    if (customPlateImageBase64) contentParts.push({ type: "image_url", image_url: { url: customPlateImageBase64 } });
    // Add manufacturer logo with label so the AI knows what it is
    if (manufacturerLogoUrl) {
      contentParts.push({ type: "text", text: "Das folgende Bild ist das HERSTELLER-LOGO (Manufacturer Logo). Verwende EXAKT dieses Logo im Hintergrund:" });
      contentParts.push({ type: "image_url", image_url: { url: manufacturerLogoUrl } });
      console.log("Manufacturer logo injected:", manufacturerLogoUrl.substring(0, 80));
    }
    // Add dealer logo with label
    if (dealerLogoUrl) {
      contentParts.push({ type: "text", text: "Das folgende Bild ist das AUTOHAUS-LOGO (Dealer Logo). Verwende dieses Logo als sekundäres Branding:" });
      contentParts.push({ type: "image_url", image_url: { url: dealerLogoUrl } });
      console.log("Dealer logo injected:", dealerLogoUrl.substring(0, 80));
    }

    // 3. Call AI with retry logic
    const maxRetries = 3;
    let resultImage: string | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Remaster attempt ${attempt + 1}/${maxRetries}, content parts: ${contentParts.length}`);
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: contentParts,
            }],
            modalities: ["image", "text"],
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("Remaster error:", response.status, errText);
          if (response.status === 429) {
            if (attempt < maxRetries - 1) {
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
              continue;
            }
            return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte warte kurz." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (response.status === 402) {
            return new Response(JSON.stringify({ error: "AI Credits aufgebraucht." }), {
              status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          lastError = `Remaster error: ${response.status}`;
          continue;
        }

        const data = await response.json();
        resultImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!resultImage && Array.isArray(data.choices?.[0]?.message?.content)) {
          const imgPart = data.choices[0].message.content.find((p: any) => p.type === 'image_url');
          resultImage = imgPart?.image_url?.url;
        }

        if (resultImage) break;

        console.warn(`Attempt ${attempt + 1}: No image in response, retrying...`);
        lastError = "Kein Bild generiert";
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (retryErr) {
        console.error(`Attempt ${attempt + 1} failed:`, retryErr);
        lastError = retryErr instanceof Error ? retryErr.message : "Unknown error";
      }
    }

    if (!resultImage) throw new Error(lastError || "Kein Bild generiert. Bitte versuche es erneut.");

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
