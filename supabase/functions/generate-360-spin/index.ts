// generate-360-spin (V2 — identitätsgesperrte Keyframe-Architektur)
//
// Schritte: analyze → profile → keyframes → validate_keyframes → frames (Sektoren, bidirektional) → assemble
//
// Kernprinzipien:
//  - 8 Keyframes (0/45/90/135/180/225/270/315), vorhandene Fotos belegen so viele wie möglich
//  - Zwischenframes bidirektional pro Sektor (Drift-Minimierung), immer mit mehreren Referenzen
//  - Originalfotos sind Identitätswahrheit, Remaster/Generate dürfen sie nie überstimmen
//  - Kein Fallback auf unnormalisierte Rohfotos, kein Auto-Pass: QA entscheidet
//  - Job wird nur "completed", wenn jeder Frame existiert UND die QA bestanden hat
//  - Alle Bildtransfers bevorzugt über die Gemini File API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";
import {
  KEYFRAME_ANGLES,
  MAX_FRAME_ATTEMPTS,
  MAX_KEYFRAME_ATTEMPTS,
  MAX_NORMALIZE_ATTEMPTS,
  SPIN_MODELS,
  aggregateQuality,
  angleForIndex,
  buildIdentityProfilePrompt,
  buildIntermediatePrompt,
  buildKeyframePrompt,
  buildManifest,
  buildQaPrompt,
  buildRepairPrompt,
  evaluateSourceCoverage,
  MIN_SOURCE_ANGLES,
  frameIndexForAngle,
  framesPerSector,
  isQaPassed,
  keyframeReferenceLabel,
  modelForAttempt,
  neighbourReferenceLabel,
  normalizeFrameCount,
  originalIdentityLabel,
  parseQaResult,
  planSector,
  qaCompositeScore,
  qaFailClosed,
  resolveIdentitySources,
  wheelReferenceLabel,
  type QaResult,
  SOURCE_ANALYSIS_PROMPT,
} from "../_shared/spin360-core.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const WHEEL_REFERENCE_ANGLE = -1; // Sonder-Slot in spin360_source_selection

/** Vision-Analyse der Radreferenz — nichts raten, Unsicheres bleibt null. */
const WHEEL_SPEC_PROMPT = `Analyse ONLY the supplied wheel/rim photograph of this vehicle.
Never guess, never use catalogue knowledge. Unclear attributes must be null.
Return strict JSON only:
{ "spokeCount": number|null, "spokeStyle": string|null, "finish": string|null,
  "secondaryColour": string|null, "concavity": string|null, "centreCap": string|null,
  "brakeCaliperColour": string|null, "tyreSidewall": string|null,
  "description": string|null, "confidence": "high"|"medium"|"low" }`;

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

/** Referenz mit Label — die Reihenfolge entspricht <REFERENCE_PRIORITY>. */
interface LabeledRef {
  url: string;
  label: string;
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

