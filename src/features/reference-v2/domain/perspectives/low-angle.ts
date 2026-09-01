import { VEHICLE_CLASSES_V2 } from "../vehicle-classes";
import type { VisualSurface, WheelPosition } from "../surfaces";
import type {
  PerspectiveId,
  PerspectiveSpec,
  VehicleFrontImageDirection,
} from "./types";

/**
 * Reference V2 — Low Angle Perspectives (Phase 0).
 * Kamera nahe Bodenhoehe mit moderatem Aufwaerts-Pitch. Proportionen bleiben
 * referenztreu; riskLevel medium, weil untere Karosseriekanten sichtbar werden,
 * die nicht in jeder Referenz abgedeckt sind.
 */

const ALL_CLASSES = VEHICLE_CLASSES_V2;

interface LowAngleConfig {
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

function lowAngle(cfg: LowAngleConfig): PerspectiveSpec {
  return {
    id: cfg.id,
    version: 1,
    category: "low_angle",
    labelDe: cfg.labelDe,
    labelEn: cfg.labelEn,
    applicableVehicleClasses: ALL_CLASSES,
    pose: {
      azimuthDeg: cfg.azimuthDeg,
      azimuthToleranceDeg: cfg.azimuthToleranceDeg,
      elevationProfile: "low",
      pitchDeg: 8,
      pitchToleranceDeg: 6,
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
      targetFocalLengthMm: 35,
      focalLengthMinMm: 28,
      focalLengthMaxMm: 45,
      semanticConstraints: [
        "camera near ground level (approx. 0.3-0.6 m)",
        "moderate upward tilt",
        "proportions must stay true to the references",
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
    riskLevel: "medium",
  };
}

export const LOW_ANGLE_SPECS: readonly PerspectiveSpec[] = [
  lowAngle({
    id: "LOW_FRONT",
    labelDe: "Froschperspektive Front",
    labelEn: "Low Front",
    azimuthDeg: 0,
    azimuthToleranceDeg: 10,
    azimuthValidationToleranceDeg: 13,
    sideMustMatch: false,
    requiredVisibleSurfaces: ["front"],
    forbiddenDominantSurfaces: ["rear"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_left", "front_right"],
  }),
  lowAngle({
    id: "LOW_FRONT_LEFT",
    labelDe: "Froschperspektive Front links",
    labelEn: "Low Front-Left",
    azimuthDeg: -45,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["front", "left_side"],
    forbiddenDominantSurfaces: ["rear", "right_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_left", "rear_left"],
  }),
  lowAngle({
    id: "LOW_FRONT_RIGHT",
    labelDe: "Froschperspektive Front rechts",
    labelEn: "Low Front-Right",
    azimuthDeg: 45,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["front", "right_side"],
    forbiddenDominantSurfaces: ["rear", "left_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_right", "rear_right"],
  }),
  lowAngle({
    id: "LOW_REAR",
    labelDe: "Froschperspektive Heck",
    labelEn: "Low Rear",
    azimuthDeg: 180,
    azimuthToleranceDeg: 10,
    azimuthValidationToleranceDeg: 13,
    sideMustMatch: false,
    requiredVisibleSurfaces: ["rear"],
    forbiddenDominantSurfaces: ["front"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["rear_left", "rear_right"],
  }),
  lowAngle({
    id: "LOW_REAR_LEFT",
    labelDe: "Froschperspektive Heck links",
    labelEn: "Low Rear-Left",
    azimuthDeg: -135,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["rear", "left_side"],
    forbiddenDominantSurfaces: ["front", "right_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["front_left", "rear_left"],
  }),
  lowAngle({
    id: "LOW_REAR_RIGHT",
    labelDe: "Froschperspektive Heck rechts",
    labelEn: "Low Rear-Right",
    azimuthDeg: 135,
    azimuthToleranceDeg: 12,
    azimuthValidationToleranceDeg: 15,
    sideMustMatch: true,
    requiredVisibleSurfaces: ["rear", "right_side"],
    forbiddenDominantSurfaces: ["front", "left_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["front_right", "rear_right"],
  }),
];
