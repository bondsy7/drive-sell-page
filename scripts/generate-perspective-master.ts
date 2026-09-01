/**
 * Generates the machine-readable PerspectiveMaster v1 from the Phase 0
 * Perspective Registry. The YAML file is the contract Phase 1 enforces at
 * runtime; the registry stays the single source of truth.
 *
 * Run: bun run scripts/generate-perspective-master.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { stringify } from "yaml";
import {
  ALL_PERSPECTIVE_SPECS,
  PERSPECTIVE_REGISTRY_VERSION,
} from "../src/features/reference-v2/domain/perspectives/registry";

const OUT = "docs/vehicle-reference-engine-v2/perspective-spec-v1-machine.yaml";

const doc = {
  masterVersion: 1,
  registryVersion: PERSPECTIVE_REGISTRY_VERSION,
  generatedFrom: "src/features/reference-v2/domain/perspectives/registry.ts",
  sideConvention: "vehicle_relative",
  perspectives: ALL_PERSPECTIVE_SPECS.map((s) => ({
    id: s.id,
    version: s.version,
    category: s.category,
    labelDe: s.labelDe,
    labelEn: s.labelEn,
    vehicleClasses: [...s.applicableVehicleClasses],
    basePerspectiveId: s.basePerspectiveId ?? null,
    azimuthDeg: s.pose.azimuthDeg ?? null,
    azimuthToleranceDeg: s.pose.azimuthToleranceDeg ?? null,
    maxAzimuthErrorDeg: s.validationRules.maxAzimuthErrorDeg ?? null,
    elevationProfile: s.pose.elevationProfile,
    targetFocalLengthMm: s.cameraGuidance.targetFocalLengthMm,
    focalLengthMinMm: s.cameraGuidance.focalLengthMinMm,
    focalLengthMaxMm: s.cameraGuidance.focalLengthMaxMm,
    sideMustMatch: s.validationRules.sideMustMatch,
    minimumPerspectiveScore: s.validationRules.minimumPerspectiveScore,
    requiredVisibleSurfaces: [...s.requiredVisibleSurfaces],
    fullVehicle: s.framing.fullVehicle,
    paddingMinPct: s.framing.paddingMinPct,
    paddingMaxPct: s.framing.paddingMaxPct,
    riskLevel: s.riskLevel,
  })),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `# PerspectiveMaster v1 — generated, do not edit by hand.\n# Source: ${doc.generatedFrom}\n${stringify(doc)}`,
);
console.log(`wrote ${OUT} (${doc.perspectives.length} perspectives)`);