  console.log(`[spin] Engine=gemini Model=${SPIN_MODELS.analysis} Tier=analysis (binding)`);
  const resp = await fetch(`${BASE_URL}/models/${SPIN_MODELS.analysis}:generateContent?key=${apiKey}`, {
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

/** Bildgenerierung mit mehreren gelabelten Referenzen. Verweigerung = verwertbares Fehlersignal. */
async function callImageGeneration(
  prompt: string,
  references: LabeledRef[],
  model: string,
): Promise<{ dataUrl: string; model: string } | null> {
  const apiKey = await getSecret("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const refParts: any[] = [];
  for (const ref of references) {
    const part = await toReferencePart(apiKey, ref.url);
    if (part) {
      refParts.push({ text: `Reference: ${ref.label}` });
      refParts.push(refPartToGemini(part));
    }
  }
  if (refParts.length === 0) throw new Error("no_reference_images");

  console.log(`[spin] Engine=gemini Model=${model} Tier=image refs=${references.length} (binding, no cross-engine fallback)`);
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
      console.error(`[spin] image gen error (${model}): ${resp.status} ${t.slice(0, 300)}`);
      if (resp.status === 429) throw new Error("rate_limited");
      return null;
    }

    const data = await resp.json();
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return { dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, model };
      }
    }
    console.warn(`[spin] ${model} returned no image (refusal signal)`);
    return null;
  } catch (e) {
    if ((e as Error).message === "rate_limited") throw e;
    console.warn(`[spin] image generation failed: ${(e as Error).message}`);
    return null;
  }
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

// ─── QA ───
interface QaContext {
  frameIndex: number;
  angle: number;
  frameCount: number;
  isKeyframe: boolean;
  candidateUrl: string;
  references: LabeledRef[];
}

/**
 * QA — FAIL CLOSED: Schlägt der Request oder das Parsing fehl, ist das
 * Ergebnis niemals "pass", sondern regenerate/manual_review mit Score 0.
 */
async function runQa(ctx: QaContext): Promise<{ result: QaResult; score: number; passed: boolean }> {
  const prompt = buildQaPrompt({
    angle: ctx.angle,
    frameIndex: ctx.frameIndex,
    frameCount: ctx.frameCount,
    isKeyframe: ctx.isKeyframe,
    referenceLabels: ctx.references.map((r) => r.label),
  });
  let result: QaResult;
  try {
    // Kandidat immer als LETZTES Bild (siehe Prompt).
    const raw = await callGeminiJson(prompt, [...ctx.references.map((r) => r.url), ctx.candidateUrl]);
    result = parseQaResult(raw);
  } catch (e) {
    console.warn(`[spin] QA unavailable for frame ${ctx.frameIndex}: ${(e as Error).message}`);
    result = qaFailClosed((e as Error).message);
  }
  const passed = isQaPassed(result);
  return { result, score: passed ? qaCompositeScore(result) : Math.min(qaCompositeScore(result), 94), passed };
}

function qaNotes(result: QaResult): string | null {
  const notes = [...result.hard_failures, ...result.repair_instructions].join("; ");
  return notes || null;
}


async function recordReview(
  sb: any, jobId: string, userId: string, frameIndex: number, attempt: number,
  verdict: string, score: number, notes: string | null, model: string,
) {
  await sb.from("spin360_frame_reviews").insert({
    job_id: jobId, user_id: userId, frame_index: frameIndex, attempt,
    verdict, score, notes, model_used: model,
  });
}

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

    // Konfiguration des Jobs (Frame-Tier)
    const { data: jobRow } = await sb.from("spin360_jobs")
      .select("id, vehicle_id, target_frame_count, identity_profile, identity_hash, qa_summary")
      .eq("id", jobId).single();
    const FRAME_COUNT = normalizeFrameCount(jobRow?.target_frame_count ?? body.frameCount);
    const PER_SECTOR = framesPerSector(FRAME_COUNT);

    /**
     * Quellenauswahl inkl. Radreferenz laden.
     * `identitySources` sind AUSSCHLIESSLICH echte Fotos (original > upload > gallery);
     * generierte/normalisierte Keyframes sind nie Identitätswahrheit.
     */
    const loadSelection = async () => {
      const { data } = await sb.from("spin360_source_selection")
        .select("angle_degrees, image_url, asset_kind, asset_id, storage_path").eq("job_id", jobId);
      const rows = data || [];
      const wheelRow = rows.find((r: any) => Number(r.angle_degrees) === WHEEL_REFERENCE_ANGLE);
      const identity = resolveIdentitySources(rows as any);
      return {
        wheelRef: wheelRow?.image_url as string | undefined,
        wheelRow,
        identityTier: identity.tier,
        identitySources: identity.sources as any[],
        all: rows.filter((r: any) => Number(r.angle_degrees) >= 0),
      };
    };

    /** Gelabelte Identitätsreferenzen (ORIGINAL IDENTITY #n) für Generierung und QA. */
    const identityRefsFrom = (sources: any[], limit = 3): LabeledRef[] =>
      sources.slice(0, limit).map((s, i) => ({
        url: s.image_url,
        label: originalIdentityLabel(i + 1, Number(s.angle_degrees)),
      }));


