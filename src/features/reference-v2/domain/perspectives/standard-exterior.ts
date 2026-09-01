import { VEHICLE_CLASSES_V2 } from "../vehicle-classes";
import type { VisualSurface, WheelPosition } from "../surfaces";
import type {
  PerspectiveId,
  PerspectiveSpec,
  VehicleFrontImageDirection,
} from "./types";

/**
 * Reference V2 — Standard Exterior Perspectives (Phase 0).
 * Winkelkonvention siehe ../angles.ts. Links/Rechts fahrzeugrelativ.
 */

const ALL_CLASSES = VEHICLE_CLASSES_V2;

interface StdExteriorConfig {
  readonly id: PerspectiveId;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly azimuthDeg: number;
  readonly azimuthToleranceDeg: number;
  readonly requiredVisibleSurfaces: readonly VisualSurface[];
  readonly forbiddenDominantSurfaces: readonly VisualSurface[];
  readonly vehicleFrontImageDirection: VehicleFrontImageDirection;
  readonly requiredVisibleWheels: readonly WheelPosition[];
  readonly orientationNotes?: string;
}

function stdExterior(cfg: StdExteriorConfig): PerspectiveSpec {
  return {
    id: cfg.id,
    version: 1,
    category: "standard_exterior",
    labelDe: cfg.labelDe,
    labelEn: cfg.labelEn,
    applicableVehicleClasses: ALL_CLASSES,
    pose: {
      azimuthDeg: cfg.azimuthDeg,
      azimuthToleranceDeg: cfg.azimuthToleranceDeg,
      elevationProfile: "standard",
      pitchDeg: 0,
      pitchToleranceDeg: 5,
    },
    requiredVisibleSurfaces: cfg.requiredVisibleSurfaces,
    forbiddenDominantSurfaces: cfg.forbiddenDominantSurfaces,
    orientationRules: {
      sideConvention: "vehicle_relative",
      vehicleFrontImageDirection: cfg.vehicleFrontImageDirection,
      notes: cfg.orientationNotes,
    },
    framing: {
      fullVehicle: true,
      paddingMinPct: 4,
      paddingMaxPct: 12,
      requiredVisibleWheels: cfg.requiredVisibleWheels,
    },
    cameraGuidance: {
      projection: "rectilinear",
      focalLengthMinMm: 35,
      focalLengthMaxMm: 85,
      semanticConstraints: [
        "eye-level catalogue camera height (approx. 1.2-1.6 m)",
        "no wide-angle distortion that changes the proportions",
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
      sideMustMatch: true,
      maxAzimuthErrorDeg: cfg.azimuthToleranceDeg,
      minimumPerspectiveScore: 92,
    },
    riskLevel: "low",
  };
}

export const STANDARD_EXTERIOR_SPECS: readonly PerspectiveSpec[] = [
  stdExterior({
    id: "EXT_FRONT",
    labelDe: "Frontansicht",
    labelEn: "Front View",
    azimuthDeg: 0,
    azimuthToleranceDeg: 10,
    requiredVisibleSurfaces: ["front"],
    forbiddenDominantSurfaces: ["rear", "left_side", "right_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_left", "front_right"],
  }),
  stdExterior({
    id: "EXT_34_FRONT_RIGHT",
    labelDe: "Front-Rechts 3/4",
    labelEn: "Front-Right 3/4",
    azimuthDeg: 45,
    azimuthToleranceDeg: 15,
    requiredVisibleSurfaces: ["front", "right_side"],
    forbiddenDominantSurfaces: ["rear", "left_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_right", "rear_right"],
  }),
  stdExterior({
    id: "EXT_SIDE_RIGHT",
    labelDe: "Seitenansicht rechts",
    labelEn: "Right Side",
    azimuthDeg: 90,
    azimuthToleranceDeg: 10,
    requiredVisibleSurfaces: ["right_side"],
    forbiddenDominantSurfaces: ["left_side", "front", "rear"],
    vehicleFrontImageDirection: "left",
    requiredVisibleWheels: ["front_right", "rear_right"],
    orientationNotes:
      "Convention: right side of the vehicle visible; the vehicle front points to the image left.",
  }),
  stdExterior({
    id: "EXT_34_REAR_RIGHT",
    labelDe: "Heck-Rechts 3/4",
    labelEn: "Rear-Right 3/4",
    azimuthDeg: 135,
    azimuthToleranceDeg: 15,
    requiredVisibleSurfaces: ["rear", "right_side"],
    forbiddenDominantSurfaces: ["front", "left_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["front_right", "rear_right"],
  }),
  stdExterior({
    id: "EXT_REAR",
    labelDe: "Heckansicht",
    labelEn: "Rear View",
    azimuthDeg: 180,
    azimuthToleranceDeg: 10,
    requiredVisibleSurfaces: ["rear"],
    forbiddenDominantSurfaces: ["front", "left_side", "right_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["rear_left", "rear_right"],
  }),
  stdExterior({
    id: "EXT_34_REAR_LEFT",
    labelDe: "Heck-Links 3/4",
    labelEn: "Rear-Left 3/4",
    azimuthDeg: -135,
    azimuthToleranceDeg: 15,
    requiredVisibleSurfaces: ["rear", "left_side"],
    forbiddenDominantSurfaces: ["front", "right_side"],
    vehicleFrontImageDirection: "away_from_camera",
    requiredVisibleWheels: ["front_left", "rear_left"],
  }),
  stdExterior({
    id: "EXT_SIDE_LEFT",
    labelDe: "Seitenansicht links",
    labelEn: "Left Side",
    azimuthDeg: -90,
    azimuthToleranceDeg: 10,
    requiredVisibleSurfaces: ["left_side"],
    forbiddenDominantSurfaces: ["right_side", "front", "rear"],
    vehicleFrontImageDirection: "right",
    requiredVisibleWheels: ["front_left", "rear_left"],
    orientationNotes:
      "Convention: left side of the vehicle visible; the vehicle front points to the image right.",
  }),
  stdExterior({
    id: "EXT_34_FRONT_LEFT",
    labelDe: "Front-Links 3/4",
    labelEn: "Front-Left 3/4",
    azimuthDeg: -45,
    azimuthToleranceDeg: 15,
    requiredVisibleSurfaces: ["front", "left_side"],
    forbiddenDominantSurfaces: ["rear", "right_side"],
    vehicleFrontImageDirection: "toward_camera",
    requiredVisibleWheels: ["front_left", "rear_left"],
  }),
];
