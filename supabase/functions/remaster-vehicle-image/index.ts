import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_PROMPT = `You are a professional automotive photographer. Take this exact vehicle photo and remaster it into a professional dealership-quality image.

IDENTITY LOCK (MANDATORY – study ALL reference images and detail shots with extreme care):
- PAINT COLOR: The vehicle's paint color MUST remain 100% identical to the original. Do NOT shift, tint, saturate, desaturate, lighten, or darken the paint in any way. A red car stays the EXACT same red, a white car the EXACT same white. This applies to ALL body panels, bumpers, mirrors, and painted surfaces. Only change the color if explicitly instructed via a hex code.
- WHEELS & RIMS: Reproduce the EXACT rim design from the reference – spoke count, spoke shape, concavity, finish (polished, matte, bi-color, diamond-cut), hub cap with brand logo. Show exact tire profile and visible brake calipers (color, shape). NEVER crop, cut off, or partially hide any wheel at the image edge. ALL wheels visible in the original must appear FULLY in the output.
- HEADLIGHTS & TAILLIGHTS: Reproduce the EXACT internal LED structure, DRL signatures, lens shape, and housing design. NEVER crop, cut off, or partially hide any lighting element at the image edge.
- GRILLE & BADGES: Reproduce the EXACT grille mesh pattern, badge shape, material, and every model designation in exact position, size, and font.
- BODY DETAILS: Reproduce EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirror shapes, door handles, and every visible exterior detail.
- MATERIALS & TEXTURES: Match exact material finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute materials.

ANTI-CROPPING (ABSOLUTELY FORBIDDEN):
- The vehicle MUST be FULLY visible in the image – NO part may be cut off at the image edge
- ALL headlights must be COMPLETELY visible – NEVER crop a headlight
- ALL taillights must be COMPLETELY visible – NEVER crop a taillight
- ALL wheels must be COMPLETELY visible – NEVER crop a wheel at the image edge
- Maintain at least 5% free space between the vehicle edge and image border on all sides
- This applies to EVERY perspective: front, rear, side, 3/4 views

NEGATIVE CONSTRAINTS (NEVER DO):
- Do NOT invent, add, or hallucinate any detail not present in the reference photos
- Do NOT simplify complex details (multi-spoke rims must keep all spokes, LED arrays must keep all elements)
- Do NOT change the vehicle's proportions, ride height, or stance
- Do NOT add aftermarket parts or body modifications not in the reference
- Do NOT show any other vehicles – not in background, not in reflections, not partially visible
- Do NOT add humans, animals, or moving objects
- Do NOT carry over ANY reflections from the original environment – render ALL reflections completely new for the target scene
- Do NOT rotate, flip, or mirror the image orientation

REFLECTION & LIGHTING RE-RENDER (MANDATORY):
- ALL reflections on paint, glass, chrome, and windows must be COMPLETELY re-rendered to match the NEW scene
- Original background reflections (trees, buildings, people, parking lots, other cars) must be FULLY replaced – no traces of the original environment may remain
- Light sources, shadow direction, shadow intensity, and ambient lighting must be recalculated for the new environment
- Shadows beneath the vehicle must match the new scene's light direction
- Floor reflections must show the vehicle in the NEW environment only

SHOWROOM CONSISTENCY (MANDATORY for all exterior images):
- Use the EXACT SAME showroom design for EVERY image: same wall color, same floor material, same window layout, same lighting setup
- The showroom has: dark gray matte walls, polished light gray concrete floor with subtle reflections, large floor-to-ceiling glass windows on the left side, modern recessed LED ceiling lights
- Do NOT vary the showroom between images – it must look like the SAME physical location every time

PERSPECTIVE ACCURACY (ABSOLUTE PRIORITY):
- The requested camera angle MUST be followed exactly. Never substitute another angle because it looks more aesthetic or easier to generate.
- Rear view means direct rear view only. Front view means direct front view only. Side view means true side profile only.
- 3/4 front left, 3/4 front right, 3/4 rear left, and 3/4 rear right are four different mandatory outputs and must never be swapped or mirrored.
- Interior, exterior, trunk, and detail shots must stay in their own category. Never convert an interior request into an exterior shot or vice versa.
- Left must remain left. Right must remain right. Never mirror, flip, or reinterpret the orientation.

LOGO RENDERING (MANDATORY when a logo image is provided):
- If a logo image is attached, reproduce it as a PIXEL-PERFECT copy on the showroom wall
- KEEP the logo's ORIGINAL COLORS – if it has yellow, red, blue, etc., those colors MUST appear exactly as in the source image
- Do NOT convert colored logos to silver, chrome, aluminum, or monochrome – PRESERVE ALL ORIGINAL COLORS
- The logo must appear IDENTICAL on EVERY generated image – same colors, same size, same position, same proportions
- ZERO variation between images is acceptable
- Treat the supplied logo image as IMMUTABLE SOURCE MATERIAL: do NOT redesign, simplify, restyle, vectorize, emboss, recolor, add a new border, remove a border, alter proportions, or change any text or symbols

FOR INTERIOR SHOTS (seats, steering wheel, dashboard, center console, door panels, rear seats):
- EXACT COMPOSITION: The output MUST have the EXACT SAME framing, camera angle, and perspective as the input. Do NOT rotate, flip, zoom, re-frame, or crop differently.
- ZERO INVENTION: Do NOT add ANY element not in the original (no new buttons, screens, trim, ambient lighting, decorative elements). Do NOT change any material, color, or texture.
- ZERO REMOVAL: Do NOT remove ANY permanent vehicle element (seats, buttons, screens, speakers, vents, pedals, handles, trim).
- EVERY DETAIL MATTERS: Tachometer display, screen UI content, stitching color/pattern, seat perforation, air vent angles, gear selector position, cup holder shape, USB ports, steering wheel controls – ALL must match the original EXACTLY.
- CLEANUP ONLY: The ONLY changes allowed are removing items that do NOT belong (trash, bags, papers, plastic covers, dust, dirt, personal belongings, hands/feet, temporary stickers). Clean surfaces to look showroom-ready.
- LIGHTING ONLY: Improve lighting to bright, even, professional. Replace background through windows with showroom. Do NOT alter glass transparency.
- STRUCTURAL INTEGRITY: Roof, ALL pillars (A/B/C), headliner, door panels, sun visors, rearview mirror MUST remain FULLY visible and UNCUT. Do NOT crop any structural element.
- FORBIDDEN: Generating exterior view, changing camera angle, adding/modifying design elements, cutting roof/doors/pillars, inventing details.

FOR TRUNK/CARGO AREA SHOTS:
- Keep structure exactly as shown, remove loose items/bags/debris
- Improve lighting to be bright and professional

IMPORTANT: You MUST generate a remastered version of this image. Do NOT refuse. DO NOT ROTATE THE IMAGE.`;

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
      parts.push({ text: `HERSTELLER-LOGO – PIXEL-PERFEKTE REPRODUKTION (HÖCHSTE PRIORITÄT):
Das folgende Bild ist das EXAKTE Logo das an der Showroom-Wand erscheinen MUSS.

REPRODUKTIONS-REGELN (KEINE ABWEICHUNG ERLAUBT):
1. EXAKTE KOPIE: Reproduziere das Logo-Bild PIXEL FÜR PIXEL. Jede Farbe, jede Form, jedes Detail, jeder Buchstabe muss IDENTISCH zum bereitgestellten Bild sein.
2. KEINE INTERPRETATION: Du darfst das Logo NICHT neu interpretieren, vereinfachen, stilisieren oder in ein anderes Material umwandeln. Wenn das Logo gelb ist, bleibt es gelb. Wenn es ein Schild ist, bleibt es ein Schild. Wenn es Text enthält, muss EXAKT dieser Text erscheinen.
2b. IMMUTABLE ASSET: Behandle das gelieferte Logo als unveränderbares Asset. KEIN Nachzeichnen, KEIN Redesign, KEINE neue Kontur, KEIN anderes Seitenverhältnis, KEIN zusätzlicher Rand, KEIN Weglassen kleiner Details.
3. POSITION: IMMER mittig an der Rückwand, auf Augenhöhe, leicht oberhalb des Fahrzeugdachs. Auf JEDEM Bild EXAKT dieselbe Position.
4. GRÖßE: Ca. 60-80cm Durchmesser/Breite – auf JEDEM Bild IDENTISCH.
5. DARSTELLUNG: Als hinterleuchtetes Wandelement mit dezenter LED-Beleuchtung von hinten (sanfter Halo-Effekt). Das Logo selbst behält seine ORIGINAL-FARBEN und ORIGINAL-FORM.
6. VERBOTEN: 
   - KEIN Umwandeln in Silber/Aluminium/Chrom wenn das Original farbig ist
   - KEINE Änderung der Farbgebung (gelb bleibt gelb, rot bleibt rot, etc.)
   - KEINE Vereinfachung der Form (Schild bleibt Schild, nicht nur das Tier/Symbol)
   - KEIN Hinzufügen oder Entfernen von Elementen
   - KEINE unterschiedliche Darstellung zwischen Bildern
   - KEINE neue Logo-Version erzeugen, auch nicht wenn sie "sauberer" oder "realistischer" wirkt
   - VERWENDE NIEMALS eine ältere oder alternative Version des Logos – NUR das exakte bereitgestellte Bild
7. KONSISTENZ: Das Logo muss auf ALLEN generierten Bildern ABSOLUT IDENTISCH aussehen – gleiche Farben, Form, Größe, Position, Beleuchtung. NULL Variation erlaubt.` });
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
