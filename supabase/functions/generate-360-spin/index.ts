import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function createUserClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

async function getCustomPrompt(sb: any, key: string, defaultPrompt: string): Promise<string> {
  try {
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
}

const TARGET_FRAME_COUNT = 36;
const FRAME_BATCH_SIZE = 4;
const MAX_FRAME_BATCH_RETRIES = 3;

async function updateJobStatus(sb: any, jobId: string, status: string, extra: Record<string, any> = {}) {
  await sb.from("spin360_jobs").update({ status, updated_at: new Date().toISOString(), ...extra }).eq("id", jobId);
}

async function touchJob(sb: any, jobId: string, extra: Record<string, any> = {}) {
  await sb.from("spin360_jobs").update({ updated_at: new Date().toISOString(), ...extra }).eq("id", jobId);
}

async function markJobFailed(sb: any, jobId: string, errorMessage: string) {
  await sb.from("spin360_jobs").update({
    status: "failed",
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

async function getExistingFrameIndexes(sb: any, jobId: string): Promise<Set<number>> {
  const { data } = await sb
    .from("spin360_generated_frames")
    .select("frame_index")
    .eq("job_id", jobId)
    .eq("validation_status", "passed");

  return new Set(
    (data || [])
      .map((frame: any) => Number(frame.frame_index))
      .filter((frameIndex: number) => Number.isFinite(frameIndex)),
  );
}

function buildMissingFramePlan(existingIndexes: Set<number>, targetFrameCount: number = TARGET_FRAME_COUNT) {
  const frames: { index: number; angle: number }[] = [];
  const angleStep = 360 / targetFrameCount;

  for (let index = 0; index < targetFrameCount; index++) {
    if (!existingIndexes.has(index)) {
      frames.push({ index, angle: Math.round(index * angleStep) });
    }
  }

  return frames;
}

async function insertFrameIfMissing(sb: any, frame: Record<string, any>): Promise<boolean> {
  const { data: existing } = await sb
    .from("spin360_generated_frames")
    .select("id")
    .eq("job_id", frame.job_id)
    .eq("frame_index", frame.frame_index)
    .limit(1);

  if (existing && existing.length > 0) return false;

  const { error } = await sb.from("spin360_generated_frames").insert(frame);
  if (error) throw new Error(`Frame insert error: ${error.message}`);
  return true;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function callGeminiFlash(prompt: string, imageUrls: string[], responseType: "json" | "text" = "json"): Promise<any> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const parts: any[] = [{ text: prompt }];
  for (const url of imageUrls) {
    const imgResp = await fetch(url);
    const imgBuf = await imgResp.arrayBuffer();
    const b64 = arrayBufferToBase64(imgBuf);
    const mimeType = imgResp.headers.get("content-type") || "image/jpeg";
    parts.push({ inlineData: { mimeType, data: b64 } });
  }

  const body: any = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  };
  if (responseType === "json") body.generationConfig.responseMimeType = "application/json";

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Gemini Flash error:", resp.status, text);
    throw new Error(`Gemini API error: ${resp.status}`);
  }

  const result = await resp.json();
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error("No response from Gemini");

  if (responseType === "json") {
    try { return JSON.parse(textContent); } catch { return textContent; }
  }
  return textContent;
}

async function callImageGeneration(prompt: string, referenceImageUrl: string, model: string = "gemini-2.5-flash"): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  // Download reference image and convert to base64
  const imgResp = await fetch(referenceImageUrl);
  const imgBuf = await imgResp.arrayBuffer();
  const b64 = arrayBufferToBase64(imgBuf);
  const mimeType = imgResp.headers.get("content-type") || "image/jpeg";

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: b64 } },
          ],
        }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    },
  );

  if (!resp.ok) {
    const t = await resp.text();
    console.error(`Image gen error (${model}):`, resp.status, t);
    if (resp.status === 429) throw new Error("rate_limited");
    throw new Error(`image_generation_${resp.status}`);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

async function uploadBase64ToStorage(sb: any, userId: string, path: string, base64Data: string): Promise<string> {
  const isDataUrl = base64Data.startsWith("data:");
  const mimeMatch = isDataUrl ? base64Data.match(/^data:(image\/\w+);base64,/) : null;
  const contentType = mimeMatch ? mimeMatch[1] : "image/png";
  const raw = isDataUrl ? base64Data.split(",")[1] : base64Data;
  const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));

  const fullPath = `${userId}/${path}`;
  const { error } = await sb.storage.from("vehicle-images").upload(fullPath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload error: ${error.message}`);

  const { data: urlData } = sb.storage.from("vehicle-images").getPublicUrl(fullPath);
  return urlData.publicUrl;
}

// Self-invoke the next step (fire-and-forget)
async function invokeNextStep(authHeader: string, body: Record<string, any>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-360-spin`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("Self-invoke failed:", resp.status, errorText);
    }
  } catch (e) {
    console.error("Self-invoke failed:", e);
  }
}

