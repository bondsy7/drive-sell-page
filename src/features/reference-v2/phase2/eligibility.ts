import { z } from "zod";
import {
  PerspectiveIdSchema,
  isSideSensitivePerspective,
  type PerspectiveId,
} from "../domain/perspectives/types";
import { getPerspectiveSpec } from "../domain/perspectives/registry";
import { resolvePerspectiveIdsForClass } from "../domain/capability-profiles";
import { ReferenceHardFailCodeSchema } from "../domain/readiness";
import type { ReferenceHardFailCode } from "../domain/readiness";
import {
  IngestionBlockerCodeSchema,
  VehicleMasterRecordSchema,
  type IngestionBlockerCode,
  type ReferenceAssetRecord,
  type VehicleMasterRecord,
} from "../phase1/vehicle-master";
import { MIN_SAME_VEHICLE_CONFIDENCE } from "../phase1-5/analyzer-contract";
import {
  REFERENCE_V2_PROVIDER_ID,
  isAllowedReferenceV2Mime,
} from "../phase1-5/provider-adapter";
import {
  PlannerReasonSchema,
  resolveReferenceGeometryPerspectiveId,
  type PlannerReason,
} from "./planner-contract";

/**
 * Reference V2 — Phase 2.1: PURE ASSET ELIGIBILITY.
 *
 * Diese Datei beantwortet ausschliesslich die Frage: "Darf dieses Asset fuer
 * diese Zielperspektive ueberhaupt als Referenz in Betracht gezogen werden?"
 *
 * KERNPRINZIP: Die vom Analyzer erkannte visuelle Perspektive ist die Wahrheit.
 * `asset.requestedPerspectiveId` ist reine Admin-/Historie-Absicht und darf die
 * Eligibility NIEMALS bestimmen. Gespeicherte Phase-1-Scores sind zielabhaengig
 * berechnet worden und werden hier NICHT verwendet.
 *
 * KEIN Scoring, KEIN Ranking, KEINE Coverage, KEINE Auswahl, KEINE Adjazenz,
 * keine UI, keine Persistenz, keine Provider-Aufrufe. Reine Funktion ohne I/O.
 */

// --------------------------------------------------------------------------
// Legacy target-relative codes
// --------------------------------------------------------------------------

/**
 * Diese beiden gespeicherten Codes wurden in Phase 1 GEGEN
 * `asset.requestedPerspectiveId` berechnet. Fuer ein neues Ziel sind sie
 * bedeutungslos und werden hier ignoriert (aber protokolliert) und — wo
 * relevant — zielbezogen neu berechnet.
 */
export const IGNORED_LEGACY_TARGET_RELATIVE_CODES = [
  "WRONG_VEHICLE_SIDE",
  "PERSPECTIVE_MISMATCH",
] as const;
export type IgnoredLegacyTargetRelativeCode =
  (typeof IGNORED_LEGACY_TARGET_RELATIVE_CODES)[number];
export const IgnoredLegacyTargetRelativeCodeSchema = z.enum(
  IGNORED_LEGACY_TARGET_RELATIVE_CODES,
);

function isIgnoredLegacyCode(
  code: string,
): code is IgnoredLegacyTargetRelativeCode {
  return (IGNORED_LEGACY_TARGET_RELATIVE_CODES as readonly string[]).includes(
    code,
  );
}

