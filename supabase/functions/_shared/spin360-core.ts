// ═══════════════════════════════════════════════════════════════════════
// Spin360 V2 – Core (pure, deterministic, testbar)
//
// Dieses Modul enthält AUSSCHLIESSLICH seiteneffektfreie Logik:
// Winkelraster, Sektor-/Frame-Planung, Prompt-Builder, QA-Bewertung,
// Qualitäts-Aggregation und Manifest-Erzeugung.
//
// Es wird von der Edge Function `generate-360-spin` genutzt und direkt
// von den Vitest-Tests importiert (kein Deno-API-Zugriff!).
// ═══════════════════════════════════════════════════════════════════════

// ─── Modell-Routing (verifizierte IDs, Stand August 2026) ───
export const SPIN_MODELS = {
  /** Analyse, Identitätsprofil, QA (multimodal, JSON) */
  analysis: "gemini-3.7-flash",
  /** Standard-Bildgenerierung: Zwischenframes + normale Reparatur */
  image: "gemini-3.1-flash-image",
  /** Schwierige Keyframes, Normalisierung, finale Reparatur */
  imagePro: "gemini-3-pro-image",
} as const;

/** Analyse, Identitätsprofil und multimodale QA (Stand August 2026). */
export const ANALYSIS_QA_MODEL = SPIN_MODELS.analysis;
/** Standard-Bildgenerierung für Zwischenframes. */
export const STANDARD_IMAGE_MODEL = SPIN_MODELS.image;
/** Hochwertige Keyframe-Normalisierung und finale Reparatur. */
export const HIGH_FIDELITY_IMAGE_MODEL = SPIN_MODELS.imagePro;


export type SpinFrameTier = 32 | 48;

export const KEYFRAME_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;
export const DEFAULT_FRAME_COUNT: SpinFrameTier = 48;
export const SUPPORTED_FRAME_COUNTS: SpinFrameTier[] = [32, 48];

/** QA-Schwelle für identitätskritische Dimensionen. */
export const QA_IDENTITY_THRESHOLD = 95;
/** QA-Schwelle für sekundäre Dimensionen (Umgebung, Artefakte …). */
export const QA_SECONDARY_THRESHOLD = 80;
/** 1 Erstversuch + 2 Standardreparaturen + 1 Pro-Reparatur. */
export const MAX_FRAME_ATTEMPTS = 4;
export const MAX_NORMALIZE_ATTEMPTS = 3;

export const IDENTITY_CRITICAL_DIMENSIONS = ["identity", "wheels", "lights", "paint"] as const;
export const SECONDARY_DIMENSIONS = [
  "angle_continuity",
  "camera_continuity",
  "environment",
  "artifact_free",
] as const;

export type QaDimension =
  | (typeof IDENTITY_CRITICAL_DIMENSIONS)[number]
  | (typeof SECONDARY_DIMENSIONS)[number];

// ─── Winkelraster ──────────────────────────────────────────────────────

export function isSupportedFrameCount(count: number): count is SpinFrameTier {
  return SUPPORTED_FRAME_COUNTS.includes(count as SpinFrameTier);
}

export function normalizeFrameCount(count: unknown): SpinFrameTier {
  const n = Number(count);
  return isSupportedFrameCount(n) ? n : DEFAULT_FRAME_COUNT;
}

export function angleStep(frameCount: number): number {
  return 360 / frameCount;
}

export function angleForIndex(index: number, frameCount: number): number {
  return round2((((index % frameCount) + frameCount) % frameCount) * angleStep(frameCount));
}

/** Exakter Frame-Index eines Keyframe-Winkels (nur für 32/48 exakt ganzzahlig). */
export function frameIndexForAngle(angle: number, frameCount: number): number {
  return Math.round((angle / 360) * frameCount);
}

export function keyframeIndices(frameCount: number): number[] {
  return KEYFRAME_ANGLES.map((a) => frameIndexForAngle(a, frameCount));
}

export function framesPerSector(frameCount: number): number {
  return frameCount / KEYFRAME_ANGLES.length;
}

