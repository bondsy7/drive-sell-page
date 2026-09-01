import type { VehicleClassV2 } from "../vehicle-classes";
import type { VisualSurface } from "../surfaces";
import type { PerspectiveId, PerspectiveSpec, RiskLevel } from "./types";

/**
 * Reference V2 — Interior Perspectives (Phase 0).
 *
 * Kein Azimut: Interior-Posen werden ueber semantische Camera/Surface-
 * Constraints beschrieben statt mit erfundener Winkel-Praezision.
 * Cockpit-Seite (Lenkradposition) kommt AUSSCHLIESSLICH aus den Referenzen —
 * niemals aus Markt- oder Landesannahmen.
 */

const CABIN_CLASSES: readonly VehicleClassV2[] = [
  "car",
  "van",
  "motorhome",
  "truck",
];
const REAR_DOOR_CLASSES: readonly VehicleClassV2[] = [
  "car",
  "van",
  "motorhome",
];
const CARGO_CLASSES: readonly VehicleClassV2[] = [
  "car",
  "van",
  "motorhome",
  "truck",
  "trailer",
];

interface InteriorConfig {
  readonly id: PerspectiveId;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly applicableVehicleClasses?: readonly VehicleClassV2[];
  readonly requiredVisibleSurfaces: readonly VisualSurface[];
  readonly forbiddenDominantSurfaces?: readonly VisualSurface[];
  readonly sideMustMatch: boolean;
  readonly semanticConstraints: readonly string[];
  readonly targetFocalLengthMm?: number;
  readonly focalLengthMinMm?: number;
  readonly focalLengthMaxMm?: number;
  readonly riskLevel?: RiskLevel;
  readonly orientationNotes?: string;
}

function interior(cfg: InteriorConfig): PerspectiveSpec {
  return {
    id: cfg.id,
    version: 1,
    category: "interior",
    labelDe: cfg.labelDe,
    labelEn: cfg.labelEn,
    applicableVehicleClasses: cfg.applicableVehicleClasses ?? CABIN_CLASSES,
    pose: {
      elevationProfile: "interior",
    },
    requiredVisibleSurfaces: cfg.requiredVisibleSurfaces,
    forbiddenDominantSurfaces: cfg.forbiddenDominantSurfaces ?? [],
    orientationRules: {
      sideConvention: "vehicle_relative",
      vehicleFrontImageDirection: "not_applicable",
      notes: cfg.orientationNotes,
    },
    framing: {
      fullVehicle: false,
      paddingMinPct: 0,
      paddingMaxPct: 10,
      requiredVisibleWheels: [],
    },
    cameraGuidance: {
      projection: "rectilinear",
      targetFocalLengthMm: cfg.targetFocalLengthMm ?? 24,
      focalLengthMinMm: cfg.focalLengthMinMm ?? 20,
      focalLengthMaxMm: cfg.focalLengthMaxMm ?? 32,
      semanticConstraints: cfg.semanticConstraints,
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
      minimumPerspectiveScore: 92,
    },
    riskLevel: cfg.riskLevel ?? "low",
  };
}

