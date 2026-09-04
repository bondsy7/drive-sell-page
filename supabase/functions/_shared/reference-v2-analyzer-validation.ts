// Reference V2 ONLY — strict server-side validation for the vision analyzer.
//
// The reference image defines WHAT the vehicle is. Metadata only describes
// what we know ABOUT it. Metadata must never override visible vehicle identity.
//
// Two jobs:
//  1) strict request validation (exact key whitelist, provider file refs only)
//  2) strict analyzer-response validation (exact keys, enums, ranges,
//     PerspectiveMaster membership, detected-class applicability)
// No optimistic defaults anywhere: anything not provably valid is rejected.

import {
  getReferenceV2MasterEntry,
  REFERENCE_V2_ELEVATION_PROFILES,
  REFERENCE_V2_ISSUE_SEVERITIES,
  REFERENCE_V2_VEHICLE_CLASSES,
  REFERENCE_V2_VISUAL_SURFACES,
  REFERENCE_V2_WHEEL_POSITIONS,
} from "./reference-v2-perspective-master.generated.ts";

export const ANALYZER_SCHEMA_VERSION = "reference-v2-vision-1";
export const REFERENCE_V2_PROVIDER_ID = "gemini-file-api";
export const MAX_ANCHORS = 3;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];

/** Only Gemini File API references are accepted — no arbitrary external URLs. */
const FILE_URI_PATTERNS: RegExp[] = [
  /^files\/[A-Za-z0-9_-]{1,128}$/,
  /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/files\/[A-Za-z0-9_-]{1,128}$/,
];

export function isValidProviderFileUri(value: unknown): value is string {
  return (
    typeof value === "string" && FILE_URI_PATTERNS.some((re) => re.test(value))
  );
}

// ---------------------------------------------------------------------------
// Semantic firewall (keys + lexical content)
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = [
  "make", "brand", "manufacturer", "marke", "hersteller", "model", "modell",
  "modelname", "variant", "trim", "ausstattung", "generation", "facelift",
  "modelyear", "year", "baujahr", "vin", "fin", "chassisnumber",
  "fahrgestellnummer", "title", "vehicletitle", "commercialtitle",
  "listingtitle", "price", "preis",
];

const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
  /\b(19|20)\d{2}\b/, // model/production year
  /\b[A-HJ-NPR-Z0-9]{17}\b/, // VIN
  // explicit semantic identity wording (EN)
  // Note: bare "model"/"trim" are NOT forbidden — they are legitimate
  // morphology words ("window trim", "scale proportions"). Only explicit
  // identity wording like "trim level"/"model name" is blocked.
  /\b(brand|make|manufacturer|marque|model(?:\s|-)?(?:name|year|range|line)|trim\s?(?:level|line)|facelift|generation|badge\s?name|nameplate|vin)\b/i,
  // explicit semantic identity wording (DE)
  /\b(marke|hersteller|modell(?:name|jahr|reihe)|baujahr|ausstattungslinie|typbezeichnung|fahrgestellnummer)\b/i,
];