    // ─────────── ANALYZE ───────────
    if (currentStep === "analyze") {
      const { sourceImages } = body;
      if (!Array.isArray(sourceImages)) throw new Error("Quellbilder fehlen");

      // Produktionslauf: die vier Kardinalwinkel müssen als echtes Foto vorliegen (#H).
      const declaredCoverage = evaluateSourceCoverage(
        sourceImages.filter((s: any) => Number(s.angle) >= 0).map((s: any) => s.angle),
      );
      if (!declaredCoverage.ok) {
        await markJobFailed(
          sb, jobId,
          `Zu wenig Quellmaterial: mindestens ${MIN_SOURCE_ANGLES} echte Perspektiven (0°, 90°, 180°, 270°) erforderlich. Fehlend: ${declaredCoverage.missingRequired.join("°, ")}°`,
          "needs_review",
        );
        return json({ error: "insufficient_source_coverage", missing: declaredCoverage.missingRequired });
      }

      await updateJob(sb, jobId, { status: "analyzing", error_message: null, source_mode: body.sourceMode || "upload" });

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

      const angleSources = sourceImages.filter((s: any) => Number(s.angle) >= 0);
      const wheelSource = sourceImages.find(
        (s: any) => s.assetKind === "wheel_reference" || Number(s.angle) === WHEEL_REFERENCE_ANGLE,
      );

      const analysisPrompt = await getCustomPrompt(sb, "spin360_analysis", SOURCE_ANALYSIS_PROMPT);
      let analysis: any = null;
      try {
        analysis = await callGeminiJson(analysisPrompt, angleSources.map((s: any) => s.url));
      } catch (e) {
        console.warn(`[${jobId}] analysis failed, using declared angles:`, (e as Error).message);
      }

      // Vom Nutzer bestätigter Winkel gewinnt; die Analyse ist nur Plausibilisierung.
      const selection: Record<number, any> = {};
      angleSources.forEach((src: any, i: number) => {
        const detected = analysis?.images?.find((im: any) => Number(im.index) === i);
        const declared = Number(src.angle);
        const angle = (KEYFRAME_ANGLES as readonly number[]).includes(declared)
          ? declared
          : (KEYFRAME_ANGLES as readonly number[]).includes(Number(detected?.detected_angle)) &&
              detected?.left_right_certain !== false
            ? Number(detected.detected_angle)
            : null;
        if (angle === null || selection[angle]) return;
        selection[angle] = { ...src, angle, analysis: detected ?? null };
      });

      if (analysis?.images) {
        for (const img of analysis.images) {
          await sb.from("spin360_source_images").update({ analysis: img })
            .eq("job_id", jobId).eq("sort_order", img.index);
        }
      }

      const chosen = Object.values(selection);
      const coverage = evaluateSourceCoverage(chosen.map((c: any) => c.angle));
      if (!coverage.ok) {
        await markJobFailed(
          sb, jobId,
          `Zu wenige verwertbare Perspektiven erkannt (fehlend: ${coverage.missingRequired.join("°, ")}°)`,
          "needs_review",
        );
        return json({ error: "not_enough_perspectives", missing: coverage.missingRequired });
      }

      await sb.from("spin360_source_selection").delete().eq("job_id", jobId);
      const rows = chosen.map((c: any) => ({
        job_id: jobId,
        user_id: userId,
        angle_degrees: c.angle,
        asset_kind: c.assetKind || "upload",
        asset_id: c.assetId || null,
        storage_path: c.storagePath || null,
        image_url: c.url,
      }));
      if (wheelSource) {
        rows.push({
          job_id: jobId,
          user_id: userId,
          angle_degrees: WHEEL_REFERENCE_ANGLE,
          asset_kind: "wheel_reference",
          asset_id: wheelSource.assetId || null,
          storage_path: wheelSource.storagePath || null,
          image_url: wheelSource.url,
        });
      }
      await sb.from("spin360_source_selection").insert(rows);

      // Radreferenz: strukturierte Vision-Analyse als verbindliche Felgen-Wahrheit (#7).
      let wheelSpec: unknown = null;
      if (wheelSource) {
        try {
          wheelSpec = await callGeminiJson(WHEEL_SPEC_PROMPT, [wheelSource.url]);
        } catch (e) {
          console.warn(`[${jobId}] wheel reference analysis failed:`, (e as Error).message);
        }
      }

      await updateJob(sb, jobId, {
        status: "selecting_sources",
        keyframe_count: KEYFRAME_ANGLES.length,
        target_frame_count: FRAME_COUNT,
        manifest_version: 2,
        qa_summary: {
          ...(jobRow?.qa_summary as Record<string, any> ?? {}),
          wheelReference: wheelSpec,
          hasDedicatedWheelReference: !!wheelSource,
        },
      });

      // Identitätsprofil ZUERST — es ist Prompt-Anker für alle Keyframes.
      invokeNextStep(authHeader, { jobId, step: "profile" });
      return json({ success: true, step: "analyze", keyframes: chosen.length, frameCount: FRAME_COUNT });
    }

