import { z } from "zod";
import { VehicleClassV2Schema, type VehicleClassV2 } from "../vehicle-classes";
import {
  VisualSurfaceSchema,
  WheelPositionSchema,
  type VisualSurface,
  type WheelPosition,
} from "../surfaces";

/**
 * Reference V2 — Perspective Registry Types (Phase 0).
 *
 * Zentrale, versionsfaehige Registry. Jede Spec ist eine unveraenderliche,
 * versionierte Definition. Aenderungen an einer Spec erfordern einen
 * Versionssprung, niemals stilles Ueberschreiben.
 */

export const PERSPECTIVE_CATEGORIES = [
  "standard_exterior",
  "hero",
  "low_angle",
  "elevated",
  "interior",
  "detail",
] as const;
export type PerspectiveCategory = (typeof PERSPECTIVE_CATEGORIES)[number];
export const PerspectiveCategorySchema = z.enum(PERSPECTIVE_CATEGORIES);

export const ELEVATION_PROFILES = [
  "low",
  "standard",
  "elevated",
  "interior",
  "close_detail",
] as const;
export type ElevationProfile = (typeof ELEVATION_PROFILES)[number];
export const ElevationProfileSchema = z.enum(ELEVATION_PROFILES);

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const RiskLevelSchema = z.enum(RISK_LEVELS);

/**
 * Richtung, in die die Fahrzeugfront im Bild zeigt.
 * Konvention laut Spezifikation:
 *   EXT_SIDE_RIGHT (+90°, rechte Fahrzeugseite sichtbar): Front im Bild nach LINKS.
 *   EXT_SIDE_LEFT  (-90°, linke Fahrzeugseite sichtbar):  Front im Bild nach RECHTS.
 */
export const VEHICLE_FRONT_IMAGE_DIRECTIONS = [
  "left",
  "right",
  "toward_camera",
  "away_from_camera",
  "not_applicable",
] as const;
export type VehicleFrontImageDirection =
  (typeof VEHICLE_FRONT_IMAGE_DIRECTIONS)[number];
export const VehicleFrontImageDirectionSchema = z.enum(
  VEHICLE_FRONT_IMAGE_DIRECTIONS,
);

export const PERSPECTIVE_IDS = [
  // STANDARD EXTERIOR
  "EXT_FRONT",
  "EXT_34_FRONT_RIGHT",
  "EXT_SIDE_RIGHT",
  "EXT_34_REAR_RIGHT",
  "EXT_REAR",
  "EXT_34_REAR_LEFT",
  "EXT_SIDE_LEFT",
  "EXT_34_FRONT_LEFT",
  // HERO (Output-Keys mit basePerspective-Bezug, keine neue Geometrie)
  "HERO_FRONT_LEFT",
  "HERO_FRONT_RIGHT",
  "HERO_FRONT_CENTER",
  "HERO_REAR_LEFT",
  "HERO_REAR_RIGHT",
  // LOW ANGLE
  "LOW_FRONT",
  "LOW_FRONT_LEFT",
  "LOW_FRONT_RIGHT",
  "LOW_REAR",
  "LOW_REAR_LEFT",
  "LOW_REAR_RIGHT",
  // ELEVATED
  "HIGH_FRONT",
  "HIGH_FRONT_LEFT",
  "HIGH_FRONT_RIGHT",
  "HIGH_REAR",
  "HIGH_REAR_LEFT",
  "HIGH_REAR_RIGHT",
  // INTERIOR
  "INT_DRIVER_POV",
  "INT_DASH_CENTER",
  "INT_WIDE_CABIN",
  "INT_PASSENGER_DASH",
  "INT_FRONT_SEATS",
  "INT_REAR_FROM_FRONT",
  "INT_REAR_LEFT_DOOR",
  "INT_REAR_RIGHT_DOOR",
  "INT_CARGO",
  "INT_CARGO_34",
  "INT_CENTER_CONSOLE",
  "INT_ROOF",
  // DETAIL
  "DET_HEADLIGHT_LEFT",
  "DET_HEADLIGHT_RIGHT",
  "DET_TAILLIGHT_LEFT",
  "DET_TAILLIGHT_RIGHT",
  "DET_GRILLE",
  "DET_FRONT_BADGE",
  "DET_REAR_BADGE",
  "DET_WHEEL_FRONT_LEFT",
  "DET_WHEEL_FRONT_RIGHT",
  "DET_WHEEL_REAR_LEFT",
  "DET_WHEEL_REAR_RIGHT",
  "DET_STEERING_WHEEL",
  "DET_CLUSTER",
  "DET_INFOTAINMENT",
  "DET_CENTER_CONSOLE",
  "DET_DOOR_LEFT",
  "DET_DOOR_RIGHT",
  "DET_CHARGE_PORT",
  "DET_FUEL_FLAP",
  "DET_ROOF",
] as const;

