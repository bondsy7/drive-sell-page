import { z } from "zod";
import { VehicleClassV2Schema } from "./vehicle-classes";
import { VisualSurfaceSchema, WheelPositionSchema } from "./surfaces";
import {
  ElevationProfileSchema,
  PerspectiveIdSchema,
} from "./perspectives/types";

/**
 * Reference V2 — Vision Intake Schemas (Phase 0).
 *
 * Strukturiertes Analyseergebnis EINES Referenzbildes. Provider-unabhaengig:
 * Das Schema beschreibt nur, WAS eine Analyse liefern muss — nicht, welches
 * Modell sie erzeugt. Enthaelt bewusst KEINE Business-Metadaten (keine Marke,
 * kein Modell, kein Baujahr, keine VIN).
 *
 * Visibility-Scores sind 0..1, hoch = gut sichtbar.
 * Quality-Semantik ist EXPLIZIT gemischt und hier verbindlich definiert:
 *   sharpness, resolutionAdequacy, usableScore: 0..1, HOCH = GUT.
 *   occlusion, glare: SEVERITY 0..1 — 0 = keine Verdeckung / kein Glare,
 *   1 = starke Verdeckung / starkes Glare (hoch = SCHLECHT).
 */

const Score01Schema = z.number().min(0).max(1);

export const INTAKE_ISSUE_SEVERITIES = ["critical", "major", "minor"] as const;
export type IntakeIssueSeverity = (typeof INTAKE_ISSUE_SEVERITIES)[number];

/** Empfohlene, aber nicht abschliessende Issue-Codes. */
export const KNOWN_INTAKE_ISSUE_CODES = [
  "NO_VEHICLE",
  "MULTIPLE_VEHICLES",
  "LOW_RESOLUTION",
  "HEAVY_OCCLUSION",
  "STRONG_GLARE",
  "MIRRORED_SUSPECTED",
  "CROPPED_VEHICLE",
  "IDENTITY_MISMATCH",
  "FILE_UNAVAILABLE",
] as const;

export const VisionIntakeIssueSchema = z
  .object({
    code: z.string().min(1),
    severity: z.enum(INTAKE_ISSUE_SEVERITIES),
    message: z.string().min(1),
  })
  .strict();
export type VisionIntakeIssue = z.infer<typeof VisionIntakeIssueSchema>;

export const VisionIntakePoseSchema = z
  .object({
    canonicalPerspectiveId: PerspectiveIdSchema.optional(),
    azimuthDeg: z.number().gt(-180).max(180).optional(),
    pitchDeg: z.number().min(-90).max(90).optional(),
    rollDeg: z.number().gt(-180).max(180).optional(),
    elevationProfile: ElevationProfileSchema.optional(),
  })
  .strict();
export type VisionIntakePose = z.infer<typeof VisionIntakePoseSchema>;

export const VisionIntakeVisibilitySchema = z
  .object({
    front: Score01Schema,
    rear: Score01Schema,
    leftSide: Score01Schema,
    rightSide: Score01Schema,
    roof: Score01Schema,
    /** Zusaetzliche Interior-/Detail-Flaechen mit Sichtbarkeits-Scores. */
    surfaces: z.record(VisualSurfaceSchema, Score01Schema).optional(),
  })
  .strict();
export type VisionIntakeVisibility = z.infer<typeof VisionIntakeVisibilitySchema>;

export const VisionIntakeFramingSchema = z
  .object({
    fullVehicleVisible: z.boolean(),
    cropped: z.boolean(),
    visibleWheelPositions: z.array(WheelPositionSchema),
  })
  .strict();
export type VisionIntakeFraming = z.infer<typeof VisionIntakeFramingSchema>;

export const VisionIntakeQualitySchema = z
  .object({
    /** hoch = gut */
    sharpness: Score01Schema,
    /** SEVERITY: 0 = keine Verdeckung, 1 = stark verdeckt */
    occlusion: Score01Schema,
    /** SEVERITY: 0 = kein Glare, 1 = starkes Glare */
    glare: Score01Schema,
    /** hoch = gut */
    resolutionAdequacy: Score01Schema,
    /** hoch = gut */
    usableScore: Score01Schema,
  })
  .strict();
export type VisionIntakeQuality = z.infer<typeof VisionIntakeQualitySchema>;

export const VisionIntakeManualOverrideSchema = z
  .object({
    canonicalPerspectiveId: PerspectiveIdSchema.optional(),
    vehicleClass: VehicleClassV2Schema.optional(),
    sameVehicleConfirmed: z.boolean().optional(),
    reason: z.string().min(1).optional(),
    overriddenBy: z.string().min(1).optional(),
    overriddenAtIso: z.string().min(1).optional(),
  })
  .strict();
export type VisionIntakeManualOverride = z.infer<
  typeof VisionIntakeManualOverrideSchema
>;

export const VisionIntakeResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    assetId: z.string().min(1),
    vehicleDetected: z.boolean(),
    vehicleClass: VehicleClassV2Schema.optional(),
    /** Cluster-ID fuer "gleiches physisches Fahrzeug" ueber mehrere Bilder. */
    identityClusterId: z.string().min(1).optional(),
    sameVehicleConfidence: Score01Schema.optional(),
    pose: VisionIntakePoseSchema,
    visibility: VisionIntakeVisibilitySchema,
    framing: VisionIntakeFramingSchema,
    quality: VisionIntakeQualitySchema,
    classificationConfidence: Score01Schema,
    issues: z.array(VisionIntakeIssueSchema),
    manualOverride: VisionIntakeManualOverrideSchema.optional(),
  })
  .strict();
export type VisionIntakeResult = z.infer<typeof VisionIntakeResultSchema>;

export function parseVisionIntakeResult(input: unknown): VisionIntakeResult {
  return VisionIntakeResultSchema.parse(input);
}
