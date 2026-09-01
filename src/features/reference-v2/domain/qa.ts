import { z } from "zod";
import { PerspectiveIdSchema } from "./perspectives/types";

/**
 * Reference V2 — Post-Generation QA Schemas (Phase 0).
 *
 * Hard-Fail-Logik: Falsche Fahrzeugseite und Spiegelung sind IMMER Hard
 * Requirements — sie koennen durch keinen noch so hohen Score kompensiert
 * werden.
 */

export const QA_VERDICTS = ["PASS", "REPAIR", "NEEDS_REVIEW"] as const;
export type QaVerdict = (typeof QA_VERDICTS)[number];
export const QaVerdictSchema = z.enum(QA_VERDICTS);

export const QA_FINDING_SEVERITIES = ["critical", "major", "minor"] as const;
export type QaFindingSeverity = (typeof QA_FINDING_SEVERITIES)[number];
export const QaFindingSeveritySchema = z.enum(QA_FINDING_SEVERITIES);

export const QA_HARD_FAILURE_CODES = [
  "WRONG_VEHICLE_SIDE",
  "MIRRORED_OUTPUT",
  "IDENTITY_FEATURE_MISMATCH",
  "PERSPECTIVE_MISMATCH",
  "REFERENCE_CONTRADICTION",
] as const;
export type QaHardFailureCode = (typeof QA_HARD_FAILURE_CODES)[number];
export const QaHardFailureCodeSchema = z.enum(QA_HARD_FAILURE_CODES);

const Score100Schema = z.number().min(0).max(100);

export const QaPerspectiveCheckSchema = z
  .object({
    detectedPerspectiveId: PerspectiveIdSchema.optional(),
    detectedAzimuthDeg: z.number().gt(-180).max(180).optional(),
    requestedPerspectiveId: PerspectiveIdSchema,
    sideMatch: z.boolean(),
    mirrorDetected: z.boolean(),
    score: Score100Schema,
  })
  .strict();
export type QaPerspectiveCheck = z.infer<typeof QaPerspectiveCheckSchema>;

export const QaIdentityCheckSchema = z
  .object({
    overallScore: Score100Schema,
    criticalScore: Score100Schema,
    secondaryScore: Score100Schema,
    hardFailures: z.array(QaHardFailureCodeSchema),
  })
  .strict();
export type QaIdentityCheck = z.infer<typeof QaIdentityCheckSchema>;

export const QaFindingSchema = z
  .object({
    feature: z.string().min(1),
    severity: QaFindingSeveritySchema,
    issue: z.string().min(1),
    evidenceReferenceAssetId: z.string().min(1).optional(),
  })
  .strict();
export type QaFinding = z.infer<typeof QaFindingSchema>;

export const QaResultSchema = z
  .object({
    verdict: QaVerdictSchema,
    perspective: QaPerspectiveCheckSchema,
    identity: QaIdentityCheckSchema,
    findings: z.array(QaFindingSchema),
    confidence: Score100Schema,
    attemptNumber: z.number().int().min(1),
  })
  .strict();
export type QaResult = z.infer<typeof QaResultSchema>;

/**
 * START-SCHWELLEN (Phase 0) — bewusst als PROVISORISCH markiert.
 * Diese Werte sind Startpunkte fuer die empirische Kalibrierung in spaeteren
 * Phasen und duerfen NICHT als final betrachtet werden.
 */
export const QA_STRICT_REFERENCE_THRESHOLDS_V0 = {
  schemaVersion: 1,
  calibrationStatus: "provisional",
  /** Hard requirement — nicht kompensierbar. */
  requireSideMatch: true,
  /** Hard requirement — nicht kompensierbar. */
  forbidMirror: true,
  minPerspectiveScore: 92,
  minCriticalIdentityScore: 92,
  minSecondaryIdentityScore: 86,
  minConfidence: 88,
  maxHardFailures: 0,
  /** Insgesamt maximal 2 automatische Versuche (initial + 1 Repair). */
  maxAutomaticAttempts: 2,
} as const;
export type QaThresholds = typeof QA_STRICT_REFERENCE_THRESHOLDS_V0;

export interface QaMeasurements {
  readonly sideMatch: boolean;
  readonly mirrorDetected: boolean;
  readonly perspectiveScore: number;
  readonly criticalIdentityScore: number;
  readonly secondaryIdentityScore: number;
  readonly confidence: number;
  readonly hardFailures: readonly QaHardFailureCode[];
}

export interface QaVerdictDerivation {
  readonly verdict: QaVerdict;
  readonly hardFailed: boolean;
  readonly failedChecks: readonly string[];
}

/**
 * Leitet das Verdict deterministisch aus Messwerten ab.
 * - Hard Fails (falsche Seite, Spiegelung, Hard-Failure-Codes) fuehren NIE zu
 *   PASS — unabhaengig von allen Scores.
 * - Bei Fehlern: REPAIR solange attemptNumber < maxAutomaticAttempts,
 *   danach NEEDS_REVIEW.
 */
export function deriveQaVerdict(
  measurements: QaMeasurements,
  attemptNumber: number,
  thresholds: QaThresholds = QA_STRICT_REFERENCE_THRESHOLDS_V0,
): QaVerdictDerivation {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error(`deriveQaVerdict: invalid attemptNumber ${attemptNumber}`);
  }

  const failedChecks: string[] = [];
  let hardFailed = false;

  if (thresholds.requireSideMatch && !measurements.sideMatch) {
    failedChecks.push("SIDE_MISMATCH");
    hardFailed = true;
  }
  if (thresholds.forbidMirror && measurements.mirrorDetected) {
    failedChecks.push("MIRROR_DETECTED");
    hardFailed = true;
  }
  if (measurements.hardFailures.length > thresholds.maxHardFailures) {
    for (const code of measurements.hardFailures) {
      failedChecks.push(`HARD_FAILURE:${code}`);
    }
    hardFailed = true;
  }
  if (measurements.perspectiveScore < thresholds.minPerspectiveScore) {
    failedChecks.push("PERSPECTIVE_SCORE_BELOW_MIN");
  }
  if (
    measurements.criticalIdentityScore < thresholds.minCriticalIdentityScore
  ) {
    failedChecks.push("CRITICAL_IDENTITY_BELOW_MIN");
  }
  if (
    measurements.secondaryIdentityScore < thresholds.minSecondaryIdentityScore
  ) {
    failedChecks.push("SECONDARY_IDENTITY_BELOW_MIN");
  }
  if (measurements.confidence < thresholds.minConfidence) {
    failedChecks.push("CONFIDENCE_BELOW_MIN");
  }

  if (failedChecks.length === 0) {
    return { verdict: "PASS", hardFailed: false, failedChecks };
  }
  if (attemptNumber < thresholds.maxAutomaticAttempts) {
    return { verdict: "REPAIR", hardFailed, failedChecks };
  }
  return { verdict: "NEEDS_REVIEW", hardFailed, failedChecks };
}
