import { z } from "zod";
import { VehicleClassV2Schema } from "../domain/vehicle-classes";
import {
  PerspectiveIdSchema,
  type PerspectiveId,
} from "../domain/perspectives/types";
import {
  MatchComponentScoresSchema,
  ReferenceHardFailCodeSchema,
  ReferenceReadinessStatusSchema,
} from "../domain/readiness";
import { VisionIntakeResultSchema } from "../domain/vision-intake";
import { ColorFamilySchema } from "./color-families";
import { OutputFormatSchema } from "./output-format-policy";

/**
 * Reference V2 — Phase 1: Vehicle Master Records.
 *
 * Ein Vehicle Master Record buendelt die Referenzbilder EINES physischen
 * Fahrzeugs. Er enthaelt bewusst KEINE Business-Metadaten (Marke, Modell,
 * Baujahr, VIN, Titel) — nur visuelle Kategorien (Fahrzeugklasse,
 * Farbfamilie) und einen freien internen Admin-Label, der niemals in einen
 * Generierungs-Prompt gelangt (Phase 0 Request-Schema ist .strict()).
 *
 * Phase 1 ist rein frontend/local-state — keine DB, kein Schema-Change.
 */

/**
 * Phase-1-Ingestion-Blocker.
 *
 * Superset der Phase-0-Hard-Fail-Codes: Die Phase-0-Enums bleiben unveraendert
 * (kein Eingriff in die Governance-Semantik). Zusaetzliche Bildfehler, die
 * Phase 0 als Kandidaten-Bewertung, aber nicht als Hard-Fail-Code kennt
 * (Perspektiv-Abweichung, Crop, Occlusion, Glare, Aufloesung), werden hier
 * als eigene, klar getrennte Phase-1-Blocker gefuehrt.
 */
export const PHASE1_EXTRA_BLOCKER_CODES = [
  "PERSPECTIVE_MISMATCH",
  "CROP_VIOLATION",
  "OCCLUSION_VIOLATION",
  "GLARE_VIOLATION",
  "RESOLUTION_VIOLATION",
] as const;
export type Phase1ExtraBlockerCode = (typeof PHASE1_EXTRA_BLOCKER_CODES)[number];
export const Phase1ExtraBlockerCodeSchema = z.enum(PHASE1_EXTRA_BLOCKER_CODES);

export const IngestionBlockerCodeSchema = z.union([
  ReferenceHardFailCodeSchema,
  Phase1ExtraBlockerCodeSchema,
]);
export type IngestionBlockerCode = z.infer<typeof IngestionBlockerCodeSchema>;

export const BLOCKER_LABELS_DE: Record<IngestionBlockerCode, string> = {
  WRONG_VEHICLE_SIDE: "Falsche Fahrzeugseite",
  MIRRORED_REFERENCE: "Bild gespiegelt / geflippt",
  IDENTITY_CLUSTER_CONFLICT: "Anderes Fahrzeug (Identitätskonflikt)",
  FILE_UNAVAILABLE: "Datei nicht verfügbar",
  NO_VEHICLE_DETECTED: "Kein Fahrzeug erkannt",
  VEHICLE_CLASS_MISMATCH: "Falsche Fahrzeugklasse",
  PERSPECTIVE_MISMATCH: "Perspektive weicht zu stark ab",
  CROP_VIOLATION: "Fahrzeug angeschnitten",
  OCCLUSION_VIOLATION: "Zu starke Verdeckung",
  GLARE_VIOLATION: "Zu starke Reflexionen / Glare",
  RESOLUTION_VIOLATION: "Auflösung unzureichend",
};

/** Rolle einer Referenz. Sekundaere Referenzen sind NIE Primary-faehig. */
export const REFERENCE_ROLES = [
  "primary",
  "primary_candidate",
  "secondary_support",
  "rejected",
] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];
export const ReferenceRoleSchema = z.enum(REFERENCE_ROLES);