// ─── PROMPTS ───
const ANALYSIS_PROMPT = `You are an expert automotive photographer analyzing 4 vehicle images for a 360° spin.
Analyze each image and return JSON:
{
  "images": [
    { "index": 0, "detected_perspective": "front"|"rear"|"left"|"right", "quality_score": 0-100,
      "vehicle_fully_visible": true/false, "cropping_ok": true/false, "brightness_ok": true/false,
      "warnings": [], "vehicle_type": "sedan"|"suv"|"hatchback"|"coupe"|"wagon"|"van"|"truck"|"convertible",
      "color": "string" }
  ],
  "same_vehicle": true/false, "mismatch_warnings": [],
  "suggested_reorder": [0,1,2,3] or null, "overall_quality": "good"|"acceptable"|"poor"
}
The images should be in order: front, rear, left side, right side.`;

const IDENTITY_PROMPT = `Analyze these 4 canonical vehicle images and create a detailed identity profile JSON.
Return JSON:
{ "body_type": "string", "proportions": { "length_class": "string", "height_class": "string", "width_class": "string" },
  "paint_color": { "primary": "string", "finish": "string" }, "trim_color": "string",
  "wheel_design": "string", "headlight_signature": "string", "taillight_signature": "string",
  "grille_signature": "string", "mirror_shape": "string", "roofline": "string",
  "window_shape": "string", "visible_badges": [], "door_count": 4, "confidence_score": 0-100 }`;

