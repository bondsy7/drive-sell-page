import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

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

PAINT COLOR PRESERVATION (CRITICAL):
- The vehicle's paint/lacquer color MUST remain 100% identical to the original photo
- Do NOT shift, saturate, desaturate, darken, lighten, or alter the paint color in any way
- A red car must stay the EXACT same shade of red, a white car the EXACT same white, etc.
- This applies to ALL body panels, bumpers, mirrors, and painted surfaces
- Only change the paint color if explicitly instructed via a color hex code

WHEEL & HEADLIGHT PRESERVATION (CRITICAL):
- NEVER crop, cut off, or partially remove wheels/rims/tires from the image
- ALL wheels visible in the original photo must be FULLY visible in the output – no cropping at image edges
- NEVER crop, cut off, or alter headlights, taillights, or any lighting elements
- The complete wheel (tire + rim) and all lights must be rendered in full, matching the original exactly

REFLECTION & LIGHTING RE-RENDER (CRITICAL):
- Do NOT carry over any reflections from the original photo's environment into the new scene
- ALL reflections on the paint, glass, chrome, and windows must be COMPLETELY re-rendered to match the NEW scene/showroom environment
- The original background reflections (trees, buildings, people, other cars, parking lots) must be fully replaced with reflections that match the new showroom/scene
- Light sources, shadow direction, shadow intensity, and ambient lighting must all be recalculated and adapted to the new environment
- Shadows beneath the vehicle must match the new scene's light direction and intensity
- Reflections on the floor must show the vehicle in the NEW environment, not remnants of the old one

NO OTHER VEHICLES (CRITICAL):
- No other vehicles may appear in the image – not in the background, not in reflections on glass, paint, chrome, or floor
- Only the one vehicle from the input photo may be visible

FOR EXTERIOR SHOTS:
- Change the background to a modern, bright, luxurious car dealership showroom
- Add realistic showroom lighting with soft overhead lights
- The floor should be polished/reflective like a real showroom
- ALL reflections on the car body and floor must correspond to the NEW showroom environment

FOR INTERIOR SHOTS (seats, steering wheel, dashboard, center console, door panels, rear seats):
- CRITICAL: Do NOT rotate, flip, or change the orientation/angle of the photo in any way
- The camera perspective must remain EXACTLY as in the original photo
- Do NOT add or remove ANY interior elements (seats, buttons, screens, trim, steering wheel, etc.)
- MANDATORY CLEANUP: Remove ALL items that do not belong to the vehicle: trash, bags, papers, plastic covers, protective films, transport packaging, personal belongings, loose items on seats or floor mats, tags, stickers, warning labels (except permanent vehicle labels)
- Clean up BOTH front seats AND rear seats equally – the entire cabin must look showroom-ready
- After cleanup, the seats, floor mats, and surfaces should look clean, pristine, and professionally prepared
- Only enhance the lighting to be bright, even, and professional
- Remove any harsh shadows and make it look like a professional dealership interior photo

FOR TRUNK/CARGO AREA SHOTS:
- Keep the trunk/cargo area structure exactly as shown
- Remove any loose items, bags, or debris that are not factory-installed
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
    if (Array.isArray(additionalImages) && additionalImages.length > 0) {
      parts.push({ text: "Die folgenden Bilder sind zusätzliche Detailaufnahmen des Fahrzeugs (z.B. Felgen, Schäden, Logos, Motorraum). Nutze sie als Referenz, um das Fahrzeug exakt und detailgetreu darzustellen:" });
      for (const img of additionalImages.slice(0, 10)) {
        parts.push(toInlineData(img));
      }
    }
    // Add showroom with clear label so the AI knows what it is
    if (customShowroomBase64) {
      parts.push({ text: "Das folgende Bild ist der EIGENE SHOWROOM-HINTERGRUND. Platziere das Fahrzeug EXAKT in dieser Showroom-Umgebung. Passe Beleuchtung, Schatten und Perspektive an, sodass das Auto natürlich in diese Szene integriert wirkt. Verwende NUR diesen Hintergrund, erfinde keinen anderen. WICHTIG: Dies gilt NUR für EXTERIEUR-Aufnahmen. Bei INTERIEUR-Aufnahmen (Sitze, Lenkrad, Armaturenbrett, Kofferraum) den Hintergrund NICHT ändern, nur die Beleuchtung verbessern." });
      parts.push(toInlineData(customShowroomBase64));
    }
    if (customPlateImageBase64) {
      parts.push({ text: "Das folgende Bild ist das EIGENE NUMMERNSCHILD. Ersetze das Nummernschild des Fahrzeugs durch dieses:" });
      parts.push(toInlineData(customPlateImageBase64));
    }
    // Add manufacturer logo – prefer pre-cached base64
    if (manufacturerLogoBase64 || manufacturerLogoUrl) {
      const logoData = manufacturerLogoBase64
        ? toInlineData(manufacturerLogoBase64)
        : await resolveImage(manufacturerLogoUrl);
      if (logoData) {
        parts.push({ text: "Das folgende Bild ist das HERSTELLER-LOGO (Manufacturer Logo). Verwende EXAKT dieses Logo im Hintergrund:" });
        parts.push(logoData);
        console.log("Manufacturer logo injected", manufacturerLogoBase64 ? "(cached b64)" : "(fetched)");
      }
    }
    // Add dealer logo – prefer pre-cached base64
    if (dealerLogoBase64 || dealerLogoUrl) {
      const logoData = dealerLogoBase64
        ? toInlineData(dealerLogoBase64)
        : await resolveImage(dealerLogoUrl);
      if (logoData) {
        parts.push({ text: "Das folgende Bild ist das AUTOHAUS-LOGO (Dealer Logo). Montiere dieses Logo gut sichtbar an der Rückwand des Showrooms – z.B. als beleuchtetes Wandlogo aus gebürstetem Aluminium mit kaltweißem LED-Halo-Effekt. Das Logo soll prominent und professionell im Hintergrund sichtbar sein. Verwende EXAKT dieses Logo – erfinde KEIN anderes." });
        parts.push(logoData);
        console.log("Dealer logo injected", dealerLogoBase64 ? "(cached b64)" : "(fetched)");
      }
    }

    // 3. Call Gemini API directly with retry logic + automatic model fallback
    const FALLBACK_ORDER: Record<string, string[]> = {
      'gemini-3-pro-image-preview': ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'],
      'gemini-3.1-flash-image-preview': ['gemini-2.5-flash-image'],
    };
    const modelsToTry = [geminiModel, ...(FALLBACK_ORDER[geminiModel] || [])];
    const maxRetries = 2;
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
            if (response.status === 503 || response.status === 429) {
              // Model overloaded – break inner loop to try fallback model
              lastError = `Model ${currentModel} unavailable (${response.status})`;
              if (attempt < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
                continue;
              }
              console.warn(`Model ${currentModel} exhausted, trying fallback...`);
              break; // move to next model in fallback chain
            }
            lastError = `Remaster error: ${response.status}`;
            if (attempt < maxRetries - 1) { await new Promise(r => setTimeout(r, 2000)); continue; }
            break;
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