export const ASSET_PROTECTION_STATES = ["unprotected", "protected"] as const;
export type AssetProtectionState = (typeof ASSET_PROTECTION_STATES)[number];
export const AssetProtectionStateSchema = z.enum(ASSET_PROTECTION_STATES);

export const AssetHistoryEntrySchema = z
  .object({
    version: z.number().int().min(1),
    atIso: z.string().min(1),
    action: z.string().min(1),
    detail: z.string().min(1).optional(),
  })
  .strict();
export type AssetHistoryEntry = z.infer<typeof AssetHistoryEntrySchema>;

export const ReferenceAssetRecordSchema = z
  .object({
    id: z.string().min(1),
    vehicleMasterId: z.string().min(1),
    /** Vom Admin beim Capture gewaehlte Zielperspektive. */
    requestedPerspectiveId: PerspectiveIdSchema,
    fileName: z.string().min(1),
    /** Lokale Object-URL (kein Upload, kein Storage in Phase 1). */
    previewUrl: z.string().min(1),
    createdAtIso: z.string().min(1),
    intake: VisionIntakeResultSchema,
    /**
     * Phase 1.5: Nachweis der automatischen Vision-Analyse. OPTIONAL, damit
     * bestehende Phase-1-Records gueltig bleiben (backwards-safe).
     */
    analysis: ReferenceAnalysisRecordSchema.optional(),
    scores: MatchComponentScoresSchema,
    weightedScore: z.number().min(0).max(100),
    hardFailures: z.array(ReferenceHardFailCodeSchema),
    blockers: z.array(IngestionBlockerCodeSchema),
    warnings: z.array(z.string().min(1)),
    role: ReferenceRoleSchema,
    protection: AssetProtectionStateSchema,
    outputReadyFormats: z.array(OutputFormatSchema),
    version: z.number().int().min(1),
    history: z.array(AssetHistoryEntrySchema).nonempty(),
  })
  .strict()
  .superRefine((asset, ctx) => {
    const blocked = asset.blockers.length > 0 || asset.hardFailures.length > 0;
    if (blocked && asset.role !== "rejected") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["role"],
        message: "assets with blockers must be rejected (fail-closed)",
      });
    }
  });
export type ReferenceAssetRecord = z.infer<typeof ReferenceAssetRecordSchema>;

export const VehicleMasterRecordSchema = z
  .object({
    id: z.string().min(1),
    /** Interner Admin-Label. Nie Prompt-Input. */
    label: z.string().min(1),
    vehicleClass: VehicleClassV2Schema,
    colorFamily: ColorFamilySchema.nullable(),
    /** Cluster-ID fuer "gleiches physisches Fahrzeug". */
    identityClusterId: z.string().min(1),
    createdAtIso: z.string().min(1),
    version: z.number().int().min(1),
    history: z.array(AssetHistoryEntrySchema).nonempty(),
    assets: z.array(ReferenceAssetRecordSchema),
  })
  .strict();
export type VehicleMasterRecord = z.infer<typeof VehicleMasterRecordSchema>;

export const COMPLETENESS_WARNING_CODES = [
  "MISSING_COLOR_FAMILY",
  "MISSING_REQUIRED_PERSPECTIVE",
  "NO_PRIMARY_FOR_PERSPECTIVE",
  "ONLY_SECONDARY_AVAILABLE",
  "OUTPUT_FORMAT_NOT_READY",
  "REJECTED_ASSETS_PRESENT",
] as const;
export type CompletenessWarningCode =
  (typeof COMPLETENESS_WARNING_CODES)[number];

export interface CompletenessWarning {
  readonly code: CompletenessWarningCode;
  readonly perspectiveId?: PerspectiveId;
  readonly message: string;
}

export interface PerspectiveCoverage {
  readonly perspectiveId: PerspectiveId;
  readonly required: boolean;
  readonly primary?: ReferenceAssetRecord;
  readonly secondaries: readonly ReferenceAssetRecord[];
  readonly rejected: readonly ReferenceAssetRecord[];
  readonly status: z.infer<typeof ReferenceReadinessStatusSchema>;
}
