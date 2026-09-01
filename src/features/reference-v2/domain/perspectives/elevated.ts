import { VEHICLE_CLASSES_V2 } from "../vehicle-classes";
import type { VisualSurface, WheelPosition } from "../surfaces";
import type {
  PerspectiveId,
  PerspectiveSpec,
  VehicleFrontImageDirection,
} from "./types";

/**
 * Reference V2 — Elevated Perspectives (Phase 0).
 *
 * riskLevel HIGH: erhoehte Perspektiven offenbaren das Dach — eine Flaeche,
 * die in typischen Referenzsaetzen selten abgedeckt ist. "roof" ist deshalb
 * Teil der requiredCoverageSurfaces; fehlende Dach-Abdeckung muss spaeter im
 * Readiness-Check zu NEEDS_CONFIRMATION/INSUFFICIENT_REFERENCE fuehren.
 */

const ALL_CLASSES = VEHICLE_CLASSES_V2;

interface ElevatedConfig {
  readonly id: PerspectiveId;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly azimuthDeg: number;
  readonly azimuthToleranceDeg: number;
  readonly azimuthValidationToleranceDeg: number;
  readonly sideMustMatch: boolean;
  readonly requiredVisibleSurfaces: readonly VisualSurface[];
  readonly forbiddenDominantSurfaces: readonly VisualSurface[];
  readonly vehicleFrontImageDirection: VehicleFrontImageDirection;
  readonly requiredVisibleWheels: readonly WheelPosition[];
}

function elevated(cfg: ElevatedConfig): PerspectiveSpec {
  return {
    id: cfg.id,
    version: 1,
    category: "elevated",
    labelDe: cfg.labelDe,
    labelEn: cfg.labelEn,
    applicableVehicleClasses: ALL_CLASSES,
    pose: {
      azimuthDeg: cfg.azimuthDeg,
      azimuthToleranceDeg: cfg.azimuthToleranceDeg,
      elevationProfile: "elevated",
      pitchDeg: -15,
      pitchToleranceDeg: 10,
    },
    requiredVisibleSurfaces: cfg.requiredVisibleSurfaces,
    forbiddenDominantSurfaces: cfg.forbiddenDominantSurfaces,
    orientationRules: {
      sideConvention: "vehicle_relative",
      vehicleFrontImageDirection: cfg.vehicleFrontImageDirection,
    },
    framing: {
      fullVehicle: true,
      paddingMinPct: 4,
      paddingMaxPct: 14,
      requiredVisibleWheels: cfg.requiredVisibleWheels,
    },
    cameraGuidance: {
      projection: "rectilinear",
      targetFocalLengthMm: 45,
      focalLengthMinMm: 35,
      focalLengthMaxMm: 60,
      semanticConstraints: [
        "camera above the roofline (approx. 2.5-4 m)",
        "moderate downward tilt",
        "roof appearance exclusively from the references",
      ],
    },
    referenceRequirements: {
      exactReferencePreferred: true,
      minimumUsableReferences: 1,
      allowedMultiReference: true,
      requiredCoverageSurfaces: cfg.requiredVisibleSurfaces,
      minPrimaryQualityScore: 0.55,
    },
    validationRules: {
      mirrorForbidden: true,
      sideMustMatch: cfg.sideMustMatch,
      maxAzimuthErrorDeg: cfg.azimuthValidationToleranceDeg,
      minimumPerspectiveScore: 92,
    },
    riskLevel: "high",
  };
}

export const ELEVATED_SPECS: readonly PerspectiveSpec[] = [
  elevated({
    id: "HIGH_FRONT",
    labelDe: "Vogelperspektive Front",
    labelEn: "High Front",
    azimuthDeg: 0,
    azimuthToleranceDeg: 10,
    azimuthValidationToleranceDeg: 13,
    sideMustMatch: false,
    requiredVisibleSurfaces: ["front", "roof"],
    forbiddenDominantSurfaces: ["rear"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_left", "front_right"],
  }),
  elevated({
    id: "HIGH_FRONT_LEFT",
    labelDe: "Vogelperspektive Front links",
    labelEn: "High Front-Left",
    azimuthDeg: -45,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["front", "left_side", "roof"],
    forbiddenDominantSurfaces: ["rear", "right_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_left", "rear_left"],
  }),
  elevated({
    id: "HIGH_FRONT_RIGHT",
    labelDe: "Vogelperspektive Front rechts",
    labelEn: "High Front-Right",
    azimuthDeg: 45,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["front", "right_side", "roof"],
    forbiddenDominantSurfaces: ["rear", "left_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_right", "rear_right"],
  }),
  elevated({
    id: "HIGH_REAR",
    labelDe: "Vogelperspektive Heck",
    labelEn: "High Rear",
    azimuthDeg: 180,
    azimuthToleranceDeg: 10,
    azimuthValidationToleranceDeg: 13,
    sideMustMatch: false,
    requiredVisibleSurfaces: ["rear", "roof"],
    forbiddenDominantSurfaces: ["front"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["rear_left", "rear_right"],
  }),
  elevated({
    id: "HIGH_REAR_LEFT",
    labelDe: "Vogelperspektive Heck links",
    labelEn: "High Rear-Left",
    azimuthDeg: -135,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["rear", "left_side", "roof"],
    forbiddenDominantSurfaces: ["front", "right_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["front_left", "rear_left"],
  }),
  elevated({
    id: "HIGH_REAR_RIGHT",
    labelDe: "Vogelperspektive Heck rechts",
    labelEn: "High Rear-Right",
    azimuthDeg: 135,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["rear", "right_side", "roof"],
    forbiddenDominantSurfaces: ["front", "left_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["front_right", "rear_right"],
  }),
];