export function semanticViolations(value: unknown, path = "", depth = 0): string[] {
  const out: string[] = [];
  if (depth > 12) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) =>
      out.push(...semanticViolations(v, `${path}[${i}]`, depth + 1)),
    );
    return out;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nk = k.toLowerCase().replace(/[^a-z]/g, "");
      if (FORBIDDEN_KEYS.includes(nk)) out.push(`forbidden key "${k}"`);
      out.push(...semanticViolations(v, path ? `${path}.${k}` : k, depth + 1));
    }
    return out;
  }
  if (typeof value === "string") {
    for (const re of FORBIDDEN_VALUE_PATTERNS) {
      if (re.test(value)) {
        out.push(`forbidden semantic wording at "${path || "value"}"`);
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

export interface AnalyzeRequestAnchor {
  readonly fileId: string;
  readonly mimeType: string;
}

export interface ValidAnalyzeRequest {
  readonly fileId: string;
  readonly mimeType: string;
  readonly anchors: readonly AnalyzeRequestAnchor[];
}

const REQUEST_KEYS = ["schemaVersion", "fileId", "mimeType", "providerId", "anchors"];
const ANCHOR_KEYS = ["fileId", "mimeType"];

function exactKeys(obj: Record<string, unknown>, allowed: string[]): string[] {
  return Object.keys(obj).filter((k) => !allowed.includes(k));
}

export function validateAnalyzeRequest(
  raw: unknown,
): { ok: true; request: ValidAnalyzeRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "request body must be an object" };
  }
  const body = raw as Record<string, unknown>;

  const unknownKeys = exactKeys(body, REQUEST_KEYS);
  if (unknownKeys.length > 0) {
    return { ok: false, error: `unknown request keys: ${unknownKeys.join(", ")}` };
  }
  if (body.schemaVersion !== ANALYZER_SCHEMA_VERSION) {
    return { ok: false, error: "schemaVersion mismatch" };
  }
  if (body.providerId !== REFERENCE_V2_PROVIDER_ID) {
    return { ok: false, error: "unsupported providerId" };
  }
  if (!isValidProviderFileUri(body.fileId)) {
    return {
      ok: false,
      error:
        "FILE_REFERENCE_UNSUPPORTED: fileId must be a Reference V2 provider file reference",
    };
  }
  if (
    typeof body.mimeType !== "string" ||
    !ALLOWED_IMAGE_MIME.includes(body.mimeType)
  ) {
    return { ok: false, error: "unsupported mimeType" };
  }

  const anchorsRaw = body.anchors ?? [];
  if (!Array.isArray(anchorsRaw)) {
    return { ok: false, error: "anchors must be an array" };
  }
  if (anchorsRaw.length > MAX_ANCHORS) {
    return { ok: false, error: `at most ${MAX_ANCHORS} anchors are allowed` };
  }
  const anchors: AnalyzeRequestAnchor[] = [];
  for (const [i, a] of anchorsRaw.entries()) {
    if (!a || typeof a !== "object" || Array.isArray(a)) {
      return { ok: false, error: `anchors[${i}] must be an object` };
    }
    const rec = a as Record<string, unknown>;
    const extra = exactKeys(rec, ANCHOR_KEYS);
    if (extra.length > 0) {
      return { ok: false, error: `anchors[${i}] unknown keys: ${extra.join(", ")}` };
    }
    if (!isValidProviderFileUri(rec.fileId)) {
      return {
        ok: false,
        error: `FILE_REFERENCE_UNSUPPORTED: anchors[${i}].fileId is not a provider file reference`,
      };
    }
    if (
      typeof rec.mimeType !== "string" ||
      !ALLOWED_IMAGE_MIME.includes(rec.mimeType)
    ) {
      return { ok: false, error: `anchors[${i}].mimeType is not an allowed image type` };
    }
    anchors.push({ fileId: rec.fileId, mimeType: rec.mimeType });
  }

  return {
    ok: true,
    request: { fileId: body.fileId, mimeType: body.mimeType, anchors },
  };
}

// ---------------------------------------------------------------------------
// Response validation
// ---------------------------------------------------------------------------

const RESPONSE_KEYS = [
  "schemaVersion", "vehicleDetected", "vehicleClass", "canonicalPerspectiveId",
  "perspectiveConfidence", "azimuthDeg", "pitchDeg", "elevationProfile",
  "visibility", "framing", "quality", "mirroredSuspected",
  "classificationConfidence", "sameVehicleConfidence", "identityEvidence",
  "issues",
];
/** The five global visibility fields are never expected inside `surfaces`. */
export const CORE_VISIBILITY_SURFACES: readonly string[] = [
  "front",
  "rear",
  "left_side",
  "right_side",
  "roof",
];

const VISIBILITY_KEYS = ["front", "rear", "leftSide", "rightSide", "roof", "surfaces"];
const FRAMING_KEYS = [
  "fullVehicleVisible", "cropped", "visibleWheelPositions", "estimatedPaddingPct",
];
const QUALITY_KEYS = ["sharpness", "occlusion", "glare", "resolutionAdequacy"];
const EVIDENCE_KEYS = [
  "bodySilhouette", "proportions", "headlampGeometry", "taillampGeometry",
  "frontPanelGeometry", "bumperGeometry", "windowAndRoofline", "wheelDesign",
  "mirrorsAndHandles", "trimPlacement", "roofEquipment",
];
const ISSUE_KEYS = ["code", "severity", "message"];

function isScore01(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

export function validateAnalyzerResponse(
  raw: unknown,
): { ok: true; response: Record<string, unknown> } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const fail = () => ({ ok: false as const, issues });

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push("response must be an object");
    return fail();
  }
  const r = raw as Record<string, unknown>;

  const unknownKeys = exactKeys(r, RESPONSE_KEYS);
  if (unknownKeys.length > 0) issues.push(`unknown keys: ${unknownKeys.join(", ")}`);
  if (r.schemaVersion !== ANALYZER_SCHEMA_VERSION) issues.push("schemaVersion mismatch");
  if (typeof r.vehicleDetected !== "boolean") issues.push("vehicleDetected must be boolean");
  if (typeof r.mirroredSuspected !== "boolean") issues.push("mirroredSuspected must be boolean");

  if (
    r.vehicleClass !== null &&
    !(REFERENCE_V2_VEHICLE_CLASSES as readonly string[]).includes(
      r.vehicleClass as string,
    )
  ) {
    issues.push("vehicleClass is not a known visual vehicle class");
  }

  const entry =
    r.canonicalPerspectiveId === null
      ? null
      : typeof r.canonicalPerspectiveId === "string"
        ? getReferenceV2MasterEntry(r.canonicalPerspectiveId)
        : undefined;
  if (entry === undefined) {
    issues.push("canonicalPerspectiveId is not part of PerspectiveMaster v1");
  }

  if (!isScore01(r.perspectiveConfidence)) issues.push("perspectiveConfidence out of range");
  if (!isScore01(r.classificationConfidence)) issues.push("classificationConfidence out of range");
  if (r.sameVehicleConfidence !== null && !isScore01(r.sameVehicleConfidence)) {
    issues.push("sameVehicleConfidence out of range");
  }

  if (
    r.azimuthDeg !== null &&
    !(typeof r.azimuthDeg === "number" && r.azimuthDeg > -180 && r.azimuthDeg <= 180)
  ) {
    issues.push("azimuthDeg out of range");
  }
  if (
    r.pitchDeg !== null &&
    !(typeof r.pitchDeg === "number" && r.pitchDeg >= -90 && r.pitchDeg <= 90)
  ) {
    issues.push("pitchDeg out of range");
  }
  if (
    r.elevationProfile !== null &&
    !(REFERENCE_V2_ELEVATION_PROFILES as readonly string[]).includes(
      r.elevationProfile as string,
    )
  ) {
    issues.push("elevationProfile is not a known profile");
  }

  // visibility
  const vis = r.visibility;
  if (!vis || typeof vis !== "object" || Array.isArray(vis)) {
    issues.push("visibility must be an object");
  } else {
    const v = vis as Record<string, unknown>;
    const extra = exactKeys(v, VISIBILITY_KEYS);
    if (extra.length > 0) issues.push(`visibility unknown keys: ${extra.join(", ")}`);
    for (const k of ["front", "rear", "leftSide", "rightSide", "roof"]) {
      if (!isScore01(v[k])) issues.push(`visibility.${k} out of range`);
    }
    if (!v.surfaces || typeof v.surfaces !== "object" || Array.isArray(v.surfaces)) {
      issues.push("visibility.surfaces must be an object");
    } else {
      for (const [k, val] of Object.entries(v.surfaces as Record<string, unknown>)) {
        if (!(REFERENCE_V2_VISUAL_SURFACES as readonly string[]).includes(k)) {
          issues.push(`visibility.surfaces unknown surface "${k}"`);
        }
        if (!isScore01(val)) issues.push(`visibility.surfaces.${k} out of range`);
      }
    }
  }

  // framing
  const fr = r.framing;
  if (!fr || typeof fr !== "object" || Array.isArray(fr)) {
    issues.push("framing must be an object");
  } else {
    const f = fr as Record<string, unknown>;
    const extra = exactKeys(f, FRAMING_KEYS);
    if (extra.length > 0) issues.push(`framing unknown keys: ${extra.join(", ")}`);
    if (typeof f.fullVehicleVisible !== "boolean") issues.push("framing.fullVehicleVisible must be boolean");
    if (typeof f.cropped !== "boolean") issues.push("framing.cropped must be boolean");
    if (
      typeof f.estimatedPaddingPct !== "number" ||
      f.estimatedPaddingPct < 0 ||
      f.estimatedPaddingPct > 60
    ) {
      issues.push("framing.estimatedPaddingPct out of range");
    }
    if (!Array.isArray(f.visibleWheelPositions)) {
      issues.push("framing.visibleWheelPositions must be an array");
    } else {
      for (const w of f.visibleWheelPositions) {
        if (!(REFERENCE_V2_WHEEL_POSITIONS as readonly string[]).includes(w as string)) {
          issues.push(`framing.visibleWheelPositions contains unknown "${String(w)}"`);
        }
      }
    }
  }

  // quality
  const q = r.quality;
  if (!q || typeof q !== "object" || Array.isArray(q)) {
    issues.push("quality must be an object");
  } else {
    const qq = q as Record<string, unknown>;
    const extra = exactKeys(qq, QUALITY_KEYS);
    if (extra.length > 0) issues.push(`quality unknown keys: ${extra.join(", ")}`);
    for (const k of QUALITY_KEYS) {
      if (!isScore01(qq[k])) issues.push(`quality.${k} out of range`);
    }
  }

  // identity evidence
  const ev = r.identityEvidence;
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) {
    issues.push("identityEvidence must be an object");
  } else {
    const e = ev as Record<string, unknown>;
    const extra = exactKeys(e, EVIDENCE_KEYS);
    if (extra.length > 0) issues.push(`identityEvidence unknown keys: ${extra.join(", ")}`);
    for (const [k, val] of Object.entries(e)) {
      if (typeof val !== "string" || val.length < 1 || val.length > 240) {
        issues.push(`identityEvidence.${k} must be a short descriptive string`);
      }
    }
  }

  // issues
  if (!Array.isArray(r.issues)) {
    issues.push("issues must be an array");
  } else if (r.issues.length > 12) {
    issues.push("issues array too long");
  } else {
    for (const [i, it] of r.issues.entries()) {
      if (!it || typeof it !== "object" || Array.isArray(it)) {
        issues.push(`issues[${i}] must be an object`);
        continue;
      }
      const rec = it as Record<string, unknown>;
      const extra = exactKeys(rec, ISSUE_KEYS);
      if (extra.length > 0) issues.push(`issues[${i}] unknown keys: ${extra.join(", ")}`);
      if (typeof rec.code !== "string" || rec.code.length < 1 || rec.code.length > 64) {
        issues.push(`issues[${i}].code invalid`);
      }
      if (!(REFERENCE_V2_ISSUE_SEVERITIES as readonly string[]).includes(rec.severity as string)) {
        issues.push(`issues[${i}].severity invalid`);
      }
      if (typeof rec.message !== "string" || rec.message.length < 1 || rec.message.length > 240) {
        issues.push(`issues[${i}].message invalid`);
      }
    }
  }

  // a detected vehicle must always carry a detected class (no optimistic null)
  if (r.vehicleDetected === true && r.vehicleClass === null) {
    issues.push("a detected vehicle must carry a detected vehicleClass");
  }

  // detected class must actually allow the chosen perspective
  if (entry && typeof r.vehicleClass === "string") {
    if (!entry.vehicleClasses.includes(r.vehicleClass)) {
      issues.push(
        `perspective ${entry.id} is not applicable to detected class ${r.vehicleClass}`,
      );
    }
  }

  // a chosen perspective must carry the fields needed to validate it
  if (entry) {
    if (entry.azimuthDeg !== null && typeof r.azimuthDeg !== "number") {
      issues.push(`perspective ${entry.id} requires a numeric azimuthDeg`);
    }
    if (typeof r.elevationProfile !== "string") {
      issues.push(`perspective ${entry.id} requires an elevationProfile`);
    }
    if (r.vehicleDetected !== true) {
      issues.push("a canonical perspective requires vehicleDetected = true");
    }
    // Non-core required surfaces MUST be reported explicitly (value may be 0);
    // omission is invalid analyzer JSON. Phase-1 governance judges usability.
    const surfaces =
      vis && typeof vis === "object" && !Array.isArray(vis)
        ? (vis as Record<string, unknown>).surfaces
        : undefined;
    const surfaceMap =
      surfaces && typeof surfaces === "object" && !Array.isArray(surfaces)
        ? (surfaces as Record<string, unknown>)
        : undefined;
    for (const surface of entry.requiredVisibleSurfaces) {
      if (CORE_VISIBILITY_SURFACES.includes(surface)) continue;
      if (!surfaceMap || surfaceMap[surface] === undefined) {
        issues.push(
          `visibility.surfaces.${surface} is required for perspective ${entry.id}`,
        );
      }
    }
  }


  if (issues.length > 0) return fail();
  return { ok: true, response: r };
}
