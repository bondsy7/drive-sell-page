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
export const QA_IDENTITY_THRESHOLD = 90;
/** QA-Schwelle für sekundäre Dimensionen (Umgebung, Artefakte …). */
export const QA_SECONDARY_THRESHOLD = 85;
/** Mindest-Confidence der QA (0–100), darunter niemals "pass". */
export const QA_CONFIDENCE_THRESHOLD = 85;
/** Toleranz (Grad) beim Abgleich Frame-Winkel ↔ Winkelraster. */
export const ANGLE_TOLERANCE_DEG = 0.001;
/** 1 Erstversuch + 2 Standardreparaturen + 1 Pro-Reparatur. */
export const MAX_FRAME_ATTEMPTS = 4;
export const MAX_NORMALIZE_ATTEMPTS = 3;
/** Keyframes: 1 Erstversuch + 2 Standardreparaturen + 1 Pro-Reparatur. */
export const MAX_KEYFRAME_ATTEMPTS = 4;


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

export const QA_THRESHOLD_POLICY = {
  verdict: "pass",
  identityCriticalDimensions: IDENTITY_CRITICAL_DIMENSIONS,
  secondaryDimensions: SECONDARY_DIMENSIONS,
  identityCritical: QA_IDENTITY_THRESHOLD,
  secondary: QA_SECONDARY_THRESHOLD,
  confidence: QA_CONFIDENCE_THRESHOLD,
  hardFailuresAllowed: 0,
} as const;

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

/** Exakter Frame-Index eines Winkels (für 32/48 bei den 45°-Keyframes ganzzahlig). */
export function frameIndexForAngle(angle: number, frameCount: number): number {
  const norm = ((angle % 360) + 360) % 360;
  return Math.round((norm / 360) * frameCount) % frameCount;
}

/** Alias mit Spec-Namensgebung. */
export const indexForAngle = frameIndexForAngle;


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
/**
 * Reine Reihenfolge der Zwischen-Offsets innerhalb eines Sektors:
 * abwechselnd vom linken und rechten Keyframe nach innen, Mittelpunkt zuletzt.
 * 32 Frames → [1,3,2], 48 Frames → [1,5,2,4,3].
 */
export function buildBidirectionalOffsets(frameCount: number): number[] {
  const per = framesPerSector(frameCount);
  const inner: number[] = [];
  for (let o = 1; o < per; o++) inner.push(o);

  const order: number[] = [];
  let left = 0;
  let right = inner.length - 1;
  let takeLeft = true;
  while (left <= right) {
    order.push(takeLeft ? inner[left] : inner[right]);
    if (takeLeft) left++;
    else right--;
    if (left <= right) takeLeft = !takeLeft;
  }
  return order;
}