function uniqueArray(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/** Deterministische Deduplizierung unter Beibehaltung der Einfuegereihenfolge. */
function dedupe<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// --------------------------------------------------------------------------
// Input contract
// --------------------------------------------------------------------------

export const ELIGIBILITY_INTENDED_ROLES = ["primary", "secondary"] as const;
export type EligibilityIntendedRole =
  (typeof ELIGIBILITY_INTENDED_ROLES)[number];
export const EligibilityIntendedRoleSchema = z.enum(ELIGIBILITY_INTENDED_ROLES);

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const AssetEligibilityInputSchema = z
  .object({
    vehicleMaster: VehicleMasterRecordSchema,
    assetId: z.string().min(1),
    targetPerspectiveId: PerspectiveIdSchema,
    intendedRole: EligibilityIntendedRoleSchema,
    nowIso: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((input, ctx) => {
    const matches = input.vehicleMaster.assets.filter(
      (a) => a.id === input.assetId,
    );
    if (matches.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetId"],
        message:
          matches.length === 0
            ? "assetId must exist in vehicleMaster.assets"
            : "assetId must exist exactly once in vehicleMaster.assets",
      });
    }
  });
export type AssetEligibilityInput = z.infer<typeof AssetEligibilityInputSchema>;

// --------------------------------------------------------------------------
// Result contract
// --------------------------------------------------------------------------

export const AssetEligibilityResultSchema = z
  .object({
    assetId: z.string().min(1),
    targetPerspectiveId: PerspectiveIdSchema,
    referenceGeometryPerspectiveId: PerspectiveIdSchema,
    detectedPerspectiveId: PerspectiveIdSchema.nullable(),
    intendedRole: EligibilityIntendedRoleSchema,
    selectable: z.boolean(),
    reviewRequired: z.boolean(),
    exactPerspective: z.boolean(),
    reasons: z.array(PlannerReasonSchema),
    hardFailures: z
      .array(ReferenceHardFailCodeSchema)
      .refine(uniqueArray, { message: "hardFailures must be unique" }),
    intrinsicBlockers: z
      .array(IngestionBlockerCodeSchema)
      .refine(uniqueArray, { message: "intrinsicBlockers must be unique" }),
    ignoredLegacyTargetRelativeCodes: z
      .array(IgnoredLegacyTargetRelativeCodeSchema)
      .refine(uniqueArray, {
        message: "ignoredLegacyTargetRelativeCodes must be unique",
      }),
  })
  .strict()
  .superRefine((result, ctx) => {
    const hasBlocking = result.reasons.some((r) => r.severity === "BLOCKING");
    const hasReview = result.reasons.some((r) => r.severity === "REVIEW");
    const disqualified =
      hasBlocking ||
      result.hardFailures.length > 0 ||
      result.intrinsicBlockers.length > 0;

    if (result.selectable && disqualified) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectable"],
        message:
          "selectable requires no BLOCKING reason, no hardFailures and no intrinsicBlockers",
      });
    }
    if (!result.selectable && !disqualified) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["selectable"],
        message:
          "non-selectable requires at least one BLOCKING reason, hardFailure or intrinsicBlocker",
      });
    }
    if (result.reviewRequired && !result.selectable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewRequired"],
        message: "reviewRequired implies selectable",
      });
    }
    if (result.reviewRequired && !hasReview) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewRequired"],
        message: "reviewRequired requires at least one REVIEW reason",
      });
    }
  });
export type AssetEligibilityResult = z.infer<
  typeof AssetEligibilityResultSchema
>;

export class AssetEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetEligibilityError";
  }
}