export type PerspectiveId = (typeof PERSPECTIVE_IDS)[number];
export const PerspectiveIdSchema = z.enum(PERSPECTIVE_IDS);

export interface PerspectivePose {
  /** Fahrzeugrelativer Kamera-Azimut, (-180, 180]. Undefiniert bei Interior/Detail (semantische Constraints statt erfundener Praezision). */
  readonly azimuthDeg?: number;
  /**
   * GENERATIONSTOLERANZ: Spielraum, der dem Bildmodell im Prompt zugestanden
   * wird. Strikt getrennt von der Validationstoleranz
   * (validationRules.maxAzimuthErrorDeg), die immer >= dieser Toleranz ist.
   */
  readonly azimuthToleranceDeg?: number;
  /** Hoehenprofil der Kamera — bestimmt u. a. Scene-Plate-Kompatibilitaet. */
  readonly elevationProfile: ElevationProfile;
  /** Kamera-Pitch: positiv = nach oben geneigt, negativ = nach unten. */
  readonly pitchDeg?: number;
  readonly pitchToleranceDeg?: number;
}

export interface OrientationRules {
  /** Immer fahrzeugrelativ — niemals Betrachterseite, niemals LHD/RHD. */
  readonly sideConvention: "vehicle_relative";
  readonly vehicleFrontImageDirection?: VehicleFrontImageDirection;
  readonly notes?: string;
}

export interface FramingSpec {
  readonly fullVehicle: boolean;
  /** Mindest-Rand um das Motiv in % der Bildbreite/-hoehe. */
  readonly paddingMinPct: number;
  readonly paddingMaxPct: number;
  readonly requiredVisibleWheels: readonly WheelPosition[];
}

export interface CameraGuidance {
  readonly projection: "rectilinear";
  /** Reproduzierbarer Zielwert (KB-Aequivalent). */
  readonly targetFocalLengthMm: number;
  readonly focalLengthMinMm: number;
  readonly focalLengthMaxMm: number;
  /** Semantische Constraints — duerfen die visuelle Identitaet niemals veraendern. */
  readonly semanticConstraints: readonly string[];
}

export interface ReferenceRequirements {
  readonly exactReferencePreferred: boolean;
  readonly minimumUsableReferences: number;
  readonly allowedMultiReference: boolean;
  readonly requiredCoverageSurfaces: readonly VisualSurface[];
  /** 0..1 — Mindest-Qualitaetsscore der Primaerreferenz. */
  readonly minPrimaryQualityScore: number;
}

export interface ValidationRules {
  readonly mirrorForbidden: true;
  /**
   * Nur fuer side-sensitive Perspektiven true. Bei Front/Rear/Interior/Detail
   * ohne Seitenbezug ist die Seite fachlich N/A und darf nicht hart failen.
   */
  readonly sideMustMatch: boolean;
  /** VALIDATIONSTOLERANZ (post-generation QA), >= pose.azimuthToleranceDeg. */
  readonly maxAzimuthErrorDeg?: number;
  /** 0..100 */
  readonly minimumPerspectiveScore: number;
}


export interface PerspectiveSpec {
  readonly id: PerspectiveId;
  readonly version: number;
  readonly category: PerspectiveCategory;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly applicableVehicleClasses: readonly VehicleClassV2[];
  /** Nur fuer category "hero": HERO ist ein Output-Key auf Basis einer Standardperspektive, KEINE neue Fahrzeuggeometrie. */
  readonly basePerspectiveId?: PerspectiveId;
  readonly pose: PerspectivePose;
  readonly requiredVisibleSurfaces: readonly VisualSurface[];
  readonly forbiddenDominantSurfaces: readonly VisualSurface[];
  readonly orientationRules: OrientationRules;
  readonly framing: FramingSpec;
  readonly cameraGuidance: CameraGuidance;
  readonly referenceRequirements: ReferenceRequirements;
  readonly validationRules: ValidationRules;
  /** Risiko, dass die Perspektive Flaechen offenbart, die keine Referenz abdeckt. */
  readonly riskLevel: RiskLevel;
}

const AzimuthSchema = z.number().gt(-180).max(180);

export const PerspectivePoseSchema = z
  .object({
    azimuthDeg: AzimuthSchema.optional(),
    azimuthToleranceDeg: z.number().min(0).max(45).optional(),
    elevationProfile: ElevationProfileSchema,
    pitchDeg: z.number().min(-60).max(60).optional(),
    pitchToleranceDeg: z.number().min(0).max(30).optional(),
  })
  .strict();

