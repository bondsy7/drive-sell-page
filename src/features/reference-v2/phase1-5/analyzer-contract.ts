import { z } from "zod";
import { VehicleClassV2Schema } from "../domain/vehicle-classes";
import { VisualSurfaceSchema, WheelPositionSchema } from "../domain/surfaces";
import {
  ElevationProfileSchema,
  PerspectiveIdSchema,
  type PerspectiveId,
} from "../domain/perspectives/types";
import { getPerspectiveSpec } from "../domain/perspectives/registry";
import {
  INTAKE_ISSUE_SEVERITIES,
  type VisionIntakeResult,
} from "../domain/vision-intake";

/**
 * Reference V2 — Phase 1.5: Automatic Vision Intake Contract.
 *
 * PRODUKTPRINZIP (Grenze zur Business-Welt):
 * The reference image defines WHAT the vehicle is. Metadata only describes
 * what we know ABOUT it. Metadata must never override visible vehicle identity.
 *
 * Dieser Vertrag beschreibt ausschliesslich SICHTBARE Morphologie. Marke,
 * Modell, Variante, Baujahr, Facelift/Generation, VIN und kommerzielle Titel
 * existieren in diesem Schema nicht — weder als Eingabe noch als Ausgabe.
 * Das Ergebnis wird deterministisch in das Phase-0-`VisionIntakeResult`
 * normalisiert; es gibt KEIN konkurrierendes Perspektiven-/Klassen-Schema.
 */

export const ANALYZER_SCHEMA_VERSION = "reference-v2-vision-1" as const;

/** Unterhalb dieser Klassifikationssicherheit ist eine Aufnahme nicht verwertbar. */
export const MIN_CLASSIFICATION_CONFIDENCE = 0.7;
/** Unterhalb dieser Identitaetssicherheit gilt ein Identitaetskonflikt. */
export const MIN_SAME_VEHICLE_CONFIDENCE = 0.75;

const Score01Schema = z.number().min(0).max(1);

// --------------------------------------------------------------------------
// Semantic firewall
// --------------------------------------------------------------------------

/** Schluessel, die niemals in Analyzer-Request oder -Response auftauchen duerfen. */
export const FORBIDDEN_SEMANTIC_KEYS = [
  "make",
  "brand",
  "manufacturer",
  "marke",
  "hersteller",
  "model",
  "modell",
  "modelname",
  "variant",
  "trim",
  "ausstattung",
  "generation",
  "facelift",
  "modelyear",
  "year",
  "baujahr",
  "vin",
  "fin",
  "chassisnumber",
  "fahrgestellnummer",
  "title",
  "vehicletitle",
  "commercialtitle",
  "listingtitle",
  "price",
  "preis",
] as const;

/**
 * Inhaltliche Muster, die auf semantische Identitaet hindeuten. Rein lexikalisch
 * (keine Markenlisten): erkannt werden Jahreszahlen, VIN-Muster sowie explizite
 * Identitaets-Vokabeln in EN/DE.
 */
const FORBIDDEN_VALUE_PATTERNS: readonly RegExp[] = [
  /\b(19|20)\d{2}\b/, // Baujahr / Modelljahr
  /\b[A-HJ-NPR-Z0-9]{17}\b/, // VIN
  /\b(brand|make|manufacturer|marque|model|models|modelname|model\s?year|model\s?range|model\s?line|trim|trim\s?level|facelift|generation|badge\s?name|nameplate|vin)\b/i,
  /\b(marke|hersteller|modell|modellname|modelljahr|modellreihe|baujahr|ausstattungslinie|typbezeichnung|fahrgestellnummer)\b/i,
];