export function parseAssetEligibilityInput(
  value: unknown,
): AssetEligibilityInput {
  const parsed = AssetEligibilityInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new AssetEligibilityError(
      `invalid asset eligibility input: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

export function parseAssetEligibilityResult(
  value: unknown,
): AssetEligibilityResult {
  const parsed = AssetEligibilityResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new AssetEligibilityError(
      `invalid asset eligibility result: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function isValidIsoTimestamp(value: string): boolean {
  return IsoDateTimeSchema.safeParse(value).success;
}

/** Erwartete Fahrzeugseite — ausschliesslich aus der Registry abgeleitet. */
function requiredSideForGeometry(
  geometryId: PerspectiveId,
): "left_side" | "right_side" | null {
  const spec = getPerspectiveSpec(geometryId);
  if (!isSideSensitivePerspective(spec)) return null;
  if (spec.requiredVisibleSurfaces.includes("right_side")) return "right_side";
  if (spec.requiredVisibleSurfaces.includes("left_side")) return "left_side";
  return null;
}

function hasIntakeIssue(asset: ReferenceAssetRecord, code: string): boolean {
  return asset.intake.issues.some((i) => i.code === code);
}

function findAsset(
  master: VehicleMasterRecord,
  assetId: string,
): ReferenceAssetRecord {
  const asset = master.assets.find((a) => a.id === assetId);
  if (!asset) {
    // Durch die Input-Cross-Field-Validierung unerreichbar.
    throw new AssetEligibilityError(`asset ${assetId} not found in master`);
  }
  return asset;
}

// --------------------------------------------------------------------------
// Evaluator
// --------------------------------------------------------------------------

/**
 * Deterministische Auswertungsreihenfolge der Reasons:
 *  1. Ziel-Anwendbarkeit auf die Fahrzeugklasse
 *  2. Datei-/Analyse-Lifecycle (kein Record, Status, Provider, MIME, Ablauf)
 *  3. Intrinsische visuelle Sicherheit (Fahrzeug, Klasse, Identitaet, Mirror)
 *  4. Identitaets-Konfidenz (Review)
 *  5. PRIMARY: exakte Referenzgeometrie
 *  6. PRIMARY: zielbezogene Seiten-Evidenz
 *  7. PRIMARY: Promotion-Review
 * Innerhalb eines Schrittes ist die Reihenfolge fest verdrahtet; es wird
 * NICHT nach lokalisierten Texten sortiert.
 */
export function evaluateAssetEligibility(
  rawInput: unknown,
): AssetEligibilityResult {
  const input = parseAssetEligibilityInput(rawInput);
  const { vehicleMaster, assetId, targetPerspectiveId, intendedRole, nowIso } =
    input;
  const asset = findAsset(vehicleMaster, assetId);

  const reasons: PlannerReason[] = [];
  const hardFailures: ReferenceHardFailCode[] = [];
  const intrinsicBlockers: IngestionBlockerCode[] = [];
  const ignoredLegacy: IgnoredLegacyTargetRelativeCode[] = [];

  const add = (
    code: PlannerReason["code"],
    severity: PlannerReason["severity"],
    messageDe: string,
  ): void => {
    reasons.push({ code, severity, messageDe, assetId });
  };

  const referenceGeometryPerspectiveId =
    resolveReferenceGeometryPerspectiveId(targetPerspectiveId);
  const detectedPerspectiveId =
    asset.intake.pose.canonicalPerspectiveId ?? null;
  const exactPerspective =
    detectedPerspectiveId !== null &&
    detectedPerspectiveId === referenceGeometryPerspectiveId;

  // 1. Ziel-Anwendbarkeit
  const applicable = resolvePerspectiveIdsForClass(vehicleMaster.vehicleClass);
  if (!applicable.includes(targetPerspectiveId)) {
    add(
      "VEHICLE_CLASS_NOT_APPLICABLE",
      "BLOCKING",
      `Perspektive ${targetPerspectiveId} ist für die Fahrzeugklasse ${vehicleMaster.vehicleClass} nicht verfügbar.`,
    );
  }

  // 2. Lifecycle — fail closed
  const analysis = asset.analysis;
  if (!analysis) {
    add(
      "NO_ANALYSIS_RECORD",
      "BLOCKING",
      "Kein Analyse-Nachweis vorhanden (Phase-1.5-Analyse fehlt).",
    );
  } else {
    if (analysis.status !== "analyzed") {
      add(
        "FILE_NOT_ANALYZED",
        "BLOCKING",
        `Analyse nicht abgeschlossen (Status: ${analysis.status}).`,
      );
    }
    if (analysis.providerId !== REFERENCE_V2_PROVIDER_ID) {
      add(
        "FILE_PROVIDER_INVALID",
        "BLOCKING",
        "Dateireferenz stammt nicht vom zulässigen Reference-V2-Provider.",
      );
    }
    if (!isAllowedReferenceV2Mime(analysis.mimeType)) {
      add(
        "FILE_MIME_INVALID",
        "BLOCKING",
        "MIME-Type der Dateireferenz fehlt oder ist nicht zulässig.",
      );
    }
    const expiry = analysis.fileExpiresAtIso;
    if (expiry === undefined) {
      add(
        "FILE_EXPIRY_UNKNOWN",
        "REVIEW",
        "Ablaufzeitpunkt der Dateireferenz ist unbekannt.",
      );
    } else if (!isValidIsoTimestamp(expiry)) {
      add(
        "FILE_EXPIRY_UNKNOWN",
        "BLOCKING",
        "Lifecycle-Zeitstempel ungültig: Ablaufzeitpunkt der Dateireferenz ist nicht parsebar.",
      );
    } else if (Date.parse(expiry) <= Date.parse(nowIso)) {
      add(
        "FILE_EXPIRED",
        "BLOCKING",
        "Dateireferenz beim Provider ist abgelaufen.",
      );
    }
  }

  // 3. Intrinsische visuelle Sicherheit (Neuberechnung, fail closed)
  const intake = asset.intake;
  if (intake.vehicleDetected !== true) {
    hardFailures.push("NO_VEHICLE_DETECTED");
    add("NO_ANALYSIS_RECORD", "BLOCKING", "Kein Fahrzeug im Bild erkannt.");
  }
  if (
    intake.vehicleClass === undefined ||
    intake.vehicleClass !== vehicleMaster.vehicleClass
  ) {
    hardFailures.push("VEHICLE_CLASS_MISMATCH");
    add(
      "VEHICLE_CLASS_NOT_APPLICABLE",
      "BLOCKING",
      `Visuell erkannte Fahrzeugklasse (${intake.vehicleClass ?? "unbekannt"}) passt nicht zum Vehicle Master (${vehicleMaster.vehicleClass}).`,
    );
  }
  if (
    intake.identityClusterId === undefined ||
    intake.identityClusterId !== vehicleMaster.identityClusterId
  ) {
    hardFailures.push("IDENTITY_CLUSTER_CONFLICT");
    add(
      "IDENTITY_CLUSTER_MIXED",
      "BLOCKING",
      "Bild gehört nicht zum Identitäts-Cluster dieses Fahrzeugs.",
    );
  }
  if (
    hasIntakeIssue(asset, "MIRRORED_SUSPECTED") ||
    asset.hardFailures.includes("MIRRORED_REFERENCE") ||
    asset.blockers.includes("MIRRORED_REFERENCE")
  ) {
    hardFailures.push("MIRRORED_REFERENCE");
    add(
      "MIRROR_RISK",
      "BLOCKING",
      "Bild steht im Verdacht, gespiegelt zu sein.",
    );
  }
  if (hasIntakeIssue(asset, "IDENTITY_MISMATCH")) {
    hardFailures.push("IDENTITY_CLUSTER_CONFLICT");
    add(
      "IDENTITY_CLUSTER_MIXED",
      "BLOCKING",
      "Analyse meldet ein abweichendes Fahrzeug (Identitätskonflikt).",
    );
  }

  // 3b. Gespeicherte Codes: intrinsisch uebernehmen, zielrelative ignorieren
  for (const code of asset.hardFailures) {
    if (isIgnoredLegacyCode(code)) {
      ignoredLegacy.push(code);
      continue;
    }
    hardFailures.push(code);
  }
  for (const code of asset.blockers) {
    if (isIgnoredLegacyCode(code)) {
      ignoredLegacy.push(code);
      continue;
    }
    intrinsicBlockers.push(code);
  }

  // 4. Identitaets-Konfidenz
  const identityConflict = hardFailures.includes("IDENTITY_CLUSTER_CONFLICT");
  if (
    !identityConflict &&
    intake.sameVehicleConfidence !== undefined &&
    intake.sameVehicleConfidence < MIN_SAME_VEHICLE_CONFIDENCE
  ) {
    add(
      "IDENTITY_CONFIDENCE_LOW",
      "REVIEW",
      `Identitäts-Konfidenz ${intake.sameVehicleConfidence} liegt unter ${MIN_SAME_VEHICLE_CONFIDENCE}.`,
    );
  }

  if (intendedRole === "primary") {
    // 5. Exakte Referenzgeometrie
    if (!exactPerspective) {
      add(
        "EXACT_REFERENCE_MISSING",
        "BLOCKING",
        `Erkannte Perspektive (${detectedPerspectiveId ?? "unbekannt"}) entspricht nicht der Referenzgeometrie ${referenceGeometryPerspectiveId}.`,
      );
    } else {
      // 6. Zielbezogene Seiten-Evidenz (nur bei exakter Geometrie sinnvoll)
      const side = requiredSideForGeometry(referenceGeometryPerspectiveId);
      if (side !== null) {
        const wanted =
          side === "right_side"
            ? intake.visibility.rightSide
            : intake.visibility.leftSide;
        const opposite =
          side === "right_side"
            ? intake.visibility.leftSide
            : intake.visibility.rightSide;
        if (wanted <= 0 || wanted <= opposite) {
          add(
            "SIDE_EVIDENCE_MISSING",
            "BLOCKING",
            `Erforderliche Fahrzeugseite (${side}) ist nicht eindeutig belegt.`,
          );
        }
      }
    }

    // 7. Promotion-Review
    if (asset.role !== "primary") {
      add(
        "PRIMARY_NOT_PROMOTED",
        "REVIEW",
        `Asset ist aktuell nicht als Primary freigegeben (Rolle: ${asset.role}).`,
      );
    }
  }

  const uniqueHardFailures = dedupe(hardFailures);
  const uniqueIntrinsicBlockers = dedupe(intrinsicBlockers);
  const uniqueIgnored = dedupe(ignoredLegacy);
  const hasBlocking = reasons.some((r) => r.severity === "BLOCKING");
  const selectable =
    !hasBlocking &&
    uniqueHardFailures.length === 0 &&
    uniqueIntrinsicBlockers.length === 0;
  const reviewRequired =
    selectable && reasons.some((r) => r.severity === "REVIEW");

  return parseAssetEligibilityResult({
    assetId,
    targetPerspectiveId,
    referenceGeometryPerspectiveId,
    detectedPerspectiveId,
    intendedRole,
    selectable,
    reviewRequired,
    exactPerspective,
    reasons,
    hardFailures: uniqueHardFailures,
    intrinsicBlockers: uniqueIntrinsicBlockers,
    ignoredLegacyTargetRelativeCodes: uniqueIgnored,
  });
}