export function planSector(sector: number, frameCount: number): PlannedFrame[] {
  const per = framesPerSector(frameCount);
  const startIndex = sector * per;
  const endIndex = startIndex + per; // == nächster Keyframe (modulo frameCount)
  const sectorStartAngle = angleForIndex(startIndex, frameCount);
  const sectorEndAngle = sectorStartAngle + 45;

  const offsets = buildBidirectionalOffsets(frameCount);
  if (offsets.length === 0) return [];
  const midpointOffset = offsets.length % 2 === 1 ? offsets[offsets.length - 1] : null;

  return offsets.map((offset, position) => {
    const index = startIndex + offset;
    const isMidpoint = midpointOffset !== null && offset === midpointOffset && offsets.length > 1;
    // Gerade Positionen kommen vom linken Keyframe, ungerade vom rechten.
    const direction: PlannedFrame["direction"] = isMidpoint
      ? "midpoint"
      : position % 2 === 0
        ? "forward"
        : "backward";

    return {
      index,
      angle: angleForIndex(index, frameCount),
      sector,
      fraction: round2(offset / per),
      sectorStartAngle,
      sectorEndAngle,
      sectorStartIndex: startIndex,
      sectorEndIndex: endIndex % frameCount,
      direction,
      neighborIndex: direction === "backward" ? index + 1 : index - 1,
    };
  });
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

/**
 * `wheelSpec` ist die strukturierte Vision-Analyse der Radreferenz
 * (Speichenzahl, Finish, Caliper …) und wird wörtlich als Zwang eingebettet.
 */
export function wheelLockBlock(hasDedicatedWheelReference: boolean, wheelSpec?: unknown): string {
  const specLine = wheelSpec
    ? `\nBinding measured wheel specification (must match exactly):\n${JSON.stringify(wheelSpec)}\nAny attribute that is null in this specification must be taken from the reference image, never invented.`
    : "";
  return `<WHEEL_LOCK>
The wheels are identity-critical and binding.${
    hasDedicatedWheelReference
      ? " A dedicated wheel reference image is supplied and is the single source of truth for the wheels; it overrides every other image for rim design."
      : " Derive the wheels strictly from the original vehicle photographs."
  }${specLine}
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

/**
 * Verbindliche Rollen-Labels für Referenzbilder (#12).
 * Die Reihenfolge im Request entspricht der Priorität im Prompt.
 */
export const REFERENCE_ROLES = {
  ORIGINAL_IDENTITY: "ORIGINAL IDENTITY",
  WHEEL_REFERENCE: "WHEEL REFERENCE",
  LEFT_KEYFRAME: "LEFT VERIFIED KEYFRAME",
  RIGHT_KEYFRAME: "RIGHT VERIFIED KEYFRAME",
  NEIGHBOUR: "VERIFIED NEIGHBOUR",
} as const;

export function originalIdentityLabel(n: number, angle?: number | null): string {
  return `${REFERENCE_ROLES.ORIGINAL_IDENTITY} #${n}${
    angle === null || angle === undefined ? "" : ` at ${angle}°`
  } (identity truth, overrides everything)`;
}

export function wheelReferenceLabel(): string {
  return `${REFERENCE_ROLES.WHEEL_REFERENCE} (binding source of truth for rim design, spoke count, finish, centre cap, caliper)`;
}

export function keyframeReferenceLabel(side: "left" | "right", angle: number): string {
  const role = side === "left" ? REFERENCE_ROLES.LEFT_KEYFRAME : REFERENCE_ROLES.RIGHT_KEYFRAME;
  return `${role} at ${angle}° (geometry and continuity only, never identity)`;
}

export function neighbourReferenceLabel(angle: number): string {
  return `${REFERENCE_ROLES.NEIGHBOUR} at ${angle}° (local continuity only, may never override originals)`;
}

export function directSourceLabel(angle: number): string {
  return `DIRECT SOURCE at ${angle}° (same-angle real photograph; primary comparison for this keyframe, background/light/framing may be normalized)`;
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

/**
 * Prompt für das verbindliche Identitätsprofil. Optionale Kontexthinweise
 * (z. B. Anzahl Originalfotos) werden angehängt, ohne die Reference-Truth-Regel
 * aufzuweichen.
 */
export function buildIdentityProfilePrompt(input?: {
  originalPhotoLabels?: string[];
  hasDedicatedWheelReference?: boolean;
  identitySourceTier?: IdentitySourceTier;
}): string {
  const labels = input?.originalPhotoLabels ?? [];
  const tier = input?.identitySourceTier ?? "original";
  return `${IDENTITY_PROFILE_PROMPT}

${REFERENCE_TRUTH_PROTOCOL}
${labels.length ? referencePriorityBlock(labels) : ""}
<IDENTITY_SOURCE_TIER>
All supplied images are REAL photographs of the vehicle (tier: ${tier}).
No generated or normalized turntable frame is supplied and none may be assumed.
${tier === "original"
      ? "These are the vehicle's original photographs — highest identity trust."
      : "These are lower-trust real sources: be conservative and mark uncertain attributes PARTIAL or UNKNOWN."}
</IDENTITY_SOURCE_TIER>
${input?.hasDedicatedWheelReference
      ? "A dedicated wheel close-up is supplied: describe the wheels from that image only (exact spoke count, geometry, finish, centre cap, caliper)."
      : "No dedicated wheel close-up is supplied: describe the wheels only as far as they are visible, otherwise UNKNOWN."}
Do NOT generate an image. Return strict JSON only.`;
}


export interface KeyframePromptInput {
  angle: number;

  identity: unknown;
  referenceLabels: string[];
  hasDedicatedWheelReference: boolean;
  wheelSpec?: unknown;
  hasDirectPhoto: boolean;
  sourceAngles?: number[];
  strictRetry?: boolean;
  repairInstructions?: string[];
}

function targetAngleAppearance(angle: number): string {
  switch (normalizeKeyframeAngle(angle)) {
    case 0:
      return "direct FRONT view: grille and emblem centered, both headlights symmetrical, both front wheel arches only minimally visible, no three-quarter stance";
    case 45:
      return "front three-quarter LEFT view: front and left side visible, left side plane dominant enough to show length";
    case 90:
      return "full LEFT side profile: vehicle side parallel to image plane, front and rear faces barely visible";
    case 135:
      return "rear three-quarter LEFT view: rear and left side visible, left side plane remains identifiable";
    case 180:
      return "direct REAR view: tailgate/trunk and rear bumper centered, taillights symmetrical, no three-quarter stance";
    case 225:
      return "rear three-quarter RIGHT view: rear and right side visible, right side plane remains identifiable";
    case 270:
      return "full RIGHT side profile: vehicle side parallel to image plane, front and rear faces barely visible";
    case 315:
      return "front three-quarter RIGHT view: front and right side visible, right side plane dominant enough to show length";
    default:
      return "the exact requested turntable angle; do not copy a neighbouring angle";
  }
}

function missingKeyframeSynthesisBlock(angle: number, sourceAngles?: number[]): string {
  const normalized = normalizeKeyframeAngle(angle);
  if (normalized === null) return "";
  const unique = Array.from(new Set((sourceAngles ?? []).map(normalizeKeyframeAngle).filter((a): a is number => a !== null))).sort((a, b) => a - b);
  const neighbours = nearestSourceAnglesAround(normalized, unique);
  const sourceList = unique.length ? unique.map((a) => `${a}°`).join(", ") : "none";
  const previous = neighbours.previous === null ? "unknown" : `${neighbours.previous}°`;
  const next = neighbours.next === null ? "unknown" : `${neighbours.next}°`;

  return `<MISSING_KEYFRAME_SYNTHESIS>
No real photograph exists at the target angle ${normalized}°.
Available real source angles after vision remapping: ${sourceList}.
Nearest physical anchors around the target: previous=${previous}, next=${next}.
Generate a NEW rigid turntable keyframe at exactly ${normalized}° — do not duplicate, mirror, crop or relabel any neighbour photo.
Target appearance: ${targetAngleAppearance(normalized)}.
For direct front/rear targets, the vehicle must be centered and symmetrical; a 45°/135°/225°/315° three-quarter look is a QA failure.
Unknown hidden details must be resolved only from the identity profile and visible references; never from catalogue memory.
</MISSING_KEYFRAME_SYNTHESIS>`;
}

export function buildKeyframePrompt(input: KeyframePromptInput): string {
  const {
    angle, identity, referenceLabels, hasDedicatedWheelReference, wheelSpec, hasDirectPhoto,
    sourceAngles, strictRetry, repairInstructions,
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
${hasDirectPhoto ? "" : missingKeyframeSynthesisBlock(angle, sourceAngles)}
${REFERENCE_TRUTH_PROTOCOL}
${identityLockBlock(identity)}
${CAMERA_LOCK}
${ROTATION_LOCK}
${SCENE_LOCK}
${wheelLockBlock(hasDedicatedWheelReference, wheelSpec)}
${FORBIDDEN_BLOCK}${
    strictRetry
      ? `

<STRICT_RETRY>
A previous attempt was rejected by automated quality control. Keep angle, camera, framing and background
identical and change ONLY the rejected details:
${(repairInstructions && repairInstructions.length > 0
          ? repairInstructions
          : ["repeat studio normalization only; do not alter vehicle identity, angle, camera, framing, background or lighting"])
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
  wheelSpec?: unknown;
  strictRetry?: boolean;
  repairInstructions?: string[];
}

export function buildIntermediatePrompt(input: IntermediatePromptInput): string {
  const { frame, frameCount, identity, referenceLabels, hasDedicatedWheelReference, wheelSpec, strictRetry, repairInstructions } =
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
${wheelLockBlock(hasDedicatedWheelReference, wheelSpec)}
${FORBIDDEN_BLOCK}${
    strictRetry
      ? `

<STRICT_RETRY>
A previous attempt was rejected. Preserve angle, camera, framing and background exactly and repair ONLY:
${(repairInstructions && repairInstructions.length > 0
          ? repairInstructions
          : ["repeat the same interpolation cleanly; preserve all identity details and change no unflagged vehicle dimension"])
          .map((r) => `- ${r}`)
          .join("\n")}
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
  hasDirectSource?: boolean;
  sourceAngles?: number[];
  keyframeMode?: "direct_source" | "generated_from_neighbours" | "intermediate";
}

export function buildQaPrompt(input: QaPromptInput): string {
  const { angle, frameIndex, frameCount, referenceLabels, isKeyframe, hasDirectSource = false, sourceAngles = [], keyframeMode } = input;
  const sourceAngleLine = sourceAngles.length ? `Real source angles available: ${sourceAngles.join("°, ")}°.` : "";
  const modeLine = isKeyframe
    ? hasDirectSource
      ? `This keyframe has a DIRECT SOURCE at ${angle}°. Use that same-angle real photo as the primary vehicle/angle comparison. Studio background, lighting, crop and framing normalization are expected and must not reduce identity or angle scores when the vehicle is faithfully preserved. Other originals are supplemental identity truth only and may show different camera/backgrounds.`
      : `This keyframe is GENERATED because no same-angle source exists. Judge angle_continuity against the nearest real source angles around ${angle}° and identity against the originals. Do not penalize the candidate merely because unrelated originals have different camera positions or backgrounds.`
    : `This is an intermediate frame. Judge rotation continuity between the verified sector keyframes and local neighbour; originals remain identity truth only.`;
  return `You are the automated quality gate for a ${frameCount}-frame 360° vehicle turntable sequence.
Do NOT generate an image. Inspect only. Return strict JSON, nothing else.

<CANDIDATE>
The LAST supplied image is the candidate: frame ${frameIndex} at ${angle}° (${isKeyframe ? "keyframe" : "intermediate frame"}).
${ANGLE_CONVENTION}
</CANDIDATE>

${referencePriorityBlock(referenceLabels)}
<QA_CONTEXT>
Mode: ${keyframeMode ?? (isKeyframe ? (hasDirectSource ? "direct_source" : "generated_from_neighbours") : "intermediate")}.
${sourceAngleLine}
${modeLine}
</QA_CONTEXT>
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

export interface RepairPromptInput {
  frameIndex: number;
  angle: number;
  frameCount: number;
  identity: unknown;
  referenceLabels: string[];
  hasDedicatedWheelReference: boolean;
  wheelSpec?: unknown;
  isKeyframe: boolean;
  attempt: number;
  hardFailures: string[];
  repairInstructions: string[];
  qaResult?: QaResult;
}

/**
 * Reparatur-Prompt nach einem QA-Fail: erzeugt den Frame neu, aber ändert
 * ausschließlich die beanstandeten Details. Enthält alle Pflicht-Lock-Blöcke.
 */
export function buildRepairPrompt(input: RepairPromptInput): string {
  const {
    frameIndex, angle, frameCount, identity, referenceLabels,
    hasDedicatedWheelReference, wheelSpec, isKeyframe, attempt, hardFailures, repairInstructions, qaResult,
  } = input;

  const deterministic = qaResult ? deriveRepairInstructionsFromQa(qaResult) : [];
  const fixes = Array.from(new Set([...repairInstructions, ...deterministic])).filter((f) => f.trim().length > 0);
  const mustFix = fixes.length > 0
    ? fixes
    : [
      "No below-threshold visual dimension was reported. Re-render the same frame conservatively for clearer QA confidence only; preserve all passed dimensions and do not alter wheels, paint, lights, body, trim, equipment, angle, camera, framing, background or lighting.",
    ];

  return `You are repairing frame ${frameIndex} (${angle}°) of a ${frameCount}-frame studio turntable sequence
of ONE specific physical vehicle. This is repair attempt ${attempt}.

<TASK>
Re-render the ${isKeyframe ? "keyframe" : "intermediate frame"} at exactly ${angle} degrees.
${ANGLE_CONVENTION}
Automated quality control REJECTED the previous attempt. Keep angle, camera, framing, background and
lighting byte-for-byte comparable and repair ONLY the listed defects.
Return exactly ONE image and no text.
</TASK>

<REJECTED_FINDINGS>
${hardFailures.length ? hardFailures.map((f) => `- hard failure: ${f}`).join("\n") : "- (no hard failure reported)"}
</REJECTED_FINDINGS>

<MUST_FIX>
${mustFix.map((r) => `- ${r}`).join("\n")}
</MUST_FIX>

<PRESERVE_EVERYTHING_ELSE>
Preserve every other aspect of the rejected attempt unchanged: rotation angle, camera position, framing,
focal length, vehicle centre, ground contact, background, lighting, shadow, paint tone, trim and equipment.
Do not "improve", restyle or re-compose anything that was not explicitly listed above.
</PRESERVE_EVERYTHING_ELSE>

${referencePriorityBlock(referenceLabels)}
${REFERENCE_TRUTH_PROTOCOL}
${identityLockBlock(identity)}
${CAMERA_LOCK}
${ROTATION_LOCK}
${SCENE_LOCK}
${wheelLockBlock(hasDedicatedWheelReference, wheelSpec)}
${FORBIDDEN_BLOCK}`;
}



// ─── QA-Auswertung ─────────────────────────────────────────────────────

export interface QaResult {
  scores: Partial<Record<QaDimension, number>>;
  verdict: "pass" | "regenerate" | "manual_review";
  hard_failures: string[];
  repair_instructions: string[];
  confidence: number;
}

/** Akzeptiert 0–1 und 0–100 Skalen; alles andere ist 0 (fail closed). */
export function normalizeConfidence(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const scaled = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
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
    confidence: normalizeConfidence(r.confidence),
  };
}

/** Gesamtscore: identitätskritische Dimensionen doppelt gewichtet. */
export function qaCompositeScore(result: QaResult): number {
  let sum = 0;
  let weight = 0;
  for (const dim of IDENTITY_CRITICAL_DIMENSIONS) {
    sum += (result.scores[dim] ?? 0) * 2;
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
  confidenceThreshold: number = QA_CONFIDENCE_THRESHOLD,
): boolean {
  if (result.verdict !== "pass") return false;
  if (result.hard_failures.length > 0) return false;
  if (!Number.isFinite(result.confidence) || result.confidence < confidenceThreshold) return false;
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

export interface QaThresholdBreach {
  dimension: QaDimension | "confidence";
  score: number | null;
  threshold: number;
  critical: boolean;
}

export function qaThresholdBreaches(
  result: QaResult,
  identityThreshold: number = QA_IDENTITY_THRESHOLD,
  secondaryThreshold: number = QA_SECONDARY_THRESHOLD,
  confidenceThreshold: number = QA_CONFIDENCE_THRESHOLD,
): QaThresholdBreach[] {
  const breaches: QaThresholdBreach[] = [];
  for (const dim of IDENTITY_CRITICAL_DIMENSIONS) {
    const score = result.scores[dim];
    if (score === undefined || score < identityThreshold) {
      breaches.push({ dimension: dim, score: score ?? null, threshold: identityThreshold, critical: true });
    }
  }
  for (const dim of SECONDARY_DIMENSIONS) {
    const score = result.scores[dim];
    if (score === undefined || score < secondaryThreshold) {
      breaches.push({ dimension: dim, score: score ?? null, threshold: secondaryThreshold, critical: false });
    }
  }
  if (!Number.isFinite(result.confidence) || result.confidence < confidenceThreshold) {
    breaches.push({ dimension: "confidence", score: Number.isFinite(result.confidence) ? result.confidence : null, threshold: confidenceThreshold, critical: false });
  }
  return breaches;
}

export function qaScoreBreakdown(result: QaResult): string {
  const scores = [...IDENTITY_CRITICAL_DIMENSIONS, ...SECONDARY_DIMENSIONS]
    .map((dim) => `${dim}=${result.scores[dim] ?? "missing"}`)
    .join(", ");
  return `scores: ${scores}; confidence=${result.confidence}; verdict=${result.verdict}`;
}

const DIMENSION_REPAIR_INSTRUCTIONS: Record<QaDimension, string> = {
  identity: "restore the exact same physical vehicle identity: body proportions, badges, trim, sensors and visible equipment must match the original photos",
  wheels: "preserve the exact rim/spoke design, wheel finish, centre cap, tyre sidewall and brake-caliper appearance from the wheel/original references",
  lights: "restore the original headlight, DRL and taillight signatures without changing body panels",
  paint: "match the original paint colour tone, finish and reflections uniformly without recolouring trim or lights",
  angle_continuity: "correct only the rotation angle so it sits on the requested turntable angle and progresses in the correct direction; do not change identity details",
  camera_continuity: "correct only framing, vehicle centre, horizon, focal length and ground-plane continuity; do not alter wheels, paint, lights or body geometry",
  environment: "correct only the neutral studio background, lighting and contact shadow; do not alter the vehicle",
  artifact_free: "remove only malformed components, extra objects, text, watermarks or rendering artifacts; preserve all real vehicle details",
};

export function deriveRepairInstructionsFromQa(result: QaResult): string[] {
  const explicit = result.repair_instructions.map((r) => r.trim()).filter(Boolean);
  const fromHardFailures = result.hard_failures.map((failure): string | null => {
    const f = failure.toLowerCase();
    if (f.includes("wheel") || f.includes("spoke")) return DIMENSION_REPAIR_INSTRUCTIONS.wheels;
    if (f.includes("light") || f.includes("drl") || f.includes("tail")) return DIMENSION_REPAIR_INSTRUCTIONS.lights;
    if (f.includes("paint") || f.includes("colour") || f.includes("color")) return DIMENSION_REPAIR_INSTRUCTIONS.paint;
    if (f.includes("angle") || f.includes("backwards") || f.includes("duplicate") || f.includes("mirror")) return DIMENSION_REPAIR_INSTRUCTIONS.angle_continuity;
    if (f.includes("camera") || f.includes("framing")) return DIMENSION_REPAIR_INSTRUCTIONS.camera_continuity;
    if (f.includes("environment") || f.includes("background") || f.includes("shadow")) return DIMENSION_REPAIR_INSTRUCTIONS.environment;
    if (f.includes("malformed") || f.includes("text") || f.includes("watermark") || f.includes("artifact")) return DIMENSION_REPAIR_INSTRUCTIONS.artifact_free;
    if (f.includes("body") || f.includes("door") || f.includes("equipment")) return DIMENSION_REPAIR_INSTRUCTIONS.identity;
    return null;
  }).filter((instruction): instruction is string => Boolean(instruction));
  const fromScores = qaThresholdBreaches(result)
    .filter((b) => b.dimension !== "confidence")
    .map((b) => DIMENSION_REPAIR_INSTRUCTIONS[b.dimension as QaDimension]);
  return Array.from(new Set([...explicit, ...fromHardFailures, ...fromScores]));
}

export function buildQaTelemetry(result: QaResult, rawResult: unknown, passed: boolean): Record<string, unknown> {
  const derivedRepairInstructions = deriveRepairInstructionsFromQa(result);
  return {
    rawResult,
    scores: result.scores,
    sanitizedScores: result.scores,
    confidence: result.confidence,
    verdict: result.verdict,
    hardFailures: result.hard_failures,
    repairInstructions: result.repair_instructions,
    derivedRepairInstructions,
    thresholds: QA_THRESHOLD_POLICY,
    policy: QA_THRESHOLD_POLICY,
    thresholdPolicy: QA_THRESHOLD_POLICY,
    thresholdBreaches: qaThresholdBreaches(result),
    compositeScore: qaCompositeScore(result),
    passed,
  };
}

/**
 * Fail-closed QA-Auswertung eines rohen Modell-Outputs.
 * Wirft die Anfrage oder das Parsing einen Fehler, MUSS dieses Ergebnis
 * verwendet werden — niemals ein Default-"pass".
 */
export function qaFailClosed(reason: string, terminal = false): QaResult {
  return {
    scores: {},
    verdict: terminal ? "manual_review" : "regenerate",
    hard_failures: [`qa_unavailable: ${reason}`],
    repair_instructions: [],
    confidence: 0,
  };
}

/** Modell für den nächsten Versuch: 1–3 Standard, letzter Versuch Pro. */
export function modelForAttempt(attempt: number, maxAttempts: number = MAX_FRAME_ATTEMPTS): string {
  return attempt >= maxAttempts ? SPIN_MODELS.imagePro : SPIN_MODELS.image;
}

// ─── Mindest-Quellabdeckung ────────────────────────────────────────────

/** Kardinalwinkel bleiben empfohlen, sind aber nicht mehr harte Pflicht. */
export const REQUIRED_SOURCE_ANGLES = [0, 90, 180, 270] as const;
/** Mindestanzahl eindeutiger echter Quellwinkel. */
export const MIN_SOURCE_ANGLES = 4;
/** Größte erlaubte Lücke zwischen realen Quellwinkeln für verteilte Abdeckung. */
export const MAX_SOURCE_CIRCULAR_GAP_DEG = 135;

export interface CircularAngleGap {
  from: number;
  to: number;
  size: number;
}

export interface SourceCoverageResult {
  ok: boolean;
  uniqueAngles: number[];
  /** Legacy-Diagnose: empfohlene Kardinalwinkel, die fehlen; nicht mehr startblockierend. */
  missingRequired: number[];
  /** Optionale Diagonalen (45/135/225/315), die die Qualität weiter erhöhen. */
  missingOptional: number[];
  maxGap: number;
  gaps: CircularAngleGap[];
  reason: "ok" | "not_enough_unique_angles" | "clustered_angles";
}

export function normalizeKeyframeAngle(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const norm = ((n % 360) + 360) % 360;
  return (KEYFRAME_ANGLES as readonly number[]).includes(norm) ? norm : null;
}

export function circularAngleDistance(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(diff, 360 - diff);
}

export function circularAngleGaps(angles: number[]): CircularAngleGap[] {
  const unique = Array.from(new Set(angles.map(normalizeKeyframeAngle).filter((a): a is number => a !== null))).sort((a, b) => a - b);
  if (unique.length === 0) return [{ from: 0, to: 0, size: 360 }];
  return unique.map((from, i) => {
    const to = unique[(i + 1) % unique.length];
    const size = i === unique.length - 1 ? 360 - from + to : to - from;
    return { from, to, size };
  });
}

/**
 * Prüft die Quellabdeckung VOR dem Start. Produktionsfähig sind 4+ eindeutige
 * echte Keyframe-Winkel, wenn sie rund ums Fahrzeug verteilt sind
 * (größte Kreis-Lücke ≤ 135°). Es wird nie eine fehlende Perspektive durch
 * eine andere ersetzt — fehlende Keyframes werden später aus umliegender Wahrheit generiert.
 */
export function evaluateSourceCoverage(angles: Array<number | string | null | undefined>): SourceCoverageResult {
  const unique = Array.from(
    new Set(angles.map(normalizeKeyframeAngle).filter((a): a is number => a !== null)),
  ).sort((a, b) => a - b);
  const gaps = circularAngleGaps(unique);
  const maxGap = Math.max(...gaps.map((g) => g.size));
  const missingRequired = REQUIRED_SOURCE_ANGLES.filter((a) => !unique.includes(a));
  const missingOptional = (KEYFRAME_ANGLES as readonly number[])
    .filter((a) => !(REQUIRED_SOURCE_ANGLES as readonly number[]).includes(a) && !unique.includes(a));
  const enough = unique.length >= MIN_SOURCE_ANGLES;
  const distributed = maxGap <= MAX_SOURCE_CIRCULAR_GAP_DEG;

  return {
    ok: enough && distributed,
    uniqueAngles: unique,
    missingRequired: [...missingRequired],
    missingOptional,
    maxGap,
    gaps,
    reason: !enough ? "not_enough_unique_angles" : distributed ? "ok" : "clustered_angles",
  };
}

export function sourceCoverageFailureReason(coverage: SourceCoverageResult): string {
  if (coverage.ok) return "ok";
  if (coverage.reason === "not_enough_unique_angles") {
    return `Mindestens ${MIN_SOURCE_ANGLES} eindeutige echte Perspektiven im 45°-Raster erforderlich; erkannt: ${coverage.uniqueAngles.join("°, ") || "keine"}°.`;
  }
  return `Perspektiven sind zu stark gebündelt: größte Winkellücke ${coverage.maxGap}° (max. ${MAX_SOURCE_CIRCULAR_GAP_DEG}°); erkannt: ${coverage.uniqueAngles.join("°, ")}°.`;
}

export const SOURCE_ANGLE_CONFIDENCE_THRESHOLD = 85;

export interface SourceAngleTruthInput {
  declaredAngle: unknown;
  detectedAngle?: unknown;
  angleConfidence?: unknown;
  leftRightCertain?: unknown;
  sourceMode?: string;
}

export interface SourceAngleDecision {
  selectedAngle: number | null;
  declaredAngle: number | null;
  detectedAngle: number | null;
  angleConfidence: number | null;
  leftRightCertain: boolean | null;
  sourceMode: string;
  remapped: boolean;
  conflictDegrees: number | null;
  reason: "detected_truth_upload" | "manual_mapping_kept" | "manual_conflict_detected_used" | "declared_used_detection_uncertain" | "detected_used_no_valid_declared" | "unusable";
  warning?: string;
}

export function resolveSourceAngleTruth(input: SourceAngleTruthInput): SourceAngleDecision {
  const sourceMode = input.sourceMode || "upload";
  const declaredAngle = normalizeKeyframeAngle(input.declaredAngle);
  const detectedAngle = normalizeKeyframeAngle(input.detectedAngle);
  const confidenceValue = Number(input.angleConfidence);
  const angleConfidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(100, Math.round(confidenceValue))) : null;
  const leftRightCertain = typeof input.leftRightCertain === "boolean" ? input.leftRightCertain : null;
  const detectedReliable = detectedAngle !== null && (angleConfidence ?? 0) >= SOURCE_ANGLE_CONFIDENCE_THRESHOLD && leftRightCertain !== false;
  const conflictDegrees = declaredAngle !== null && detectedAngle !== null ? circularAngleDistance(declaredAngle, detectedAngle) : null;
  const remappedFromDeclared = (selectedAngle: number | null) => selectedAngle !== null && declaredAngle !== null && selectedAngle !== declaredAngle;

  if (detectedReliable && sourceMode === "upload") {
    return {
      selectedAngle: detectedAngle,
      declaredAngle,
      detectedAngle,
      angleConfidence,
      leftRightCertain,
      sourceMode,
      remapped: remappedFromDeclared(detectedAngle),
      conflictDegrees,
      reason: "detected_truth_upload",
      warning: remappedFromDeclared(detectedAngle) ? `Upload-Hinweis ${declaredAngle}° wurde durch Analyse ${detectedAngle}° ersetzt.` : undefined,
    };
  }

  if (detectedReliable && declaredAngle === null) {
    return { selectedAngle: detectedAngle, declaredAngle, detectedAngle, angleConfidence, leftRightCertain, sourceMode, remapped: false, conflictDegrees, reason: "detected_used_no_valid_declared" };
  }

  if (detectedReliable && declaredAngle !== null && conflictDegrees !== null && conflictDegrees >= 45) {
    return {
      selectedAngle: detectedAngle,
      declaredAngle,
      detectedAngle,
      angleConfidence,
      leftRightCertain,
      sourceMode,
      remapped: true,
      conflictDegrees,
      reason: "manual_conflict_detected_used",
      warning: `Manuelle Zuordnung ${declaredAngle}° widerspricht sicherer Analyse ${detectedAngle}°; Analysewinkel verwendet.`,
    };
  }

  if (declaredAngle !== null) {
    return {
      selectedAngle: declaredAngle,
      declaredAngle,
      detectedAngle,
      angleConfidence,
      leftRightCertain,
      sourceMode,
      remapped: false,
      conflictDegrees,
      reason: detectedReliable ? "manual_mapping_kept" : "declared_used_detection_uncertain",
      warning: !detectedReliable && detectedAngle !== null ? `Analyse unsicher (${detectedAngle}°, Confidence ${angleConfidence ?? "n/a"}); Zuordnung ${declaredAngle}° beibehalten.` : undefined,
    };
  }

  return { selectedAngle: null, declaredAngle, detectedAngle, angleConfidence, leftRightCertain, sourceMode, remapped: false, conflictDegrees, reason: "unusable", warning: "Kein verwertbarer Keyframe-Winkel erkannt." };
}

export interface SourceAngleSelectable {
  angle?: unknown;
  url?: string;
  assetKind?: string;
  [key: string]: unknown;
}

export interface SourceAnalysisImage {
  index?: unknown;
  detected_angle?: unknown;
  angle_confidence?: unknown;
  left_right_certain?: unknown;
  quality_score?: unknown;
  warnings?: unknown;
  [key: string]: unknown;
}

export interface ResolvedSourceAngleSelection<T extends SourceAngleSelectable = SourceAngleSelectable> {
  angle: number;
  source: T;
  analysis: SourceAnalysisImage | null;
  decision: SourceAngleDecision;
  rankScore: number;
}

export interface SourceAngleResolution<T extends SourceAngleSelectable = SourceAngleSelectable> {
  selected: ResolvedSourceAngleSelection<T>[];
  diagnostics: Array<{
    sourceIndex: number;
    url?: string;
    decision: SourceAngleDecision;
    analysis: SourceAnalysisImage | null;
    selected: boolean;
    discardedBecause?: "unusable_angle" | "duplicate_angle_lower_confidence";
  }>;
  duplicates: Array<{ angle: number; keptIndex: number; discardedIndex: number; reason: string }>;
}

function sourceRankScore(analysis: SourceAnalysisImage | null, decision: SourceAngleDecision): number {
  const quality = Number(analysis?.quality_score);
  const confidence = decision.angleConfidence ?? 0;
  const qualityScore = Number.isFinite(quality) ? Math.max(0, Math.min(100, Math.round(quality))) : 0;
  return confidence * 2 + qualityScore;
}

export function resolveSourceAngleSelections<T extends SourceAngleSelectable>(
  sources: T[],
  analysisImages: SourceAnalysisImage[] | undefined,
  sourceMode: string,
): SourceAngleResolution<T> {
  const byAngle = new Map<number, ResolvedSourceAngleSelection<T> & { sourceIndex: number }>();
  const diagnostics: SourceAngleResolution<T>["diagnostics"] = [];
  const duplicates: SourceAngleResolution<T>["duplicates"] = [];

  sources.forEach((source, sourceIndex) => {
    const analysis = analysisImages?.find((im) => Number(im.index) === sourceIndex) ?? null;
    const decision = resolveSourceAngleTruth({
      declaredAngle: source.angle,
      detectedAngle: analysis?.detected_angle,
      angleConfidence: analysis?.angle_confidence,
      leftRightCertain: analysis?.left_right_certain,
      sourceMode,
    });
    if (decision.selectedAngle === null) {
      diagnostics.push({ sourceIndex, url: source.url, decision, analysis, selected: false, discardedBecause: "unusable_angle" });
      return;
    }

    const candidate = {
      angle: decision.selectedAngle,
      source,
      analysis,
      decision,
      rankScore: sourceRankScore(analysis, decision),
      sourceIndex,
    };
    const existing = byAngle.get(candidate.angle);
    if (!existing) {
      byAngle.set(candidate.angle, candidate);
      diagnostics.push({ sourceIndex, url: source.url, decision, analysis, selected: true });
      return;
    }

    if (candidate.rankScore > existing.rankScore) {
      byAngle.set(candidate.angle, candidate);
      duplicates.push({ angle: candidate.angle, keptIndex: sourceIndex, discardedIndex: existing.sourceIndex, reason: "higher analysis confidence/quality" });
      const existingDiag = diagnostics.find((d) => d.sourceIndex === existing.sourceIndex);
      if (existingDiag) {
        existingDiag.selected = false;
        existingDiag.discardedBecause = "duplicate_angle_lower_confidence";
      }
      diagnostics.push({ sourceIndex, url: source.url, decision, analysis, selected: true });
      return;
    }

    duplicates.push({ angle: candidate.angle, keptIndex: existing.sourceIndex, discardedIndex: sourceIndex, reason: "lower analysis confidence/quality" });
    diagnostics.push({ sourceIndex, url: source.url, decision, analysis, selected: false, discardedBecause: "duplicate_angle_lower_confidence" });
  });

  return {
    selected: [...byAngle.values()].sort((a, b) => a.angle - b.angle).map(({ sourceIndex: _sourceIndex, ...rest }) => rest),
    diagnostics,
    duplicates,
  };
}

export function getDirectSourceForKeyframe<T extends { angle_degrees?: unknown; angle?: unknown }>(sources: T[], angle: number): T | undefined {
  return sources.find((source) => normalizeKeyframeAngle(source.angle_degrees ?? source.angle) === angle);
}

export function nearestSourceAnglesAround(targetAngle: number, sourceAngles: number[]): { previous: number | null; next: number | null } {
  const target = normalizeKeyframeAngle(targetAngle);
  const unique = Array.from(new Set(sourceAngles.map(normalizeKeyframeAngle).filter((a): a is number => a !== null))).sort((a, b) => a - b);
  if (target === null || unique.length === 0) return { previous: null, next: null };
  const previous = [...unique].reverse().find((a) => a < target) ?? unique[unique.length - 1];
  const next = unique.find((a) => a > target) ?? unique[0];
  return { previous, next };
}

// ─── Identitätsquellen-Priorisierung ───────────────────────────────────

export type IdentitySourceTier = "original" | "upload" | "gallery" | "none";

export interface SelectionRow {
  angle_degrees: number | string | null;
  image_url: string;
  asset_kind?: string | null;
}

/**
 * Identitätswahrheit NUR aus echten Quellbildern.
 * Priorität: original → upload → gallery. Generierte Keyframes sind
 * ausdrücklich niemals Identitätsquelle.
 */
export function resolveIdentitySources(rows: SelectionRow[]): {
  tier: IdentitySourceTier;
  sources: SelectionRow[];
} {
  const angled = rows.filter((r) => Number(r.angle_degrees) >= 0);
  const notGenerated = angled.filter(
    (r) => (r.asset_kind ?? "") !== "generated" && (r.asset_kind ?? "") !== "generated_keyframe",
  );
  for (const tier of ["original", "upload", "gallery"] as const) {
    const sources = notGenerated.filter((r) => (r.asset_kind ?? "upload") === tier);
    if (sources.length > 0) return { tier, sources };
  }
  return notGenerated.length > 0
    ? { tier: "gallery", sources: notGenerated }
    : { tier: "none", sources: [] };
}


// ─── Qualitäts-Aggregation ─────────────────────────────────────────────

export interface FrameQualityInput {
  frame_index: number;
  quality_score?: number | null;
  validation_status?: string | null;
  angle_degrees?: number | null;
}

export interface QualityAggregate {
  frameCount: number;
  passedCount: number;
  uniqueIndexCount: number;
  completeness: number;
  averageScore: number;
  /** Gesamtscore = Durchschnitt × Vollständigkeit */
  qualityScore: number;
  /** Alle Winkel liegen (in Toleranz) exakt auf dem Raster. */
  gridConsistent: boolean;
  complete: boolean;
}

/** Prüft, ob jeder Frame-Winkel dem erwarteten Rasterwinkel entspricht. */
export function framesMatchGrid(
  frames: FrameQualityInput[],
  targetFrameCount: number,
  tolerance: number = ANGLE_TOLERANCE_DEG,
): boolean {
  return frames.every((f) => {
    if (f.angle_degrees === null || f.angle_degrees === undefined) return false;
    const expected = angleForIndex(f.frame_index, targetFrameCount);
    const diff = Math.abs(Number(f.angle_degrees) - expected);
    return Math.min(diff, 360 - diff) <= tolerance;
  });
}

export function aggregateQuality(frames: FrameQualityInput[], targetFrameCount: number): QualityAggregate {
  const unique = new Map<number, FrameQualityInput>();
  for (const f of frames) if (!unique.has(f.frame_index)) unique.set(f.frame_index, f);
  const list = [...unique.values()];
  const passed = list.filter((f) => f.validation_status === "passed");
  // Qualität leitet sich aus den tatsächlichen QA-Scores ab, nicht aus der Dateizahl.
  const averageScore = passed.length
    ? Math.round(passed.reduce((s, f) => s + (f.quality_score ?? 0), 0) / passed.length)
    : 0;
  const completeness = targetFrameCount > 0 ? Math.min(1, passed.length / targetFrameCount) : 0;
  // Raster-Konsistenz nur prüfen, wenn Winkel geliefert wurden (Legacy-Jobs ohne Winkel bleiben tolerant).
  const hasAngles = list.some((f) => f.angle_degrees !== null && f.angle_degrees !== undefined);
  const gridConsistent = hasAngles ? framesMatchGrid(list, targetFrameCount) : true;
  return {
    frameCount: list.length,
    passedCount: passed.length,
    uniqueIndexCount: unique.size,
    completeness: Math.round(completeness * 100) / 100,
    averageScore,
    qualityScore: Math.round(averageScore * completeness),
    gridConsistent,
    // 'complete' NUR wenn jeder geforderte Index genau einmal existiert,
    // jeder Frame die QA bestanden hat UND alle Winkel auf dem Raster liegen.
    complete:
      unique.size === targetFrameCount &&
      passed.length === targetFrameCount &&
      list.every((f) => f.validation_status === "passed") &&
      Array.from({ length: targetFrameCount }, (_, i) => i).every((i) => unique.has(i)) &&
      gridConsistent,
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
  /** Tatsächlich enthaltene Frames. */
  frameCount: number;
  /** Vom Job gefordertes Raster (32 oder 48). */
  targetFrameCount: number;
  angleStep: number;
  direction: "clockwise";
  startAngle: number;
  keyframeAngles: number[];
  backgroundStyle: string;
  identityHash: string | null;
  qualityScore: number;
  /** Aggregierte QA-Kennzahlen (keine internen Analyse-Rohdaten). */
  qaSummary: QualityAggregate;
  createdAt: string;
  frames: { index: number; angle: number; src: string; status?: string; sourceKind?: string }[];
}

/**
 * Öffentliches Verteil-Manifest. Enthält BEWUSST kein vollständiges
 * Identitätsprofil — nur der Hash verlässt den Server.
 */
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
    targetFrameCount: params.targetFrameCount,
    angleStep: angleStep(params.targetFrameCount),
    direction: "clockwise",
    startAngle: 0,
    keyframeAngles: [...KEYFRAME_ANGLES],
    backgroundStyle: "studio_cyclorama_neutral_grey",
    identityHash: params.identityHash ?? null,
    qualityScore: quality.qualityScore,
    qaSummary: quality,
    createdAt: params.createdAt ?? new Date().toISOString(),
    frames: sorted.map((f) => ({
      index: f.frame_index,
      angle: f.angle_degrees ?? angleForIndex(f.frame_index, params.targetFrameCount),
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

// ─── Orchestrierung: reine, testbare Cursor-Logik ──────────────────────
//
// Jede Edge-Invocation bearbeitet GENAU EINE teure Einheit (ein Keyframe,
// ein QA-/Reparaturversuch, ein Zwischenframe-Versuch) und ruft sich danach
// mit dem nächsten Cursor selbst auf. Dadurch bleibt jede Invocation weit
// unter dem Wall-Clock-Limit und ist nach einem Timeout wiederaufnehmbar.

export type SpinPipelineStep =
  | "analyze"
  | "profile"
  | "keyframes"
  | "validate_keyframe"
  | "generate_frame"
  | "assemble";

export interface SpinCursor {
  step: SpinPipelineStep;
  keyframeIndex?: number;
  sector?: number;
  planPosition?: number;
  attempt?: number;
}

export type SpinAdvance =
  | { kind: "next"; cursor: SpinCursor }
  | { kind: "terminal"; reason: string };

/** Nach einem persistierten Keyframe: nächster Winkel oder Validierungsphase. */
export function advanceKeyframe(keyframeIndex: number): SpinAdvance {
  if (keyframeIndex < KEYFRAME_ANGLES.length - 1) {
    return { kind: "next", cursor: { step: "keyframes", keyframeIndex: keyframeIndex + 1 } };
  }
  return { kind: "next", cursor: { step: "validate_keyframe", keyframeIndex: 0, attempt: 1 } };
}

/**
 * Validierung eines einzelnen Keyframes.
 * passed → nächster Keyframe bzw. Start der Zwischenframes.
 * sonst → nächster Reparaturversuch, bis MAX_KEYFRAME_ATTEMPTS erschöpft ist.
 */
export function advanceValidation(
  keyframeIndex: number,
  attempt: number,
  passed: boolean,
  maxAttempts: number = MAX_KEYFRAME_ATTEMPTS,
): SpinAdvance {
  if (passed) {
    if (keyframeIndex < KEYFRAME_ANGLES.length - 1) {
      return { kind: "next", cursor: { step: "validate_keyframe", keyframeIndex: keyframeIndex + 1, attempt: 1 } };
    }
    return { kind: "next", cursor: { step: "generate_frame", sector: 0, planPosition: 0, attempt: 1 } };
  }
  if (attempt < maxAttempts) {
    return { kind: "next", cursor: { step: "validate_keyframe", keyframeIndex, attempt: attempt + 1 } };
  }
  return {
    kind: "terminal",
    reason: `Keyframe ${KEYFRAME_ANGLES[keyframeIndex]}° hat die QA nach ${maxAttempts} Versuchen nicht bestanden.`,
  };
}

/**
 * Zwischenframes: eine Planposition pro Invocation, mit begrenzten Versuchen.
 * Nach der letzten Planposition folgt der nächste Sektor, nach Sektor 7 assemble.
 */
export function advanceFrame(
  sector: number,
  planPosition: number,
  attempt: number,
  passed: boolean,
  frameCount: number,
  maxAttempts: number = MAX_FRAME_ATTEMPTS,
): SpinAdvance {
  const planLength = buildBidirectionalOffsets(frameCount).length;
  if (!passed) {
    if (attempt < maxAttempts) {
      return { kind: "next", cursor: { step: "generate_frame", sector, planPosition, attempt: attempt + 1 } };
    }
    return {
      kind: "terminal",
      reason: `Frame in Sektor ${sector} (Position ${planPosition}) hat die QA nach ${maxAttempts} Versuchen nicht bestanden.`,
    };
  }
  if (planPosition < planLength - 1) {
    return { kind: "next", cursor: { step: "generate_frame", sector, planPosition: planPosition + 1, attempt: 1 } };
  }
  if (sector < KEYFRAME_ANGLES.length - 1) {
    return { kind: "next", cursor: { step: "generate_frame", sector: sector + 1, planPosition: 0, attempt: 1 } };
  }
  return { kind: "next", cursor: { step: "assemble" } };
}

/** Bereits bestandene Einheiten werden übersprungen (idempotenter Resume). */
export function shouldSkipUnit(passedIndices: Iterable<number>, targetIndex: number): boolean {
  for (const i of passedIndices) if (Number(i) === targetIndex) return true;
  return false;
}

/**
 * Sektorgrenzen eindeutig benennen: Sektor 7 endet bei 360°, also wieder bei 0°.
 * Die Interpolationsmathematik bleibt unverändert (360 = 0 + 360).
 */
export function sectorBoundaryLabel(angle: number): string {
  if (angle === 360) return "360° (= 0°, wrap-around start angle)";
  return `${angle}°`;
}

/** Modellwahl für Keyframes: direktes Foto ⇒ Standard zuerst, sonst Pro. */
export function keyframeModelForAttempt(
  attempt: number,
  hasDirectPhoto: boolean,
  maxAttempts: number = MAX_NORMALIZE_ATTEMPTS,
): string {
  if (!hasDirectPhoto) return SPIN_MODELS.imagePro;
  return attempt >= maxAttempts ? SPIN_MODELS.imagePro : SPIN_MODELS.image;
}

// ─── Abrechnungs-Idempotenz ────────────────────────────────────────────

export function billingMarker(kind: string, id: string | number = ""): string {
  return id === "" ? kind : `${kind}:${id}`;
}

export function hasBilled(qaSummary: unknown, marker: string): boolean {
  const billing = (qaSummary as any)?.billing;
  return Array.isArray(billing) && billing.includes(marker);
}

export function withBilling(qaSummary: unknown, marker: string): Record<string, unknown> {
  const base = (qaSummary && typeof qaSummary === "object" ? { ...(qaSummary as any) } : {}) as Record<string, unknown>;
  const billing = Array.isArray(base.billing) ? [...(base.billing as string[])] : [];
  if (!billing.includes(marker)) billing.push(marker);
  base.billing = billing;
  return base;
}

// ─── Viewer-/Manifest-Guard ────────────────────────────────────────────

/**
 * Nur vollständige Jobs dürfen als Spin angezeigt werden: Status `completed`,
 * exakt targetFrameCount bestandene Frames, eindeutige Indizes 0…n-1.
 * Alles andere ist Diagnosematerial und darf nicht wie ein fertiger Spin wirken.
 */
export function isRenderableSpin(input: {
  status?: string | null;
  targetFrameCount: number;
  frames: { frame_index: number; validation_status?: string | null }[];
}): boolean {
  if (input.status !== "completed") return false;
  if (!isSupportedFrameCount(input.targetFrameCount)) return false;
  const passed = new Set<number>();
  for (const f of input.frames) {
    if (f.validation_status !== "passed") continue;
    passed.add(Number(f.frame_index));
  }
  if (passed.size !== input.targetFrameCount) return false;
  for (let i = 0; i < input.targetFrameCount; i++) if (!passed.has(i)) return false;
  return true;
}