export class SemanticFirewallError extends Error {
  readonly violations: readonly string[];
  constructor(violations: readonly string[]) {
    super(`Semantic firewall violation: ${violations.join("; ")}`);
    this.name = "SemanticFirewallError";
    this.violations = violations;
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

function walk(
  value: unknown,
  path: string,
  violations: string[],
  depth = 0,
): void {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`, violations, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nk = normalizeKey(k);
      if ((FORBIDDEN_SEMANTIC_KEYS as readonly string[]).includes(nk)) {
        violations.push(`forbidden key "${path ? `${path}.` : ""}${k}"`);
      }
      walk(v, path ? `${path}.${k}` : k, violations, depth + 1);
    }
    return;
  }
  if (typeof value === "string") {
    for (const re of FORBIDDEN_VALUE_PATTERNS) {
      if (re.test(value)) {
        violations.push(`forbidden semantic content at "${path}"`);
        break;
      }
    }
  }
}

/**
 * Fail-closed Firewall: wirft, sobald irgendwo im Objektbaum ein verbotener
 * Identitaets-Schluessel oder -Inhalt auftaucht. Wird sowohl auf ausgehende
 * Requests als auch auf Provider-Responses angewendet.
 */
export function assertNoSemanticIdentity(value: unknown, label = "payload"): void {
  const violations: string[] = [];
  walk(value, "", violations);
  if (violations.length > 0) {
    throw new SemanticFirewallError(violations.map((v) => `${label}: ${v}`));
  }
}

// --------------------------------------------------------------------------
// Visual identity evidence (QA / same-vehicle comparison)
// --------------------------------------------------------------------------

const EvidenceTextSchema = z.string().min(1).max(240);

export const VisualIdentityEvidenceSchema = z
  .object({
    bodySilhouette: EvidenceTextSchema.optional(),
    proportions: EvidenceTextSchema.optional(),
    headlampGeometry: EvidenceTextSchema.optional(),
    taillampGeometry: EvidenceTextSchema.optional(),
    frontPanelGeometry: EvidenceTextSchema.optional(),
    bumperGeometry: EvidenceTextSchema.optional(),
    windowAndRoofline: EvidenceTextSchema.optional(),
    wheelDesign: EvidenceTextSchema.optional(),
    mirrorsAndHandles: EvidenceTextSchema.optional(),
    trimPlacement: EvidenceTextSchema.optional(),
    roofEquipment: EvidenceTextSchema.optional(),
  })
  .strict();
export type VisualIdentityEvidence = z.infer<typeof VisualIdentityEvidenceSchema>;

// --------------------------------------------------------------------------
// Analyzer response
// --------------------------------------------------------------------------

/**
 * Die fuenf globalen Sichtbarkeitsfelder — sie werden nicht in
 * `visibility.surfaces` erwartet, sondern als eigene Felder gefuehrt.
 */
export const CORE_VISIBILITY_SURFACES: readonly string[] = [
  "front",
  "rear",
  "left_side",
  "right_side",
  "roof",
];

export const AnalyzerIssueSchema = z
  .object({
    code: z.string().min(1).max(64),
    severity: z.enum(INTAKE_ISSUE_SEVERITIES),
    message: z.string().min(1).max(240),
  })
  .strict();
export type AnalyzerIssue = z.infer<typeof AnalyzerIssueSchema>;

export const AnalyzerVisionResponseSchema = z
  .object({
    schemaVersion: z.literal(ANALYZER_SCHEMA_VERSION),
    vehicleDetected: z.boolean(),
    vehicleClass: VehicleClassV2Schema.nullable(),
    canonicalPerspectiveId: PerspectiveIdSchema.nullable(),
    perspectiveConfidence: Score01Schema,
    azimuthDeg: z.number().gt(-180).max(180).nullable(),
    pitchDeg: z.number().min(-90).max(90).nullable(),
    elevationProfile: ElevationProfileSchema.nullable(),
    visibility: z
      .object({
        front: Score01Schema,
        rear: Score01Schema,
        leftSide: Score01Schema,
        rightSide: Score01Schema,
        roof: Score01Schema,
        surfaces: z.record(VisualSurfaceSchema, Score01Schema),
      })
      .strict(),
    framing: z
      .object({
        fullVehicleVisible: z.boolean(),
        cropped: z.boolean(),
        visibleWheelPositions: z.array(WheelPositionSchema),
        estimatedPaddingPct: z.number().min(0).max(60),
      })
      .strict(),
    quality: z
      .object({
        /** hoch = gut */
        sharpness: Score01Schema,
        /** SEVERITY: 0 = keine Verdeckung, 1 = stark verdeckt */
        occlusion: Score01Schema,
        /** SEVERITY: 0 = kein Glare, 1 = starkes Glare */
        glare: Score01Schema,
        resolutionAdequacy: Score01Schema,
      })
      .strict(),
    mirroredSuspected: z.boolean(),
    classificationConfidence: Score01Schema,
    /** Nur gesetzt, wenn Anker-Referenzen mitgegeben wurden. */
    sameVehicleConfidence: Score01Schema.nullable(),
    identityEvidence: VisualIdentityEvidenceSchema,
    issues: z.array(AnalyzerIssueSchema).max(12),
  })
  .strict()
  // Fail-closed Querbedingungen — identisch zur serverseitigen Validierung:
  // ein erkanntes Fahrzeug MUSS eine Klasse haben, und eine gesetzte
  // kanonische Perspektive MUSS durch Winkelangaben belegt sein.
  .superRefine((r, ctx) => {
    if (r.vehicleDetected && r.vehicleClass === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vehicleClass"],
        message: "vehicleClass is required when vehicleDetected is true",
      });
    }
    if (!r.vehicleDetected && r.canonicalPerspectiveId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["canonicalPerspectiveId"],
        message: "canonicalPerspectiveId must be null when no vehicle is detected",
      });
    }
    if (r.canonicalPerspectiveId !== null) {
      // Single source of truth: Phase-0 Perspective Registry.
      const spec = getPerspectiveSpec(r.canonicalPerspectiveId);
      if (spec.pose.azimuthDeg !== undefined && r.azimuthDeg === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["azimuthDeg"],
          message: "azimuthDeg is required when a canonical perspective is chosen",
        });
      }
      if (r.elevationProfile === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["elevationProfile"],
          message: "elevationProfile is required when a canonical perspective is chosen",
        });
      }
      for (const surface of spec.requiredVisibleSurfaces) {
        if (CORE_VISIBILITY_SURFACES.includes(surface)) continue;
        if (!Object.prototype.hasOwnProperty.call(r.visibility.surfaces, surface)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["visibility", "surfaces", surface],
            message: `visibility.surfaces.${surface} is required for perspective ${spec.id}`,
          });
        }
      }

    }
  });
export type AnalyzerVisionResponse = z.infer<typeof AnalyzerVisionResponseSchema>;


export class AnalyzerResponseError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Analyzer response invalid: ${issues.join("; ")}`);
    this.name = "AnalyzerResponseError";
    this.issues = issues;
  }
}