export const INTERIOR_SPECS: readonly PerspectiveSpec[] = [
  interior({
    id: "INT_DRIVER_POV",
    labelDe: "Cockpit (Fahrerposition)",
    labelEn: "Cockpit From Seating Position",
    requiredVisibleSurfaces: ["steering_wheel", "dashboard", "instrument_cluster"],
    sideMustMatch: true,
    semanticConstraints: [
      "view from the seating position behind the wheel toward the dash",
      "wheel position (left or right) exactly as in the references — never inferred",
    ],
    orientationNotes:
      "Cockpit side comes exclusively from the references; never from market assumptions.",
  }),
  interior({
    id: "INT_DASH_CENTER",
    labelDe: "Armaturenbrett zentral",
    labelEn: "Dash Center",
    requiredVisibleSurfaces: ["dashboard", "infotainment", "center_console"],
    sideMustMatch: false,
    semanticConstraints: [
      "centered on the dash",
      "straight-on or slightly angled",
    ],
  }),
  interior({
    id: "INT_WIDE_CABIN",
    labelDe: "Kabine weit",
    labelEn: "Wide Cabin",
    requiredVisibleSurfaces: ["dashboard", "front_seats", "center_console"],
    sideMustMatch: false,
    targetFocalLengthMm: 20,
    focalLengthMinMm: 16,
    focalLengthMaxMm: 26,
    semanticConstraints: [
      "wide view capturing the front cabin as a whole",
      "wide-angle allowed but without heavy distortion",
    ],
  }),
  interior({
    id: "INT_PASSENGER_DASH",
    labelDe: "Armaturenbrett von Beifahrerseite",
    labelEn: "Dash From Passenger Side",
    requiredVisibleSurfaces: ["dashboard"],
    sideMustMatch: true,
    semanticConstraints: [
      "taken from the passenger seating position toward the dash",
    ],
  }),
  interior({
    id: "INT_FRONT_SEATS",
    labelDe: "Vordersitze",
    labelEn: "Front Seats",
    requiredVisibleSurfaces: ["front_seats"],
    sideMustMatch: false,
    semanticConstraints: [
      "both front seats fully visible",
      "taken from the front door opening or slightly elevated",
    ],
  }),
  interior({
    id: "INT_REAR_FROM_FRONT",
    labelDe: "Ruecksitzbank von vorn",
    labelEn: "Rear Bench From Front",
    requiredVisibleSurfaces: ["rear_seats"],
    sideMustMatch: false,
    semanticConstraints: [
      "rear bench seen from between the front seats or the front door area",
    ],
  }),
  interior({
    id: "INT_REAR_LEFT_DOOR",
    labelDe: "Fond durch linke Tuer",
    labelEn: "Rear Through Left Door",
    applicableVehicleClasses: REAR_DOOR_CLASSES,
    requiredVisibleSurfaces: ["rear_seats", "door_panel_left"],
    sideMustMatch: true,
    semanticConstraints: ["view through the open rear left door"],
  }),
  interior({
    id: "INT_REAR_RIGHT_DOOR",
    labelDe: "Fond durch rechte Tuer",
    labelEn: "Rear Through Right Door",
    applicableVehicleClasses: REAR_DOOR_CLASSES,
    requiredVisibleSurfaces: ["rear_seats", "door_panel_right"],
    sideMustMatch: true,
    semanticConstraints: ["view through the open rear right door"],
  }),
  interior({
    id: "INT_CARGO",
    labelDe: "Laderaum",
    labelEn: "Cargo Area",
    applicableVehicleClasses: CARGO_CLASSES,
    requiredVisibleSurfaces: ["cargo_area"],
    sideMustMatch: false,
    semanticConstraints: ["straight view into the open cargo area"],
  }),
  interior({
    id: "INT_CARGO_34",
    labelDe: "Laderaum schraeg",
    labelEn: "Cargo Area Angled",
    applicableVehicleClasses: CARGO_CLASSES,
    requiredVisibleSurfaces: ["cargo_area"],
    sideMustMatch: false,
    semanticConstraints: ["angled view into the cargo area showing its depth"],
  }),
  interior({
    id: "INT_CENTER_CONSOLE",
    labelDe: "Mittelkonsole",
    labelEn: "Center Console",
    requiredVisibleSurfaces: ["center_console"],
    sideMustMatch: false,
    targetFocalLengthMm: 35,
    focalLengthMinMm: 28,
    focalLengthMaxMm: 50,
    semanticConstraints: [
      "top-down or angled close view of the center console",
    ],
  }),
  interior({
    id: "INT_ROOF",
    labelDe: "Dachhimmel",
    labelEn: "Headliner / Roof",
    requiredVisibleSurfaces: ["headliner"],
    sideMustMatch: false,
    riskLevel: "medium",
    semanticConstraints: [
      "upward view of the headliner and roof elements (glass roof only if present in the references)",
    ],
  }),
];
