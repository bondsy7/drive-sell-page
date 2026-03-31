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

<ANTI_CROPPING>
Vehicle MUST be FULLY visible – NO part cut off at edges.
ALL headlights, taillights, wheels COMPLETELY visible.
Minimum 5% free space between vehicle edge and image border on all sides.
</ANTI_CROPPING>

<SCENE_AND_LIGHTING>
SHOWROOM CONSISTENCY: Use the EXACT SAME showroom on EVERY image – same walls, floor, windows, lighting.
Dark gray matte walls, polished light gray concrete floor with subtle reflections, floor-to-ceiling glass windows on left, modern recessed LED ceiling lights.
REFLECTIONS: Completely re-render ALL reflections for the NEW scene. Remove original background reflections entirely.
Shadows MUST match new lighting direction. Floor reflections show vehicle in new environment only.
</SCENE_AND_LIGHTING>

<PERSPECTIVE_ACCURACY>
The requested camera angle MUST be followed exactly. Never substitute another angle.
Rear view = direct rear only. Front view = direct front only. Side view = true side profile only.
3/4 front left, front right, rear left, rear right are FOUR DIFFERENT mandatory outputs – never swap or mirror.
Interior/exterior/trunk/detail must stay in their own category. NEVER mirror or flip. Left is left, right is right.
</PERSPECTIVE_ACCURACY>

<LOGO_RENDERING>
If a logo image is attached: reproduce it PIXEL-FOR-PIXEL on the showroom wall.
KEEP the logo's ORIGINAL COLORS – do NOT convert to silver/chrome/monochrome.
Logo must appear IDENTICAL on EVERY image – same colors, size, position, proportions. ZERO variation.
Treat as IMMUTABLE ASSET: do NOT redesign, simplify, restyle, recolor, or alter in any way.
</LOGO_RENDERING>

<INTERIOR_RULES>
For interior shots (seats, steering wheel, dashboard, center console, door panels, rear seats):
EXACT COMPOSITION: Same framing, camera angle, perspective as input. Do NOT rotate, flip, zoom, re-frame.
ZERO INVENTION: Do NOT add ANY element not in original. Do NOT change materials or textures.
EVERY DETAIL: Tachometer, screen UI, stitching, seat perforation, air vents, gear selector – ALL match exactly.
CLEANUP ONLY: Remove trash, bags, papers, plastic covers, dust, personal belongings, hands/feet.
LIGHTING ONLY: Improve to bright, even, professional. Replace background through windows with showroom.
STRUCTURAL INTEGRITY: Roof, ALL pillars, headliner, door panels FULLY visible and UNCUT.
FORBIDDEN: Generating exterior from interior reference, changing angle, adding/modifying design, cutting roof/pillars.
</INTERIOR_RULES>

<STRICT_NEGATIVE_CONSTRAINTS>
UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Simplify complex details (multi-spoke rims keep all spokes)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Rotate, flip, or mirror the image
- Carry over reflections from original environment
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
      parts.push({ text: "The following image is the CUSTOM SHOWROOM BACKGROUND. Place the vehicle EXACTLY in this showroom environment. Match lighting, shadows, and perspective so the car integrates naturally. Use ONLY this background. NOTE: For INTERIOR shots, do NOT change background – only improve lighting." });
      parts.push(toInlineData(customShowroomBase64));
    }
    if (customPlateImageBase64) {
      parts.push({ text: "The following image is the CUSTOM LICENSE PLATE. Replace the vehicle's license plate with this exact plate:" });
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
        parts.push({ text: `AUTOHAUS-LOGO – PIXEL-PERFEKTE REPRODUKTION:
Das folgende Bild ist das EXAKTE Autohaus-Logo. Reproduziere es PIXEL FÜR PIXEL mit allen Original-Farben und Original-Formen.
- Position: IMMER rechts neben dem Hersteller-Logo an der Rückwand – auf JEDEM Bild IDENTISCH
- Größe: Kleiner als das Hersteller-Logo
- KEINE Interpretation, KEINE Farbänderung, KEINE Vereinfachung – exakte Kopie des bereitgestellten Bildes
- IMMUTABLE ASSET: keine neue Kontur, kein neues Schild, kein alternativer Font, keine neue Farbwelt` });
        parts.push(logoData);
        console.log("Dealer logo injected", dealerLogoBase64 ? "(cached b64)" : "(fetched)");
      }
    }

    // 3. Call Gemini API directly with retry logic + automatic model fallback
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
