/**
 * Generates the machine-readable PerspectiveMaster v1 from the Phase 0
 * Perspective Registry. The YAML file is the contract Phase 1 enforces at
 * runtime; the registry stays the single source of truth.
 *
 * Additionally emits a Reference-V2-ONLY generated TypeScript artifact that the
 * two Reference V2 edge functions import, so the server never depends on
 * perspective definitions supplied by the browser.
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
import {
  VISUAL_SURFACES,
  WHEEL_POSITIONS,
} from "../src/features/reference-v2/domain/surfaces";
import { VEHICLE_CLASSES_V2 } from "../src/features/reference-v2/domain/vehicle-classes";
import { ELEVATION_PROFILES } from "../src/features/reference-v2/domain/perspectives/types";
import { INTAKE_ISSUE_SEVERITIES } from "../src/features/reference-v2/domain/vision-intake";

const OUT = "docs/vehicle-reference-engine-v2/perspective-spec-v1-machine.yaml";
const EDGE_OUT =
  "supabase/functions/_shared/reference-v2-perspective-master.generated.ts";


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

// ---------------------------------------------------------------------------
// Reference V2 edge-function artifact (generated, do not edit by hand)
// ---------------------------------------------------------------------------

const edgeEntries = ALL_PERSPECTIVE_SPECS.map((s) => ({
  id: s.id,
  category: s.category,
  vehicleClasses: [...s.applicableVehicleClasses],
  azimuthDeg: s.pose.azimuthDeg ?? null,
  azimuthToleranceDeg: s.pose.azimuthToleranceDeg ?? null,
  maxAzimuthErrorDeg: s.validationRules.maxAzimuthErrorDeg ?? null,
  elevationProfile: s.pose.elevationProfile,
  sideMustMatch: s.validationRules.sideMustMatch,
  requiredVisibleSurfaces: [...s.requiredVisibleSurfaces],
  fullVehicle: s.framing.fullVehicle,
  paddingMinPct: s.framing.paddingMinPct,
  paddingMaxPct: s.framing.paddingMaxPct,
  vehicleFrontImageDirection:
    s.orientationRules.vehicleFrontImageDirection ?? null,
}));

const edgeSource = `// GENERATED FILE — DO NOT EDIT BY HAND.
// Source: ${doc.generatedFrom} (via scripts/generate-perspective-master.ts)
// Reference V2 ONLY. Consumed exclusively by the reference-v2-* edge functions
// so the server never trusts perspective definitions sent by the browser.

export const REFERENCE_V2_MASTER_VERSION = ${doc.masterVersion};
export const REFERENCE_V2_REGISTRY_VERSION = ${doc.registryVersion};
export const REFERENCE_V2_SIDE_CONVENTION = "vehicle_relative" as const;

export const REFERENCE_V2_VEHICLE_CLASSES = ${JSON.stringify([...VEHICLE_CLASSES_V2])} as const;
export const REFERENCE_V2_ELEVATION_PROFILES = ${JSON.stringify([...ELEVATION_PROFILES])} as const;
export const REFERENCE_V2_WHEEL_POSITIONS = ${JSON.stringify([...WHEEL_POSITIONS])} as const;
export const REFERENCE_V2_VISUAL_SURFACES = ${JSON.stringify([...VISUAL_SURFACES])} as const;
export const REFERENCE_V2_ISSUE_SEVERITIES = ${JSON.stringify([...INTAKE_ISSUE_SEVERITIES])} as const;

export interface ReferenceV2MasterEntry {
  readonly id: string;
  readonly category: string;
  readonly vehicleClasses: readonly string[];
  readonly azimuthDeg: number | null;
  readonly azimuthToleranceDeg: number | null;
  readonly maxAzimuthErrorDeg: number | null;
  readonly elevationProfile: string;
  readonly sideMustMatch: boolean;
  readonly requiredVisibleSurfaces: readonly string[];
  readonly fullVehicle: boolean;
  readonly paddingMinPct: number;
  readonly paddingMaxPct: number;
  readonly vehicleFrontImageDirection: string | null;
}

export const REFERENCE_V2_PERSPECTIVE_MASTER: readonly ReferenceV2MasterEntry[] =
${JSON.stringify(edgeEntries, null, 2)} as const;

const BY_ID = new Map<string, ReferenceV2MasterEntry>(
  REFERENCE_V2_PERSPECTIVE_MASTER.map((e) => [e.id, e]),
);

export function getReferenceV2MasterEntry(
  id: string,
): ReferenceV2MasterEntry | undefined {
  return BY_ID.get(id);
}

/** Compact, purely visual definition list handed to the vision model. */
export function referenceV2PerspectiveDefinitionLines(): string {
  return REFERENCE_V2_PERSPECTIVE_MASTER.map((e) => {
    const az =
      e.azimuthDeg === null
        ? "azimuth: n/a"
        : \`azimuth \${e.azimuthDeg}° ±\${e.azimuthToleranceDeg ?? 0}° (max err \${e.maxAzimuthErrorDeg ?? 0}°)\`;
    return [
      e.id,
      \`category \${e.category}\`,
      az,
      \`elevation \${e.elevationProfile}\`,
      \`sideMustMatch \${e.sideMustMatch}\`,
      \`framing \${e.fullVehicle ? "full vehicle" : "partial/detail"} padding \${e.paddingMinPct}-\${e.paddingMaxPct}%\`,
      \`required surfaces: \${e.requiredVisibleSurfaces.join("/")}\`,
      \`classes: \${e.vehicleClasses.join("/")}\`,
      e.vehicleFrontImageDirection
        ? \`front points \${e.vehicleFrontImageDirection} in image\`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");
  }).join("\\n");
}
`;

mkdirSync(dirname(EDGE_OUT), { recursive: true });
writeFileSync(EDGE_OUT, edgeSource);
console.log(`wrote ${EDGE_OUT} (${edgeEntries.length} perspectives)`);

