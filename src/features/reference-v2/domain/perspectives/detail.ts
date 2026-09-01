import type { VehicleClassV2 } from "../vehicle-classes";
import type { VisualSurface } from "../surfaces";
import type { PerspectiveId, PerspectiveSpec, RiskLevel } from "./types";

/**
 * Reference V2 — Detail Perspectives (Phase 0).
 *
 * Kein Azimut: Detail-Posen werden ueber semantische Camera/Surface-
 * Constraints beschrieben. Embleme/Badges kommen AUSSCHLIESSLICH aus den
 * visuellen Referenzen (siehe scene-logo.ts: Environment-Logos sind strikt
 * getrennt von Fahrzeug-Emblemen).
 */

const CVMT: readonly VehicleClassV2[] = ["car", "van", "motorhome", "truck"];
const CVMT_TRAILER: readonly VehicleClassV2[] = [
  "car",
  "van",
  "motorhome",
  "truck",
  "trailer",
];
const CVMT_MOTO: readonly VehicleClassV2[] = [
  "car",
  "van",
  "motorhome",
  "truck",
  "motorcycle",
];

interface DetailConfig {
  readonly id: PerspectiveId;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly applicableVehicleClasses: readonly VehicleClassV2[];
  readonly requiredVisibleSurfaces: readonly VisualSurface[];
  readonly sideMustMatch: boolean;
  readonly semanticConstraints: readonly string[];
  readonly riskLevel: RiskLevel;
  readonly orientationNotes?: string;
}

function detail(cfg: DetailConfig): PerspectiveSpec {
  return {
    id: cfg.id,
    version: 1,
    category: "detail",
    labelDe: cfg.labelDe,
    labelEn: cfg.labelEn,
    applicableVehicleClasses: cfg.applicableVehicleClasses,
    pose: {
      elevationProfile: "close_detail",
    },
    requiredVisibleSurfaces: cfg.requiredVisibleSurfaces,
    forbiddenDominantSurfaces: [],
    orientationRules: {
      sideConvention: "vehicle_relative",
      vehicleFrontImageDirection: "not_applicable",
      notes: cfg.orientationNotes,
    },
    framing: {
      fullVehicle: false,
      paddingMinPct: 2,
      paddingMaxPct: 15,
      requiredVisibleWheels: [],
    },
    cameraGuidance: {
      projection: "rectilinear",
      targetFocalLengthMm: 60,
      focalLengthMinMm: 45,
      focalLengthMaxMm: 85,
      semanticConstraints: cfg.semanticConstraints,
    },
    referenceRequirements: {
      exactReferencePreferred: true,
      minimumUsableReferences: 1,
      allowedMultiReference: true,
      requiredCoverageSurfaces: cfg.requiredVisibleSurfaces,
      minPrimaryQualityScore: 0.6,
    },
    validationRules: {
      mirrorForbidden: true,
      sideMustMatch: cfg.sideMustMatch,
      minimumPerspectiveScore: 92,
    },
    riskLevel: cfg.riskLevel,
  };
}

