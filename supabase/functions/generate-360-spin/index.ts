// generate-360-spin (v2 — Keyframe/Doppel-Anker-Architektur)
// Schritte: analyze → normalize (8 Keyframes) → profile → frames (Sektoren + QA) → assemble
//
// Kernprinzipien:
//  - 8 Keyframes (0/45/90/135/180/225/270/315), vorhandene Fotos belegen so viele wie möglich
//  - Zwischenframes immer mit linkem + rechtem Keyframe + letztem akzeptierten Nachbarn als Referenz
//  - Kein Fallback auf unnormalisierte Rohfotos
//  - QA nach jedem Sektor, gezielte Regeneration, Credits erst nach QA
//  - Alle Bildtransfers bevorzugt über die Gemini File API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Konfiguration ───
const TARGET_FRAME_COUNT = 32;              // 11,25° Schritte
const KEYFRAME_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const FRAMES_PER_SECTOR = TARGET_FRAME_COUNT / KEYFRAME_ANGLES.length; // 4
const MAX_FRAME_ATTEMPTS = 3;               // 1 Versuch + 2 Regenerationen
const MAX_NORMALIZE_ATTEMPTS = 3;
const SECTOR_COUNT = KEYFRAME_ANGLES.length;

// Tier → Engine bindend, kein Cross-Engine-Fallback.
const TEXT_MODEL = "gemini-2.5-flash";
const MODEL_NORMALIZE = "gemini-3-pro-image-preview";
const MODEL_FRAME = "gemini-3.1-flash-image-preview";
const MODEL_REGEN = "gemini-3-pro-image-preview";
const IMAGE_FALLBACKS: Record<string, string[]> = {
  "gemini-3-pro-image-preview": ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"],
  "gemini-3.1-flash-image-preview": ["gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"],
};

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function createServiceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function createUserClient(authHeader: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function getCustomPrompt(sb: any, key: string, defaultPrompt: string): Promise<string> {
  try {
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) {
    console.warn("Custom prompt load failed:", e);
  }
  return defaultPrompt;
}

// ─── Job Helpers ───
async function updateJob(sb: any, jobId: string, extra: Record<string, any>) {
  await sb.from("spin360_jobs").update({ updated_at: new Date().toISOString(), ...extra }).eq("id", jobId);
}

async function markJobFailed(sb: any, jobId: string, errorMessage: string, status = "failed") {
  await updateJob(sb, jobId, { status, error_message: errorMessage });
}

function angleForIndex(index: number) {
  return (index * 360) / TARGET_FRAME_COUNT;
}

function keyframeIndexForAngle(angle: number) {
  return Math.round((angle / 360) * TARGET_FRAME_COUNT);
}

// ─── Bild-/Datei-Utilities ───
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface RefPart {
  fileUri?: { uri: string; mimeType: string };
  inline?: { mimeType: string; data: string };
}

/** File API First: Bild einmal hochladen, URI wiederverwenden. Fallback: inline bytes. */
const fileUriCache = new Map<string, { uri: string; mimeType: string }>();

async function toReferencePart(apiKey: string, url: string): Promise<RefPart | null> {
  const cached = fileUriCache.get(url);
  if (cached) return { fileUri: cached };

  let bytes: Uint8Array;
  let mimeType = "image/jpeg";
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    mimeType = resp.headers.get("content-type") || "image/jpeg";
    bytes = new Uint8Array(await resp.arrayBuffer());
  } catch (e) {
    console.warn("Reference download failed:", url, (e as Error).message);
    return null;
  }

  try {
    const start = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: `spin_${crypto.randomUUID()}` } }),
    });
    const uploadUrl = start.headers.get("x-goog-upload-url");
    if (start.ok && uploadUrl) {
      const finish = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Length": String(bytes.byteLength),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
        },
        body: bytes,
      });
      if (finish.ok) {
        const info = await finish.json();
        const uri = info?.file?.uri;
        if (uri) {
          const entry = { uri, mimeType: info?.file?.mimeType || mimeType };
          fileUriCache.set(url, entry);
          return { fileUri: entry };
        }
      }
    }
  } catch (e) {
    console.warn("Gemini File API upload failed, falling back to inline:", (e as Error).message);
  }

  return { inline: { mimeType, data: arrayBufferToBase64(bytes.buffer as ArrayBuffer) } };
}

