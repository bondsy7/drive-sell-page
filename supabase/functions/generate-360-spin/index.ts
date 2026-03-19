import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

async function updateJobStatus(sb: any, jobId: string, status: string, extra: Record<string, any> = {}) {
  await sb.from("spin360_jobs").update({ status, updated_at: new Date().toISOString(), ...extra }).eq("id", jobId);
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
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  };

  if (responseType === "json") {
    body.generationConfig.responseMimeType = "application/json";
  }

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
    try { return JSON.parse(textContent); }
    catch { return textContent; }
  }
  return textContent;
}

async function callImageGeneration(prompt: string, referenceImageUrl: string, model: string = "gemini-3-pro-image-preview"): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const messages: any[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: referenceImageUrl } },
      ],
    },
  ];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: `google/${model}`,
      messages,
      modalities: ["image", "text"],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error(`Image gen error (${model}):`, resp.status, t);
    if (resp.status === 429) throw new Error("rate_limited");
    if (resp.status === 402) throw new Error("payment_required");
    return null;
  }

  const data = await resp.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  return imageUrl || null;
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

// ─── ANALYSIS STEP ───
const ANALYSIS_PROMPT = `You are an expert automotive photographer analyzing 4 vehicle images for a 360° spin.

Analyze each image and return JSON:
{
  "images": [
    {
      "index": 0,
      "detected_perspective": "front" | "rear" | "left" | "right",
      "quality_score": 0-100,
      "vehicle_fully_visible": true/false,
      "cropping_ok": true/false,
      "brightness_ok": true/false,
      "warnings": ["string"],
      "vehicle_type": "sedan" | "suv" | "hatchback" | "coupe" | "wagon" | "van" | "truck" | "convertible",
      "color": "string"
    }
  ],
  "same_vehicle": true/false,
  "mismatch_warnings": ["string"],
  "suggested_reorder": [0,1,2,3] or null,
  "overall_quality": "good" | "acceptable" | "poor"
}

The images should be in order: front, rear, left side, right side.
Check if any images appear swapped or assigned to the wrong slot.`;

// ─── IDENTITY PROFILE PROMPT ───
const IDENTITY_PROMPT = `Analyze these 4 canonical vehicle images and create a detailed identity profile JSON. This profile will be used to ensure consistency when generating intermediate angles.

Return JSON:
{
  "body_type": "sedan|suv|hatchback|coupe|wagon|van|truck|convertible",
  "proportions": { "length_class": "compact|mid|full", "height_class": "low|mid|high", "width_class": "narrow|mid|wide" },
  "paint_color": { "primary": "string", "finish": "metallic|matte|glossy|pearl" },
  "trim_color": "string",
  "wheel_design": "string description",
  "headlight_signature": "string description",
  "taillight_signature": "string description",
  "grille_signature": "string description",
  "mirror_shape": "string",
  "roofline": "string description",
  "window_shape": "string",
  "visible_badges": ["string"],
  "door_count": 2|3|4|5,
  "confidence_score": 0-100
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const userSb = createUserClient(authHeader);
    const { data: { user }, error: authError } = await userSb.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const serviceSb = createServiceClient();
    const { jobId, sourceImages } = await req.json();

    if (!jobId || !sourceImages || sourceImages.length < 4) {
      throw new Error("Missing jobId or insufficient sourceImages");
    }

    console.log(`Starting 360 spin pipeline for job ${jobId} with ${sourceImages.length} images`);

    // ─── STEP 1: ANALYZE ───
    await updateJobStatus(serviceSb, jobId, "analyzing");

    const analysisPrompt = await getCustomPrompt(serviceSb, "spin360_analysis", ANALYSIS_PROMPT);
    const imageUrls = sourceImages.map((s: any) => s.url);
    
    let analysis;
    try {
      const { data: deductResult } = await serviceSb.rpc("deduct_credits", {
        _user_id: user.id,
        _amount: 1,
        _action_type: "spin360_analysis",
        _description: "360° Spin – Bildanalyse",
      });
      if (deductResult && !deductResult.success) {
        await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Nicht genug Credits" });
        return new Response(JSON.stringify({ error: "insufficient_credits" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      analysis = await callGeminiFlash(analysisPrompt, imageUrls);
      console.log("Analysis complete:", JSON.stringify(analysis).substring(0, 200));
    } catch (e) {
      console.error("Analysis failed:", e);
      await updateJobStatus(serviceSb, jobId, "failed", { error_message: `Analyse fehlgeschlagen: ${(e as Error).message}` });
      return new Response(JSON.stringify({ error: "Analysis failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (analysis?.images) {
      for (const img of analysis.images) {
        await serviceSb.from("spin360_source_images")
          .update({ analysis: img })
          .eq("job_id", jobId)
          .eq("sort_order", img.index);
      }
    }

    // ─── STEP 2: NORMALIZE ───
    await updateJobStatus(serviceSb, jobId, "normalizing");

    const normalizePrompt = await getCustomPrompt(serviceSb, "spin360_normalize",
      `You are a professional automotive photographer. Take this vehicle photo and normalize it:
- Remove the background completely and replace with a clean, neutral studio-white/light-grey gradient
- Center the vehicle perfectly in frame
- Correct any perspective tilt or distortion
- Balance brightness and contrast for studio-quality lighting
- Keep the EXACT same vehicle with ALL details: color, wheels, badges, trim, accessories
- The result must look like a professional studio photo
- DO NOT change or add any vehicle details
- Maintain the exact perspective (front/rear/left/right) as the original
- ALWAYS generate an image - never refuse`);

    const { data: normDeduct } = await serviceSb.rpc("deduct_credits", {
      _user_id: user.id,
      _amount: 4,
      _action_type: "spin360_normalize",
      _description: "360° Spin – 4 Bilder normalisieren",
    });
    if (normDeduct && !normDeduct.success) {
      await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Nicht genug Credits" });
      return new Response(JSON.stringify({ error: "insufficient_credits" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canonicalUrls: { perspective: string; url: string }[] = [];
    const perspectives = ["front", "rear", "left", "right"];
    
    for (let i = 0; i < 4; i++) {
      const perspective = perspectives[i];
      console.log(`Normalizing ${perspective}...`);
      try {
        const sourceUrl = imageUrls[i];
        
        const normalizedBase64 = await callImageGeneration(
          `${normalizePrompt}\n\nThis is the ${perspective} view of the vehicle.`,
          sourceUrl,
          "gemini-3-pro-image-preview",
        );

        if (normalizedBase64) {
          const storedUrl = await uploadBase64ToStorage(
            serviceSb, user.id,
            `spin360/${jobId}/canonical/${perspective}.png`,
            normalizedBase64,
          );
          canonicalUrls.push({ perspective, url: storedUrl });

          await serviceSb.from("spin360_canonical_images").insert({
            job_id: jobId, user_id: user.id, perspective, image_url: storedUrl, sort_order: i,
          });
          console.log(`Normalized ${perspective} saved`);
        } else {
          console.warn(`Normalization returned null for ${perspective}`);
        }
      } catch (e) {
        console.error(`Normalize ${perspective} failed:`, e);
      }
      // Delay between normalization calls
      await new Promise(r => setTimeout(r, 2000));
    }

    if (canonicalUrls.length < 4) {
      console.warn(`Only ${canonicalUrls.length}/4 canonical images created`);
      // Continue with what we have if we got at least 2
      if (canonicalUrls.length < 2) {
        await updateJobStatus(serviceSb, jobId, "failed", { error_message: `Nur ${canonicalUrls.length}/4 Bilder normalisiert` });
        return new Response(JSON.stringify({ error: "Normalization incomplete" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── STEP 3: IDENTITY PROFILE ───
    await updateJobStatus(serviceSb, jobId, "profiling");

    let identityProfile;
    try {
      const profilePrompt = await getCustomPrompt(serviceSb, "spin360_identity", IDENTITY_PROMPT);
      identityProfile = await callGeminiFlash(profilePrompt, canonicalUrls.map(c => c.url));
      await serviceSb.from("spin360_jobs").update({ identity_profile: identityProfile }).eq("id", jobId);
      console.log("Identity profile created");
    } catch (e) {
      console.error("Identity profiling failed:", e);
      identityProfile = {};
    }

    // ─── STEP 4: GENERATE ANCHOR FRAMES ───
    await updateJobStatus(serviceSb, jobId, "generating_anchors");

    const { data: genDeduct } = await serviceSb.rpc("deduct_credits", {
      _user_id: user.id,
      _amount: 15,
      _action_type: "spin360_generate",
      _description: "360° Spin – Frames generieren",
    });
    if (genDeduct && !genDeduct.success) {
      await updateJobStatus(serviceSb, jobId, "failed", { error_message: "Nicht genug Credits" });
      return new Response(JSON.stringify({ error: "insufficient_credits" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const identityDesc = identityProfile ? JSON.stringify(identityProfile) : "";
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
      { angle: 45, label: "front-left quarter (45°)", refIdx: 0 },
      { angle: 135, label: "rear-left quarter (135°)", refIdx: 2 },
      { angle: 225, label: "rear-right quarter (225°)", refIdx: 1 },
      { angle: 315, label: "front-right quarter (315°)", refIdx: 3 },
    ];

    // Insert canonical frames first
    const canonicalAngles = [
      { perspective: "front", angle: 0, index: 0 },
      { perspective: "rear", angle: 180, index: 18 },
      { perspective: "left", angle: 90, index: 9 },
      { perspective: "right", angle: 270, index: 27 },
    ];

    for (const ca of canonicalAngles) {
      const canonical = canonicalUrls.find(c => c.perspective === ca.perspective);
      if (canonical) {
        await serviceSb.from("spin360_generated_frames").insert({
          job_id: jobId, user_id: user.id, frame_index: ca.index,
          frame_type: "canonical", image_url: canonical.url,
          angle_degrees: ca.angle, model_used: "canonical",
          validation_status: "passed",
        });
      }
    }

    for (const anchor of anchorAngles) {
      const refIdx = Math.min(anchor.refIdx, canonicalUrls.length - 1);
      const refUrl = canonicalUrls[refIdx]?.url || canonicalUrls[0].url;
      console.log(`Generating anchor ${anchor.label}...`);
      try {
        const anchorBase64 = await callImageGeneration(
          `${anchorPromptBase} ${anchor.label}`,
          refUrl,
          "gemini-3-pro-image-preview",
        );

        if (anchorBase64) {
          const frameIndex = Math.round((anchor.angle / 360) * 36);
          const storedUrl = await uploadBase64ToStorage(
            serviceSb, user.id,
            `spin360/${jobId}/anchors/anchor_${anchor.angle}.png`,
            anchorBase64,
          );

          await serviceSb.from("spin360_generated_frames").insert({
            job_id: jobId, user_id: user.id, frame_index: frameIndex,
            frame_type: "anchor", image_url: storedUrl,
            angle_degrees: anchor.angle, model_used: "gemini-3-pro-image-preview",
            validation_status: "passed",
          });
          console.log(`Anchor ${anchor.angle}° saved`);
        }
      } catch (e) {
        console.error(`Anchor ${anchor.label} failed:`, e);
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    // ─── STEP 5: GENERATE INTERMEDIATE FRAMES ───
    await updateJobStatus(serviceSb, jobId, "generating_frames");

    const existingAngles = new Set([0, 45, 90, 135, 180, 225, 270, 315]);
    const targetFrameCount = 36;
    const angleStep = 360 / targetFrameCount;

    for (let i = 0; i < targetFrameCount; i++) {
      const angle = Math.round(i * angleStep);
      if (existingAngles.has(angle)) continue;

      let nearestRefUrl = canonicalUrls[0].url;
      const nearestCanonical = canonicalAngles.reduce((best, ca) => {
        const diff = Math.abs(((angle - ca.angle + 540) % 360) - 180);
        const bestDiff = Math.abs(((angle - best.angle + 540) % 360) - 180);
        return diff < bestDiff ? ca : best;
      });
      const nearestCan = canonicalUrls.find(c => c.perspective === nearestCanonical.perspective);
      if (nearestCan) nearestRefUrl = nearestCan.url;

      try {
        const frameBase64 = await callImageGeneration(
          `${anchorPromptBase} ${angle} degrees from center front (0° = front, 90° = left side, 180° = rear, 270° = right side)`,
          nearestRefUrl,
          "gemini-3.1-flash-image-preview",
        );

        if (frameBase64) {
          const storedUrl = await uploadBase64ToStorage(
            serviceSb, user.id,
            `spin360/${jobId}/frames/frame_${String(i).padStart(3, "0")}.png`,
            frameBase64,
          );

          await serviceSb.from("spin360_generated_frames").insert({
            job_id: jobId, user_id: user.id, frame_index: i,
            frame_type: "intermediate", image_url: storedUrl,
            angle_degrees: angle, model_used: "gemini-3.1-flash-image-preview",
            validation_status: "passed",
          });
        }
      } catch (e) {
        if ((e as Error).message === "rate_limited") {
          console.warn("Rate limited, waiting 10s...");
          await new Promise(r => setTimeout(r, 10000));
        }
        console.error(`Frame ${angle}° failed:`, e);
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    // ─── STEP 6: VALIDATE ───
    await updateJobStatus(serviceSb, jobId, "validating");

    const { data: allFrames } = await serviceSb
      .from("spin360_generated_frames")
      .select("id")
      .eq("job_id", jobId)
      .eq("validation_status", "passed");

    const frameCount = allFrames?.length || 0;
    console.log(`Generated ${frameCount} frames for job ${jobId}`);

    // ─── STEP 7: ASSEMBLE ───
    await updateJobStatus(serviceSb, jobId, "assembling");

    const manifest = {
      jobId,
      frameCount,
      targetFrameCount,
      createdAt: new Date().toISOString(),
      backgroundStyle: "studio_white",
      qualityScore: frameCount >= targetFrameCount ? 100 : Math.round((frameCount / targetFrameCount) * 100),
      identityProfile,
      sourceViews: sourceImages.map((s: any) => s.perspective),
    };

    await serviceSb.from("spin360_jobs").update({
      manifest,
      status: "completed",
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`Job ${jobId} completed with ${frameCount} frames`);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      frameCount,
      manifest,
    }), {
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