export function angleGrid(frameCount: number): { index: number; angle: number; isKeyframe: boolean }[] {
  const keys = new Set(keyframeIndices(frameCount));
  return Array.from({ length: frameCount }, (_, index) => ({
    index,
    angle: angleForIndex(index, frameCount),
    isKeyframe: keys.has(index),
  }));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── Sektor-/Frame-Planung (bidirektional) ─────────────────────────────

export interface PlannedFrame {
  index: number;
  angle: number;
  sector: number;
  /** Interpolationsanteil zwischen Sektor-Start (0) und Sektor-Ende (1). */
  fraction: number;
  sectorStartAngle: number;
  sectorEndAngle: number;
  sectorStartIndex: number;
  sectorEndIndex: number;
  /** forward = vom linken Keyframe aus, backward = vom rechten, midpoint = beidseitig */
  direction: "forward" | "backward" | "midpoint";
  /** Bereits verifizierter Nachbar, der als lokale Kontinuitätsreferenz dient. */
  neighborIndex: number;
}

/**
 * Bidirektionaler Plan innerhalb eines 45°-Sektors:
 * abwechselnd vom linken und rechten verifizierten Keyframe nach innen,
 * der Mittelpunkt zuletzt (mit beiden Seiten als Anker) → minimale Drift.
 */
export function planSector(sector: number, frameCount: number): PlannedFrame[] {
  const per = framesPerSector(frameCount);
  const startIndex = sector * per;
  const endIndex = startIndex + per; // == nächster Keyframe (modulo frameCount)
  const sectorStartAngle = angleForIndex(startIndex, frameCount);
  const sectorEndAngle = sectorStartAngle + 45;

  const inner: number[] = [];
  for (let i = startIndex + 1; i < endIndex; i++) inner.push(i);
  if (inner.length === 0) return [];

  const plan: PlannedFrame[] = [];
  let left = 0;
  let right = inner.length - 1;
  let takeLeft = true;

  while (left <= right) {
    const isLast = left === right;
    const index = takeLeft ? inner[left] : inner[right];
    const direction: PlannedFrame["direction"] = isLast && inner.length > 1 && left === right
      ? "midpoint"
      : takeLeft
        ? "forward"
        : "backward";

    plan.push({
      index,
      angle: angleForIndex(index, frameCount),
      sector,
      fraction: round2((index - startIndex) / per),
      sectorStartAngle,
      sectorEndAngle,
      sectorStartIndex: startIndex,
      sectorEndIndex: endIndex % frameCount,
      direction,
      neighborIndex: direction === "backward" ? index + 1 : index - 1,
    });

    if (takeLeft) left++;
    else right--;
    if (left <= right) takeLeft = !takeLeft;
  }

  return plan;
}

export function planAllSectors(frameCount: number): PlannedFrame[] {
  return Array.from({ length: KEYFRAME_ANGLES.length }, (_, s) => planSector(s, frameCount)).flat();
}

// ─── Prompt-Bausteine ──────────────────────────────────────────────────

export const ANGLE_CONVENTION =
  "Angle convention: 0 = direct front, 45 = front three-quarter LEFT, 90 = full LEFT side (driver side in LHD), " +
  "135 = rear three-quarter LEFT, 180 = direct rear, 225 = rear three-quarter RIGHT, 270 = full RIGHT side, " +
  "315 = front three-quarter RIGHT. Rotation direction is clockwise when seen from above.";

export const REFERENCE_TRUTH_PROTOCOL = `<REFERENCE_TRUTH_PROTOCOL>
Use ONLY the reference images. Do NOT invent colors, badges, wheels, rims, trim, stitching, lettering or UI elements.
Every visible attribute MUST match the references exactly.
Do NOT fall back on generic model knowledge about this make, model, trim or catalog equipment.
</REFERENCE_TRUTH_PROTOCOL>`;

export const CAMERA_LOCK = `<CAMERA_LOCK>
Fixed-camera turntable: the camera NEVER orbits, zooms, crops, pans, tilts, rolls or changes focal length.
Locked tripod, 50 mm equivalent, eye level at roughly half vehicle height, horizon fixed.
The vehicle stands on a turntable and rotates rigidly around one fixed vertical axis through its centre.
The vehicle centre stays on the same image point and on the same ground plane in every frame.
Do NOT force an equal apparent width across angles: keep physically correct projected dimensions
(a side view is wider than a front view). Only the vehicle rotation changes.
</CAMERA_LOCK>`;

export const ROTATION_LOCK = `<ROTATION>
This is a rigid physical rotation of ONE existing object, not a new interpretation, not a re-imagining.
No morphing, no shape drift, no re-proportioning between frames.
NEVER mirror the vehicle: left-side and right-side details (fuel/charge flap, exhaust layout, antenna,
trim, damage, badges) must stay on their real physical side.
</ROTATION>`;

export const SCENE_LOCK = `<SCENE_LOCK>
Background: seamless neutral light-grey studio cyclorama (#EDEDED at the floor, fading to white at the top).
No showroom, no props, no architecture, no reflections of foreign objects.
Lighting: large soft overhead key plus even fill, identical in every frame, no coloured light, no visible lamps.
Ground contact: one soft elliptical contact shadow directly under the wheelbase.
Framing: vehicle horizontally centred, identical margins, 3:2 landscape.
</SCENE_LOCK>`;

export const FORBIDDEN_BLOCK = `<FORBIDDEN>
No different wheels or rim design. No changed light signature. No added or removed body kit, spoiler,
side skirt or trim. No changed ride height or stance. No text, captions, watermarks, logos or borders.
No people, animals, second vehicle, studio equipment or props. No readable license plate.
No random reflections. No camera move, zoom, crop or focal length change. No motion blur, lens flare or vignette.
Do not repair dents, scratches or wear, do not clean or restyle the vehicle.
</FORBIDDEN>`;

export function wheelLockBlock(hasDedicatedWheelReference: boolean): string {
  return `<WHEEL_LOCK>
The wheels are identity-critical and binding.${
    hasDedicatedWheelReference
      ? " A dedicated wheel reference image is supplied and is the single source of truth for the wheels."
      : " Derive the wheels strictly from the original vehicle photographs."
  }
Reproduce exactly: rim design, spoke count and spoke geometry, finish (polished / painted / two-tone / matte),
centre cap emblem, bolt pattern, tyre sidewall lettering position, brake caliper colour and shape, disc visibility.
Never substitute a similar-looking rim, never change the spoke count, never add aftermarket wheels.
</WHEEL_LOCK>`;
}

export function identityLockBlock(identity: unknown): string {
  return `<IDENTITY_LOCK>
The following JSON is the binding identity profile of the ONE physical vehicle that must appear.
Attributes marked UNKNOWN must NOT be invented — render them consistently with the reference photographs only.
${JSON.stringify(identity ?? {}, null, 0)}
Paint tone and finish, rim design and spoke count, headlight/DRL and taillight signatures, grille pattern,
bumper and sensor layout, mirror type, roofline, glass geometry, badges, door count and visible damage
must be identical in every frame.
</IDENTITY_LOCK>`;
}

export function referencePriorityBlock(labels: string[]): string {
  return `<REFERENCE_PRIORITY>
Priority order when references disagree:
1. ORIGINAL vehicle photographs (highest identity truth — they always win)
2. Dedicated wheel reference
3. Adjacent verified turntable views (keyframes) — geometry and continuity only
4. Scene / framing reference — background, light and framing only, never identity
Supplied references in order:
${labels.map((l, i) => `Reference ${i + 1} = ${l}`).join("\n")}
</REFERENCE_PRIORITY>`;
}

// ─── Prompt-Builder ────────────────────────────────────────────────────

export const IDENTITY_PROFILE_PROMPT = `The attached ORIGINAL photographs show one specific physical vehicle and are the only identity source of truth.
Never infer equipment from make, model, trim, VIN description, catalog knowledge or training memory.
For every attribute mark CONFIRMED, PARTIAL or UNKNOWN. UNKNOWN must remain unknown and may not be invented later.
Return strict JSON only, no prose, matching exactly this schema:
{
  "body": { "body_type": {"value":"","status":"CONFIRMED|PARTIAL|UNKNOWN"},
            "door_count": {"value":0,"status":""},
            "proportions": {"value":{"length_class":"","height_class":"","width_class":""},"status":""} },
  "paint": { "primary_colour": {"value":"","status":""}, "finish": {"value":"","status":""},
             "two_tone": {"value":false,"status":""} },
  "front": { "grille": {"value":"","status":""}, "headlights": {"value":"","status":""},
             "drl_signature": {"value":"","status":""}, "bumper": {"value":"","status":""},
             "sensors": {"value":"","status":""} },
  "rear":  { "taillights": {"value":"","status":""}, "bumper": {"value":"","status":""},
             "exhaust": {"value":"","status":""}, "badges": {"value":[],"status":""} },
  "side":  { "trim": {"value":"","status":""}, "flap_type_and_side": {"value":"","status":""},
             "window_geometry": {"value":"","status":""}, "mirrors": {"value":"","status":""} },
  "roof":  { "roofline": {"value":"","status":""}, "rails": {"value":"","status":""},
             "spoiler": {"value":"","status":""} },
  "wheels":{ "design": {"value":"","status":""}, "spoke_count": {"value":0,"status":""},
             "finish": {"value":"","status":""}, "centre_cap": {"value":"","status":""},
             "caliper": {"value":"","status":""}, "tyre": {"value":"","status":""} },
  "damage": { "value": [], "status": "" },
  "confidence": 0
}`;

export const SOURCE_ANALYSIS_PROMPT = `You are an automotive photo analyst preparing a 360° turntable spin.
${ANGLE_CONVENTION}
For each supplied image return strict JSON:
{ "images": [{ "index": 0, "detected_angle": 0|45|90|135|180|225|270|315, "angle_confidence": 0-100,
   "left_right_certain": true, "quality_score": 0-100, "vehicle_fully_visible": true, "cropping_ok": true,
   "brightness_ok": true, "warnings": [], "vehicle_type": "", "colour": "" }],
  "same_vehicle": true, "mismatch_warnings": [], "overall_quality": "good"|"acceptable"|"poor" }
If you cannot reliably distinguish a LEFT from a RIGHT three-quarter view, set "left_right_certain": false
and lower "angle_confidence" instead of guessing.`;

export interface KeyframePromptInput {
  angle: number;
  identity: unknown;
  referenceLabels: string[];
  hasDedicatedWheelReference: boolean;
  hasDirectPhoto: boolean;
  strictRetry?: boolean;
  repairInstructions?: string[];
}

export function buildKeyframePrompt(input: KeyframePromptInput): string {
  const {
    angle, identity, referenceLabels, hasDedicatedWheelReference, hasDirectPhoto,
    strictRetry, repairInstructions,
  } = input;

  return `You are a professional automotive studio photographer producing ONE turntable keyframe.

<TASK>
Render the vehicle at exactly ${angle} degrees of the turntable rotation.
${ANGLE_CONVENTION}
${hasDirectPhoto
      ? "A real photograph of this exact angle is supplied as reference 1: keep the vehicle pixel-faithful and change only background, lighting and framing to the studio standard."
      : "No direct photograph exists for this angle. Derive it strictly from the supplied verified views. Do not invent any detail that is not visible in the references."}
Return exactly ONE image and no text.
</TASK>

${referencePriorityBlock(referenceLabels)}
${REFERENCE_TRUTH_PROTOCOL}
${identityLockBlock(identity)}
${CAMERA_LOCK}
${ROTATION_LOCK}
${SCENE_LOCK}
${wheelLockBlock(hasDedicatedWheelReference)}
${FORBIDDEN_BLOCK}${
    strictRetry
      ? `

<STRICT_RETRY>
A previous attempt was rejected by automated quality control. Keep angle, camera, framing and background
identical and change ONLY the rejected details:
${(repairInstructions ?? ["rim design and spoke count", "paint tone", "light signatures", "body proportions"])
          .map((r) => `- ${r}`)
          .join("\n")}
</STRICT_RETRY>`
      : ""
  }`;
}

export interface IntermediatePromptInput {
  frame: PlannedFrame;
  frameCount: number;
  identity: unknown;
  referenceLabels: string[];
  hasDedicatedWheelReference: boolean;
  strictRetry?: boolean;
  repairInstructions?: string[];
}

export function buildIntermediatePrompt(input: IntermediatePromptInput): string {
  const { frame, frameCount, identity, referenceLabels, hasDedicatedWheelReference, strictRetry, repairInstructions } =
    input;

  return `You are producing frame ${frame.index} (${frame.angle}°) of a ${frameCount}-frame studio turntable
sequence of ONE specific physical vehicle.

<TASK>
Sector A = ${frame.sectorStartAngle}° (verified keyframe), Sector B = ${frame.sectorEndAngle}° (verified keyframe).
Target angle = ${frame.angle}°, i.e. interpolation fraction ${frame.fraction} between A and B.
${ANGLE_CONVENTION}
The result must sit visually exactly between A and B and never beyond either of them.
Generation direction: ${frame.direction}.
Return exactly ONE image and no text.
</TASK>

${referencePriorityBlock(referenceLabels)}
<CONTINUITY>
The neighbouring accepted frame is supplied for LOCAL continuity only (light, position, sharpness).
It may NEVER override the original photographs on any identity detail. If the neighbour and the originals
disagree, follow the originals.
</CONTINUITY>
${REFERENCE_TRUTH_PROTOCOL}
${identityLockBlock(identity)}
${CAMERA_LOCK}
${ROTATION_LOCK}
${SCENE_LOCK}
${wheelLockBlock(hasDedicatedWheelReference)}
${FORBIDDEN_BLOCK}${
    strictRetry
      ? `

<STRICT_RETRY>
A previous attempt was rejected. Preserve angle, camera, framing and background exactly and repair ONLY:
${(repairInstructions ?? ["identity drift", "wheel design", "light signature"]).map((r) => `- ${r}`).join("\n")}
</STRICT_RETRY>`
      : ""
  }`;
}

export interface QaPromptInput {
  angle: number;
  frameIndex: number;
  frameCount: number;
  referenceLabels: string[];
  isKeyframe: boolean;
}

export function buildQaPrompt(input: QaPromptInput): string {
  const { angle, frameIndex, frameCount, referenceLabels, isKeyframe } = input;
  return `You are the automated quality gate for a ${frameCount}-frame 360° vehicle turntable sequence.
Do NOT generate an image. Inspect only. Return strict JSON, nothing else.

<CANDIDATE>
The LAST supplied image is the candidate: frame ${frameIndex} at ${angle}° (${isKeyframe ? "keyframe" : "intermediate frame"}).
${ANGLE_CONVENTION}
</CANDIDATE>

${referencePriorityBlock(referenceLabels)}
The ORIGINAL photographs define the physical vehicle. Judge the candidate against them, against the adjacent
accepted frame and against the neighbouring keyframes.

<CHECKS>
identity        – is it the same physical car (proportions, body type, door count, badges, damage)?
wheels          – identical rim design, spoke count, finish, centre cap, caliper?
lights          – identical headlight/DRL and taillight signature?
paint           – identical colour tone and finish?
angle_continuity– is the rotation plausible, strictly progressing, not backwards, not duplicated, not mirrored?
camera_continuity – same camera position, framing, focal length, horizon, vehicle centre and ground plane?
environment     – identical neutral studio background, lighting and contact shadow?
artifact_free   – no deformation, no malformed components, no text, no watermark, no extra objects?
</CHECKS>

<HARD_FAILURES>
Report any of these in hard_failures: wrong_wheel_design, wrong_spoke_count, changed_light_signature,
changed_body_or_door_count, mirrored_side_asymmetry, backwards_or_duplicate_angle, camera_or_framing_jump,
inconsistent_environment, malformed_component, added_or_removed_equipment, text_or_watermark.
</HARD_FAILURES>

Return exactly:
{ "scores": { "identity":0-100, "wheels":0-100, "lights":0-100, "paint":0-100,
              "angle_continuity":0-100, "camera_continuity":0-100, "environment":0-100, "artifact_free":0-100 },
  "verdict": "pass"|"regenerate"|"manual_review",
  "hard_failures": [], "repair_instructions": [], "confidence": 0-100 }
Be strict: when in doubt, do not pass.`;
}

// ─── QA-Auswertung ─────────────────────────────────────────────────────

export interface QaResult {
  scores: Partial<Record<QaDimension, number>>;
  verdict: "pass" | "regenerate" | "manual_review";
  hard_failures: string[];
  repair_instructions: string[];
  confidence: number;
}

export function parseQaResult(raw: unknown): QaResult {
  const r = (raw ?? {}) as Record<string, any>;
  const scores: Partial<Record<QaDimension, number>> = {};
  for (const dim of [...IDENTITY_CRITICAL_DIMENSIONS, ...SECONDARY_DIMENSIONS]) {
    const v = Number(r.scores?.[dim]);
    if (Number.isFinite(v)) scores[dim] = Math.max(0, Math.min(100, Math.round(v)));
  }
  const verdict = r.verdict === "pass" || r.verdict === "manual_review" ? r.verdict : "regenerate";
  return {
    scores,
    verdict,
    hard_failures: Array.isArray(r.hard_failures) ? r.hard_failures.map(String) : [],
    repair_instructions: Array.isArray(r.repair_instructions) ? r.repair_instructions.map(String) : [],
    confidence: Number.isFinite(Number(r.confidence)) ? Number(r.confidence) : 0,
  };
}

/** Gesamtscore: identitätskritische Dimensionen doppelt gewichtet. */
export function qaCompositeScore(result: QaResult): number {
  let sum = 0;
  let weight = 0;
  for (const dim of IDENTITY_CRITICAL_DIMENSIONS) {
    if (result.scores[dim] === undefined) continue;
    sum += result.scores[dim]! * 2;
    weight += 2;
  }
  for (const dim of SECONDARY_DIMENSIONS) {
    if (result.scores[dim] === undefined) continue;
    sum += result.scores[dim]!;
    weight += 1;
  }
  return weight === 0 ? 0 : Math.round(sum / weight);
}

/**
 * Ein Frame gilt nur als bestanden, wenn Verdict = pass, keine Hard-Failures
 * vorliegen, ALLE identitätskritischen Dimensionen gemeldet wurden und die
 * Schwellen erfüllt sind. Fehlende Werte = kein Bestehen (kein Auto-Pass).
 */
export function isQaPassed(
  result: QaResult,
  identityThreshold: number = QA_IDENTITY_THRESHOLD,
  secondaryThreshold: number = QA_SECONDARY_THRESHOLD,
): boolean {
  if (result.verdict !== "pass") return false;
  if (result.hard_failures.length > 0) return false;
  for (const dim of IDENTITY_CRITICAL_DIMENSIONS) {
    const score = result.scores[dim];
    if (score === undefined || score < identityThreshold) return false;
  }
  for (const dim of SECONDARY_DIMENSIONS) {
    const score = result.scores[dim];
    if (score === undefined || score < secondaryThreshold) return false;
  }
  return true;
}

/** Modell für den nächsten Versuch: 1–3 Standard, letzter Versuch Pro. */
export function modelForAttempt(attempt: number, maxAttempts: number = MAX_FRAME_ATTEMPTS): string {
  return attempt >= maxAttempts ? SPIN_MODELS.imagePro : SPIN_MODELS.image;
}

// ─── Qualitäts-Aggregation ─────────────────────────────────────────────

export interface FrameQualityInput {
  frame_index: number;
  quality_score?: number | null;
  validation_status?: string | null;
}

export interface QualityAggregate {
  frameCount: number;
  passedCount: number;
  uniqueIndexCount: number;
  completeness: number;
  averageScore: number;
  /** Gesamtscore = Durchschnitt × Vollständigkeit */
  qualityScore: number;
  complete: boolean;
}

export function aggregateQuality(frames: FrameQualityInput[], targetFrameCount: number): QualityAggregate {
  const unique = new Map<number, FrameQualityInput>();
  for (const f of frames) if (!unique.has(f.frame_index)) unique.set(f.frame_index, f);
  const list = [...unique.values()];
  const passed = list.filter((f) => f.validation_status === "passed");
  const averageScore = passed.length
    ? Math.round(passed.reduce((s, f) => s + (f.quality_score ?? 0), 0) / passed.length)
    : 0;
  const completeness = targetFrameCount > 0 ? Math.min(1, passed.length / targetFrameCount) : 0;
  return {
    frameCount: list.length,
    passedCount: passed.length,
    uniqueIndexCount: unique.size,
    completeness: Math.round(completeness * 100) / 100,
    averageScore,
    qualityScore: Math.round(averageScore * completeness),
    complete: passed.length === targetFrameCount && unique.size === targetFrameCount,
  };
}

// ─── Manifest ──────────────────────────────────────────────────────────

export const MANIFEST_VERSION = 2;

export interface ManifestFrameInput {
  frame_index: number;
  angle_degrees: number | null;
  image_url: string;
  validation_status?: string | null;
  quality_score?: number | null;
  source_kind?: string | null;
}

export interface Auto3SpinManifest {
  version: number;
  type: "auto3-spin";
  jobId: string;
  vehicleId: string | null;
  vin: string | null;
  frameCount: number;
  angleStep: number;
  direction: "cw";
  startAngle: number;
  keyframeAngles: number[];
  backgroundStyle: string;
  identityHash: string | null;
  qualityScore: number;
  qa: QualityAggregate;
  createdAt: string;
  frames: { index: number; angle: number; src: string; status?: string; sourceKind?: string }[];
}

export function buildManifest(params: {
  jobId: string;
  vehicleId?: string | null;
  vin?: string | null;
  frames: ManifestFrameInput[];
  targetFrameCount: number;
  identityHash?: string | null;
  createdAt?: string;
}): Auto3SpinManifest {
  const sorted = [...params.frames].sort((a, b) => a.frame_index - b.frame_index);
  const quality = aggregateQuality(sorted, params.targetFrameCount);
  return {
    version: MANIFEST_VERSION,
    type: "auto3-spin",
    jobId: params.jobId,
    vehicleId: params.vehicleId ?? null,
    vin: params.vin ?? null,
    frameCount: sorted.length,
    angleStep: angleStep(params.targetFrameCount),
    direction: "cw",
    startAngle: 0,
    keyframeAngles: [...KEYFRAME_ANGLES],
    backgroundStyle: "studio_cyclorama_neutral_grey",
    identityHash: params.identityHash ?? null,
    qualityScore: quality.qualityScore,
    qa: quality,
    createdAt: params.createdAt ?? new Date().toISOString(),
    frames: sorted.map((f) => ({
      index: f.frame_index,
      angle: f.angle_degrees ?? 0,
      src: f.image_url,
      status: f.validation_status ?? undefined,
      sourceKind: f.source_kind ?? undefined,
    })),
  };
}

/** Coverage-Score für die UI vor dem Start (0–100). */
export function coverageScore(params: {
  confirmedAngles: number[];
  hasWheelReference: boolean;
  hasOriginals: boolean;
}): { score: number; keyAngles: number; label: "gering" | "ausreichend" | "gut" | "exzellent" } {
  const keyAngles = new Set(params.confirmedAngles.filter((a) => (KEYFRAME_ANGLES as readonly number[]).includes(a))).size;
  let score = Math.round((keyAngles / KEYFRAME_ANGLES.length) * 70);
  if (params.hasWheelReference) score += 20;
  if (params.hasOriginals) score += 10;
  score = Math.min(100, score);
  const label = score >= 85 ? "exzellent" : score >= 65 ? "gut" : score >= 40 ? "ausreichend" : "gering";
  return { score, keyAngles, label };
}