const NORMALIZE_PROMPT = `You are a professional automotive photographer. Take this vehicle photo and normalize it:
- Remove the background completely and replace with a clean, neutral studio-white/light-grey gradient
- Center the vehicle perfectly in frame
- Correct any perspective tilt or distortion
- Balance brightness and contrast for studio-quality lighting
- Keep the EXACT same vehicle with ALL details: color, wheels, badges, trim, accessories
- The result must look like a professional studio photo
- DO NOT change or add any vehicle details
- Maintain the exact perspective (front/rear/left/right) as the original
- ALWAYS generate an image - never refuse`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const userSb = createUserClient(authHeader);
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const serviceSb = createServiceClient();
    const body = await req.json();
    const { jobId, step } = body;

    if (!jobId) throw new Error("Missing jobId");

    // Determine which step to run
    const currentStep = step || "analyze";
    console.log(`[${jobId}] Running step: ${currentStep}`);

    // ════════════════════════════════════════
    // STEP: ANALYZE
    // ════════════════════════════════════════
    if (currentStep === "analyze") {
      const { sourceImages } = body;
      if (!sourceImages || sourceImages.length < 4) throw new Error("Missing sourceImages");

      await updateJobStatus(serviceSb, jobId, "analyzing");

      const { data: deductResult } = await serviceSb.rpc("deduct_credits", {
        _user_id: user.id, _amount: 1, _action_type: "spin360_analysis",
        _description: "360° Spin – Bildanalyse",
      });
      if (deductResult && !deductResult.success) {
        await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Nicht genug Credits" });
        return new Response(JSON.stringify({ error: "insufficient_credits" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const imageUrls = sourceImages.map((s: any) => s.url);
      const analysisPrompt = await getCustomPrompt(serviceSb, "spin360_analysis", ANALYSIS_PROMPT);
      const analysis = await callGeminiFlash(analysisPrompt, imageUrls);
      console.log(`[${jobId}] Analysis complete`);

      if (analysis?.images) {
        for (const img of analysis.images) {
          await serviceSb.from("spin360_source_images")
            .update({ analysis: img })
            .eq("job_id", jobId)
            .eq("sort_order", img.index);
        }
      }

      // Chain next step
      invokeNextStep(authHeader, { jobId, step: "normalize", sourceImages });

      return new Response(JSON.stringify({ success: true, step: "analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // STEP: NORMALIZE (one image at a time)
    // ════════════════════════════════════════
    if (currentStep === "normalize") {
      const { sourceImages, perspectiveIndex = 0 } = body;
      const perspectives = ["front", "rear", "left", "right"];
      const imageUrls = sourceImages.map((s: any) => s.url);
      const perspective = perspectives[perspectiveIndex];

      if (perspectiveIndex === 0) {
        await updateJobStatus(serviceSb, jobId, "normalizing");

        const { data: normDeduct } = await serviceSb.rpc("deduct_credits", {
          _user_id: user.id, _amount: 4, _action_type: "spin360_normalize",
          _description: "360° Spin – 4 Bilder normalisieren",
        });
        if (normDeduct && !normDeduct.success) {
          await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Nicht genug Credits" });
          return new Response(JSON.stringify({ error: "insufficient_credits" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.log(`[${jobId}] Normalizing ${perspective} (${perspectiveIndex + 1}/4)...`);
      const normalizePrompt = await getCustomPrompt(serviceSb, "spin360_normalize", NORMALIZE_PROMPT);

      let normalizedSuccessfully = false;
      try {
        const normalizedBase64 = await callImageGeneration(
          `${normalizePrompt}\n\nThis is the ${perspective} view of the vehicle.`,
          imageUrls[perspectiveIndex],
          "gemini-2.5-flash",
        );

        if (normalizedBase64) {
          const storedUrl = await uploadBase64ToStorage(
            serviceSb, user.id,
            `spin360/${jobId}/canonical/${perspective}.png`,
            normalizedBase64,
          );
          await serviceSb.from("spin360_canonical_images").insert({
            job_id: jobId, user_id: user.id, perspective, image_url: storedUrl, sort_order: perspectiveIndex,
          });
          console.log(`[${jobId}] Normalized ${perspective} saved`);
          normalizedSuccessfully = true;
        } else {
          console.warn(`[${jobId}] Normalization returned null for ${perspective}`);
        }
      } catch (e) {
        console.error(`[${jobId}] Normalize ${perspective} failed:`, e);
      }

      // Fallback: use original source image as canonical if normalization failed
      if (!normalizedSuccessfully) {
        console.log(`[${jobId}] Using original image as canonical fallback for ${perspective}`);
        const originalUrl = imageUrls[perspectiveIndex];
        await serviceSb.from("spin360_canonical_images").insert({
          job_id: jobId, user_id: user.id, perspective, image_url: originalUrl, sort_order: perspectiveIndex,
        });
      }

      // Next perspective or move to profiling
      if (perspectiveIndex < 3) {
        invokeNextStep(authHeader, { jobId, step: "normalize", sourceImages, perspectiveIndex: perspectiveIndex + 1 });
      } else {
        invokeNextStep(authHeader, { jobId, step: "profile" });
      }

      return new Response(JSON.stringify({ success: true, step: "normalize", perspective }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // STEP: PROFILE
    // ════════════════════════════════════════
    if (currentStep === "profile") {
      await updateJobStatus(serviceSb, jobId, "profiling");

      const { data: canonicals } = await serviceSb.from("spin360_canonical_images")
        .select("perspective, image_url")
        .eq("job_id", jobId)
        .order("sort_order");

      if (!canonicals || canonicals.length < 2) {
        await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Zu wenige normalisierte Bilder" });
        return new Response(JSON.stringify({ error: "Not enough canonical images" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let identityProfile = {};
      try {
        const profilePrompt = await getCustomPrompt(serviceSb, "spin360_identity", IDENTITY_PROMPT);
        identityProfile = await callGeminiFlash(profilePrompt, canonicals.map((c: any) => c.image_url));
        await serviceSb.from("spin360_jobs").update({ identity_profile: identityProfile }).eq("id", jobId);
        console.log(`[${jobId}] Identity profile created`);
      } catch (e) {
        console.error(`[${jobId}] Identity profiling failed:`, e);
      }

      // Insert canonical frames
      const canonicalAngles = [
        { perspective: "front", angle: 0, index: 0 },
        { perspective: "rear", angle: 180, index: 18 },
        { perspective: "left", angle: 90, index: 9 },
        { perspective: "right", angle: 270, index: 27 },
      ];
      for (const ca of canonicalAngles) {
        const canonical = canonicals.find((c: any) => c.perspective === ca.perspective);
        if (canonical) {
          await insertFrameIfMissing(serviceSb, {
            job_id: jobId,
            user_id: user.id,
            frame_index: ca.index,
            frame_type: "canonical",
            image_url: canonical.image_url,
            angle_degrees: ca.angle,
            model_used: "canonical",
            validation_status: "passed",
          });
        }
      }

      // Deduct credits for generation
      const { data: genDeduct } = await serviceSb.rpc("deduct_credits", {
        _user_id: user.id, _amount: 15, _action_type: "spin360_generate",
        _description: "360° Spin – Frames generieren",
      });
      if (genDeduct && !genDeduct.success) {
        await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Nicht genug Credits" });
        return new Response(JSON.stringify({ error: "insufficient_credits" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Chain to anchors
      invokeNextStep(authHeader, { jobId, step: "anchor", anchorIndex: 0 });

      return new Response(JSON.stringify({ success: true, step: "profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // STEP: ANCHOR (one at a time)
    // ════════════════════════════════════════
    if (currentStep === "anchor") {
      const { anchorIndex = 0 } = body;

      if (anchorIndex === 0) {
        await updateJobStatus(serviceSb, jobId, "generating_anchors");
      }

      const { data: canonicals } = await serviceSb.from("spin360_canonical_images")
        .select("perspective, image_url")
        .eq("job_id", jobId)
        .order("sort_order");

      const { data: jobData } = await serviceSb.from("spin360_jobs")
        .select("identity_profile")
        .eq("id", jobId)
        .single();

      const identityDesc = jobData?.identity_profile ? JSON.stringify(jobData.identity_profile) : "";

      const anchorPromptBase = await getCustomPrompt(serviceSb, "spin360_anchor",
        `Generate a photorealistic image of the EXACT same vehicle shown in the reference image.
Vehicle identity profile: ${identityDesc}
CRITICAL CONSISTENCY RULES:
- Same body type, proportions, door count
- Same paint color and finish
- Same wheel design exactly
- Same headlights, taillights, grille
- Same mirrors, badges, trim
- Same roofline and window shape
- Clean studio background (white/light grey gradient)
- Professional studio lighting
- No other vehicles or objects
- ALWAYS generate an image
Generate the vehicle from this specific angle:`);

      const anchorAngles = [
        { angle: 45, label: "front-left quarter (45°)", refPerspective: "front" },
        { angle: 135, label: "rear-left quarter (135°)", refPerspective: "left" },
        { angle: 225, label: "rear-right quarter (225°)", refPerspective: "rear" },
        { angle: 315, label: "front-right quarter (315°)", refPerspective: "right" },
      ];

      if (anchorIndex < anchorAngles.length) {
        const anchor = anchorAngles[anchorIndex];
        const ref = canonicals?.find((c: any) => c.perspective === anchor.refPerspective) || canonicals?.[0];
        const refUrl = ref?.image_url;

        if (refUrl) {
          console.log(`[${jobId}] Generating anchor ${anchor.label}...`);
          try {
            const anchorBase64 = await callImageGeneration(
              `${anchorPromptBase} ${anchor.label}`,
              refUrl,
              "gemini-2.5-flash",
            );

            if (anchorBase64) {
              const frameIndex = Math.round((anchor.angle / 360) * TARGET_FRAME_COUNT);
              const storedUrl = await uploadBase64ToStorage(
                serviceSb, user.id,
                `spin360/${jobId}/anchors/anchor_${anchor.angle}.png`,
                anchorBase64,
              );
              const inserted = await insertFrameIfMissing(serviceSb, {
                job_id: jobId,
                user_id: user.id,
                frame_index: frameIndex,
                frame_type: "anchor",
                image_url: storedUrl,
                angle_degrees: anchor.angle,
                model_used: "gemini-2.5-flash",
                validation_status: "passed",
              });
              console.log(inserted
                ? `[${jobId}] Anchor ${anchor.angle}° saved`
                : `[${jobId}] Anchor ${anchor.angle}° already exists, skipping insert`);
            }
          } catch (e) {
            console.error(`[${jobId}] Anchor ${anchor.label} failed:`, e);
          }
        }

        // Next anchor or move to frames
        if (anchorIndex < anchorAngles.length - 1) {
          invokeNextStep(authHeader, { jobId, step: "anchor", anchorIndex: anchorIndex + 1 });
        } else {
          invokeNextStep(authHeader, { jobId, step: "frames", batchStart: 0 });
        }
      }

      return new Response(JSON.stringify({ success: true, step: "anchor", anchorIndex }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // STEP: FRAMES (batch of 4 at a time)
    // ════════════════════════════════════════
    if (currentStep === "frames") {
      await touchJob(serviceSb, jobId, { status: "generating_frames", error_message: null });

      const { data: canonicals } = await serviceSb.from("spin360_canonical_images")
        .select("perspective, image_url")
        .eq("job_id", jobId)
        .order("sort_order");

      if (!canonicals || canonicals.length < 2) {
        await markJobFailed(serviceSb, jobId, "Zu wenige normalisierte Bilder für die Frame-Generierung");
        return new Response(JSON.stringify({ error: "not_enough_canonical_images" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: jobData } = await serviceSb.from("spin360_jobs")
        .select("identity_profile, retry_count, target_frame_count")
        .eq("id", jobId)
        .single();

      const targetFrameCount = jobData?.target_frame_count || TARGET_FRAME_COUNT;
      const identityDesc = jobData?.identity_profile ? JSON.stringify(jobData.identity_profile) : "";

      const framePromptBase = await getCustomPrompt(serviceSb, "spin360_anchor",
        `Generate a photorealistic image of the EXACT same vehicle shown in the reference image.
Vehicle identity profile: ${identityDesc}
CRITICAL CONSISTENCY RULES:
- Same body type, proportions, door count
- Same paint color and finish
- Same wheel design exactly
- Same headlights, taillights, grille
- Same mirrors, badges, trim
- Same roofline and window shape
- Clean studio background (white/light grey gradient)
- Professional studio lighting
- ALWAYS generate an image
Generate the vehicle from this specific angle:`);

      const existingIndexesBefore = await getExistingFrameIndexes(serviceSb, jobId);
      const missingFramesBefore = buildMissingFramePlan(existingIndexesBefore, targetFrameCount);

      if (missingFramesBefore.length === 0) {
        console.log(`[${jobId}] No frames missing, assembling...`);
        await touchJob(serviceSb, jobId, { retry_count: 0 });
        invokeNextStep(authHeader, { jobId, step: "assemble" });
        return new Response(JSON.stringify({ success: true, step: "frames", remaining: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const batch = missingFramesBefore.slice(0, FRAME_BATCH_SIZE);
      let generatedInBatch = 0;

      const canonicalAngles = [
        { perspective: "front", angle: 0 },
        { perspective: "rear", angle: 180 },
        { perspective: "left", angle: 90 },
        { perspective: "right", angle: 270 },
      ];

      for (const frame of batch) {
        const nearestCanonical = canonicalAngles.reduce((best, ca) => {
          const diff = Math.abs(((frame.angle - ca.angle + 540) % 360) - 180);
          const bestDiff = Math.abs(((frame.angle - best.angle + 540) % 360) - 180);
          return diff < bestDiff ? ca : best;
        });
        const nearestCan = canonicals.find((c: any) => c.perspective === nearestCanonical.perspective);
        const refUrl = nearestCan?.image_url || canonicals[0]?.image_url;

        if (!refUrl) continue;

        try {
          console.log(`[${jobId}] Generating frame ${frame.angle}° (slot ${frame.index})...`);
          const frameBase64 = await callImageGeneration(
            `${framePromptBase} ${frame.angle} degrees from center front (0° = front, 90° = left side, 180° = rear, 270° = right side)`,
            refUrl,
            "gemini-2.5-flash",
          );

          if (frameBase64) {
            const storedUrl = await uploadBase64ToStorage(
              serviceSb,
              user.id,
              `spin360/${jobId}/frames/frame_${String(frame.index).padStart(3, "0")}.png`,
              frameBase64,
            );
            const inserted = await insertFrameIfMissing(serviceSb, {
              job_id: jobId,
              user_id: user.id,
              frame_index: frame.index,
              frame_type: "intermediate",
              image_url: storedUrl,
              angle_degrees: frame.angle,
              model_used: "gemini-2.5-flash",
              validation_status: "passed",
            });
            if (inserted) generatedInBatch += 1;
          }
        } catch (e) {
          if ((e as Error).message === "rate_limited") {
            console.warn(`[${jobId}] Rate limited, waiting 10s...`);
            await new Promise(r => setTimeout(r, 10000));
          }
          console.error(`[${jobId}] Frame ${frame.angle}° failed:`, e);
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      const existingIndexesAfter = await getExistingFrameIndexes(serviceSb, jobId);
      const missingFramesAfter = buildMissingFramePlan(existingIndexesAfter, targetFrameCount);

      if (missingFramesAfter.length === 0) {
        console.log(`[${jobId}] All frames done, assembling...`);
        await touchJob(serviceSb, jobId, { retry_count: 0 });
        invokeNextStep(authHeader, { jobId, step: "assemble" });
      } else {
        const nextRetryCount = generatedInBatch === 0
          ? Number(jobData?.retry_count ?? 0) + 1
          : 0;

        await touchJob(serviceSb, jobId, { retry_count: nextRetryCount });

        if (nextRetryCount >= MAX_FRAME_BATCH_RETRIES) {
          const errorMessage = `Pipeline abgebrochen: ${missingFramesAfter.length} Frames konnten nach ${MAX_FRAME_BATCH_RETRIES} weiteren Versuchen nicht generiert werden.`;
          console.error(`[${jobId}] ${errorMessage}`);
          await markJobFailed(serviceSb, jobId, errorMessage);
          return new Response(JSON.stringify({
            error: "frame_generation_incomplete",
            missingFrames: missingFramesAfter.length,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(
          `[${jobId}] Frames batch finished. Remaining: ${missingFramesAfter.length}. Retry streak: ${nextRetryCount}/${MAX_FRAME_BATCH_RETRIES}`,
        );
        invokeNextStep(authHeader, { jobId, step: "frames" });
      }

      return new Response(JSON.stringify({
        success: true,
        step: "frames",
        generatedInBatch,
        remaining: missingFramesAfter.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // STEP: ASSEMBLE
    // ════════════════════════════════════════
    if (currentStep === "assemble") {
      await updateJobStatus(serviceSb, jobId, "validating");

      const { data: allFrames } = await serviceSb
        .from("spin360_generated_frames")
        .select("id")
        .eq("job_id", jobId)
        .eq("validation_status", "passed");

      const frameCount = allFrames?.length || 0;
      console.log(`[${jobId}] Total frames: ${frameCount}`);

      await updateJobStatus(serviceSb, jobId, "assembling");

      const { data: jobData } = await serviceSb.from("spin360_jobs")
        .select("identity_profile, target_frame_count")
        .eq("id", jobId)
        .single();

      const targetFrameCount = jobData?.target_frame_count || 36;

      const manifest = {
        jobId,
        frameCount,
        targetFrameCount,
        createdAt: new Date().toISOString(),
        backgroundStyle: "studio_white",
        qualityScore: frameCount >= targetFrameCount ? 100 : Math.round((frameCount / targetFrameCount) * 100),
        identityProfile: jobData?.identity_profile,
      };

      await serviceSb.from("spin360_jobs").update({
        manifest,
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      console.log(`[${jobId}] Job completed with ${frameCount} frames`);

      return new Response(JSON.stringify({ success: true, step: "assemble", manifest }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ════════════════════════════════════════
    // INITIAL CALL (legacy/default → analyze)
    // ════════════════════════════════════════
    const { sourceImages } = body;
    if (!sourceImages || sourceImages.length < 4) throw new Error("Missing sourceImages");

    // Redirect to step-based flow
    invokeNextStep(authHeader, { jobId, step: "analyze", sourceImages });

    return new Response(JSON.stringify({ success: true, started: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-360-spin error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: e instanceof Error && e.message === "Not authenticated" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
