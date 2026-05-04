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

async function authenticateAndDeductCredits(req: Request, actionType: string, cost: number): Promise<{ userId: string } | Response> {
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
  return { userId };
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
    const { imageBase64, additionalImages, additionalFileUris, mainImageFileUri, customShowroomFileUri, vehicleDescription, modelTier, dynamicPrompt, customShowroomBase64, customPlateImageBase64, dealerLogoUrl, dealerLogoBase64, manufacturerLogoUrl, manufacturerLogoBase64 } = JSON.parse(bodyText);
    
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
    if (!imageBase64) throw new Error("No image provided");

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

    // Build Gemini content parts
    const parts: any[] = [{ text: prompt }];

    // Main image: prefer file_data URI if available
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

    // Custom showroom
    if (customShowroomBase64) {
      parts.push({ text: `<CUSTOM_SHOWROOM_INSTRUCTION>
The following image is the CUSTOM SHOWROOM BACKGROUND. This is an IMMUTABLE ASSET.

OUTPUT FORMAT: The result MUST be in 4:3 (landscape) aspect ratio.

MUTUAL ADAPTATION (CRITICAL):
This is NOT a simple background swap or collage. You must RE-RENDER the ENTIRE scene as ONE cohesive photograph – as if a professional photographer took a real photo of this car parked inside this exact showroom.

VEHICLE INTEGRATION:
1. Place the vehicle NATURALLY in this showroom – it must look PHYSICALLY PRESENT and STANDING on the floor.
2. The vehicle should occupy approximately 55-65% of the image width. This size MUST be IDENTICAL across ALL perspectives.
3. The vehicle MUST be lit by the showroom's actual light sources – matching direction, color temperature, and intensity.
4. Vehicle paint, glass, chrome, rims and glossy trim MUST reflect the showroom environment (walls, ceiling, windows, floor and light fixtures) — NOT the original source photo environment.
5. Ceiling lights/window bands from the showroom MUST be visible as soft, natural highlights on hood, roof, windshield, side glass and body sides, showing exactly where the light comes from.
6. Vehicle MUST cast realistic shadows onto the showroom floor. Tires MUST make contact with the floor surface with subtle ambient occlusion.
7. If the showroom floor is reflective, show a realistic, faint reflection of the vehicle on the floor.
8. All old reflections from the source photo MUST be erased: no trees, sky, people, photographer, other cars, asphalt, parking lines, old showroom, old logos, banners, text or watermarks may remain on paint, glass, chrome or rims.

SHOWROOM PRESERVATION (CRITICAL):
- Do NOT modify, replace, remove, or obscure ANY element in the showroom.
- ALL logos, signs, wall decorations, furniture, branding, display cases MUST remain EXACTLY as they are.
- The showroom floor, walls, ceiling, windows MUST be reproduced faithfully with their exact materials and colors.
- When camera perspective changes, architectural elements and logos shift naturally by 3D perspective – but NEVER disappear or change.
- The showroom MUST be CLEARLY RECOGNIZABLE as the SAME room in EVERY generated image.

ORIGINAL ENVIRONMENT REMOVAL (ZERO TOLERANCE):
- The reference vehicle photo may contain an OLD showroom, OLD studio, dealer banner strips, abbinder footer bars, slogan text (e.g. "AUTOS KAUFT MAN BEI ..."), URLs, watermarks, advertising overlays, sticker prints, or any branded backdrop.
- ALL of these MUST be FULLY REMOVED. They MUST NOT appear in the output – not as text, not as a strip, not as a faint trace, not on walls, not on the floor, not on the vehicle body.
- Only the VEHICLE is taken from the reference. The ENTIRE environment is replaced by the custom showroom asset above. Zero pixel of the old environment may survive.

CAMERA PERSPECTIVE:
- The camera perspective of the showroom MUST match the requested vehicle perspective.
- Adapt the showroom view to match front, side, rear, or 3/4 angles naturally.
- The showroom must ALWAYS be fully visible – never cropped out or replaced.

INTERIOR SHOTS WITH CUSTOM SHOWROOM:
For INTERIOR vehicle shots, the custom showroom MUST be visible THROUGH ALL vehicle windows (windshield, side windows, rear window).
The showroom architecture, walls, floor, ceiling, and any logos/branding MUST be clearly recognizable through the glass.
Do NOT show a random outdoor scene or generic background through the windows – it MUST be THIS showroom.
The interior itself should only receive improved lighting – do NOT change the dashboard, seats, or any interior elements.
</CUSTOM_SHOWROOM_INSTRUCTION>` });
      if (customShowroomFileUri?.uri) {
        parts.push({ file_data: { mime_type: customShowroomFileUri.mimeType, file_uri: customShowroomFileUri.uri } });
        console.log(`[remaster] Showroom via file_uri`);
      } else {
        parts.push(toInlineData(customShowroomBase64));
      }
    } else if (customShowroomFileUri?.uri) {
      parts.push({ text: `<CUSTOM_SHOWROOM_INSTRUCTION>The following is the CUSTOM SHOWROOM BACKGROUND. This is an IMMUTABLE ASSET. Place the vehicle naturally in this showroom.</CUSTOM_SHOWROOM_INSTRUCTION>` });
      parts.push({ file_data: { mime_type: customShowroomFileUri.mimeType, file_uri: customShowroomFileUri.uri } });
    }

    if (customPlateImageBase64) {
      parts.push({ text: "CRITICAL – CUSTOM LICENSE PLATE IMAGE: The following image is the EXACT license plate you MUST use. Replace the vehicle's existing plate with this plate PIXEL-FOR-PIXEL. Reproduce every character, color, seal, EU badge, and spacing exactly. Do NOT invent or modify any element. This is an IMMUTABLE ASSET:" });
      parts.push(toInlineData(customPlateImageBase64));
    }

    // Manufacturer logo
    if (manufacturerLogoBase64 || manufacturerLogoUrl) {
      let logoData = null;
      if (manufacturerLogoBase64) {
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
- IMMUTABLE ASSET: No redesign, no recoloring, no simplification.
</LOGO_REFERENCE>` });
        parts.push(logoData);
        console.log("Dealer logo injected", dealerLogoBase64 ? "(cached b64)" : "(fetched)");
      }
    }

    // No logos → explicit instruction
    const hasAnyLogo = !!(manufacturerLogoBase64 || manufacturerLogoUrl || dealerLogoBase64 || dealerLogoUrl);
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
    const maxRetries = 1;

    for (const currentModel of modelsToTry) {
      if (resultImage) break;
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Remaster model=${currentModel} attempt ${attempt + 1}/${maxRetries}, parts: ${parts.length}`);
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
          }, 55_000);

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
