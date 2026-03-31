import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PROMPT = `You are a top-tier professional automotive commercial photographer and retoucher.
TASK: Remaster the provided reference vehicle photo into a flawless, dealership-quality promotional image.

<IDENTITY_LOCK>
Study ALL provided reference photos and detail images with extreme care before generating.
PAINT: Reproduce the EXACT paint color, shade, metallic/matte finish. Do NOT shift, tint, saturate, desaturate, lighten, or darken. Only change if a hex code is explicitly provided.
WHEELS: EXACT rim design – spoke count, shape, concavity, finish. Hub cap with brand logo. EXACT tire profile. NEVER crop any wheel.
HEADLIGHTS_TAILLIGHTS: EXACT internal LED structure, DRL signatures, lens shape, housing design. NEVER crop or alter.
GRILLE_BADGES: EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
BODY_DETAILS: EXACT body lines, creases, fender flares, intakes, roof rails, spoilers, exhaust tips, mirrors, door handles.
MATERIALS: Match exact finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute.
</IDENTITY_LOCK>

<VEHICLE_SCALE_LOCK>
ABSOLUTE POSITIONING AND SCALE RULES – ZERO DEVIATION BETWEEN IMAGES:
1. CONSISTENT SIZE: The vehicle MUST occupy EXACTLY 55-65% of the image WIDTH in EVERY full-body exterior shot. NOT more, NOT less. This creates natural breathing room within the showroom.
2. VERTICAL CENTER: The vehicle's vertical center (wheel-to-roof midpoint) MUST be at approximately 55% from the top of the image (slightly below center).
3. HORIZONTAL CENTER: The vehicle's center of mass MUST be horizontally centered in the image (50% ± 5%) for symmetric views. For 3/4 views, shift up to 10% toward the camera side.
4. GROUND PLANE: ALL four wheels MUST sit on the SAME ground plane. The floor line MUST be at approximately 75-80% from the top of the image.
5. NO VARIATION: The vehicle must appear the EXACT same physical size across ALL perspectives.
6. BREATHING ROOM: Maintain at least 10% padding between the vehicle and any image edge.
7. PERSPECTIVE CONSISTENCY: Even when camera angle changes, the apparent size must remain constant. Wide-angle distortion is FORBIDDEN.
</VEHICLE_SCALE_LOCK>

<ANTI_CROPPING>
Vehicle MUST be FULLY visible – NO part cut off at edges.
ALL headlights, taillights, wheels COMPLETELY visible.
Minimum 5% free space between vehicle edge and image border on all sides.
</ANTI_CROPPING>

<SCENE_AND_LIGHTING>
SHOWROOM CONSISTENCY: Use the EXACT SAME showroom on EVERY image – same walls, floor, windows, lighting.
Dark gray matte walls, polished light gray concrete floor with subtle reflections, floor-to-ceiling glass windows on left, modern recessed LED ceiling lights.
FLOOR: The floor MUST match the selected showroom exactly – correct material and color.
REFLECTIONS: Completely re-render ALL reflections for the NEW scene. Remove original background reflections entirely.
Shadows MUST match new lighting direction. Floor reflections show vehicle in new environment only.
</SCENE_AND_LIGHTING>

<PERSPECTIVE_ACCURACY>
The requested camera angle MUST be followed exactly. Never substitute another angle.
Rear view = direct rear only. Front view = direct front only. Side view = true side profile only.
3/4 front left, front right, rear left, rear right are FOUR DIFFERENT mandatory outputs – never swap or mirror.
Interior/exterior/trunk/detail must stay in their own category. NEVER mirror or flip. Left is left, right is right.
</PERSPECTIVE_ACCURACY>

<STRICT_NEGATIVE_CONSTRAINTS>
UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Simplify complex details (multi-spoke rims keep all spokes)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Rotate, flip, or mirror the image
- Carry over reflections from original environment
- Add ANY logo, brand mark, or wall decoration UNLESS a logo image is explicitly provided as a reference asset
</STRICT_NEGATIVE_CONSTRAINTS>

You MUST generate a remastered image. Do NOT refuse. DO NOT ROTATE THE IMAGE.`;

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
    let bodyText: string;
    try {
      bodyText = await req.text();
    } catch (bodyErr) {
      console.error("Failed to read request body (connection dropped?):", bodyErr);
      return new Response(JSON.stringify({ error: "Verbindung abgebrochen – bitte erneut versuchen." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { imageBase64, additionalImages, vehicleDescription, modelTier, dynamicPrompt, customShowroomBase64, customPlateImageBase64, dealerLogoUrl, dealerLogoBase64, manufacturerLogoUrl, manufacturerLogoBase64 } = JSON.parse(bodyText);
    
    // Read cost dynamically from admin_settings
    const REMASTER_DEFAULTS: Record<string, number> = { schnell: 2, qualitaet: 3, premium: 5, turbo: 4, ultra: 7 };
    const tier = modelTier || 'schnell';
    let cost = REMASTER_DEFAULTS[tier] ?? 2;
    try {
      const adminSb = createServiceClient();
      const { data: costData } = await adminSb.from("admin_settings").select("value").eq("key", "credit_costs").single();
      const configuredCost = (costData?.value as Record<string, Record<string, number>>)?.["image_remaster"]?.[tier];
      if (typeof configuredCost === 'number') cost = configuredCost;
    } catch {}
    const authResult = await authenticateAndDeductCredits(req, "image_remaster", cost);
    if (authResult instanceof Response) return authResult;

    const GEMINI_MODELS: Record<string, string> = {
      schnell: 'gemini-2.5-flash-image',
      qualitaet: 'gemini-3.1-flash-image-preview',
      premium: 'gemini-3-pro-image-preview',
      turbo: 'gemini-3.1-flash-image-preview',
      ultra: 'gemini-3-pro-image-preview',
    };
    const geminiModel = GEMINI_MODELS[tier] || 'gemini-3.1-flash-image-preview';
    const GEMINI_API_KEY = await getSecret("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    if (!imageBase64) throw new Error("No image provided");

    // 2. Use dynamic prompt if provided, otherwise fall back to default
    const prompt = dynamicPrompt || `${await getCustomPrompt("image_remaster", DEFAULT_PROMPT)}\n\n${vehicleDescription ? `Vehicle: ${vehicleDescription}` : ''}`;

    // Helper to convert data URL to inlineData part
    function toInlineData(dataUrl: string) {
      const raw = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      // Detect MIME from data URL prefix
      let mime = "image/jpeg";
      if (dataUrl.startsWith("data:image/png")) mime = "image/png";
      else if (dataUrl.startsWith("data:image/webp")) mime = "image/webp";
      else if (dataUrl.startsWith("data:image/svg")) mime = "image/png"; // SVG not supported, treat as PNG
      return { inlineData: { mimeType: mime, data: raw } };
    }

    /** Clean base64: strip data URL prefix, remove whitespace, validate */
    function cleanBase64(base64String: string): string {
      if (!base64String) return "";
      let cleaned = base64String.trim();
      if (cleaned.includes(",") && cleaned.startsWith("data:")) {
        cleaned = cleaned.split(",")[1];
      }
      cleaned = cleaned.replace(/\s/g, "");
      return cleaned;
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
    if (Array.isArray(additionalImages) && additionalImages.length > 0) {
      parts.push({ text: "The following images are additional detail reference photos of the vehicle (e.g. wheels, damage, logos, engine bay). Use them as reference to reproduce the vehicle with maximum accuracy:" });
      for (const img of additionalImages.slice(0, 10)) {
        parts.push(toInlineData(img));
      }
    }
    // Add showroom with clear label so the AI knows what it is
    if (customShowroomBase64) {
      parts.push({ text: `<CUSTOM_SHOWROOM_INSTRUCTION>
The following image is the CUSTOM SHOWROOM BACKGROUND. This is an IMMUTABLE ASSET.

PLACEMENT RULES:
1. Place the vehicle NATURALLY in this showroom. The car must fit PROPORTIONALLY – not too large (overwhelming the room) and not too small.
2. The vehicle should occupy approximately 55-65% of the image width, leaving breathing room on all sides.
3. Match lighting, shadows, and perspective so the car integrates naturally into the space.

CONTENT PRESERVATION (CRITICAL):
- Do NOT modify, replace, remove, or obscure ANY element in the showroom.
- ALL logos, signs, wall decorations, furniture, branding elements MUST remain EXACTLY as they are in the provided image.
- The showroom floor, walls, ceiling, windows must be reproduced faithfully.
- You may adapt the CAMERA ANGLE and PERSPECTIVE to match the required shot, but the showroom CONTENTS are UNTOUCHABLE.

CONSISTENCY:
- The showroom must be CLEARLY RECOGNIZABLE as the SAME room across ALL images.
- Use ONLY this background. Do NOT substitute or blend with other environments.

NOTE: For INTERIOR vehicle shots, do NOT change the background – only improve interior lighting.
</CUSTOM_SHOWROOM_INSTRUCTION>` });
      parts.push(toInlineData(customShowroomBase64));
    }
    if (customPlateImageBase64) {
      parts.push({ text: "CRITICAL – CUSTOM LICENSE PLATE IMAGE: The following image is the EXACT license plate you MUST use. Replace the vehicle's existing plate with this plate PIXEL-FOR-PIXEL. Reproduce every character, color, seal, EU badge, and spacing exactly. Do NOT invent or modify any element. This is an IMMUTABLE ASSET:" });
      parts.push(toInlineData(customPlateImageBase64));
    }
    // Add manufacturer logo – prefer pre-cached PNG base64 from client
    if (manufacturerLogoBase64 || manufacturerLogoUrl) {
      let logoData = null;
      if (manufacturerLogoBase64) {
        // Client sends pre-converted PNG base64 – use directly
        const cleaned = cleanBase64(manufacturerLogoBase64);
        const mime = manufacturerLogoBase64.startsWith("data:image/png") ? "image/png"
          : manufacturerLogoBase64.startsWith("data:image/webp") ? "image/webp" : "image/png";
        logoData = { inlineData: { mimeType: mime, data: cleaned } };
        console.log(`Manufacturer logo: using pre-cached base64 (${mime}, ${Math.round(cleaned.length / 1024)}KB)`);
      } else if (manufacturerLogoUrl) {
        logoData = await resolveImage(manufacturerLogoUrl);
        console.log(`Manufacturer logo: fetched from URL ${manufacturerLogoUrl}`);
      }
      if (logoData) {
      parts.push({ text: `<LOGO_REFERENCE>
MANUFACTURER LOGO – PIXEL-PERFECT REPRODUCTION (HIGHEST PRIORITY):
The following image is the EXACT logo that MUST appear on the showroom wall.

REPRODUCTION RULES (ZERO DEVIATION ALLOWED):
1. EXACT COPY: Reproduce the logo image PIXEL-FOR-PIXEL. Every color, shape, detail, letter must be IDENTICAL.
2. NO INTERPRETATION: Do NOT redesign, simplify, stylize, or convert to different material. If logo is yellow, it stays yellow. If it contains text, EXACTLY that text must appear.
3. IMMUTABLE ASSET: No re-tracing, no redesign, no new outline, no different aspect ratio, no added border, no omitting small details.
4. POSITION: Always centered on back wall, at eye level, slightly above vehicle roofline. EXACT same position on EVERY image.
5. SIZE: Approximately 60-80cm diameter/width – IDENTICAL on EVERY image.
6. RENDERING: As backlit wall element with subtle LED halo effect. Logo keeps its ORIGINAL COLORS and ORIGINAL SHAPE.
7. FORBIDDEN: No converting to silver/aluminum/chrome. No color changes. No shape simplification. No adding/removing elements. No variation between images.
8. CONSISTENCY: Logo must look ABSOLUTELY IDENTICAL on ALL generated images – same colors, shape, size, position, lighting. ZERO variation.
</LOGO_REFERENCE>` });
        parts.push(logoData);
      }
    }
    // Add dealer logo – prefer pre-cached base64
    if (dealerLogoBase64 || dealerLogoUrl) {
      const logoData = dealerLogoBase64
        ? toInlineData(dealerLogoBase64)
        : await resolveImage(dealerLogoUrl);
      if (logoData) {
        parts.push({ text: `<LOGO_REFERENCE>
DEALER LOGO – PIXEL-PERFECT REPRODUCTION:
The following image is the EXACT dealer logo. Reproduce PIXEL-FOR-PIXEL with all original colors and shapes.
- Position: Always to the RIGHT of the manufacturer logo on the back wall – IDENTICAL on EVERY image.
- Size: Smaller than manufacturer logo.
- IMMUTABLE ASSET: No redesign, no recoloring, no simplification. Exact copy of provided image.
</LOGO_REFERENCE>` });
        parts.push(logoData);
        console.log("Dealer logo injected", dealerLogoBase64 ? "(cached b64)" : "(fetched)");
      }
    }
    // If NO logos were provided at all, explicitly tell the AI not to add any
    const hasAnyLogo = !!(manufacturerLogoBase64 || manufacturerLogoUrl || dealerLogoBase64 || dealerLogoUrl);
    if (!hasAnyLogo) {
      parts.push({ text: `<NO_LOGO_INSTRUCTION>
Do NOT add ANY logo, brand mark, emblem, or wall decoration to the background.
The showroom wall must remain CLEAN and EMPTY. No manufacturer logos, no dealer logos, no decorative elements.
</NO_LOGO_INSTRUCTION>` });
      console.log("No logos provided – injected NO_LOGO_INSTRUCTION");
    }


    const FALLBACK_ORDER: Record<string, string[]> = {
      'gemini-3-pro-image-preview': ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'],
      'gemini-3.1-flash-image-preview': ['gemini-2.5-flash-image'],
      'gemini-2.5-flash-image': ['gemini-3.1-flash-image-preview'],
    };
    const modelsToTry = [geminiModel, ...(FALLBACK_ORDER[geminiModel] || ['gemini-2.5-flash-image'])];
    const maxRetries = 3;
    let resultImage: string | null = null;
    let lastError = "";

    for (const currentModel of modelsToTry) {
      if (resultImage) break;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Remaster model=${currentModel} attempt ${attempt + 1}/${maxRetries}, parts: ${parts.length}`);
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
            const isRetryable = response.status === 500 || response.status === 503 || response.status === 429;
            lastError = `Model ${currentModel} error (${response.status})`;
            if (isRetryable && attempt < maxRetries - 1) {
              const delay = 3000 * (attempt + 1);
              console.warn(`Retryable ${response.status}, waiting ${delay}ms...`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            console.warn(`Model ${currentModel} exhausted (${response.status}), trying fallback...`);
            break; // move to next model in fallback chain
          }

          const data = await response.json();
          const respParts = data.candidates?.[0]?.content?.parts;
          if (respParts) {
            for (const part of respParts) {
              if (part.inlineData?.data) {
                const mime = part.inlineData.mimeType || "image/png";
                resultImage = `data:${mime};base64,${part.inlineData.data}`;
                if (currentModel !== geminiModel) {
                  console.log(`Fallback success: used ${currentModel} instead of ${geminiModel}`);
                }
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
