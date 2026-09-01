import { z } from "zod";
import { PerspectiveIdSchema } from "./perspectives/types";

/**
 * Reference V2 — Reference Readiness / Matching Domain Types (Phase 0).
 *
 * Readiness beschreibt, ob fuer einen OutputRequest ausreichend belastbare
 * Referenzen existieren. Hard-Fail-Regeln sind SEPARAT typisiert und duerfen
 * NIEMALS durch einen hohen Gesamtscore kompensiert werden (insbesondere:
 * falsche linke/rechte Fahrzeugseite).
 */

export const REFERENCE_READINESS_STATUSES = [
  "READY_EXACT",
  "READY_MULTI_REFERENCE",
  "NEEDS_CONFIRMATION",
  "INSUFFICIENT_REFERENCE",
  "BLOCKED_IDENTITY_CONFLICT",
  "BLOCKED_FILE_UNAVAILABLE",
] as const;
export type ReferenceReadinessStatus =
  (typeof REFERENCE_READINESS_STATUSES)[number];
export const ReferenceReadinessStatusSchema = z.enum(
  REFERENCE_READINESS_STATUSES,
);

/** Hard-Fail-Codes — jeder einzelne disqualifiziert eine Referenz komplett. */
export const REFERENCE_HARD_FAIL_CODES = [
  "WRONG_VEHICLE_SIDE",
  "MIRRORED_REFERENCE",
  "IDENTITY_CLUSTER_CONFLICT",
  "FILE_UNAVAILABLE",
  "NO_VEHICLE_DETECTED",
  "VEHICLE_CLASS_MISMATCH",
] as const;
export type ReferenceHardFailCode = (typeof REFERENCE_HARD_FAIL_CODES)[number];
export const ReferenceHardFailCodeSchema = z.enum(REFERENCE_HARD_FAIL_CODES);

/**
 * Scoring-Gewichte fuer das Referenz-Matching (Summe = 1.0):
 *   40% Kamerawinkel-Naehe
 *   25% korrekte Fahrzeugseite/-flaeche
 *   15% Abdeckung der geforderten Flaechen
 *   10% Qualitaet
 *   10% Framing
 */
export const MATCH_SCORE_WEIGHTS = {
  cameraAngle: 0.4,
  sideAndSurfaceCorrectness: 0.25,
  requiredSurfaceCoverage: 0.15,
  quality: 0.1,
  framing: 0.1,
} as const;

const Score100Schema = z.number().min(0).max(100);

export const MatchComponentScoresSchema = z
  .object({
    cameraAngle: Score100Schema,
    sideAndSurfaceCorrectness: Score100Schema,
    requiredSurfaceCoverage: Score100Schema,
    quality: Score100Schema,
    framing: Score100Schema,
  })
  .strict();
export type MatchComponentScores = z.infer<typeof MatchComponentScoresSchema>;

/** Gewichteter Gesamtscore 0..100. */
export function computeWeightedMatchScore(scores: MatchComponentScores): number {
  const total =
    scores.cameraAngle * MATCH_SCORE_WEIGHTS.cameraAngle +
    scores.sideAndSurfaceCorrectness *
      MATCH_SCORE_WEIGHTS.sideAndSurfaceCorrectness +
    scores.requiredSurfaceCoverage *
      MATCH_SCORE_WEIGHTS.requiredSurfaceCoverage +
    scores.quality * MATCH_SCORE_WEIGHTS.quality +
    scores.framing * MATCH_SCORE_WEIGHTS.framing;
  return Math.round(total * 10000) / 10000;
}

export interface ReferenceCandidateEvaluation {
  /** false, sobald mindestens ein Hard-Fail vorliegt — unabhaengig vom Score. */
  readonly eligible: boolean;
  readonly weightedScore: number;
  readonly hardFailures: readonly ReferenceHardFailCode[];
}