    // ─────────── KEYFRAMES (ein Winkel pro Aufruf) ───────────
    if (currentStep === "keyframes") {
      const keyframeIndex = Number(body.keyframeIndex ?? 0);
      const angle = KEYFRAME_ANGLES[keyframeIndex];

      if (keyframeIndex === 0) {
        await updateJob(sb, jobId, { status: "preparing_keyframes" });
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
      } else {
        await updateJob(sb, jobId, { status: "generating_keyframes" });
      }

      const { wheelRef, all, identitySources } = await loadSelection();
      const wheelSpec = (jobRow?.qa_summary as any)?.wheelReference ?? null;
      const { data: existingCanonicals } = await sb.from("spin360_canonical_images")
        .select("angle_degrees, image_url, normalization_status").eq("job_id", jobId)
        .not("angle_degrees", "is", null);

      const own = all.find((s: any) => Number(s.angle_degrees) === angle);
      const already = (existingCanonicals || []).find(
        (c: any) => Number(c.angle_degrees) === angle && c.normalization_status === "normalized",
      );

      if (!already) {
        // Referenzen nach Priorität: eigenes Foto → weitere Originale → nächstliegende Quellen → Radreferenz
        const references: LabeledRef[] = [];
        if (own) references.push({ url: own.image_url, label: originalIdentityLabel(1, angle) });

        const usedUrls = new Set(references.map((r) => r.url));
        for (const src of identitySources) {
          if (references.length >= (own ? 3 : 3)) break;
          if (usedUrls.has(src.image_url)) continue;
          usedUrls.add(src.image_url);
          references.push({
            url: src.image_url,
            label: originalIdentityLabel(references.length + (own ? 0 : 1), Number(src.angle_degrees)),
          });
        }

        const distance = (a: number) => Math.min(Math.abs(a - angle), 360 - Math.abs(a - angle));
        const neighbours = all
          .filter((s: any) => Number(s.angle_degrees) !== angle && !usedUrls.has(s.image_url))
          .sort((a: any, b: any) => distance(Number(a.angle_degrees)) - distance(Number(b.angle_degrees)))
          .slice(0, 2);
        for (const n of neighbours) {
          usedUrls.add(n.image_url);
          references.push({ url: n.image_url, label: neighbourReferenceLabel(Number(n.angle_degrees)) });
        }
        if (wheelRef) references.push({ url: wheelRef, label: wheelReferenceLabel() });

        const identity = jobRow?.identity_profile ?? {};
        let stored: string | null = null;
        let usedModel = SPIN_MODELS.imagePro;

        for (let attempt = 1; attempt <= MAX_NORMALIZE_ATTEMPTS && !stored; attempt++) {
          const prompt = buildKeyframePrompt({
            angle,
            identity,
            referenceLabels: references.map((r) => r.label),
            hasDedicatedWheelReference: !!wheelRef,
            wheelSpec,
            hasDirectPhoto: !!own,
            strictRetry: attempt > 1,
          });
          try {
            const result = await callImageGeneration(prompt, references, SPIN_MODELS.imagePro);
            if (result) {
              usedModel = result.model;
              stored = await uploadDataUrlToStorage(
                sb, userId, `spin360/${jobId}/canonical/kf_${angle}.png`, result.dataUrl,
              );
            }
          } catch (e) {
            if ((e as Error).message === "rate_limited") await new Promise((r) => setTimeout(r, 8000));
            console.error(`[${jobId}] keyframe ${angle}° attempt ${attempt} failed:`, (e as Error).message);
          }
        }

        if (!stored) {
          // KEIN Fallback auf ein unnormalisiertes Rohfoto (gemischte Hintergründe).
          await sb.from("spin360_canonical_images").upsert({
            job_id: jobId, user_id: userId, perspective: `kf_${angle}`,
            image_url: own?.image_url ?? "", sort_order: keyframeIndex, angle_degrees: angle,
            is_generated: !own, normalization_status: "failed",
          }, { onConflict: "job_id,angle_degrees" });
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
        invokeNextStep(authHeader, { jobId, step: "keyframes", keyframeIndex: keyframeIndex + 1 });
      } else {
        invokeNextStep(authHeader, { jobId, step: "validate_keyframes" });
      }
      return json({ success: true, step: "keyframes", angle });
    }

    // ─────────── VALIDATE KEYFRAMES (striktes QA-Gate inkl. Reparatur) ───────────
    if (currentStep === "validate_keyframes") {
      await updateJob(sb, jobId, { status: "validating_keyframes" });

      const { wheelRef, all, identitySources } = await loadSelection();
      const wheelSpec = (jobRow?.qa_summary as any)?.wheelReference ?? null;
      const identity = jobRow?.identity_profile ?? {};
      const { data: canonicals } = await sb.from("spin360_canonical_images")
        .select("angle_degrees, image_url, is_generated, normalization_status")
        .eq("job_id", jobId).not("angle_degrees", "is", null).order("angle_degrees");

      const ready = (canonicals || []).filter((c: any) => c.normalization_status === "normalized");
      if (ready.length < KEYFRAME_ANGLES.length) {
        await markJobFailed(sb, jobId, "Nicht alle Keyframes vorhanden", "needs_review");
        return json({ error: "incomplete_keyframes" });
      }

      const failures: number[] = [];
      for (const c of ready) {
        const angle = Number(c.angle_degrees);
        const frameIndex = frameIndexForAngle(angle, FRAME_COUNT);
        const own = all.find((s: any) => Number(s.angle_degrees) === angle);

        /**
         * QA-Referenzen (#I): bis zu 4 unveränderliche Identitätsfotos rund ums
         * Fahrzeug + das echte Foto des Zielwinkels + die nächstgelegenen echten
         * Quellwinkel + Radreferenz. Keine doppelten URLs, keine generierten Frames.
         */
        const references: LabeledRef[] = [];
        const seen = new Set<string>();
        const pushRef = (url: string | undefined | null, label: string) => {
          if (!url || seen.has(url)) return;
          seen.add(url);
          references.push({ url, label });
        };

        if (own) pushRef(own.image_url, originalIdentityLabel(1, angle));
        for (const src of identityRefsFrom(identitySources, 4)) pushRef(src.url, src.label);

        const qaDistance = (a: number) => Math.min(Math.abs(a - angle), 360 - Math.abs(a - angle));
        const nearestReal = all
          .filter((s: any) => Number(s.angle_degrees) !== angle)
          .sort((a: any, b: any) => qaDistance(Number(a.angle_degrees)) - qaDistance(Number(b.angle_degrees)))
          .slice(0, 2);
        for (const n of nearestReal) pushRef(n.image_url, neighbourReferenceLabel(Number(n.angle_degrees)));

        if (wheelRef) pushRef(wheelRef, wheelReferenceLabel());

        let candidateUrl: string = c.image_url;
        let accepted = false;
        let attempt = 0;
        let score = 0;
        let notes: string | null = null;
        let usedModel = SPIN_MODELS.imagePro;

        // 1 Prüfung + bis zu (MAX_KEYFRAME_ATTEMPTS - 1) Reparaturen.
        while (attempt < MAX_KEYFRAME_ATTEMPTS && !accepted) {
          attempt++;
          const qa = await runQa({
            frameIndex, angle, frameCount: FRAME_COUNT, isKeyframe: true,
            candidateUrl, references,
          });
          score = qa.score;
          accepted = qa.passed;
          notes = qaNotes(qa.result);

          await recordReview(
            sb, jobId, userId, frameIndex, attempt,
            accepted ? "pass" : attempt >= MAX_KEYFRAME_ATTEMPTS ? "manual_review" : "regenerate",
            score, notes, SPIN_MODELS.analysis,
          );
          if (accepted || attempt >= MAX_KEYFRAME_ATTEMPTS) break;

          // Reparatur mit exakten QA-Fehlern im Prompt.
          const repairPrompt = buildRepairPrompt({
            angle,
            frameIndex,
            frameCount: FRAME_COUNT,
            identity,
            referenceLabels: references.map((r) => r.label),
            hasDedicatedWheelReference: !!wheelRef,
            wheelSpec,
            isKeyframe: true,
            attempt: attempt + 1,
            hardFailures: qa.result.hard_failures,
            repairInstructions: qa.result.repair_instructions,
          });
          try {
            const repaired = await callImageGeneration(repairPrompt, references, modelForAttempt(attempt + 1));
            if (repaired) {
              usedModel = repaired.model;
              candidateUrl = await uploadDataUrlToStorage(
                sb, userId, `spin360/${jobId}/canonical/kf_${angle}_r${attempt}.png`, repaired.dataUrl,
              );
              await sb.from("spin360_canonical_images").upsert({
                job_id: jobId, user_id: userId, perspective: `kf_${angle}`,
                image_url: candidateUrl, sort_order: KEYFRAME_ANGLES.indexOf(angle),
                angle_degrees: angle, is_generated: true, normalization_status: "normalized",
              }, { onConflict: "job_id,angle_degrees" });
            }
          } catch (e) {
            console.error(`[${jobId}] keyframe repair ${angle}° failed:`, (e as Error).message);
          }
          await new Promise((r) => setTimeout(r, 600));
        }

        await sb.from("spin360_generated_frames").upsert({
          job_id: jobId,
          user_id: userId,
          frame_index: frameIndex,
          frame_type: "canonical",
          image_url: candidateUrl,
          angle_degrees: angle,
          model_used: usedModel,
          validation_status: accepted ? "passed" : "failed",
          validation_notes: notes,
          source_kind: c.is_generated ? "generated_keyframe" : "normalized_source",
          quality_score: score,
          attempt_count: attempt,
          reference_metadata: {
            references: references.map((r) => r.label),
            qaModel: SPIN_MODELS.analysis,
            hasDedicatedWheelReference: !!wheelRef,
            isKeyframe: true,
          },
        }, { onConflict: "job_id,frame_index" });

        if (!accepted) failures.push(angle);
      }

      // Keyframes sind das Fundament: ohne 8/8 keine Zwischenframes.
      if (failures.length > 0) {
        await markJobFailed(
          sb, jobId,
          `Keyframe-QA nicht bestanden für: ${failures.join("°, ")}°. Bitte Quellbilder prüfen.`,
          "needs_review",
        );
        return json({ error: "keyframe_qa_failed", failures });
      }

      invokeNextStep(authHeader, { jobId, step: "frames", sector: 0 });
      return json({ success: true, step: "validate_keyframes" });
    }

    // ─────────── PROFILE (unveränderliches Identitätsprofil aus ECHTEN Fotos) ───────────
    if (currentStep === "profile") {
      await updateJob(sb, jobId, { status: "profiling" });

      const { identitySources, identityTier, wheelRef } = await loadSelection();
      if (identitySources.length === 0) {
        await markJobFailed(sb, jobId, "Keine echten Fahrzeugfotos für das Identitätsprofil", "needs_review");
        return json({ error: "no_identity_sources" });
      }
      const labels = identitySources.slice(0, 8).map((s: any, i: number) =>
        originalIdentityLabel(i + 1, Number(s.angle_degrees)));
      const images = identitySources.slice(0, 8).map((s: any) => s.image_url);
      if (wheelRef) {
        labels.push(wheelReferenceLabel());
        images.push(wheelRef);
      }

      let identity: any = {};
      try {
        const base = buildIdentityProfilePrompt({
          originalPhotoLabels: labels,
          hasDedicatedWheelReference: !!wheelRef,
          identitySourceTier: identityTier,
        });
        const profilePrompt = await getCustomPrompt(sb, "spin360_identity", base);
        identity = await callGeminiJson(profilePrompt, images);
      } catch (e) {
        console.error(`[${jobId}] identity profiling failed:`, (e as Error).message);
        await markJobFailed(sb, jobId, "Identitätsprofil konnte nicht erstellt werden", "needs_review");
        return json({ error: "identity_profile_failed" });
      }

      const identityHash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(identity))),
        ),
      ).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);

      await updateJob(sb, jobId, {
        identity_profile: identity,
        identity_hash: identityHash,
        qa_summary: {
          ...(jobRow?.qa_summary as Record<string, any> ?? {}),
          identitySourceTier: identityTier,
          identitySourceCount: identitySources.length,
        },
      });

      invokeNextStep(authHeader, { jobId, step: "keyframes", keyframeIndex: 0 });
      return json({ success: true, step: "profile", identityHash, identityTier });
    }

    // ─────────── FRAMES (ein Sektor pro Aufruf, bidirektional, inkl. QA) ───────────
    if (currentStep === "frames") {
      const sector = Number(body.sector ?? 0);
      if (sector === 0) await updateJob(sb, jobId, { status: "generating_frames", error_message: null });

      if (sector >= KEYFRAME_ANGLES.length) {
        invokeNextStep(authHeader, { jobId, step: "assemble" });
        return json({ success: true, step: "frames", done: true });
      }

      const identity = jobRow?.identity_profile ?? {};
      const { wheelRef, identitySources } = await loadSelection();
      const wheelSpec = (jobRow?.qa_summary as any)?.wheelReference ?? null;

      const { data: canonicals } = await sb.from("spin360_canonical_images")
        .select("angle_degrees, image_url").eq("job_id", jobId).not("angle_degrees", "is", null);
      const canonicalByAngle = new Map<number, string>(
        (canonicals || []).map((c: any) => [Number(c.angle_degrees), c.image_url as string]),
      );

      const startAngle = KEYFRAME_ANGLES[sector];
      const endAngle = KEYFRAME_ANGLES[(sector + 1) % KEYFRAME_ANGLES.length];
      const startUrl = canonicalByAngle.get(startAngle);
      const endUrl = canonicalByAngle.get(endAngle);
      if (!startUrl || !endUrl) {
        await markJobFailed(sb, jobId, `Keyframes für Sektor ${startAngle}°–${endAngle}° fehlen`, "needs_review");
        return json({ error: "sector_keyframes_missing" });
      }

      const { data: existing } = await sb.from("spin360_generated_frames")
        .select("frame_index, image_url, validation_status").eq("job_id", jobId);
      const passedByIndex = new Map<number, string>(
        (existing || []).filter((f: any) => f.validation_status === "passed")
          .map((f: any) => [Number(f.frame_index), f.image_url as string]),
      );

      const identityRefs: LabeledRef[] = identityRefsFrom(identitySources, 2);

      const plan = planSector(sector, FRAME_COUNT);
      const sectorResults: { index: number; verdict: string; score: number }[] = [];

      for (const planned of plan) {
        if (passedByIndex.has(planned.index)) continue;

        const neighbourUrl = passedByIndex.get(
          ((planned.neighborIndex % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT,
        );

        const baseRefs: LabeledRef[] = [
          ...identityRefs,
          { url: startUrl, label: keyframeReferenceLabel("left", planned.sectorStartAngle) },
          { url: endUrl, label: keyframeReferenceLabel("right", planned.sectorEndAngle) },
        ];
        if (wheelRef) baseRefs.push({ url: wheelRef, label: wheelReferenceLabel() });
        if (neighbourUrl && planned.direction !== "midpoint") {
          baseRefs.push({
            url: neighbourUrl,
            label: neighbourReferenceLabel(angleForIndex(
              ((planned.neighborIndex % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT, FRAME_COUNT,
            )),
          });
        }

        let accepted = false;
        let attempt = 0;
        let lastScore = 0;
        let lastNotes: string | null = null;
        let repairInstructions: string[] = [];
        let hardFailures: string[] = [];

        while (attempt < MAX_FRAME_ATTEMPTS && !accepted) {
          attempt++;
          const model = modelForAttempt(attempt);
          // Ab dem 2. Versuch: Reparatur-Prompt mit den exakten QA-Fehlern (#9).
          const prompt = attempt > 1 && (hardFailures.length > 0 || repairInstructions.length > 0)
            ? buildRepairPrompt({
              angle: planned.angle,
              frameIndex: planned.index,
              frameCount: FRAME_COUNT,
              identity,
              referenceLabels: baseRefs.map((r) => r.label),
              hasDedicatedWheelReference: !!wheelRef,
              wheelSpec,
              isKeyframe: false,
              attempt,
              hardFailures,
              repairInstructions,
            })
            : buildIntermediatePrompt({
              frame: planned,
              frameCount: FRAME_COUNT,
              identity,
              referenceLabels: baseRefs.map((r) => r.label),
              hasDedicatedWheelReference: !!wheelRef,
              wheelSpec,
              strictRetry: attempt > 1,
              repairInstructions,
            });

          let generated: { dataUrl: string; model: string } | null = null;
          try {
            generated = await callImageGeneration(prompt, baseRefs, model);
          } catch (e) {
            if ((e as Error).message === "rate_limited") await new Promise((r) => setTimeout(r, 8000));
            console.error(`[${jobId}] frame ${planned.index} attempt ${attempt} error:`, (e as Error).message);
          }
          if (!generated) continue;

          const storedUrl = await uploadDataUrlToStorage(
            sb, userId,
            `spin360/${jobId}/frames/frame_${String(planned.index).padStart(3, "0")}_a${attempt}.png`,
            generated.dataUrl,
          );

          // QA — fail closed, niemals Auto-Pass.
          const qa = await runQa({
            frameIndex: planned.index,
            angle: planned.angle,
            frameCount: FRAME_COUNT,
            isKeyframe: false,
            candidateUrl: storedUrl,
            references: baseRefs,
          });
          const qaPassed = qa.passed;
          const score = qa.score;
          repairInstructions = qa.result.repair_instructions;
          hardFailures = qa.result.hard_failures;
          lastNotes = qaNotes(qa.result);
          lastScore = score;

          await recordReview(
            sb, jobId, userId, planned.index, attempt,
            qaPassed ? "pass" : attempt >= MAX_FRAME_ATTEMPTS ? "manual_review" : "regenerate",
            score, lastNotes, generated.model,
          );

          await sb.from("spin360_generated_frames").upsert({
            job_id: jobId,
            user_id: userId,
            frame_index: planned.index,
            frame_type: "intermediate",
            image_url: storedUrl,
            angle_degrees: planned.angle,
            model_used: generated.model,
            validation_status: qaPassed ? "passed" : "failed",
            validation_notes: lastNotes,
            source_kind: "generated",
            quality_score: score,
            attempt_count: attempt,
            reference_metadata: {
              references: baseRefs.map((r) => r.label),
              direction: planned.direction,
              fraction: planned.fraction,
              sector,
              sectorStartAngle: planned.sectorStartAngle,
              sectorEndAngle: planned.sectorEndAngle,
              neighbourIndex: planned.direction === "midpoint" ? null : planned.neighborIndex,
              hasDedicatedWheelReference: !!wheelRef,
              hardFailures,
              qaModel: SPIN_MODELS.analysis,
            },
          }, { onConflict: "job_id,frame_index" });

          if (qaPassed) {
            passedByIndex.set(planned.index, storedUrl);
            accepted = true;
          }

          await new Promise((r) => setTimeout(r, 600));
        }

        sectorResults.push({ index: planned.index, verdict: accepted ? "pass" : "needs_review", score: lastScore });
      }

      const qaSummary = { ...(jobRow?.qa_summary as Record<string, any> ?? {}), [`sector_${sector}`]: sectorResults };
      await updateJob(sb, jobId, { qa_summary: qaSummary, status: "validating_frames" });

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
      const quality = aggregateQuality(all as any, FRAME_COUNT);

      // Credits erst jetzt – nach bestandener QA, anteilig zur tatsächlichen Ausbeute.
      const generatedPassed = all.filter(
        (f: any) => f.validation_status === "passed" && f.source_kind === "generated",
      ).length;
      if (generatedPassed > 0) {
        const amount = Math.max(
          1,
          Math.round((generatedPassed / Math.max(1, FRAME_COUNT - KEYFRAME_ANGLES.length)) * 15),
        );
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

      let vin: string | null = null;
      if (jobRow?.vehicle_id) {
        const { data: vehicle } = await sb.from("vehicles").select("vin").eq("id", jobRow.vehicle_id).single();
        vin = (vehicle as any)?.vin ?? null;
      }

      const manifest = buildManifest({
        jobId,
        vehicleId: jobRow?.vehicle_id ?? null,
        vin,
        frames: all as any,
        targetFrameCount: FRAME_COUNT,
        identityHash: jobRow?.identity_hash ?? null,
      });

      await updateJob(sb, jobId, {
        manifest,
        manifest_version: 2,
        qa_summary: { ...(jobRow?.qa_summary as Record<string, any> ?? {}), aggregate: quality },
        status: quality.complete ? "completed" : "needs_review",
        error_message: quality.complete
          ? null
          : `Nur ${quality.passedCount}/${FRAME_COUNT} Frames haben die QA bestanden.`,
      });

      console.log(`[${jobId}] assembled: ${quality.passedCount}/${FRAME_COUNT} passed (score ${quality.qualityScore})`);
      return json({ success: true, step: "assemble", manifest });
    }

    // ─────────── Initialer Aufruf ───────────
    const { sourceImages } = body;
    if (!Array.isArray(sourceImages)) throw new Error("Quellbilder fehlen");
    const startCoverage = evaluateSourceCoverage(
      sourceImages.filter((s: any) => Number(s.angle) >= 0).map((s: any) => s.angle),
    );
    if (!startCoverage.ok) {
      await markJobFailed(
        sb, jobId,
        `Mindestens ${MIN_SOURCE_ANGLES} echte Perspektiven (0°, 90°, 180°, 270°) erforderlich. Fehlend: ${startCoverage.missingRequired.join("°, ")}°`,
        "needs_review",
      );
      return json({ error: "insufficient_source_coverage", missing: startCoverage.missingRequired }, 400);
    }
    invokeNextStep(authHeader, {
      jobId,
      step: "analyze",
      sourceImages,
      sourceMode: body.sourceMode,
      frameCount: FRAME_COUNT,
    });
    return json({ success: true, started: true, frameCount: FRAME_COUNT, perSector: PER_SECTOR });
  } catch (e) {
    console.error("generate-360-spin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: e instanceof Error && e.message === "Not authenticated" ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
