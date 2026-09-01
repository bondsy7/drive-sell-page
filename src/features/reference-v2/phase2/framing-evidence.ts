import { z } from "zod";
import {
  PerspectiveIdSchema,
  type PerspectiveId,
} from "../domain/perspectives/types";
import {
  OutputFormatSchema,
  evaluateOutputFormatReadiness,
  type OutputFormat,
} from "../phase1/output-format-policy";
import { resolveReferenceGeometryPerspectiveId } from "./planner-contract";
import { assertNoSemanticIdentity } from "../phase1-5/analyzer-contract";

/**
 * Reference V2 — Phase 2.4A: Current Framing Evidence + reiner
 * Output-Format-Evaluator.
 *
 * Autoritaet ist AUSSCHLIESSLICH die uebergebene aktuelle Framing-Evidenz,
 * niemals gespeicherte Phase-1-Felder eines Asset-Records. Die Crop-Policy
 * selbst wird nicht dupliziert, sondern aus Phase 1 wiederverwendet.
 * Rein/deterministisch: kein I/O, keine Zeit, kein Zufall, kein DOM.
 */

export const CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION = 1;

// --------------------------------------------------------------------------
// Evidence
// --------------------------------------------------------------------------

const FiniteNumber = z.number().finite();

export const CurrentFramingEvidenceSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION),
    assetId: z.string().min(1),
    sourceAspectRatio: FiniteNumber.positive(),
    fullVehicleVisible: z.boolean(),
    cropped: z.boolean(),
    paddingPct: FiniteNumber.min(0),
  })
  .strict();
export type CurrentFramingEvidence = z.infer<typeof CurrentFramingEvidenceSchema>;

// --------------------------------------------------------------------------
// Evaluation input
// --------------------------------------------------------------------------

export const CurrentFramingEvaluationInputSchema = z
  .object({
    evidence: CurrentFramingEvidenceSchema,
    targetPerspectiveId: PerspectiveIdSchema,
    requestedFormats: z
      .array(OutputFormatSchema)
      .refine((f) => new Set(f).size === f.length, {
        message: "requestedFormats must be unique",
      }),
  })
  .strict();
export type CurrentFramingEvaluationInput = z.infer<
  typeof CurrentFramingEvaluationInputSchema
>;

// --------------------------------------------------------------------------
// Result
// --------------------------------------------------------------------------

export const CurrentFormatReadinessSchema = z
  .object({
    format: OutputFormatSchema,
    ready: z.boolean(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type CurrentFormatReadiness = z.infer<typeof CurrentFormatReadinessSchema>;

/**
 * Effektive Vollfahrzeug-Sichtbarkeit: angeschnittene Quellen fallen immer
 * fail-closed, auch wenn der Analyzer widerspruechlich `fullVehicleVisible`
 * meldet. Die Evidenz selbst wird dabei nicht veraendert.
 */
function effectiveFullVehicleVisible(evidence: CurrentFramingEvidence): boolean {
  return evidence.fullVehicleVisible && !evidence.cropped;
}

function policyReadiness(
  geometryId: PerspectiveId,
  evidence: CurrentFramingEvidence,
): ReadonlyMap<OutputFormat, CurrentFormatReadiness> {
  const results = evaluateOutputFormatReadiness(geometryId, {
    sourceAspectRatio: evidence.sourceAspectRatio,
    fullVehicleVisible: effectiveFullVehicleVisible(evidence),
    paddingPct: evidence.paddingPct,
  });
  return new Map(
    results.map((r) => [
      r.format,
      r.reason === undefined
        ? { format: r.format, ready: r.ready }
        : { format: r.format, ready: r.ready, reason: r.reason },
    ]),
  );
}

export const CurrentFramingAssessmentSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION),
    assetId: z.string().min(1),
    targetPerspectiveId: PerspectiveIdSchema,
    referenceGeometryPerspectiveId: PerspectiveIdSchema,
    evidence: CurrentFramingEvidenceSchema,
    requestedFormats: z.array(OutputFormatSchema),
    readiness: z.array(CurrentFormatReadinessSchema),
    allRequestedFormatsReady: z.boolean(),
  })
  .strict()
  .superRefine((result, ctx) => {
    if (result.assetId !== result.evidence.assetId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assetId"],
        message: "assetId must equal evidence.assetId",
      });
    }
    if (new Set(result.requestedFormats).size !== result.requestedFormats.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestedFormats"],
        message: "requestedFormats must be unique",
      });
    }
    const expectedGeometry = resolveReferenceGeometryPerspectiveId(
      result.targetPerspectiveId,
    );
    if (result.referenceGeometryPerspectiveId !== expectedGeometry) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referenceGeometryPerspectiveId"],
        message: `referenceGeometryPerspectiveId must be ${expectedGeometry}`,
      });
      return;
    }
    if (result.readiness.length !== result.requestedFormats.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["readiness"],
        message: "readiness must contain exactly one entry per requested format",
      });
      return;
    }
    const expected = policyReadiness(expectedGeometry, result.evidence);
    result.requestedFormats.forEach((format, index) => {
      const entry = result.readiness[index];
      if (entry.format !== format) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["readiness", index, "format"],
          message: `readiness order must mirror requestedFormats (expected ${format})`,
        });
        return;
      }
      const want = expected.get(format);
      if (!want) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["readiness", index],
          message: `no frozen policy result for format ${format}`,
        });
        return;
      }
      if (entry.ready !== want.ready) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["readiness", index, "ready"],
          message: "ready must mirror the frozen output-format policy",
        });
      }
      if (entry.reason !== want.reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["readiness", index, "reason"],
          message: "reason must mirror the frozen output-format policy",
        });
      }
    });
    const allReady = result.readiness.every((r) => r.ready);
    if (result.allRequestedFormatsReady !== allReady) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allRequestedFormatsReady"],
        message: "allRequestedFormatsReady must equal readiness.every(ready)",
      });
    }
  });
