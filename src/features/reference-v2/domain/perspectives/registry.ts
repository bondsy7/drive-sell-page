import type { VehicleClassV2 } from "../vehicle-classes";
import {
  PERSPECTIVE_IDS,
  PerspectiveSpecSchema,
  type PerspectiveCategory,
  type PerspectiveId,
  type PerspectiveSpec,
} from "./types";
import { STANDARD_EXTERIOR_SPECS } from "./standard-exterior";
import { HERO_SPECS } from "./hero";
import { LOW_ANGLE_SPECS } from "./low-angle";
import { ELEVATED_SPECS } from "./elevated";
import { INTERIOR_SPECS } from "./interior";
import { DETAIL_SPECS } from "./detail";

/**
 * Reference V2 — Perspective Registry V1 (Phase 0).
 * Zentrale, versionsfaehige Registry. Aenderungen an Specs erfordern
 * Versionsspruenge (spec.version bzw. PERSPECTIVE_REGISTRY_VERSION).
 */

export const PERSPECTIVE_REGISTRY_VERSION = 1;

export const ALL_PERSPECTIVE_SPECS: readonly PerspectiveSpec[] = [
  ...STANDARD_EXTERIOR_SPECS,
  ...HERO_SPECS,
  ...LOW_ANGLE_SPECS,
  ...ELEVATED_SPECS,
  ...INTERIOR_SPECS,
  ...DETAIL_SPECS,
];

export const PERSPECTIVE_SPECS_BY_ID: ReadonlyMap<PerspectiveId, PerspectiveSpec> =
  new Map(ALL_PERSPECTIVE_SPECS.map((spec) => [spec.id, spec]));

export function getPerspectiveSpec(id: PerspectiveId): PerspectiveSpec {
  const spec = PERSPECTIVE_SPECS_BY_ID.get(id);
  if (!spec) {
    throw new Error(`Perspective spec not found in registry: ${id}`);
  }
  return spec;
}

export function listPerspectivesByCategory(
  category: PerspectiveCategory,
): readonly PerspectiveSpec[] {
  return ALL_PERSPECTIVE_SPECS.filter((s) => s.category === category);
}

export function listPerspectivesForVehicleClass(
  vehicleClass: VehicleClassV2,
): readonly PerspectiveSpec[] {
  return ALL_PERSPECTIVE_SPECS.filter((s) =>
    s.applicableVehicleClasses.includes(vehicleClass),
  );
}

export interface RegistryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** Vollstaendige strukturelle Validierung der Registry (fuer Tests/CI). */
export function validatePerspectiveRegistry(): RegistryValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const spec of ALL_PERSPECTIVE_SPECS) {
    if (seen.has(spec.id)) {
      errors.push(`duplicate perspective id: ${spec.id}`);
    }
    seen.add(spec.id);

    const parsed = PerspectiveSpecSchema.safeParse(spec);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      errors.push(`invalid spec ${spec.id}: ${detail}`);
    }

    if (spec.basePerspectiveId !== undefined) {
      const base = PERSPECTIVE_SPECS_BY_ID.get(spec.basePerspectiveId);
      if (!base) {
        errors.push(
          `${spec.id}: basePerspectiveId ${spec.basePerspectiveId} not in registry`,
        );
      } else if (base.category !== "standard_exterior") {
        errors.push(
          `${spec.id}: basePerspectiveId must reference a standard_exterior spec`,
        );
      }
    }
  }

  for (const id of PERSPECTIVE_IDS) {
    if (!seen.has(id)) {
      errors.push(`declared perspective id missing from registry: ${id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