function refPartToGemini(part: RefPart) {
  if (part.fileUri) return { fileData: { fileUri: part.fileUri.uri, mimeType: part.fileUri.mimeType } };
  return { inlineData: { mimeType: part.inline!.mimeType, data: part.inline!.data } };
}

// ─── Gemini Calls ───
async function callGeminiJson(prompt: string, imageUrls: string[]): Promise<any> {
  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const parts: any[] = [{ text: prompt }];
  for (const url of imageUrls) {
    const part = await toReferencePart(apiKey, url);
    if (part) parts.push(refPartToGemini(part));
  }

  const resp = await fetch(`${BASE_URL}/models/${TEXT_MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: "application/json" },
    }),
  });

  if (!resp.ok) throw new Error(`Gemini text API error: ${resp.status}`);
  const result = await resp.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    throw new Error("Gemini JSON parse failed");
  }
}

/** Bildgenerierung mit mehreren Referenzbildern. Verweigerung = verwertbares Fehlersignal. */
async function callImageGeneration(
  prompt: string,
  referenceUrls: string[],
  requestedModel: string,
): Promise<{ dataUrl: string; model: string } | null> {
  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const refParts: any[] = [];
  for (const url of referenceUrls) {
    const part = await toReferencePart(apiKey, url);
    if (part) refParts.push(refPartToGemini(part));
  }
  if (refParts.length === 0) throw new Error("no_reference_images");

  const chain = IMAGE_FALLBACKS[requestedModel] || [requestedModel];
  let lastError: string | null = null;

  for (const model of chain) {
    console.log(`[spin] Engine=gemini Model=${model} (requested=${requestedModel})`);
    try {
      const resp = await fetch(`${BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...refParts] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"], temperature: 0.15 },
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        lastError = `${resp.status}`;
        console.error(`[spin] image gen error (${model}): ${resp.status} ${t.slice(0, 300)}`);
        if (resp.status === 429) throw new Error("rate_limited");
        continue;
      }

      const data = await resp.json();
      for (const part of data.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return { dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, model };
        }
      }
      lastError = "no_image_in_response";
      console.warn(`[spin] ${model} returned no image (refusal signal)`);
    } catch (e) {
      if ((e as Error).message === "rate_limited") throw e;
      lastError = (e as Error).message;
    }
  }

  console.warn(`[spin] image generation failed: ${lastError}`);
  return null;
}