export type CurrentFramingAssessment = z.infer<
  typeof CurrentFramingAssessmentSchema
>;

// --------------------------------------------------------------------------
// Parsing
// --------------------------------------------------------------------------

export class CurrentFramingEvidenceError extends Error {
  readonly issues: readonly string[];
  constructor(label: string, issues: readonly string[]) {
    super(`${label} invalid: ${issues.join("; ")}`);
    this.name = "CurrentFramingEvidenceError";
    this.issues = issues;
  }
}

function parseStrict<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  label: string,
): z.infer<T> {
  assertNoSemanticIdentity(raw, label);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new CurrentFramingEvidenceError(
      label,
      parsed.error.issues.map(
        (i) => `${i.path.join(".") || "root"}: ${i.message}`,
      ),
    );
  }
  assertNoSemanticIdentity(parsed.data, label);
  return parsed.data;
}

export function parseCurrentFramingEvidence(raw: unknown): CurrentFramingEvidence {
  return parseStrict(CurrentFramingEvidenceSchema, raw, "current framing evidence");
}

export function parseCurrentFramingEvaluationInput(
  raw: unknown,
): CurrentFramingEvaluationInput {
  return parseStrict(
    CurrentFramingEvaluationInputSchema,
    raw,
    "current framing evaluation input",
  );
}

export function parseCurrentFramingAssessment(
  raw: unknown,
): CurrentFramingAssessment {
  return parseStrict(
    CurrentFramingAssessmentSchema,
    raw,
    "current framing assessment",
  );
}

// --------------------------------------------------------------------------
// Public evaluator
// --------------------------------------------------------------------------

export function evaluateCurrentFramingEvidence(
  rawInput: unknown,
): CurrentFramingAssessment {
  const input = parseCurrentFramingEvaluationInput(rawInput);
  const geometryId = resolveReferenceGeometryPerspectiveId(
    input.targetPerspectiveId,
  );
  const byFormat = policyReadiness(geometryId, input.evidence);

  const readiness: CurrentFormatReadiness[] = input.requestedFormats.map(
    (format) => {
      const entry = byFormat.get(format);
      if (!entry) {
        throw new CurrentFramingEvidenceError("current framing assessment", [
          `no frozen policy result for format ${format}`,
        ]);
      }
      return entry;
    },
  );

  return parseCurrentFramingAssessment({
    schemaVersion: CURRENT_FRAMING_EVIDENCE_SCHEMA_VERSION,
    assetId: input.evidence.assetId,
    targetPerspectiveId: input.targetPerspectiveId,
    referenceGeometryPerspectiveId: geometryId,
    evidence: { ...input.evidence },
    requestedFormats: [...input.requestedFormats],
    readiness,
    allRequestedFormatsReady: readiness.every((r) => r.ready),
  });
}
