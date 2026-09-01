import type { PerspectiveId, PerspectiveSpec } from "./types";
import { STANDARD_EXTERIOR_SPECS } from "./standard-exterior";

/**
 * Reference V2 — Hero Output Keys (Phase 0).
 *
 * HERO ist KEINE neue Fahrzeuggeometrie, sondern ein eigener Output-Key mit
 * basePerspective-Bezug: identische Pose/Geometrie wie die Basisperspektive,
 * abweichend nur in Praesentation (Framing, Szenen-Betonung).
 */

interface HeroConfig {
  readonly id: PerspectiveId;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly basePerspectiveId: PerspectiveId;
}

function hero(cfg: HeroConfig): PerspectiveSpec {
  const base = STANDARD_EXTERIOR_SPECS.find(
    (s) => s.id === cfg.basePerspectiveId,
  );
  if (!base) {
    throw new Error(
      `hero(${cfg.id}): base perspective ${cfg.basePerspectiveId} not found`,
    );
  }
  return {
    id: cfg.id,
    version: 1,
    category: "hero",
    labelDe: cfg.labelDe,
    labelEn: cfg.labelEn,
    applicableVehicleClasses: base.applicableVehicleClasses,
    basePerspectiveId: cfg.basePerspectiveId,
    pose: {
      ...base.pose,
      azimuthToleranceDeg: 20,
    },
    requiredVisibleSurfaces: base.requiredVisibleSurfaces,
    forbiddenDominantSurfaces: base.forbiddenDominantSurfaces,
    orientationRules: base.orientationRules,
    framing: {
      fullVehicle: true,
      paddingMinPct: 6,
      paddingMaxPct: 18,
      requiredVisibleWheels: base.framing.requiredVisibleWheels,
    },
    cameraGuidance: {
      projection: "rectilinear",
      focalLengthMinMm: 35,
      focalLengthMaxMm: 105,
      semanticConstraints: [
        "hero presentation: dramatic but physically plausible light and composition",
        "geometry identical to the base perspective; only presentation differs",
      ],
    },
    referenceRequirements: base.referenceRequirements,
    validationRules: base.validationRules,
    riskLevel: "low",
  };
}

export const HERO_SPECS: readonly PerspectiveSpec[] = [
  hero({
    id: "HERO_FRONT_LEFT",
    labelDe: "Hero Front links",
    labelEn: "Hero Front Left",
    basePerspectiveId: "EXT_34_FRONT_LEFT",
  }),
  hero({
    id: "HERO_FRONT_RIGHT",
    labelDe: "Hero Front rechts",
    labelEn: "Hero Front Right",
    basePerspectiveId: "EXT_34_FRONT_RIGHT",
  }),
  hero({
    id: "HERO_FRONT_CENTER",
    labelDe: "Hero Front zentral",
    labelEn: "Hero Front Center",
    basePerspectiveId: "EXT_FRONT",
  }),
  hero({
    id: "HERO_REAR_LEFT",
    labelDe: "Hero Heck links",
    labelEn: "Hero Rear Left",
    basePerspectiveId: "EXT_34_REAR_LEFT",
  }),
  hero({
    id: "HERO_REAR_RIGHT",
    labelDe: "Hero Heck rechts",
    labelEn: "Hero Rear Right",
    basePerspectiveId: "EXT_34_REAR_RIGHT",
  }),
];