async function uploadDataUrlToStorage(sb: any, userId: string, path: string, dataUrl: string): Promise<string> {
  const mimeMatch = dataUrl.match(/^data:(image\/[\w.+-]+);base64,/);
  const contentType = mimeMatch ? mimeMatch[1] : "image/png";
  const raw = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
  const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const fullPath = `${userId}/${path}`;
  const { error } = await sb.storage.from("vehicle-images").upload(fullPath, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload error: ${error.message}`);
  const { data } = sb.storage.from("vehicle-images").getPublicUrl(fullPath);
  return data.publicUrl;
}

async function invokeNextStep(authHeader: string, body: Record<string, any>) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/generate-360-spin`, {
      method: "POST",
      headers: { Authorization: authHeader, apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) console.error("Self-invoke failed:", resp.status, await resp.text());
  } catch (e) {
    console.error("Self-invoke failed:", e);
  }
}

// ═══════════════ PROMPT-BAUSTEINE ═══════════════

const REFERENCE_TRUTH = `<REFERENCE_TRUTH_PROTOCOL>
Use ONLY the provided reference images as the source of truth.
Do NOT invent colors, badges, wheels, rims, trim, stitching, lettering or UI elements.
Every visible attribute MUST match the references exactly.
Do NOT fall back on generic model knowledge about this make or model.
</REFERENCE_TRUTH_PROTOCOL>`;

const SCENE_LOCK = `<SCENE_LOCK>
Background: seamless neutral studio cyclorama, light grey (#EDEDED) at the floor fading to white at the top.
Lighting: large soft overhead key light plus even fill, no coloured light, no visible light sources.
Ground contact: one soft elliptical contact shadow directly under the vehicle, always centered under the wheelbase.
Camera: locked tripod, eye level at roughly 1/2 vehicle height, 50mm equivalent, no tilt, no roll.
Framing: vehicle horizontally centered, occupying 82% of the image width, identical margins in every frame.
Output: single photorealistic image, 3:2 landscape, no text, no watermark, no logo overlay.
</SCENE_LOCK>`;

const NEGATIVE_LIST = `<NEGATIVE_LIST>
No second vehicle. No people. No animals. No readable license plate (keep the plate area blank).
No reflections of foreign objects, no studio equipment, no tripods, no props.
No text, captions, watermarks or borders. No motion blur, no lens flare, no vignette.
No changes to body condition: do not repair dents, scratches or wear, do not add accessories.
</NEGATIVE_LIST>`;

function identityLockBlock(identity: unknown) {
  return `<IDENTITY_LOCK>
The following JSON describes the ONE vehicle that must appear. It is binding and must be reproduced literally:
${JSON.stringify(identity ?? {}, null, 0)}
Paint tone and finish, rim design and spoke count, headlight and taillight signatures, grille pattern,
mirror type, roofline, glass shape, badges and door count must be identical in every frame.
</IDENTITY_LOCK>`;
}

const DEFAULT_ANALYSIS_PROMPT = `You are an automotive photo analyst preparing a 360° turntable spin.
For each supplied image return JSON:
{
  "images": [{ "index": 0, "detected_angle": 0|45|90|135|180|225|270|315,
    "quality_score": 0-100, "vehicle_fully_visible": true, "cropping_ok": true,
    "brightness_ok": true, "warnings": [], "vehicle_type": "string", "color": "string" }],
  "same_vehicle": true, "mismatch_warnings": [], "overall_quality": "good"|"acceptable"|"poor"
}
Angle convention: 0 = direct front, 90 = full left side (driver side), 180 = direct rear,
270 = full right side, 45/135/225/315 = the corresponding three-quarter views.
Pick the closest angle from the allowed set for every image.`;

const DEFAULT_IDENTITY_PROMPT = `Analyse these vehicle images and return one binding identity profile as JSON:
{ "body_type": "", "proportions": { "length_class": "", "height_class": "", "width_class": "" },
  "paint_color": { "primary": "", "finish": "" }, "trim_color": "", "wheel_design": "",
  "wheel_spoke_count": 0, "headlight_signature": "", "taillight_signature": "", "grille_signature": "",
  "mirror_shape": "", "roofline": "", "window_shape": "", "visible_badges": [], "door_count": 4,
  "visible_damage": [], "confidence_score": 0 }
Describe only what is visible. Never guess from model knowledge.`;

function buildNormalizePrompt(base: string, angle: number) {
  return `${base}

${REFERENCE_TRUTH}
${SCENE_LOCK}
${NEGATIVE_LIST}

<TASK>
Re-photograph the vehicle from the first reference image as a studio turntable keyframe at ${angle} degrees.
Angle convention: 0 = direct front, 90 = full left side, 180 = direct rear, 270 = full right side.
Keep the vehicle identical. Only background, lighting, framing and perspective correction may change.
</TASK>`;
}

const DEFAULT_NORMALIZE_PROMPT = `You are a professional automotive studio photographer producing a turntable keyframe.`;

function buildFramePrompt(
  identity: unknown,
  angle: number,
  prevAngle: number,
  nextAngle: number,
  hasNeighbour: boolean,
  strict: boolean,
) {
  return `You are producing frame ${angle}° of a 32-frame studio turntable sequence of ONE specific vehicle.

${REFERENCE_TRUTH}
${identityLockBlock(identity)}
${SCENE_LOCK}
${NEGATIVE_LIST}

<REFERENCE_ROLES>
Reference 1 = keyframe at ${prevAngle}° (rotation start of this sector).
Reference 2 = keyframe at ${nextAngle}° (rotation end of this sector).${
    hasNeighbour ? `\nReference 3 = the already accepted neighbouring frame, immediately before this one in the rotation.` : ""
  }
</REFERENCE_ROLES>

<TASK>
Render the SAME vehicle rotated to exactly ${angle} degrees, measured clockwise from the FIRST reference image
(0 = direct front, 90 = full left side, 180 = direct rear, 270 = full right side).
The result must sit visually exactly between reference 1 and reference 2 — never beyond either of them.
Scene, lighting, camera and framing are frozen: only the vehicle's rotation changes.
</TASK>${
    strict
      ? `

<STRICT_RETRY>
A previous attempt was rejected. Pay maximum attention to: rim design and spoke count, paint tone,
light signatures, body proportions and the exact rotation angle. Do not drift towards a generic vehicle.
</STRICT_RETRY>`
      : ""
  }`;
}

const QA_PROMPT = `You are the quality gate for a 360° vehicle turntable sequence.
Reference image 1 is the binding keyframe. The following images are candidate frames.
For every candidate return JSON:
{ "frames": [{ "position": 1, "verdict": "pass"|"fail", "score": 0-100, "issues": [] }] }
Fail a frame when any of these is true: different paint tone or finish, different rim design or spoke count,
different light signature or grille, different body proportions or door count, added or removed parts,
visible artefacts or deformations, background not the uniform studio cyclorama, vehicle not centered,
or the rotation angle is implausible for the requested position.
Be strict: when in doubt, fail.`;

// ═══════════════ HANDLER ═══════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const userSb = createUserClient(authHeader);
    const { data: claims, error: authError } = await userSb.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const userId = (claims as any)?.claims?.sub || (claims as any)?.sub;
    if (authError || !userId) throw new Error("Not authenticated");

    const sb = createServiceClient();
    const body = await req.json();
    const { jobId } = body;
    if (!jobId) throw new Error("Missing jobId");

    const currentStep = body.step || "analyze";
    console.log(`[${jobId}] step=${currentStep}`);

    const json = (payload: Record<string, any>, status = 200) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ─────────── ANALYZE ───────────
    if (currentStep === "analyze") {
      const { sourceImages } = body;
      if (!Array.isArray(sourceImages) || sourceImages.length < 2) {
        throw new Error("Mindestens 2 Quellbilder erforderlich");
      }

      await updateJob(sb, jobId, { status: "analyzing", error_message: null });

      const { data: deduct } = await sb.rpc("deduct_credits", {
        _user_id: userId,
        _amount: 1,
        _action_type: "spin360_analysis",
        _description: "360° Spin – Bildanalyse",
      });
      if (deduct && !deduct.success) {
        await markJobFailed(sb, jobId, "Nicht genug Credits");
        return json({ error: "insufficient_credits" });
      }

      const analysisPrompt = await getCustomPrompt(sb, "spin360_analysis", DEFAULT_ANALYSIS_PROMPT);
      let analysis: any = null;
      try {
        analysis = await callGeminiJson(analysisPrompt, sourceImages.map((s: any) => s.url));
      } catch (e) {
        console.warn(`[${jobId}] analysis failed, using declared angles:`, (e as Error).message);
      }

      // Quellbilder auf Keyframe-Winkel abbilden (Analyse-Winkel vor deklariertem Winkel).
      const selection: Record<number, any> = {};
      sourceImages.forEach((src: any, i: number) => {
        const detected = analysis?.images?.find((im: any) => Number(im.index) === i)?.detected_angle;
        const angle = KEYFRAME_ANGLES.includes(Number(detected))
          ? Number(detected)
          : Number.isFinite(Number(src.angle))
            ? Number(src.angle)
            : null;
        if (angle === null || !KEYFRAME_ANGLES.includes(angle)) return;
        if (selection[angle]) return; // erster Treffer gewinnt
        selection[angle] = { ...src, angle };
      });

      if (analysis?.images) {
        for (const img of analysis.images) {
          await sb.from("spin360_source_images").update({ analysis: img })
            .eq("job_id", jobId).eq("sort_order", img.index);
        }
      }

      const chosen = Object.values(selection);
      if (chosen.length < 2) {
        await markJobFailed(sb, jobId, "Zu wenige verwertbare Perspektiven erkannt", "needs_review");
        return json({ error: "not_enough_perspectives" });
      }

      await sb.from("spin360_source_selection").delete().eq("job_id", jobId);
      await sb.from("spin360_source_selection").insert(
        chosen.map((c: any) => ({
          job_id: jobId,
          user_id: userId,
          angle_degrees: c.angle,
          asset_kind: c.assetKind || "upload",
          asset_id: c.assetId || null,
          storage_path: c.storagePath || null,
          image_url: c.url,
        })),
      );

      await updateJob(sb, jobId, {
        keyframe_count: KEYFRAME_ANGLES.length,
        target_frame_count: TARGET_FRAME_COUNT,
        manifest_version: 2,
      });

      invokeNextStep(authHeader, { jobId, step: "normalize", keyframeIndex: 0 });
      return json({ success: true, step: "analyze", keyframes: chosen.length });
    }

    // ─────────── NORMALIZE (ein Keyframe pro Aufruf) ───────────
    if (currentStep === "normalize") {
      const keyframeIndex = Number(body.keyframeIndex ?? 0);
      const angle = KEYFRAME_ANGLES[keyframeIndex];

      if (keyframeIndex === 0) {
        await updateJob(sb, jobId, { status: "normalizing" });
        const { data: deduct } = await sb.rpc("deduct_credits", {
          _user_id: userId,
          _amount: 4,
          _action_type: "spin360_normalize",
          _description: "360° Spin – Keyframes normalisieren",
        });
        if (deduct && !deduct.success) {
          await markJobFailed(sb, jobId, "Nicht genug Credits");
          return json({ error: "insufficient_credits" });
        }
      }

      const { data: selection } = await sb.from("spin360_source_selection")
        .select("angle_degrees, image_url").eq("job_id", jobId);
      const { data: existingCanonicals } = await sb.from("spin360_canonical_images")
        .select("angle_degrees, image_url").eq("job_id", jobId).not("angle_degrees", "is", null);

      const own = (selection || []).find((s: any) => Number(s.angle_degrees) === angle);
      const already = (existingCanonicals || []).find((c: any) => Number(c.angle_degrees) === angle);

      if (!already) {
        // Referenzen: eigenes Foto zuerst, sonst nächstliegende Quellen als Basis.
        const refUrls: string[] = [];
        if (own) refUrls.push(own.image_url);
        const sorted = (selection || [])
          .filter((s: any) => Number(s.angle_degrees) !== angle)
          .sort((a: any, b: any) => {
            const da = Math.abs(((Number(a.angle_degrees) - angle + 540) % 360) - 180);
            const db = Math.abs(((Number(b.angle_degrees) - angle + 540) % 360) - 180);
            return db - da; // näher = kleinerer Abstand zu 180 → invertiert sortieren
          })
          .reverse();
        for (const s of sorted.slice(0, own ? 1 : 2)) refUrls.push(s.image_url);

        const normalizeBase = await getCustomPrompt(sb, "spin360_normalize", DEFAULT_NORMALIZE_PROMPT);
        const prompt = own
          ? buildNormalizePrompt(normalizeBase, angle)
          : `${buildNormalizePrompt(normalizeBase, angle)}\n\n<NOTE>No direct photo exists for this angle. Derive it strictly from the supplied reference angles without inventing new details.</NOTE>`;

        let stored: string | null = null;
        let usedModel = MODEL_NORMALIZE;
        for (let attempt = 1; attempt <= MAX_NORMALIZE_ATTEMPTS && !stored; attempt++) {
          try {
            const result = await callImageGeneration(prompt, refUrls, MODEL_NORMALIZE);
            if (result) {
              usedModel = result.model;
              stored = await uploadDataUrlToStorage(
                sb, userId, `spin360/${jobId}/canonical/kf_${angle}.png`, result.dataUrl,
              );
            }
          } catch (e) {
            if ((e as Error).message === "rate_limited") await new Promise((r) => setTimeout(r, 8000));
            console.error(`[${jobId}] normalize ${angle}° attempt ${attempt} failed:`, (e as Error).message);
          }
        }

        if (!stored) {
          // Kein Fallback auf Rohfotos — Job zur Prüfung markieren.
          await markJobFailed(
            sb, jobId,
            `Keyframe ${angle}° konnte nach ${MAX_NORMALIZE_ATTEMPTS} Versuchen nicht normalisiert werden.`,
            "needs_review",
          );
          return json({ error: "normalize_failed", angle });
        }

        await sb.from("spin360_canonical_images").upsert({
          job_id: jobId,
          user_id: userId,
          perspective: `kf_${angle}`,
          image_url: stored,
          sort_order: keyframeIndex,
          angle_degrees: angle,
          is_generated: !own,
          normalization_status: "normalized",
        }, { onConflict: "job_id,angle_degrees" });

        console.log(`[${jobId}] keyframe ${angle}° ready (model=${usedModel}, fromPhoto=${!!own})`);
      }

      if (keyframeIndex < KEYFRAME_ANGLES.length - 1) {
        invokeNextStep(authHeader, { jobId, step: "normalize", keyframeIndex: keyframeIndex + 1 });
      } else {
        invokeNextStep(authHeader, { jobId, step: "profile" });
      }
      return json({ success: true, step: "normalize", angle });
    }

    // ─────────── PROFILE ───────────
    if (currentStep === "profile") {
      await updateJob(sb, jobId, { status: "profiling" });

      const { data: canonicals } = await sb.from("spin360_canonical_images")
        .select("angle_degrees, image_url").eq("job_id", jobId)
        .not("angle_degrees", "is", null).order("angle_degrees");

      if (!canonicals || canonicals.length < KEYFRAME_ANGLES.length) {
        await markJobFailed(sb, jobId, "Nicht alle Keyframes vorhanden", "needs_review");
        return json({ error: "incomplete_keyframes" });
      }

      let identity: any = {};
      try {
        const profilePrompt = await getCustomPrompt(sb, "spin360_identity", DEFAULT_IDENTITY_PROMPT);
        identity = await callGeminiJson(profilePrompt, canonicals.map((c: any) => c.image_url));
      } catch (e) {
        console.error(`[${jobId}] identity profiling failed:`, (e as Error).message);
      }

      const identityHash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(identity))),
        ),
      ).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

      await updateJob(sb, jobId, { identity_profile: identity, identity_hash: identityHash });

      for (const c of canonicals) {
        const angle = Number(c.angle_degrees);
        await sb.from("spin360_generated_frames").upsert({
          job_id: jobId,
          user_id: userId,
          frame_index: keyframeIndexForAngle(angle),
          frame_type: "canonical",
          image_url: c.image_url,
          angle_degrees: angle,
          model_used: MODEL_NORMALIZE,
          validation_status: "passed",
          source_kind: "normalized",
          quality_score: 100,
          attempt_count: 1,
        }, { onConflict: "job_id,frame_index" });
      }

      invokeNextStep(authHeader, { jobId, step: "frames", sector: 0 });
      return json({ success: true, step: "profile" });
    }

    // ─────────── FRAMES (ein Sektor pro Aufruf, inkl. QA) ───────────
    if (currentStep === "frames") {
      const sector = Number(body.sector ?? 0);
      if (sector === 0) await updateJob(sb, jobId, { status: "generating_frames", error_message: null });

      if (sector >= SECTOR_COUNT) {
        invokeNextStep(authHeader, { jobId, step: "assemble" });
        return json({ success: true, step: "frames", done: true });
      }

      const { data: job } = await sb.from("spin360_jobs")
        .select("identity_profile, qa_summary").eq("id", jobId).single();
      const identity = job?.identity_profile ?? {};

      const { data: canonicals } = await sb.from("spin360_canonical_images")
        .select("angle_degrees, image_url").eq("job_id", jobId).not("angle_degrees", "is", null);
      const canonicalByAngle = new Map<number, string>(
        (canonicals || []).map((c: any) => [Number(c.angle_degrees), c.image_url as string]),
      );

      const prevAngle = KEYFRAME_ANGLES[sector];
      const nextAngle = KEYFRAME_ANGLES[(sector + 1) % KEYFRAME_ANGLES.length];
      const prevUrl = canonicalByAngle.get(prevAngle);
      const nextUrl = canonicalByAngle.get(nextAngle);
      if (!prevUrl || !nextUrl) {
        await markJobFailed(sb, jobId, `Keyframes für Sektor ${prevAngle}°–${nextAngle}° fehlen`, "needs_review");
        return json({ error: "sector_keyframes_missing" });
      }

      const { data: existing } = await sb.from("spin360_generated_frames")
        .select("frame_index, image_url, validation_status")
        .eq("job_id", jobId);
      const passedByIndex = new Map<number, string>(
        (existing || []).filter((f: any) => f.validation_status === "passed")
          .map((f: any) => [Number(f.frame_index), f.image_url as string]),
      );

      const startIndex = sector * FRAMES_PER_SECTOR;
      let lastAccepted = passedByIndex.get(startIndex) || prevUrl;
      const sectorResults: { index: number; verdict: string; score: number }[] = [];

      for (let offset = 1; offset < FRAMES_PER_SECTOR; offset++) {
        const frameIndex = startIndex + offset;
        if (passedByIndex.has(frameIndex)) {
          lastAccepted = passedByIndex.get(frameIndex)!;
          continue;
        }

        const angle = angleForIndex(frameIndex);
        let accepted = false;
        let attempt = 0;
        let lastUrl: string | null = null;
        let lastScore = 0;

        while (attempt < MAX_FRAME_ATTEMPTS && !accepted) {
          attempt++;
          const strict = attempt > 1;
          const model = strict ? MODEL_REGEN : MODEL_FRAME;
          const refs = [prevUrl, nextUrl];
          if (lastAccepted && lastAccepted !== prevUrl) refs.push(lastAccepted);

          let generated: { dataUrl: string; model: string } | null = null;
          try {
            generated = await callImageGeneration(
              buildFramePrompt(identity, Math.round(angle * 100) / 100, prevAngle, nextAngle, refs.length > 2, strict),
              refs,
              model,
            );
          } catch (e) {
            if ((e as Error).message === "rate_limited") await new Promise((r) => setTimeout(r, 8000));
            console.error(`[${jobId}] frame ${frameIndex} attempt ${attempt} error:`, (e as Error).message);
          }
          if (!generated) continue;

          const storedUrl = await uploadDataUrlToStorage(
            sb, userId,
            `spin360/${jobId}/frames/frame_${String(frameIndex).padStart(3, "0")}_a${attempt}.png`,
            generated.dataUrl,
          );
          lastUrl = storedUrl;

          // QA direkt gegen den linken Keyframe
          let verdict = "pass";
          let score = 80;
          let issues: string[] = [];
          try {
            const qa = await callGeminiJson(
              `${QA_PROMPT}\n\nCandidate 1 is the frame at ${Math.round(angle)}° in a rotation from ${prevAngle}° to ${nextAngle}°.`,
              [prevUrl, storedUrl],
            );
            const entry = qa?.frames?.[0];
            if (entry) {
              verdict = entry.verdict === "fail" ? "fail" : "pass";
              score = Number(entry.score ?? score);
              issues = Array.isArray(entry.issues) ? entry.issues : [];
            }
          } catch (e) {
            console.warn(`[${jobId}] QA call failed for frame ${frameIndex}:`, (e as Error).message);
          }
          lastScore = score;

          await sb.from("spin360_frame_reviews").insert({
            job_id: jobId,
            user_id: userId,
            frame_index: frameIndex,
            attempt,
            verdict,
            score,
            notes: issues.join("; ") || null,
            model_used: generated.model,
          });

          if (verdict === "pass" && score >= 60) {
            await sb.from("spin360_generated_frames").upsert({
              job_id: jobId,
              user_id: userId,
              frame_index: frameIndex,
              frame_type: "intermediate",
              image_url: storedUrl,
              angle_degrees: Math.round(angle),
              model_used: generated.model,
              validation_status: "passed",
              validation_notes: issues.join("; ") || null,
              source_kind: "generated",
              quality_score: score,
              attempt_count: attempt,
            }, { onConflict: "job_id,frame_index" });
            lastAccepted = storedUrl;
            accepted = true;
          }

          await new Promise((r) => setTimeout(r, 800));
        }

        if (!accepted) {
          // Interpolation: nächstgelegenen akzeptierten Nachbarn übernehmen, damit die Sequenz lückenlos bleibt.
          const fallbackUrl = lastUrl || lastAccepted || prevUrl;
          await sb.from("spin360_generated_frames").upsert({
            job_id: jobId,
            user_id: userId,
            frame_index: frameIndex,
            frame_type: "intermediate",
            image_url: fallbackUrl,
            angle_degrees: Math.round(angle),
            model_used: MODEL_REGEN,
            validation_status: "failed",
            validation_notes: "QA nicht bestanden – interpoliert",
            source_kind: "interpolated",
            quality_score: lastScore,
            attempt_count: attempt,
          }, { onConflict: "job_id,frame_index" });
        }

        sectorResults.push({ index: frameIndex, verdict: accepted ? "pass" : "fail", score: lastScore });
      }

      const qaSummary = { ...(job?.qa_summary as Record<string, any> ?? {}), [`sector_${sector}`]: sectorResults };
      await updateJob(sb, jobId, { qa_summary: qaSummary });

      invokeNextStep(authHeader, { jobId, step: "frames", sector: sector + 1 });
      return json({ success: true, step: "frames", sector, frames: sectorResults });
    }

    // ─────────── ASSEMBLE ───────────
    if (currentStep === "assemble") {
      await updateJob(sb, jobId, { status: "assembling" });

      const { data: frames } = await sb.from("spin360_generated_frames")
        .select("frame_index, angle_degrees, image_url, validation_status, quality_score, source_kind")
        .eq("job_id", jobId).order("frame_index");

      const all = frames || [];
      const passed = all.filter((f: any) => f.validation_status === "passed");
      const { data: job } = await sb.from("spin360_jobs")
        .select("identity_profile, identity_hash, qa_summary").eq("id", jobId).single();

      // Credits erst jetzt verbuchen – nach bestandener QA, anteilig zur Ausbeute.
      const generatedPassed = passed.filter((f: any) => f.source_kind === "generated").length;
      if (generatedPassed > 0) {
        const amount = Math.max(1, Math.round((generatedPassed / (TARGET_FRAME_COUNT - KEYFRAME_ANGLES.length)) * 15));
        const { data: deduct } = await sb.rpc("deduct_credits", {
          _user_id: userId,
          _amount: amount,
          _action_type: "spin360_generate",
          _description: `360° Spin – ${generatedPassed} geprüfte Frames`,
        });
        if (deduct && !deduct.success) {
          await markJobFailed(sb, jobId, "Nicht genug Credits für die Abrechnung");
          return json({ error: "insufficient_credits" });
        }
      }

      const qualityScore = all.length
        ? Math.round(all.reduce((sum: number, f: any) => sum + (f.quality_score ?? 0), 0) / all.length)
        : 0;

      const manifest = {
        version: 2,
        jobId,
        frameCount: all.length,
        targetFrameCount: TARGET_FRAME_COUNT,
        keyframeAngles: KEYFRAME_ANGLES,
        angleStep: 360 / TARGET_FRAME_COUNT,
        createdAt: new Date().toISOString(),
        backgroundStyle: "studio_cyclorama",
        qualityScore,
        identityHash: job?.identity_hash,
        identityProfile: job?.identity_profile,
        frames: all.map((f: any) => ({
          index: f.frame_index,
          angle: f.angle_degrees,
          url: f.image_url,
          status: f.validation_status,
          sourceKind: f.source_kind,
        })),
      };

      const incomplete = all.length < TARGET_FRAME_COUNT;
      const weakSequence = passed.length < TARGET_FRAME_COUNT * 0.8;

      await updateJob(sb, jobId, {
        manifest,
        manifest_version: 2,
        status: incomplete || weakSequence ? "needs_review" : "completed",
        error_message: weakSequence ? `Nur ${passed.length}/${TARGET_FRAME_COUNT} Frames haben die QA bestanden.` : null,
      });

      console.log(`[${jobId}] assembled: ${passed.length}/${all.length} passed`);
      return json({ success: true, step: "assemble", manifest });
    }

    // ─────────── Initialer Aufruf ───────────
    const { sourceImages } = body;
    if (!Array.isArray(sourceImages) || sourceImages.length < 2) {
      throw new Error("Mindestens 2 Quellbilder erforderlich");
    }
    invokeNextStep(authHeader, { jobId, step: "analyze", sourceImages });
    return json({ success: true, started: true });
  } catch (e) {
    console.error("generate-360-spin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: e instanceof Error && e.message === "Not authenticated" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