export const OrientationRulesSchema = z
  .object({
    sideConvention: z.literal("vehicle_relative"),
    vehicleFrontImageDirection: VehicleFrontImageDirectionSchema.optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const FramingSpecSchema = z
  .object({
    fullVehicle: z.boolean(),
    paddingMinPct: z.number().min(0).max(40),
    paddingMaxPct: z.number().min(0).max(40),
    requiredVisibleWheels: z.array(WheelPositionSchema),
  })
  .strict()
  .refine((f) => f.paddingMinPct <= f.paddingMaxPct, {
    message: "paddingMinPct must be <= paddingMaxPct",
  });

export const CameraGuidanceSchema = z
  .object({
    projection: z.literal("rectilinear"),
    targetFocalLengthMm: z.number().positive(),
    focalLengthMinMm: z.number().positive(),
    focalLengthMaxMm: z.number().positive(),
    semanticConstraints: z.array(z.string().min(1)),
  })
  .strict()
  .refine((c) => c.focalLengthMinMm <= c.focalLengthMaxMm, {
    message: "focalLengthMinMm must be <= focalLengthMaxMm",
  })
  .refine(
    (c) =>
      c.targetFocalLengthMm >= c.focalLengthMinMm &&
      c.targetFocalLengthMm <= c.focalLengthMaxMm,
    { message: "targetFocalLengthMm must lie inside the allowed range" },
  )
  .refine((c) => c.focalLengthMaxMm / c.focalLengthMinMm <= 2, {
    message: "focal range must stay reproducible (max/min <= 2)",
  });


export const ReferenceRequirementsSchema = z
  .object({
    exactReferencePreferred: z.boolean(),
    minimumUsableReferences: z.number().int().min(1),
    allowedMultiReference: z.boolean(),
    requiredCoverageSurfaces: z.array(VisualSurfaceSchema),
    minPrimaryQualityScore: z.number().min(0).max(1),
  })
  .strict();

export const ValidationRulesSchema = z
  .object({
    mirrorForbidden: z.literal(true),
    sideMustMatch: z.boolean(),
    maxAzimuthErrorDeg: z.number().min(0).max(60).optional(),
    minimumPerspectiveScore: z.number().min(0).max(100),
  })
  .strict();

export const PerspectiveSpecSchema = z
  .object({
    id: PerspectiveIdSchema,
    version: z.number().int().min(1),
    category: PerspectiveCategorySchema,
    labelDe: z.string().min(1),
    labelEn: z.string().min(1),
    applicableVehicleClasses: z.array(VehicleClassV2Schema).nonempty(),
    basePerspectiveId: PerspectiveIdSchema.optional(),
    pose: PerspectivePoseSchema,
    requiredVisibleSurfaces: z.array(VisualSurfaceSchema).nonempty(),
    forbiddenDominantSurfaces: z.array(VisualSurfaceSchema),
    orientationRules: OrientationRulesSchema,
    framing: FramingSpecSchema,
    cameraGuidance: CameraGuidanceSchema,
    referenceRequirements: ReferenceRequirementsSchema,
    validationRules: ValidationRulesSchema,
    riskLevel: RiskLevelSchema,
  })
  .strict()
  .superRefine((spec, ctx) => {
    if (spec.category === "hero" && spec.basePerspectiveId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basePerspectiveId"],
        message: "hero perspectives must reference a basePerspectiveId",
      });
    }
    if (spec.category !== "hero" && spec.basePerspectiveId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["basePerspectiveId"],
        message: "only hero perspectives may reference a basePerspectiveId",
      });
    }
    const genTol = spec.pose.azimuthToleranceDeg;
    const valTol = spec.validationRules.maxAzimuthErrorDeg;
    if (spec.pose.azimuthDeg !== undefined) {
      if (genTol === undefined || valTol === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validationRules", "maxAzimuthErrorDeg"],
          message:
            "azimuth-based specs must define both generation and validation tolerance",
        });
      } else if (valTol < genTol) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validationRules", "maxAzimuthErrorDeg"],
          message:
            "validation tolerance must be >= generation tolerance (explicitly separated, never contradictory)",
        });
      } else if (valTol > genTol + 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["validationRules", "maxAzimuthErrorDeg"],
          message:
            "validation tolerance must stay within generation tolerance + 5 degrees",
        });
      }
    }
  });

/**
 * Side-Sensitivitaet ist perspektivabhaengig: Nur Specs, deren
 * Validationsregeln die Fahrzeugseite fordern, duerfen bei falscher Seite hart
 * scheitern. Front/Rear/Interior/Detail ohne Seitenbezug sind N/A.
 */
export function isSideSensitivePerspective(spec: PerspectiveSpec): boolean {
  return spec.validationRules.sideMustMatch === true;
}