/** Strikte Validierung inkl. Firewall. Niemals optimistische Defaults. */
export function parseAnalyzerResponse(raw: unknown): AnalyzerVisionResponse {
  assertNoSemanticIdentity(raw, "analyzer response");
  const parsed = AnalyzerVisionResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AnalyzerResponseError(
      parsed.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    );
  }
  return parsed.data;
}

// --------------------------------------------------------------------------
// Normalisierung in den Phase-0-Vertrag
// --------------------------------------------------------------------------

export interface NormalizeOptions {
  readonly assetId: string;
  /** Cluster des Vehicle Masters — nur zur Zuordnung, nie an den Provider. */
  readonly identityClusterId: string;
  /** true, wenn bereits akzeptierte Anker existierten. */
  readonly anchorsProvided: boolean;
}

export function normalizeToVisionIntake(
  response: AnalyzerVisionResponse,
  opts: NormalizeOptions,
): VisionIntakeResult {
  const identityConflict =
    opts.anchorsProvided &&
    response.sameVehicleConfidence !== null &&
    response.sameVehicleConfidence < MIN_SAME_VEHICLE_CONFIDENCE;

  const usableScore = Math.max(
    0,
    Math.min(
      1,
      (response.quality.sharpness + response.quality.resolutionAdequacy) / 2 -
        response.quality.occlusion / 2 -
        response.quality.glare / 4,
    ),
  );

  return {
    schemaVersion: 1,
    assetId: opts.assetId,
    vehicleDetected: response.vehicleDetected,
    ...(response.vehicleClass ? { vehicleClass: response.vehicleClass } : {}),
    identityClusterId: identityConflict
      ? `foreign_${opts.assetId}`
      : opts.identityClusterId,
    ...(response.sameVehicleConfidence !== null
      ? { sameVehicleConfidence: response.sameVehicleConfidence }
      : {}),
    pose: {
      ...(response.canonicalPerspectiveId
        ? { canonicalPerspectiveId: response.canonicalPerspectiveId }
        : {}),
      ...(response.azimuthDeg !== null ? { azimuthDeg: response.azimuthDeg } : {}),
      ...(response.pitchDeg !== null ? { pitchDeg: response.pitchDeg } : {}),
      ...(response.elevationProfile
        ? { elevationProfile: response.elevationProfile }
        : {}),
    },
    visibility: {
      front: response.visibility.front,
      rear: response.visibility.rear,
      leftSide: response.visibility.leftSide,
      rightSide: response.visibility.rightSide,
      roof: response.visibility.roof,
      surfaces: response.visibility.surfaces,
    },
    framing: {
      fullVehicleVisible: response.framing.fullVehicleVisible,
      cropped: response.framing.cropped,
      visibleWheelPositions: response.framing.visibleWheelPositions,
    },
    quality: {
      sharpness: response.quality.sharpness,
      occlusion: response.quality.occlusion,
      glare: response.quality.glare,
      resolutionAdequacy: response.quality.resolutionAdequacy,
      usableScore,
    },
    classificationConfidence: response.classificationConfidence,
    issues: [
      ...response.issues,
      ...(response.mirroredSuspected
        ? [
            {
              code: "MIRRORED_SUSPECTED",
              severity: "critical" as const,
              message: "Aufnahme wirkt gespiegelt / seitenverkehrt.",
            },
          ]
        : []),
      ...(response.vehicleDetected
        ? []
        : [
            {
              code: "NO_VEHICLE",
              severity: "critical" as const,
              message: "Kein Fahrzeug im Bild erkannt.",
            },
          ]),
      ...(identityConflict
        ? [
            {
              code: "IDENTITY_MISMATCH",
              severity: "critical" as const,
              message: "Sichtbare Morphologie weicht von den Ankerreferenzen ab.",
            },
          ]
        : []),
    ],
  };
}

