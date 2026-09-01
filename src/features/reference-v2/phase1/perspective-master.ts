import { parse } from "yaml";
import { z } from "zod";
// Raw import of the machine-readable master contract (Vite ?raw).
import masterYamlRaw from "../../../../docs/vehicle-reference-engine-v2/perspective-spec-v1-machine.yaml?raw";
import {
  ALL_PERSPECTIVE_SPECS,
  PERSPECTIVE_REGISTRY_VERSION,
  getPerspectiveSpec,
} from "../domain/perspectives/registry";
import {
  PerspectiveCategorySchema,
  PerspectiveIdSchema,
  ElevationProfileSchema,
  RiskLevelSchema,
  type PerspectiveId,
} from "../domain/perspectives/types";
import { VehicleClassV2Schema, type VehicleClassV2 } from "../domain/vehicle-classes";
import { VisualSurfaceSchema } from "../domain/surfaces";

/**
 * Reference V2 — Phase 1: PerspectiveMaster v1 enforcement.
 *
 * Die YAML-Datei ist der maschinenlesbare Vertrag, gegen den Phase 1
 * arbeitet. Sie wird aus der Phase-0-Registry generiert; beim Laden wird
 * FAIL-CLOSED geprueft, dass beide exakt uebereinstimmen. Kein Parallel-
 * schema: alle Enums/Toleranzen stammen aus Phase 0.
 */

export const PERSPECTIVE_MASTER_VERSION = 1;

const PerspectiveMasterEntrySchema = z
  .object({
    id: PerspectiveIdSchema,
    version: z.number().int().min(1),
    category: PerspectiveCategorySchema,
    labelDe: z.string().min(1),
    labelEn: z.string().min(1),
    vehicleClasses: z.array(VehicleClassV2Schema).nonempty(),
    basePerspectiveId: PerspectiveIdSchema.nullable(),
    azimuthDeg: z.number().nullable(),
    azimuthToleranceDeg: z.number().nullable(),
    maxAzimuthErrorDeg: z.number().nullable(),
    elevationProfile: ElevationProfileSchema,
    targetFocalLengthMm: z.number().positive(),
    focalLengthMinMm: z.number().positive(),
    focalLengthMaxMm: z.number().positive(),
    sideMustMatch: z.boolean(),
    minimumPerspectiveScore: z.number().min(0).max(100),
    requiredVisibleSurfaces: z.array(VisualSurfaceSchema).nonempty(),
    fullVehicle: z.boolean(),
    paddingMinPct: z.number().min(0).max(40),
    paddingMaxPct: z.number().min(0).max(40),
    riskLevel: RiskLevelSchema,
  })
  .strict();

export type PerspectiveMasterEntry = z.infer<typeof PerspectiveMasterEntrySchema>;

const PerspectiveMasterDocumentSchema = z
  .object({
    masterVersion: z.literal(PERSPECTIVE_MASTER_VERSION),
    registryVersion: z.number().int().min(1),
    generatedFrom: z.string().min(1),
    sideConvention: z.literal("vehicle_relative"),
    perspectives: z.array(PerspectiveMasterEntrySchema).nonempty(),
  })
  .strict();

export type PerspectiveMasterDocument = z.infer<
  typeof PerspectiveMasterDocumentSchema
>;

export class PerspectiveMasterIntegrityError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`PerspectiveMaster v1 integrity violation: ${issues.join("; ")}`);
    this.name = "PerspectiveMasterIntegrityError";
    this.issues = issues;
  }
}