/**
 * Hard-Fail-Regel: Ein Kandidat mit Hard-Fail (z. B. falsche Fahrzeugseite)
 * ist NIEMALS waehlbar, egal wie hoch der gewichtete Score ist.
 */
export function evaluateReferenceCandidate(
  scores: MatchComponentScores,
  hardFailures: readonly ReferenceHardFailCode[],
): ReferenceCandidateEvaluation {
  return {
    eligible: hardFailures.length === 0,
    weightedScore: computeWeightedMatchScore(scores),
    hardFailures,
  };
}

export const MatchWarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();
export type MatchWarning = z.infer<typeof MatchWarningSchema>;

export const OutputRequestMatchResultBaseSchema = z
  .object({
    outputRequestId: z.string().min(1),
    perspectiveSpecId: PerspectiveIdSchema,
    perspectiveSpecVersion: z.number().int().min(1),
    status: ReferenceReadinessStatusSchema,
    primaryReferenceAssetId: z.string().min(1).optional(),
    secondaryReferenceAssetIds: z.array(z.string().min(1)).default([]),
    scores: MatchComponentScoresSchema.optional(),
    weightedScore: Score100Schema.optional(),
    hardFailures: z.array(ReferenceHardFailCodeSchema).default([]),
    warnings: z.array(MatchWarningSchema).default([]),
  })
  .strict();

/** Hard-Fail-Codes, die einen Identitaetskonflikt belegen. */
export const IDENTITY_HARD_FAIL_CODES: readonly ReferenceHardFailCode[] = [
  "IDENTITY_CLUSTER_CONFLICT",
  "VEHICLE_CLASS_MISMATCH",
  "NO_VEHICLE_DETECTED",
];

/** Hard-Fail-Codes, die eine nicht verfuegbare Datei belegen. */
export const FILE_HARD_FAIL_CODES: readonly ReferenceHardFailCode[] = [
  "FILE_UNAVAILABLE",
];

export const OutputRequestMatchResultSchema =
  OutputRequestMatchResultBaseSchema.superRefine((v, ctx) => {
    const isReady =
      v.status === "READY_EXACT" || v.status === "READY_MULTI_REFERENCE";
    if (isReady && v.primaryReferenceAssetId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryReferenceAssetId"],
        message: "READY_* status requires a primaryReferenceAssetId",
      });
    }
    if (isReady && v.hardFailures.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hardFailures"],
        message: "READY_* status must not carry hard failures",
      });
    }
    if (
      v.status === "READY_MULTI_REFERENCE" &&
      v.secondaryReferenceAssetIds.length < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryReferenceAssetIds"],
        message:
          "READY_MULTI_REFERENCE requires a primary plus at least one secondary reference",
      });
    }
    if (
      v.primaryReferenceAssetId !== undefined &&
      v.secondaryReferenceAssetIds.includes(v.primaryReferenceAssetId)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryReferenceAssetIds"],
        message: "primary reference must not repeat in the secondaries",
      });
    }
    if (v.status === "BLOCKED_IDENTITY_CONFLICT") {
      const hasIdentityFailure = v.hardFailures.some((code) =>
        IDENTITY_HARD_FAIL_CODES.includes(code),
      );
      if (!hasIdentityFailure) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hardFailures"],
          message: `BLOCKED_IDENTITY_CONFLICT requires one of: ${IDENTITY_HARD_FAIL_CODES.join(", ")}`,
        });
      }
    }
    if (v.status === "BLOCKED_FILE_UNAVAILABLE") {
      const hasFileFailure = v.hardFailures.some((code) =>
        FILE_HARD_FAIL_CODES.includes(code),
      );
      if (!hasFileFailure) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hardFailures"],
          message: `BLOCKED_FILE_UNAVAILABLE requires one of: ${FILE_HARD_FAIL_CODES.join(", ")}`,
        });
      }
    }
  });

export type OutputRequestMatchResult = z.infer<
  typeof OutputRequestMatchResultSchema
>;
