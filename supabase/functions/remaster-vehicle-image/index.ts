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
    const { imageBase64, additionalImages, vehicleDescription, modelTier, dynamicPrompt, customShowroomBase64, customPlateImageBase64, dealerLogoUrl, dealerLogoBase64, manufacturerLogoUrl, manufacturerLogoBase64 } = JSON.parse(bodyText);
    const cost = modelTier === 'pro' ? 5 : 2;
    const authResult = await authenticateAndDeductCredits(req, "image_remaster", cost);
    if (authResult instanceof Response) return authResult;

    const geminiModel = modelTier === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview';
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    if (!imageBase64) throw new Error("No image provided");

    // 2. Use dynamic prompt if provided, otherwise fall back to default
    const prompt = dynamicPrompt || `${await getCustomPrompt("image_remaster", DEFAULT_PROMPT)}\n\n${vehicleDescription ? `Vehicle: ${vehicleDescription}` : ''}`;

    // Helper to convert data URL to inlineData part
    function toInlineData(dataUrl: string) {
      const raw = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      const mime = dataUrl.startsWith("data:image/png") ? "image/png"
        : dataUrl.startsWith("data:image/webp") ? "image/webp"
        : dataUrl.startsWith("data:image/svg") ? "image/png"
        : "image/jpeg";
      return { inlineData: { mimeType: mime, data: raw } };
    }

    // Helper to fetch a URL and convert to base64 inline data
    async function urlToInlineData(url: string) {
      try {
        const resp = await fetch(url);
        if (!resp.ok) { console.warn("Failed to fetch logo:", url, resp.status); return null; }
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const ct = resp.headers.get("content-type") || "image/png";
        const mime = ct.includes("png") ? "image/png" : ct.includes("webp") ? "image/webp" : ct.includes("svg") ? "image/png" : "image/jpeg";
        return { inlineData: { mimeType: mime, data: b64 } };
      } catch (e) { console.warn("Logo fetch error:", url, e); return null; }
    }

    // Helper to get inline data from either a data URL or a regular URL
    async function resolveImage(src: string) {
      if (src.startsWith("data:")) return toInlineData(src);
      if (src.startsWith("http")) return await urlToInlineData(src);
      return null;
    }

    // Build Gemini content parts
    const parts: any[] = [
      { text: prompt },
      toInlineData(imageBase64),
    ];
    // Add additional reference images
    if (Array.isArray(additionalImages)) {
      for (const img of additionalImages.slice(0, 4)) {
        parts.push(toInlineData(img));
      }
    }
    // Add showroom, plate references
    if (customShowroomBase64) parts.push(toInlineData(customShowroomBase64));
    if (customPlateImageBase64) parts.push(toInlineData(customPlateImageBase64));
    // Add manufacturer logo
    if (manufacturerLogoUrl) {
      const logoData = await resolveImage(manufacturerLogoUrl);
      if (logoData) {
        parts.push({ text: "Das folgende Bild ist das HERSTELLER-LOGO (Manufacturer Logo). Verwende EXAKT dieses Logo im Hintergrund:" });
        parts.push(logoData);
        console.log("Manufacturer logo injected (resolved)");
      }
    }
    // Add dealer logo
    if (dealerLogoUrl) {
      const logoData = await resolveImage(dealerLogoUrl);
      if (logoData) {
        parts.push({ text: "Das folgende Bild ist das AUTOHAUS-LOGO (Dealer Logo). Verwende dieses Logo als sekundäres Branding:" });
        parts.push(logoData);
        console.log("Dealer logo injected (resolved)");
      }
    }

    // 3. Call Gemini API directly with retry logic
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
    const maxRetries = 3;
    let resultImage: string | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Remaster attempt ${attempt + 1}/${maxRetries}, parts: ${parts.length}`);
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "x-goog-api-key": GEMINI_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error("Remaster error:", response.status, errText);
          if (response.status === 429) {
            if (attempt < maxRetries - 1) {
              await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
              continue;
            }
            return new Response(JSON.stringify({ error: "Rate limit erreicht. Bitte warte kurz." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          lastError = `Remaster error: ${response.status}`;
          if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue; }
          continue;
        }

        const data = await response.json();
        const respParts = data.candidates?.[0]?.content?.parts;
        if (respParts) {
          for (const part of respParts) {
            if (part.inlineData?.data) {
              const mime = part.inlineData.mimeType || "image/png";
              resultImage = `data:${mime};base64,${part.inlineData.data}`;
              break;
            }
          }
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