/** Vergleicht jede Master-Zeile mit der Phase-0-Registry. Fail-closed. */
export function verifyAgainstRegistry(
  doc: PerspectiveMasterDocument,
): readonly string[] {
  const issues: string[] = [];
  if (doc.registryVersion !== PERSPECTIVE_REGISTRY_VERSION) {
    issues.push(
      `registryVersion ${doc.registryVersion} != runtime registry ${PERSPECTIVE_REGISTRY_VERSION}`,
    );
  }
  if (doc.perspectives.length !== ALL_PERSPECTIVE_SPECS.length) {
    issues.push(
      `master lists ${doc.perspectives.length} perspectives, registry has ${ALL_PERSPECTIVE_SPECS.length}`,
    );
  }
  for (const entry of doc.perspectives) {
    const spec = getPerspectiveSpec(entry.id);
    const mismatches: string[] = [];
    const eq = (name: string, a: unknown, b: unknown) => {
      const norm = (v: unknown) => (v === undefined ? null : v);
      if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) {
        mismatches.push(`${name} (${JSON.stringify(a)} != ${JSON.stringify(b)})`);
      }
    };
    eq("version", entry.version, spec.version);
    eq("category", entry.category, spec.category);
    eq("basePerspectiveId", entry.basePerspectiveId, spec.basePerspectiveId);
    eq("azimuthDeg", entry.azimuthDeg, spec.pose.azimuthDeg);
    eq(
      "azimuthToleranceDeg",
      entry.azimuthToleranceDeg,
      spec.pose.azimuthToleranceDeg,
    );
    eq(
      "maxAzimuthErrorDeg",
      entry.maxAzimuthErrorDeg,
      spec.validationRules.maxAzimuthErrorDeg,
    );
    eq("elevationProfile", entry.elevationProfile, spec.pose.elevationProfile);
    eq(
      "targetFocalLengthMm",
      entry.targetFocalLengthMm,
      spec.cameraGuidance.targetFocalLengthMm,
    );
    eq("sideMustMatch", entry.sideMustMatch, spec.validationRules.sideMustMatch);
    eq(
      "minimumPerspectiveScore",
      entry.minimumPerspectiveScore,
      spec.validationRules.minimumPerspectiveScore,
    );
    eq("fullVehicle", entry.fullVehicle, spec.framing.fullVehicle);
    eq("paddingMinPct", entry.paddingMinPct, spec.framing.paddingMinPct);
    eq("paddingMaxPct", entry.paddingMaxPct, spec.framing.paddingMaxPct);
    eq(
      "vehicleClasses",
      entry.vehicleClasses,
      [...spec.applicableVehicleClasses],
    );
    eq(
      "requiredVisibleSurfaces",
      entry.requiredVisibleSurfaces,
      [...spec.requiredVisibleSurfaces],
    );
    if (mismatches.length > 0) {
      issues.push(`${entry.id}: ${mismatches.join(", ")}`);
    }
  }
  return issues;
}

function loadMaster(): PerspectiveMasterDocument {
  const parsed = PerspectiveMasterDocumentSchema.safeParse(parse(masterYamlRaw));
  if (!parsed.success) {
    throw new PerspectiveMasterIntegrityError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  const issues = verifyAgainstRegistry(parsed.data);
  if (issues.length > 0) {
    throw new PerspectiveMasterIntegrityError(issues);
  }
  return parsed.data;
}

export const PERSPECTIVE_MASTER: PerspectiveMasterDocument = loadMaster();

const BY_ID = new Map<PerspectiveId, PerspectiveMasterEntry>(
  PERSPECTIVE_MASTER.perspectives.map((p) => [p.id, p]),
);

export function getPerspectiveMasterEntry(
  id: PerspectiveId,
): PerspectiveMasterEntry {
  const entry = BY_ID.get(id);
  if (!entry) {
    throw new PerspectiveMasterIntegrityError([
      `perspective ${id} is not part of PerspectiveMaster v1`,
    ]);
  }
  return entry;
}

export function listMasterPerspectivesForClass(
  vehicleClass: VehicleClassV2,
): readonly PerspectiveMasterEntry[] {
  return PERSPECTIVE_MASTER.perspectives.filter((p) =>
    p.vehicleClasses.includes(vehicleClass),
  );
}

/**
 * Pflichtperspektiven eines Vehicle Master Records (Phase 1).
 * Nur Standard-Exterieur (die 8 Kernwinkel) plus zwei Interior-Kernbilder —
 * alles Weitere ist optional und erzeugt keine Completeness-Warnung.
 */
export const REQUIRED_MASTER_PERSPECTIVE_IDS: readonly PerspectiveId[] = [
  "EXT_FRONT",
  "EXT_34_FRONT_RIGHT",
  "EXT_SIDE_RIGHT",
  "EXT_34_REAR_RIGHT",
  "EXT_REAR",
  "EXT_34_REAR_LEFT",
  "EXT_SIDE_LEFT",
  "EXT_34_FRONT_LEFT",
  "INT_DRIVER_POV",
  "INT_DASH_CENTER",
];

export function requiredPerspectivesForClass(
  vehicleClass: VehicleClassV2,
): readonly PerspectiveId[] {
  return REQUIRED_MASTER_PERSPECTIVE_IDS.filter((id) =>
    getPerspectiveMasterEntry(id).vehicleClasses.includes(vehicleClass),
  );
}
