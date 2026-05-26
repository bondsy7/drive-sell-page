import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Fallback block keys (match REMASTER_PROMPT_BLOCKS in client) ──
const FALLBACK_BLOCK_KEYS = [
  'remaster_base_instruction',
  'remaster_identity_lock',
  'remaster_vehicle_scale_lock',
  'remaster_anti_cropping',
  'remaster_negative_constraints',
];

const HARDCODED_BLOCKS: Record<string, { tag: string; text: string }> = {
  remaster_base_instruction: {
    tag: 'BASE',
    text: `You are a top-tier professional automotive commercial photographer and retoucher.
TASK: Remaster the provided reference vehicle photo into a flawless, dealership-quality promotional image.

<OUTPUT_FORMAT>
ASPECT RATIO: The output image MUST be in 4:3 (landscape) format. Width-to-height ratio = 4:3 exactly.
</OUTPUT_FORMAT>`,
  },
  remaster_identity_lock: {
    tag: 'IDENTITY_LOCK',
    text: `PAINT: Reproduce the EXACT paint color, shade, metallic/matte finish. Do NOT shift, tint, saturate, desaturate, lighten, or darken.
WHEELS: EXACT rim design – spoke count, shape, concavity, finish. Hub cap with brand logo. EXACT tire profile. NEVER crop any wheel.
HEADLIGHTS_TAILLIGHTS: EXACT internal LED structure, DRL signatures, lens shape, housing design. NEVER crop or alter.
GRILLE_BADGES: EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
BODY_DETAILS: EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirror shapes, door handles.
MATERIALS: Match exact finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute.`,
  },
  remaster_vehicle_scale_lock: {
    tag: 'VEHICLE_SCALE_LOCK',
    text: `1. Vehicle MUST occupy 55-65% of image WIDTH in every full-body exterior shot.
2. Vertical center at ~55% from top. Horizontal center at 50% ± 5%.
3. ALL four wheels on SAME ground plane, floor line at 75-80% from top.
4. Same physical size across ALL perspectives. At least 10% padding to edges.
5. Wide-angle distortion is FORBIDDEN.`,
  },
  remaster_anti_cropping: {
    tag: 'ANTI_CROPPING',
    text: `Vehicle MUST be FULLY visible – NO part cut off at edges.
ALL headlights, taillights, wheels COMPLETELY visible.
Minimum 5% free space between vehicle edge and image border on all sides.`,
  },
  remaster_negative_constraints: {
    tag: 'STRICT_NEGATIVE_CONSTRAINTS',
    text: `UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Simplify complex details (multi-spoke rims keep all spokes)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Rotate, flip, or mirror the image
- Carry over ANY reflections, mirror images, or window content from the original environment — every reflective surface (paint, glass, side mirrors, chrome, headlights, taillights, wheel rims, glossy trim) MUST mirror ONLY the new scene
- Allow ANY trace of the original surroundings (trees, sky, other cars, buildings, people, photographers, asphalt, parking lines, old dealer logos, banners, watermarks) to appear in reflections, on glass, on chrome, on the paint, or through the windows — NOT EVEN FAINTLY
- Add ANY logo, brand mark, or wall decoration UNLESS explicitly provided`,
  },
};

const REFERENCE_TRUTH_PROTOCOL = `REFERENCE IMAGES ARE THE ONLY SOURCE OF TRUTH.
- Use ONLY the provided vehicle photos, detail shots, and immutable assets.
- Do NOT rely on generic brand/model knowledge, training-memory defaults, catalog imagery, or any imagined external source.
- Every visible attribute must match exactly: color, material, texture, stitching, perforation, trim finish, icons, labels, inscriptions, screen UI, geometry, seams, wear patterns, and proportions.
- If a region is not visible, extend ONLY from immediately adjacent visible evidence with the most conservative continuation possible.
- Never invent a new interior color, upholstery variant, trim insert, badge, text, button legend, or equipment line.`;

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Build fallback prompt dynamically from admin overrides or hardcoded blocks */
async function buildFallbackPrompt(vehicleDescription?: string): Promise<string> {
  let overrides: Record<string, string> = {};
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    overrides = (data?.value as Record<string, string>) || {};
  } catch (e) { console.warn("Fallback prompt: admin_settings load failed, using hardcoded blocks:", e); }

  const parts: string[] = [];
  for (const key of FALLBACK_BLOCK_KEYS) {
    const block = HARDCODED_BLOCKS[key];
    if (!block) continue;
    const override = overrides[key];
    const content = (override && override.trim() && override.trim().toLowerCase() !== 'default')
      ? override : block.text;
    parts.push(`<${block.tag}>\n${content}\n</${block.tag}>`);
  }

  parts.push(`<REFERENCE_TRUTH_PROTOCOL>
${REFERENCE_TRUTH_PROTOCOL}
</REFERENCE_TRUTH_PROTOCOL>`);

  if (vehicleDescription) parts.push(`Vehicle: ${vehicleDescription}`);
  parts.push('You MUST generate a remastered image. Do NOT refuse. DO NOT ROTATE THE IMAGE.');
  return parts.join('\n\n');
}