// --------------------------------------------------------------------------
// Phase-1.5-Gate (vor der Phase-1-Governance)
// --------------------------------------------------------------------------

export const AUTOMATIC_GATE_CODES = [
  "ANALYSIS_UNAVAILABLE",
  "NO_VEHICLE",
  "PERSPECTIVE_UNDETERMINED",
  "LOW_CLASSIFICATION_CONFIDENCE",
  "MIRRORED_SUSPECTED",
  "IDENTITY_CONFLICT",
  "VEHICLE_CLASS_MISMATCH",
] as const;
export type AutomaticGateCode = (typeof AUTOMATIC_GATE_CODES)[number];

export const AUTOMATIC_GATE_LABELS_DE: Record<AutomaticGateCode, string> = {
  ANALYSIS_UNAVAILABLE: "KI-Analyse nicht verfügbar",
  NO_VEHICLE: "Kein Fahrzeug erkannt",
  PERSPECTIVE_UNDETERMINED: "Perspektive nicht eindeutig bestimmbar",
  LOW_CLASSIFICATION_CONFIDENCE: "Analyse zu unsicher",
  MIRRORED_SUSPECTED: "Bild gespiegelt / seitenverkehrt",
  IDENTITY_CONFLICT: "Anderes Fahrzeug (Identitätskonflikt)",
  VEHICLE_CLASS_MISMATCH: "Falsche Fahrzeugklasse",
};

export interface AutomaticGateInput {
  readonly response: AnalyzerVisionResponse;
  readonly expectedVehicleClass: string;
  readonly anchorsProvided: boolean;
}

/**
 * Fail-closed Vorschaltung: Ergebnisse, die diese Pruefung nicht bestehen,
 * duerfen die Phase-1-Ingestion gar nicht erst erreichen und werden niemals
 * Referenzkandidat.
 */
export function evaluateAutomaticGate(
  input: AutomaticGateInput,
): readonly AutomaticGateCode[] {
  const r = input.response;
  const codes: AutomaticGateCode[] = [];
  if (!r.vehicleDetected) codes.push("NO_VEHICLE");
  if (!r.canonicalPerspectiveId) codes.push("PERSPECTIVE_UNDETERMINED");
  if (
    r.classificationConfidence < MIN_CLASSIFICATION_CONFIDENCE ||
    r.perspectiveConfidence < MIN_CLASSIFICATION_CONFIDENCE
  ) {
    codes.push("LOW_CLASSIFICATION_CONFIDENCE");
  }
  if (r.mirroredSuspected) codes.push("MIRRORED_SUSPECTED");
  if (r.vehicleClass && r.vehicleClass !== input.expectedVehicleClass) {
    codes.push("VEHICLE_CLASS_MISMATCH");
  }
  if (
    input.anchorsProvided &&
    (r.sameVehicleConfidence === null ||
      r.sameVehicleConfidence < MIN_SAME_VEHICLE_CONFIDENCE)
  ) {
    codes.push("IDENTITY_CONFLICT");
  }
  return codes;
}

/** Perspektiven-IDs, die dem Modell als geschlossene Auswahl gegeben werden. */
export function perspectiveChoiceList(
  ids: readonly PerspectiveId[],
): readonly PerspectiveId[] {
  return [...ids];
}