export const DETAIL_SPECS: readonly PerspectiveSpec[] = [
  detail({
    id: "DET_HEADLIGHT_LEFT",
    labelDe: "Scheinwerfer links",
    labelEn: "Headlamp Left",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["headlight_left"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "close view of the left headlamp unit",
      "internal light signature exactly as in the references",
    ],
  }),
  detail({
    id: "DET_HEADLIGHT_RIGHT",
    labelDe: "Scheinwerfer rechts",
    labelEn: "Headlamp Right",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["headlight_right"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "close view of the right headlamp unit",
      "internal light signature exactly as in the references",
    ],
  }),
  detail({
    id: "DET_TAILLIGHT_LEFT",
    labelDe: "Ruecklicht links",
    labelEn: "Taillamp Left",
    applicableVehicleClasses: CVMT_TRAILER,
    requiredVisibleSurfaces: ["taillight_left"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "close view of the left taillamp unit",
      "lens graphics exactly as in the references",
    ],
  }),
  detail({
    id: "DET_TAILLIGHT_RIGHT",
    labelDe: "Ruecklicht rechts",
    labelEn: "Taillamp Right",
    applicableVehicleClasses: CVMT_TRAILER,
    requiredVisibleSurfaces: ["taillight_right"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "close view of the right taillamp unit",
      "lens graphics exactly as in the references",
    ],
  }),
  detail({
    id: "DET_GRILLE",
    labelDe: "Kuehlergrill",
    labelEn: "Front Grille",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["grille"],
    sideMustMatch: false,
    riskLevel: "high",
    semanticConstraints: [
      "straight close view of the front grille area",
      "pattern, inserts and finish exactly as in the references",
    ],
  }),
  detail({
    id: "DET_FRONT_BADGE",
    labelDe: "Emblem vorn",
    labelEn: "Front Emblem",
    applicableVehicleClasses: CVMT_MOTO,
    requiredVisibleSurfaces: ["front_badge"],
    sideMustMatch: false,
    riskLevel: "high",
    semanticConstraints: [
      "close view of the front emblem area",
      "emblem appearance exclusively from the references",
    ],
  }),
  detail({
    id: "DET_REAR_BADGE",
    labelDe: "Emblem/Schriftzug hinten",
    labelEn: "Rear Emblem",
    applicableVehicleClasses: CVMT_MOTO,
    requiredVisibleSurfaces: ["rear_badge"],
    sideMustMatch: false,
    riskLevel: "high",
    semanticConstraints: [
      "close view of the rear emblem and lettering area",
      "lettering exclusively from the references",
    ],
  }),
  detail({
    id: "DET_WHEEL_FRONT_LEFT",
    labelDe: "Rad vorn links",
    labelEn: "Wheel Front-Left",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["wheel_front_left"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "full rim visible, slightly angled",
      "rim design and tire sidewall exactly as in the references",
    ],
  }),
  detail({
    id: "DET_WHEEL_FRONT_RIGHT",
    labelDe: "Rad vorn rechts",
    labelEn: "Wheel Front-Right",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["wheel_front_right"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "full rim visible, slightly angled",
      "rim design and tire sidewall exactly as in the references",
    ],
  }),
  detail({
    id: "DET_WHEEL_REAR_LEFT",
    labelDe: "Rad hinten links",
    labelEn: "Wheel Rear-Left",
    applicableVehicleClasses: CVMT_TRAILER,
    requiredVisibleSurfaces: ["wheel_rear_left"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "full rim visible, slightly angled",
      "rim design and tire sidewall exactly as in the references",
    ],
  }),
  detail({
    id: "DET_WHEEL_REAR_RIGHT",
    labelDe: "Rad hinten rechts",
    labelEn: "Wheel Rear-Right",
    applicableVehicleClasses: CVMT_TRAILER,
    requiredVisibleSurfaces: ["wheel_rear_right"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "full rim visible, slightly angled",
      "rim design and tire sidewall exactly as in the references",
    ],
  }),
  detail({
    id: "DET_STEERING_WHEEL",
    labelDe: "Lenkrad",
    labelEn: "Steering Wheel",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["steering_wheel"],
    sideMustMatch: true,
    riskLevel: "medium",
    semanticConstraints: [
      "close view of the wheel rim, spokes and controls",
      "position (left or right) exactly as in the references",
    ],
    orientationNotes:
      "Cockpit side comes exclusively from the references; never from market assumptions.",
  }),
  detail({
    id: "DET_CLUSTER",
    labelDe: "Kombiinstrument",
    labelEn: "Instrument Cluster",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["instrument_cluster"],
    sideMustMatch: false,
    riskLevel: "medium",
    semanticConstraints: [
      "straight view of the instrument cluster",
      "reproduce the cluster content exactly as visible in the references; if unreadable, leave it dark or neutral and invent nothing",
    ],
  }),
  detail({
    id: "DET_INFOTAINMENT",
    labelDe: "Infotainment-Display",
    labelEn: "Infotainment Display",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["infotainment"],
    sideMustMatch: false,
    riskLevel: "medium",
    semanticConstraints: [
      "close view of the central display",
      "reproduce the screen content exactly as visible in the references; if unreadable, leave it dark or neutral and invent nothing",
    ],
  }),
  detail({
    id: "DET_CENTER_CONSOLE",
    labelDe: "Mittelkonsole Detail",
    labelEn: "Center Console Detail",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["center_console"],
    sideMustMatch: false,
    riskLevel: "low",
    semanticConstraints: [
      "close view of the console controls and surfaces",
    ],
  }),
  detail({
    id: "DET_DOOR_LEFT",
    labelDe: "Tuer links",
    labelEn: "Door Left",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["door_left"],
    sideMustMatch: true,
    riskLevel: "low",
    semanticConstraints: [
      "close view of the left door surface and handle area",
    ],
  }),
  detail({
    id: "DET_DOOR_RIGHT",
    labelDe: "Tuer rechts",
    labelEn: "Door Right",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["door_right"],
    sideMustMatch: true,
    riskLevel: "low",
    semanticConstraints: [
      "close view of the right door surface and handle area",
    ],
  }),
  detail({
    id: "DET_CHARGE_PORT",
    labelDe: "Ladeanschluss",
    labelEn: "Charging Port",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["charge_port"],
    sideMustMatch: true,
    riskLevel: "high",
    semanticConstraints: [
      "close view of the charging port area",
      "location and flap design exclusively from the references",
    ],
  }),
  detail({
    id: "DET_FUEL_FLAP",
    labelDe: "Tankklappe",
    labelEn: "Fuel Flap",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["fuel_flap"],
    sideMustMatch: true,
    riskLevel: "high",
    semanticConstraints: [
      "close view of the fuel flap area",
      "location and flap design exclusively from the references",
    ],
  }),
  detail({
    id: "DET_ROOF",
    labelDe: "Dach Detail",
    labelEn: "Roof Detail",
    applicableVehicleClasses: CVMT,
    requiredVisibleSurfaces: ["roof"],
    sideMustMatch: false,
    riskLevel: "high",
    semanticConstraints: [
      "close angled view of the roof surface (rails, glass, antennas only as in the references)",
    ],
  }),
];