async function authenticateAndDeductCredits(req: Request, actionType: string, cost: number): Promise<{ userId: string; email?: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    console.error("Auth failed:", error?.message);
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = data.claims.sub as string;
  const email = (data.claims as any)?.email as string | undefined;
  const serviceSb = createServiceClient();
  const { data: result, error: deductError } = await serviceSb.rpc("deduct_credits", {
    _user_id: userId, _amount: cost, _action_type: actionType, _description: `${actionType} (serverseitig)`,
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
  return { userId, email };
}

// DEKRA showroom JSON scene fallback – injected for specific user emails when a custom showroom is used.
const DEKRA_SHOWROOM_USERS = new Set([
  "paul@autoactiva.de",
  "erik.wakolbinger@dekra.de",
  "d.bonds@autoactiva.de",
]);

const DEKRA_SHOWROOM_SCENE_JSON = `{
  "scene_name": "DEKRA_modern_showroom_consistent",
  "scene_type": "modern automotive showroom interior",
  "camera": {
    "view": "wide angle interior view",
    "orientation": "landscape",
    "camera_height": "approximately 1.45 meters",
    "camera_position": "front left side of the showroom, looking diagonally toward the rear feature wall and reception desk",
    "lens": "24mm to 28mm realistic architectural lens",
    "perspective": "straight vertical lines, no fisheye distortion, realistic showroom photography",
    "vanishing_point": "centered near the rear metallic feature wall",
    "framing": "large open polished floor area in foreground, glass facade on the left, reception desk on the right, decorative wall centered in background"
  },
  "architecture": {
    "floor": { "material": "smooth polished concrete", "color": "light warm grey", "finish": "glossy with soft natural reflections", "important_rule": "vehicles must cast soft contact shadows and subtle reflections on the polished concrete floor" },
    "left_side": { "elements": ["full height glass facade","black metal window frames","large exterior view with parking area and DEKRA signage","glass entrance doors near the front left"], "lighting_effect": "strong daylight entering from the left side, creating soft reflections on the floor and vehicle body" },
    "right_side": { "elements": ["white mezzanine structure","green horizontal accent stripe","glass office railing on upper level","modern reception counter with white surfaces, light wood panels and green accent line","DEKRA logo on reception counter","small waiting area with white armchairs and green cushions behind the counter"] },
    "back_wall": { "position": "center rear of the showroom", "elements": ["large metallic panel feature wall","dark grey and brushed silver rectangular panels","vertical green LED light strips","thin warm white LED lines","two white information panels with DEKRA branding on left and right side of the feature wall"], "style": "clean technical inspection center branding, premium automotive presentation area" },
    "ceiling": { "height": "high industrial ceiling", "elements": ["visible corrugated metal ceiling","white structural beams","linear LED light strips following the room geometry","round suspended industrial lamps","visible technical pipes and ventilation ducts"], "lighting": "combination of daylight, overhead industrial lamps and green decorative LED accents" }
  },
  "branding": { "brand": "DEKRA", "colors": { "primary": "white", "secondary": "dark grey", "accent": "DEKRA green" }, "logo_presence": ["DEKRA logo visible on reception counter","DEKRA signage visible outside through glass facade","DEKRA branding on rear information panels"], "important_rule": "do not invent new logos, slogans or additional signage" },
  "lighting": {
    "main_light_source": "soft daylight from the large glass facade on the left",
    "secondary_light_sources": ["overhead ceiling lamps","linear warm white LED ceiling strips","green LED accent strips on rear wall"],
    "vehicle_lighting_rules": ["left side of the vehicle should receive soft natural daylight","right side of the vehicle should have softer indoor fill light","vehicle roof and hood should reflect ceiling light strips subtly","vehicle sides should reflect the glass facade and green LED accents naturally","no harsh studio lighting","no unrealistic glowing edges","no floating vehicle"],
    "shadow_rules": ["soft contact shadow directly underneath the tires","slightly darker shadow under the chassis","shadow direction should be consistent with daylight from the left and overhead lights","floor reflection must be visible but subtle"]
  },
  "vehicle_integration_rules": {
    "general": ["place exactly one vehicle in the showroom","vehicle must sit naturally on the polished concrete floor","all four tires must touch the floor correctly","vehicle scale must match the showroom architecture","do not alter the showroom architecture","do not move the reception desk, rear wall, glass facade or ceiling structure","keep the showroom clean and empty except for the single vehicle","no people","no extra furniture","no additional cars","no artificial showroom platform"],
    "perspective_alignment": ["vehicle must follow the same vanishing point as the floor and rear wall","vehicle wheelbase must align with the floor plane","vehicle must not appear pasted in","vehicle must have realistic occlusion and grounding","vehicle reflections must match surrounding glass, ceiling lights and green LED accents"],
    "material_response": ["paint should show soft reflections of windows, ceiling LEDs and green accent lights","windows should reflect the showroom interior and glass facade","chrome and black trim should react naturally to the indoor lighting","tires should remain matte black with realistic tread visibility"]
  },
  "negative_instructions": ["do not redesign the showroom","do not change the DEKRA green accent lighting","do not add people","do not add multiple cars","do not add a car lift","do not add workshop tools","do not add banners or new text","do not create a different reception desk","do not change the floor material","do not make the vehicle float","do not create unrealistic tire shadows","do not make the car too large for the room","do not make the car too small","do not use outdoor lighting on the car","do not add dramatic smoke or cinematic fog","do not overexpose the windows","do not blur the showroom architecture","do not remove existing DEKRA branding"],
  "output_style": { "quality": "photorealistic", "rendering": "realistic automotive showroom photography", "resolution": "high resolution", "color_grading": "clean neutral daylight, subtle green corporate accent reflections", "sharpness": "sharp architectural lines, realistic vehicle details", "mood": "premium, clean, modern, professional inspection center showroom" }
}`;

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
    const { imageBase64, additionalImages, additionalFileUris, mainImageFileUri, customShowroomFileUri, customPlateImageFileUri, manufacturerLogoFileUri, dealerLogoFileUri, vehicleDescription, modelTier, dynamicPrompt, customShowroomBase64, customPlateImageBase64, dealerLogoUrl, dealerLogoBase64, manufacturerLogoUrl, manufacturerLogoBase64 } = JSON.parse(bodyText);
    
    // Read cost dynamically from admin_settings. Normalize legacy/unknown tiers so
    // "Qualität" always routes to Nano Banana 2, never to the Pro image model.
    const TIER_ALIASES: Record<string, string> = { standard: 'qualitaet', pro: 'premium' };
    const REMASTER_DEFAULTS: Record<string, number> = { schnell: 2, qualitaet: 3, premium: 5, turbo: 4, ultra: 7, neu: 8 };
    const requestedTier = typeof modelTier === 'string' ? modelTier : 'schnell';
    const tier = TIER_ALIASES[requestedTier] || requestedTier;
    let cost = REMASTER_DEFAULTS[tier] ?? 2;
    try {
      const adminSb = createServiceClient();
      const { data: costData } = await adminSb.from("admin_settings").select("value").eq("key", "credit_costs").single();
      const configuredCost = (costData?.value as Record<string, Record<string, number>>)?.["image_remaster"]?.[tier];
      if (typeof configuredCost === 'number') cost = configuredCost;
    } catch {}
    const authResult = await authenticateAndDeductCredits(req, "image_remaster", cost);
    if (authResult instanceof Response) return authResult;
    const userEmail = (authResult as any).email as string | undefined;
    const isDekraShowroomUser = !!userEmail && DEKRA_SHOWROOM_USERS.has(userEmail.toLowerCase());

    // Engine routing per user-selected tier (binding, no cross-engine fallback)
    interface EngineConfig { engine: 'gemini' | 'openai'; model: string }
    const ENGINE_MAP: Record<string, EngineConfig> = {
      schnell:   { engine: 'gemini', model: 'gemini-2.5-flash-image' },
      qualitaet: { engine: 'gemini', model: 'gemini-3.1-flash-image-preview' },
      premium:   { engine: 'gemini', model: 'gemini-3-pro-image-preview' },
      turbo:     { engine: 'openai', model: 'gpt-image-1' },
      ultra:     { engine: 'openai', model: 'gpt-image-1' },
      neu:       { engine: 'openai', model: 'gpt-image-2' },
    };
    const engineConfig = ENGINE_MAP[tier] || ENGINE_MAP['qualitaet'];
    const geminiModel = engineConfig.model; // legacy var name kept for downstream Gemini path
    console.log(`[remaster] Engine=${engineConfig.engine} Model=${engineConfig.model} Tier=${tier} (user-selected, binding)`);

    const GEMINI_API_KEY = engineConfig.engine === 'gemini' ? await getSecret("GEMINI_API_KEY") : null;
    const OPENAI_API_KEY = engineConfig.engine === 'openai' ? await getSecret("OPENAI_API_KEY") : null;
    if (engineConfig.engine === 'gemini' && !GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
    if (engineConfig.engine === 'openai' && !OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");
    if (!imageBase64 && !mainImageFileUri?.uri) throw new Error("No image provided");

    // 2. Use dynamic prompt if provided, otherwise build fallback from admin blocks
    const basePrompt = dynamicPrompt || await buildFallbackPrompt(vehicleDescription);
    const PROFESSIONAL_REFLECTION_LIGHTING_LOCK = `<PROFESSIONAL_REFLECTION_LIGHTING_LOCK>
ABSOLUTE OUTPUT STANDARD: Render this as a professional automotive photograph taken in the NEW scene, not as a vehicle pasted onto a background.
1. OLD REFLECTION PURGE: Every reflection from the source photo environment must be removed from paint, glass, mirrors, chrome, headlights, taillights, rims, piano-black trim and sunroof. No trees, sky, clouds, old showroom walls, old dealer signage, old studio strips, people, photographer, other cars, asphalt, parking lines, watermarks or text may remain — not even faintly.
2. NEW LIGHT-SOURCE PROOF: Show where the new light comes from. Ceiling LEDs, window bands, cove lights, streetlights, sun direction or studio softboxes must create visible, physically plausible highlights on hood, roof, windshield, side glass, body sides, chrome and rims.
3. NEW REFLECTIONS ONLY: Rebuild subtle natural reflections from the new room/scene only: ceiling lights in the hood/roof, wall and window bands on side panels, floor tone on lower doors, approved logos only if provided. Reflections must curve with the body geometry and remain photorealistic, not CGI.
4. GROUNDING: Tires must visibly contact the floor/ground. Add soft contact shadows, ambient occlusion under the car, and a faint floor reflection on polished or wet surfaces. Shadow direction, length and softness must match the visible light sources.
5. FINAL CHECK: If any original reflection or old environment content is still visible anywhere on the vehicle or through the windows, regenerate those surfaces from scratch using only the new scene.
</PROFESSIONAL_REFLECTION_LIGHTING_LOCK>`;
    const prompt = `${basePrompt}\n\n${PROFESSIONAL_REFLECTION_LIGHTING_LOCK}`;
    console.log(`[remaster] Using ${dynamicPrompt ? 'DYNAMIC' : 'FALLBACK (from admin blocks)'} prompt (${prompt.length} chars), model: ${geminiModel}, tier: ${tier}`);
    const hasLicensePlate = prompt.includes('LICENSE_PLATE');
    const hasScene = prompt.includes('SCENE_AND_LIGHTING') || prompt.includes('CUSTOM_SHOWROOM');
    console.log(`[remaster] Prompt contains: licensePlate=${hasLicensePlate}, scene=${hasScene}, showroomImage=${!!customShowroomBase64}, plateImage=${!!customPlateImageBase64}`);

    // Helper to convert data URL to inlineData part
    function toInlineData(dataUrl: string) {
      const raw = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      let mime = "image/jpeg";
      if (dataUrl.startsWith("data:image/png")) mime = "image/png";
      else if (dataUrl.startsWith("data:image/webp")) mime = "image/webp";
      else if (dataUrl.startsWith("data:image/svg")) mime = "image/png";
      return { inlineData: { mimeType: mime, data: raw } };
    }

    function cleanBase64(base64String: string): string {
      if (!base64String) return "";
      let cleaned = base64String.trim();
      if (cleaned.includes(",") && cleaned.startsWith("data:")) {
        cleaned = cleaned.split(",")[1];
      }
      cleaned = cleaned.replace(/\s/g, "");
      return cleaned;
    }

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

    async function resolveImage(src: string) {
      if (src.startsWith("data:")) return toInlineData(src);
      if (src.startsWith("http")) return await urlToInlineData(src);
      return null;
    }

    const hasCustomShowroom = !!(customShowroomBase64 || customShowroomFileUri?.uri);
    const customShowroomInstructionText = hasCustomShowroom ? `<CUSTOM_SHOWROOM_INSTRUCTION>
The following showroom image is the TARGET SCENE and the physical room where the final photograph must be created. This showroom is the IMMUTABLE BASE SCENE. The source vehicle photo is NOT the base image.

OUTPUT FORMAT: The result MUST be in 4:3 (landscape) aspect ratio.

FULL VEHICLE RECONSTRUCTION (NON-NEGOTIABLE):
Do NOT edit, paste, cut out, relight, or reuse pixels from the original vehicle photo. Build a NEW photorealistic vehicle render from the reference: same body shape, trim, wheels, badges, paint color and proportions, but with completely NEW lacquer, NEW glass, NEW chrome, NEW headlights, NEW rims, NEW shadows and NEW reflections created only from this showroom.

SOURCE PHOTO LIMITATION:
- The vehicle photo is ONLY an identity blueprint for geometry and equipment.
- It is FORBIDDEN to preserve its lighting, highlight pattern, window content, door-panel reflections, hood reflections, sky/tree/building reflections, old showroom reflections, asphalt/floor color, dealer banners, stickers, text, people, photographer, or any original environment clue.
- If a side panel or window still shows a reflection from the original source photo, the output is wrong. Regenerate that surface from scratch.

CAMERA MATCH & PHYSICAL PLACEMENT:
- Place the newly reconstructed vehicle ON the showroom floor plane, aligned to the showroom's vanishing point and floor perspective.
- Wheel ellipses, tire contact patches, wheelbase line and body baseline must follow the same perspective grid as the polished concrete floor.
- Do NOT force the original photo's camera perspective if it conflicts with the showroom. Re-pose the car naturally in the showroom, as if it was really parked there for a professional shoot.
- The car must not float, lean, appear too large, appear too small, or look pasted in. Add correct contact shadows and ambient occlusion under every tire.

PAINT & SURFACE REBUILD:
- Repaint the body as clean factory-grade lacquer in the reference vehicle's color, with uniform hue across all panels.
- Paint, glass, chrome, headlights, taillights, rims, roof rails, piano-black trim and mirrors must reflect ONLY the showroom: window bands, ceiling LEDs, green accent lights, wall panels, reception area and polished concrete floor.
- Reflection strength must be natural: soft and curved on paint, clearer on glass/chrome, subtle floor-tone reflection on lower doors.

LIGHTING LOCK:
- Use the showroom's actual light sources only: windows, ceiling fixtures, LED strips and room fill.
- Neutral daylight white balance around 5000-5500 K, identical exposure and color grading across all generated angles.
- The car and showroom must look captured in one camera exposure, not two stitched layers.

SHOWROOM PRESERVATION:
- Preserve the showroom architecture, floor, ceiling, windows, wall panels, furniture, logos and branding 1:1.
- The showroom should remain visible around the vehicle; do not crop it into an artificial close-up.

FINAL QUALITY GATE:
Before returning the image, inspect hood, roof, doors, windows, chrome, rims and headlights. If ANY source-photo reflection, old environment, incorrect perspective, floating tire, or pasted look remains, rebuild the vehicle surfaces and placement again until it looks like a real photo taken in the showroom.
</CUSTOM_SHOWROOM_INSTRUCTION>${isDekraShowroomUser ? `

<DEKRA_SHOWROOM_SCENE_SPEC>
This showroom is the DEKRA modern automotive showroom. The following JSON is the AUTHORITATIVE structural and lighting description of that exact scene. Treat it as ground truth – it overrides any guess based on the source vehicle photo. Re-render the vehicle inside this scene exactly as described: architecture, materials, light sources, reflections, vehicle placement, scale and shadows MUST match this spec. Use it together with the showroom reference image.

${DEKRA_SHOWROOM_SCENE_JSON}
</DEKRA_SHOWROOM_SCENE_SPEC>` : ""}` : "";

    // Build Gemini content parts
    const parts: any[] = [{ text: prompt }];

    // For custom showroom generations, present the showroom BEFORE the vehicle.
    // This makes the room the target scene and reduces source-photo reflection carryover.
    if (hasCustomShowroom) {
      parts.push({ text: customShowroomInstructionText });
      if (customShowroomFileUri?.uri) {
        parts.push({ file_data: { mime_type: customShowroomFileUri.mimeType, file_uri: customShowroomFileUri.uri } });
        console.log(`[remaster] Showroom via file_uri (target scene first)`);
      } else if (customShowroomBase64) {
        parts.push(toInlineData(customShowroomBase64));
      }
    }

    // Main image: prefer file_data URI if available
    if (hasCustomShowroom) {
      parts.push({ text: "VEHICLE IDENTITY BLUEPRINT ONLY: The next image defines the exact vehicle geometry, trim, wheels, badges, paint color and equipment. It is NOT the output base image. Do NOT preserve its environment, lighting, reflections, window content, shadows, floor, background, banners, text, or any source-photo pixels." });
    }
    if (mainImageFileUri?.uri) {
      parts.push({ file_data: { mime_type: mainImageFileUri.mimeType, file_uri: mainImageFileUri.uri } });
      console.log(`[remaster] Main image via file_uri`);
    } else {
      parts.push(toInlineData(imageBase64));
    }

    // Additional reference images
    if ((Array.isArray(additionalFileUris) && additionalFileUris.length > 0) || (Array.isArray(additionalImages) && additionalImages.length > 0)) {
      parts.push({ text: "AUTHORITATIVE DETAIL REFERENCES: The following extra images are the highest-priority source material for exact reproduction of the vehicle. Match every visible color, material, trim, label, inscription, button, texture, and geometry exactly. Do NOT replace missing certainty with generic model-memory or guessed defaults." });
    }

    if (Array.isArray(additionalFileUris) && additionalFileUris.length > 0) {
      for (const fu of additionalFileUris) {
        parts.push({ file_data: { mime_type: fu.mimeType, file_uri: fu.uri } });
      }
      console.log(`[remaster] ${additionalFileUris.length} additional images via file_uri`);
    }

    if (Array.isArray(additionalImages) && additionalImages.length > 0) {
      for (const img of additionalImages.slice(0, 10)) {
        parts.push(toInlineData(img));
      }
    }

    // Custom showroom is already injected before the vehicle image so the room becomes the target scene.
    if (!hasCustomShowroom && (customShowroomBase64 || customShowroomFileUri?.uri)) {
      parts.push({ text: `<CUSTOM_SHOWROOM_INSTRUCTION>
The following image is the CUSTOM SHOWROOM BACKGROUND. This is an IMMUTABLE ASSET.

OUTPUT FORMAT: The result MUST be in 4:3 (landscape) aspect ratio.

FULL RE-RENDER (NON-NEGOTIABLE):
This is NOT a background swap, NOT a composite, NOT a collage. You MUST RE-RENDER the entire scene from scratch as ONE cohesive photograph – as if a professional automotive photographer took a real photo of this exact car parked inside this exact showroom, with a single camera, a single light setup, and a single white balance.

PAINT & SURFACE REBUILD (CRITICAL – erase all source artifacts):
- Treat the vehicle paint, glass, chrome, headlights, rims and all glossy trim as if freshly re-rendered. Do NOT carry over ANY pixel of reflection, highlight, color cast or environment that existed on the original source photo.
- Old reflections of trees, sky, clouds, asphalt, parking lines, buildings, people, photographer, other cars, old showrooms, banners, logos, text or stickers MUST be COMPLETELY ERASED from paint, glass, chrome and rims. Zero residue allowed.
- Rebuild all reflections from scratch using ONLY the geometry, materials, light fixtures, windows, walls and ceiling of the CUSTOM SHOWROOM image. Reflections on the car MUST visibly match what is physically around it in the showroom.
- Repaint the body with clean, even, freshly-applied factory-grade lacquer. No swirl marks, no dust, no fingerprints, no old micro-scratches from the source photo.

LIGHTING LOCK (must be IDENTICAL across every image of the same vehicle in this showroom):
- Light direction: from the showroom's ceiling fixtures and window bands as visible in the asset.
- Color temperature: neutral 5000-5500 K daylight balanced to the showroom, NOT to the source photo.
- Intensity: bright but soft, no blown highlights, no crushed shadows.
- Vehicle exposure MUST match the showroom exposure – car and room belong to the SAME photograph, not two stitched layers.
- Ceiling light strips / window light bands MUST appear as soft elongated highlights on hood, roof, windshield, side glass and body sides, clearly indicating where the light comes from.

GROUND CONTACT & SHADOWS:
- Tires MUST physically touch the showroom floor with realistic contact shadow and ambient occlusion under each wheel.
- Cast a soft, directional shadow on the floor matching the showroom's ceiling lights.
- If the floor is glossy/polished, add a faint, realistic vehicle reflection on the floor – never a sharp mirror copy.

VEHICLE PLACEMENT & SCALE (must be IDENTICAL across every perspective):
- The vehicle is the hero subject, centered horizontally, occupying ~55-65% of image width. Same scale in EVERY shot.
- Camera height around hip/door-handle level, slight wide-lens feel (~35-50mm equivalent), no extreme tilt.
- The showroom MUST remain fully visible and clearly recognizable in EVERY shot – architecture, logos, signage, furniture all preserved 1:1.

SHOWROOM PRESERVATION:
- Do NOT modify, replace, remove, recolor or obscure ANY element of the showroom (logos, signs, wall panels, furniture, displays, ceiling, floor, windows).
- When the camera angle changes for front/side/rear/3-quarter shots, the showroom shifts naturally by 3D perspective – elements may move within the frame but NEVER disappear, change shape, change color or get replaced.

ORIGINAL ENVIRONMENT REMOVAL (ZERO TOLERANCE):
- The source vehicle photo may contain an OLD showroom, OLD studio, dealer banners, footer bars, slogans (e.g. "AUTOS KAUFT MAN BEI ..."), URLs, watermarks, overlays or sticker prints. ALL of these MUST be fully removed. None of it may remain – not as text, not as a faint strip, not as a color trace, not on walls, not on the floor, not on the car body, not in reflections.
- Only the VEHICLE itself (geometry, color, trim, wheels, badges) is taken from the source. The entire environment, lighting and reflections are rebuilt from the custom showroom asset.

CROSS-IMAGE CONSISTENCY (STYLE LOCK):
- Every image in this series MUST look like it was shot in the SAME 10-minute photo session, with the SAME camera, SAME lens, SAME exposure, SAME white balance, SAME post-processing.
- Same paint hue/saturation, same chrome brightness, same glass tint, same floor reflectivity, same lighting mood across ALL angles.

INTERIOR SHOTS:
- For interior views, the custom showroom MUST be visible THROUGH the windshield, side windows and rear window – clearly recognizable as the SAME room. No outdoor scene, no generic background.
- Do NOT alter dashboard, seats, trim or any interior element – only improve lighting to match the showroom ambience.
</CUSTOM_SHOWROOM_INSTRUCTION>${isDekraShowroomUser ? `

<DEKRA_SHOWROOM_SCENE_SPEC>
This showroom is the DEKRA modern automotive showroom. The following JSON is the AUTHORITATIVE structural and lighting description of that exact scene. Treat it as ground truth – it overrides any guess based on the source vehicle photo. Re-render the vehicle inside this scene exactly as described: architecture, materials, light sources, reflections, vehicle placement, scale and shadows MUST match this spec. Use it together with the showroom reference image.

${DEKRA_SHOWROOM_SCENE_JSON}
</DEKRA_SHOWROOM_SCENE_SPEC>` : ""}` });
      if (customShowroomFileUri?.uri) {
        parts.push({ file_data: { mime_type: customShowroomFileUri.mimeType, file_uri: customShowroomFileUri.uri } });
        console.log(`[remaster] Showroom via file_uri`);
      } else if (customShowroomBase64) {
        parts.push(toInlineData(customShowroomBase64));
      }
    }

    if (customPlateImageBase64 || customPlateImageFileUri?.uri) {
      parts.push({ text: "CRITICAL – CUSTOM LICENSE PLATE IMAGE: The following image is the EXACT license plate you MUST use. Replace the vehicle's existing plate with this plate PIXEL-FOR-PIXEL. Reproduce every character, color, seal, EU badge, and spacing exactly. Do NOT invent or modify any element. This is an IMMUTABLE ASSET:" });
      if (customPlateImageFileUri?.uri) {
        parts.push({ file_data: { mime_type: customPlateImageFileUri.mimeType, file_uri: customPlateImageFileUri.uri } });
        console.log(`[remaster] Plate via file_uri`);
      } else {
        parts.push(toInlineData(customPlateImageBase64));
      }
    }

    // Manufacturer logo
    if (manufacturerLogoFileUri?.uri || manufacturerLogoBase64 || manufacturerLogoUrl) {
      let logoData: any = null;
      if (manufacturerLogoFileUri?.uri) {
        logoData = { file_data: { mime_type: manufacturerLogoFileUri.mimeType, file_uri: manufacturerLogoFileUri.uri } };
        console.log(`Manufacturer logo: via file_uri`);
      } else if (manufacturerLogoBase64) {
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
2. NO INTERPRETATION: Do NOT redesign, simplify, stylize, or convert to different material.
3. IMMUTABLE ASSET: No re-tracing, no redesign, no new outline, no different aspect ratio.
4. POSITION: Always centered on back wall, at eye level, slightly above vehicle roofline. EXACT same position on EVERY image.
5. SIZE: Approximately 60-80cm diameter/width – IDENTICAL on EVERY image.
6. RENDERING: As backlit wall element with subtle LED halo effect. Logo keeps its ORIGINAL COLORS and ORIGINAL SHAPE.
7. FORBIDDEN: No converting to silver/aluminum/chrome. No color changes. No shape simplification. No re-lettering, no mirroring, no rotation.
8. CONSISTENCY: Logo must look ABSOLUTELY IDENTICAL on ALL generated images – ZERO variation in color, shape, proportions, size, or position.
9. SOURCE OF TRUTH: This logo asset OVERRIDES any logo, banner, slogan, or text visible in the reference vehicle photo. Ignore old dealer abbinder bars/slogans from the reference – use ONLY this logo.
</LOGO_REFERENCE>` });
        parts.push(logoData);
      }
    }

    // Dealer logo
    if (dealerLogoFileUri?.uri || dealerLogoBase64 || dealerLogoUrl) {
      let logoData: any = null;
      if (dealerLogoFileUri?.uri) {
        logoData = { file_data: { mime_type: dealerLogoFileUri.mimeType, file_uri: dealerLogoFileUri.uri } };
      } else if (dealerLogoBase64) {
        logoData = toInlineData(dealerLogoBase64);
      } else {
        logoData = await resolveImage(dealerLogoUrl);
      }
      if (logoData) {
        parts.push({ text: `<LOGO_REFERENCE>
DEALER LOGO – PIXEL-PERFECT REPRODUCTION:
The following image is the EXACT dealer logo. Reproduce PIXEL-FOR-PIXEL with all original colors and shapes.
- Position: Always to the RIGHT of the manufacturer logo on the back wall – IDENTICAL on EVERY image.
- Size: Smaller than manufacturer logo.
- IMMUTABLE ASSET: No redesign, no recoloring, no simplification.
</LOGO_REFERENCE>` });
        parts.push(logoData);
        console.log("Dealer logo injected", dealerLogoFileUri?.uri ? "(file_uri)" : dealerLogoBase64 ? "(cached b64)" : "(fetched)");
      }
    }

    // No logos → explicit instruction
    const hasAnyLogo = !!(manufacturerLogoFileUri?.uri || manufacturerLogoBase64 || manufacturerLogoUrl || dealerLogoFileUri?.uri || dealerLogoBase64 || dealerLogoUrl);
    if (!hasAnyLogo) {
      parts.push({ text: `<NO_LOGO_INSTRUCTION>
Do NOT add ANY logo, brand mark, emblem, or wall decoration to the background.
The showroom wall must remain CLEAN and EMPTY. No manufacturer logos, no dealer logos, no decorative elements.
</NO_LOGO_INSTRUCTION>` });
      console.log("No logos provided – injected NO_LOGO_INSTRUCTION");
    }

    // ── DEBUG: Log full payload summary ──
    const debugSummary = {
      totalParts: parts.length,
      textParts: parts.filter((p: any) => p.text).length,
      imageParts: parts.filter((p: any) => p.inlineData || p.file_data).length,
      inlineImages: parts.filter((p: any) => p.inlineData).map((p: any, i: number) => ({
        index: i,
        mimeType: p.inlineData.mimeType,
        sizeKB: Math.round(p.inlineData.data.length * 0.75 / 1024),
      })),
      fileUriImages: parts.filter((p: any) => p.file_data).map((p: any) => ({
        mimeType: p.file_data.mime_type,
        uri: p.file_data.file_uri,
      })),
      promptLength: prompt.length,
      promptFirst500: prompt.substring(0, 500),
      promptLast300: prompt.substring(prompt.length - 300),
      allTextBlocks: parts.filter((p: any) => p.text).map((p: any, i: number) => ({
        index: i,
        length: p.text.length,
        preview: p.text.substring(0, 120) + (p.text.length > 120 ? '...' : ''),
      })),
    };
    console.log(`[remaster] === FULL PAYLOAD DEBUG ===`);
    console.log(JSON.stringify(debugSummary, null, 2));

    let resultImage: string | null = null;
    let lastError = "";

    // ─────────────────────────────────────────────────────────────
    // OPENAI ENGINE (turbo / ultra / neu) — uses /v1/images/edits
    // ─────────────────────────────────────────────────────────────
    if (engineConfig.engine === 'openai') {
      // Collect all text parts into one prompt + all image data parts as multipart files
      const promptText = parts
        .filter((p: any) => typeof p.text === 'string')
        .map((p: any) => p.text)
        .join('\n\n');
      const inlineImageParts = parts.filter((p: any) => p.inlineData?.data);
      const fileUriParts = parts.filter((p: any) => p.file_data?.file_uri);

      // Materialize file_uri images by fetching them (OpenAI has no file_uri concept)
      const allImages: { mime: string; data: string }[] = [];
      for (const ip of inlineImageParts) {
        allImages.push({ mime: ip.inlineData.mimeType || 'image/png', data: ip.inlineData.data });
      }
      for (const fp of fileUriParts) {
        try {
          const r = await fetch(fp.file_data.file_uri);
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            allImages.push({ mime: fp.file_data.mime_type || 'image/png', data: btoa(bin) });
          }
        } catch (e) { console.warn('[remaster][openai] file_uri fetch failed', e); }
      }

      // OpenAI /v1/images/edits accepts up to 16 image inputs
      const limited = allImages.slice(0, 16);
      console.log(`[remaster][openai] model=${engineConfig.model}, images=${limited.length}, promptLen=${promptText.length}`);

      const form = new FormData();
      form.append('model', engineConfig.model);
      // Output: 1536x1024 (landscape 3:2 ≈ 4:3) is closest supported size
      form.append('size', '1536x1024');
      form.append('n', '1');
      form.append('quality', tier === 'ultra' || tier === 'neu' ? 'high' : 'medium');
      form.append('prompt', promptText);

      for (let i = 0; i < limited.length; i++) {
        const im = limited[i];
        const binStr = atob(im.data);
        const bytes = new Uint8Array(binStr.length);
        for (let j = 0; j < binStr.length; j++) bytes[j] = binStr.charCodeAt(j);
        const ext = im.mime.includes('png') ? 'png' : im.mime.includes('webp') ? 'webp' : 'jpg';
        const blob = new Blob([bytes], { type: im.mime });
        form.append('image', blob, `ref_${i}.${ext}`);
      }

      const MAX_OPENAI_ATTEMPTS = 2;
      for (let attempt = 0; attempt < MAX_OPENAI_ATTEMPTS && !resultImage; attempt++) {
        try {
          const resp = await fetchWithTimeout('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: form,
          }, 90_000);

          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`[remaster][openai] attempt ${attempt + 1} status=${resp.status}: ${errText.slice(0, 300)}`);
            lastError = `OpenAI ${engineConfig.model} error (${resp.status})`;
            if ([400, 401, 403].includes(resp.status) && /invalid_api_key|incorrect api key/i.test(errText)) {
              throw new Error('OPENAI_API_KEY ungültig oder nicht freigeschaltet');
            }
            // Auto-fallback: gpt-image-2 requires verified org → fall back to gpt-image-1
            if (resp.status === 403 && engineConfig.model === 'gpt-image-2' && /must be verified|verify organization/i.test(errText)) {
              console.warn('[remaster][openai] gpt-image-2 nicht freigeschaltet → Fallback auf gpt-image-1');
              engineConfig.model = 'gpt-image-1';
              form.set('model', 'gpt-image-1');
              continue;
            }
            if (resp.status === 403) {
              throw new Error(`OpenAI-Modell '${engineConfig.model}' nicht freigeschaltet. Organisation auf platform.openai.com verifizieren.`);
            }
            if (attempt < MAX_OPENAI_ATTEMPTS - 1) await sleep(2000 * (attempt + 1));
            continue;
          }
          const data = await resp.json();
          const b64 = data?.data?.[0]?.b64_json;
          if (b64) {
            resultImage = `data:image/png;base64,${b64}`;
            console.log(`[remaster][openai] success with ${engineConfig.model}`);
            break;
          }
          lastError = 'OpenAI: kein Bild im Response';
        } catch (e: any) {
          const isAbort = e?.name === 'AbortError';
          lastError = isAbort ? 'OpenAI Zeitüberschreitung (90s)' : (e?.message || 'OpenAI error');
          console.error(`[remaster][openai] attempt ${attempt + 1} threw:`, lastError);
          if (attempt < MAX_OPENAI_ATTEMPTS - 1) await sleep(2000 * (attempt + 1));
        }
      }

      if (!resultImage) throw new Error(lastError || 'OpenAI: Kein Bild generiert.');

      return new Response(JSON.stringify({ imageBase64: resultImage, engine: 'openai', model: engineConfig.model }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // GEMINI ENGINE (schnell / qualitaet / premium) — original path
    // Same-engine fallback only (never crosses to OpenAI)
    // ─────────────────────────────────────────────────────────────
    const FALLBACK_ORDER: Record<string, string[]> = {
      'gemini-3-pro-image-preview': ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'],
      'gemini-3.1-flash-image-preview': ['gemini-2.5-flash-image'],
      'gemini-2.5-flash-image': ['gemini-3.1-flash-image-preview'],
    };
    const modelsToTry = Array.from(new Set([geminiModel, ...(FALLBACK_ORDER[geminiModel] || ['gemini-3.1-flash-image-preview'])])).slice(0, 2);
    const maxRetries = 2;
    const startedAt = Date.now();
    const HARD_BUDGET_MS = 130_000; // stay under 150s edge limit

    for (const currentModel of modelsToTry) {
      if (resultImage) break;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const elapsed = Date.now() - startedAt;
          const remaining = HARD_BUDGET_MS - elapsed;
          if (remaining < 15_000) {
            console.warn(`Time budget exhausted (${elapsed}ms), aborting further attempts`);
            lastError = lastError || 'Zeitbudget erschöpft';
            break;
          }
          const perCallTimeout = Math.min(50_000, remaining - 2_000);
          console.log(`Remaster model=${currentModel} attempt ${attempt + 1}/${maxRetries}, parts: ${parts.length}, timeout=${perCallTimeout}ms`);
          const response = await fetchWithTimeout(geminiUrl, {
            method: "POST",
            headers: {
              "x-goog-api-key": GEMINI_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
            }),
          }, perCallTimeout);

          if (!response.ok) {
            const errText = await response.text();
            console.error("Remaster error:", response.status, errText);
            const isRetryable = response.status === 500 || response.status === 503 || response.status === 429;
            lastError = `Model ${currentModel} error (${response.status})`;
            if (isRetryable && attempt < maxRetries - 1) {
              const delay = 3000 * (attempt + 1);
              console.warn(`Retryable ${response.status}, waiting ${delay}ms...`);
              await sleep(delay);
              continue;
            }
            console.warn(`Model ${currentModel} exhausted (${response.status}), trying fallback...`);
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
            await sleep(1500);
          }
        } catch (retryErr) {
          console.error(`Attempt ${attempt + 1} failed:`, retryErr);
          lastError = retryErr instanceof DOMException && retryErr.name === "AbortError"
            ? "Zeitüberschreitung beim KI-Modell"
            : retryErr instanceof Error ? retryErr.message : "Unknown error";
          if (attempt < maxRetries - 1) await sleep(2500 * (attempt + 1));
        }
      }
    }

    if (!resultImage) throw new Error(lastError?.includes('503') || lastError?.includes('UNAVAILABLE')
      ? 'Das KI-Modell ist gerade überlastet. Bitte versuche es in einigen Sekunden erneut.'
      : (lastError || "Kein Bild generiert. Bitte versuche es erneut."));

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
