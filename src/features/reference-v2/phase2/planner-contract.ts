import { z } from "zod";
import {
  PerspectiveIdSchema,
  type PerspectiveId,
} from "../domain/perspectives/types";
import {
  VisualSurfaceSchema,
  WheelPositionSchema,
} from "../domain/surfaces";
import { ReferenceReadinessStatusSchema } from "../domain/readiness";
import { VehicleMasterRecordSchema } from "../phase1/vehicle-master";
import { OutputFormatSchema } from "../phase1/output-format-policy";
import { assertNoSemanticIdentity } from "../phase1-5/analyzer-contract";

/**
 * Reference V2 — Phase 2.0: Planner CONTRACTS ONLY.
 *
 * Diese Datei enthaelt ausschliesslich Vertraege (Zod-Schemas, Enums,
 * Reason-Codes) fuer den Reference Coverage & Output Planner. Es gibt hier
 * KEINE Matching-, Scoring-, Coverage- oder Auswahl-Logik, keine UI, keine
 * Persistenz und keine Provider-Aufrufe. Alle Domain-Begriffe (Perspektiven,
 * Surfaces, Radpositionen, Readiness-Status, Output-Formate, Vehicle Master)
 * werden aus Phase 0/1/1.5 wiederverwendet und NICHT dupliziert.
 */

export const PHASE2_PLANNER_VERSION = 1;

/** Harte Obergrenze fuer sekundaere Referenzen (Schema-Cap, nicht Policy). */
export const PHASE2_MAX_SECONDARY_REFERENCES = 2;

// --------------------------------------------------------------------------
// Planner state
// --------------------------------------------------------------------------

export const PLANNER_STATES = ["READY", "REVIEW", "BLOCKED"] as const;
export type PlannerState = (typeof PLANNER_STATES)[number];
export const PlannerStateSchema = z.enum(PLANNER_STATES);

// --------------------------------------------------------------------------
// Reason codes
// --------------------------------------------------------------------------

export const PLANNER_REASON_CODES = [
  "NO_ELIGIBLE_PRIMARY",
  "PRIMARY_NOT_PROMOTED",
  "EXACT_REFERENCE_MISSING",
  "ADJACENT_SUBSTITUTION_APPLIED",
  "ADJACENT_SUBSTITUTION_REFUSED",
  "REQUIRED_SURFACE_UNPROVEN",
  "SCORE_BELOW_MINIMUM",
  "OUTPUT_FORMAT_NOT_READY",
  "VEHICLE_CLASS_NOT_APPLICABLE",
  "IDENTITY_CLUSTER_MIXED",
  "IDENTITY_CONFIDENCE_LOW",
  "MIRROR_RISK",
  "SIDE_EVIDENCE_MISSING",
  "FILE_NOT_ANALYZED",
  "FILE_PROVIDER_INVALID",
  "FILE_MIME_INVALID",
  "FILE_EXPIRED",
  "FILE_EXPIRY_UNKNOWN",
  "SECONDARY_BUDGET_TRUNCATED",
  "NO_ANALYSIS_RECORD",
] as const;
export type PlannerReasonCode = (typeof PLANNER_REASON_CODES)[number];
export const PlannerReasonCodeSchema = z.enum(PLANNER_REASON_CODES);

export const PLANNER_REASON_SEVERITIES = ["INFO", "REVIEW", "BLOCKING"] as const;
export type PlannerReasonSeverity = (typeof PLANNER_REASON_SEVERITIES)[number];
export const PlannerReasonSeveritySchema = z.enum(PLANNER_REASON_SEVERITIES);

/** Nur primitive Metadaten, maximal 8 Schluessel — keine verschachtelten Objekte. */
export const PlannerReasonMetadataSchema = z
  .record(z.union([z.number(), z.string(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 8, {
    message: "metadata supports at most 8 keys",
  });

export const PlannerReasonSchema = z
  .object({
    code: PlannerReasonCodeSchema,
    severity: PlannerReasonSeveritySchema,
    messageDe: z.string().min(1),
    assetId: z.string().min(1).optional(),
    surface: VisualSurfaceSchema.optional(),
    metadata: PlannerReasonMetadataSchema.optional(),
  })
  .strict();
export type PlannerReason = z.infer<typeof PlannerReasonSchema>;

// --------------------------------------------------------------------------
// Coverage (contract only)
// --------------------------------------------------------------------------

export const SurfaceCoverageItemSchema = z
  .object({
    surface: VisualSurfaceSchema,
    visibilityScore: z.number().min(0).max(1),
    met: z.boolean(),
    sourceAssetIds: z
      .array(z.string().min(1))
      .refine((ids) => new Set(ids).size === ids.length, {
        message: "sourceAssetIds must be unique",
      }),
  })
  .strict();
export type SurfaceCoverageItem = z.infer<typeof SurfaceCoverageItemSchema>;

const uniqueArray = <T>(values: readonly T[]) =>
  new Set(values).size === values.length;

export const PlannerCoverageSchema = z
  .object({
    requiredSurfaces: z
      .array(VisualSurfaceSchema)
      .nonempty()
      .refine(uniqueArray, { message: "requiredSurfaces must be unique" }),
    items: z.array(SurfaceCoverageItemSchema),
    allMandatorySurfacesMet: z.boolean(),
    requiredWheelPositions: z
      .array(WheelPositionSchema)
      .refine(uniqueArray, { message: "requiredWheelPositions must be unique" }),
    visibleWheelPositions: z
      .array(WheelPositionSchema)
      .refine(uniqueArray, { message: "visibleWheelPositions must be unique" }),
  })
  .strict()
  .superRefine((coverage, ctx) => {
    const surfaces = coverage.items.map((i) => i.surface);
    if (!uniqueArray(surfaces)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "coverage items must be unique by surface",
      });
      return;
    }
    const required = new Set<string>(coverage.requiredSurfaces);
    const present = new Set<string>(surfaces);
    const missing = [...required].filter((s) => !present.has(s));
    const extra = surfaces.filter((s) => !required.has(s));
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: `missing coverage item for required surface(s): ${missing.join(", ")}`,
      });
    }
    if (extra.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: `coverage item(s) outside requiredSurfaces: ${extra.join(", ")}`,
      });
    }
    if (missing.length > 0 || extra.length > 0) return;
    const allMet = coverage.items.every((i) => i.met);
    if (coverage.allMandatorySurfacesMet !== allMet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allMandatorySurfacesMet"],
        message: "allMandatorySurfacesMet must equal items.every(item => item.met)",
      });
    }
  });

export type PlannerCoverage = z.infer<typeof PlannerCoverageSchema>;

// --------------------------------------------------------------------------
// Reference selection (contract only)
// --------------------------------------------------------------------------

export const SelectedPrimaryReferenceSchema = z
  .object({
    assetId: z.string().min(1),
    perspectiveId: PerspectiveIdSchema,
    role: z.literal("primary"),
    exactPerspective: z.boolean(),
  })
  .strict();
export type SelectedPrimaryReference = z.infer<
  typeof SelectedPrimaryReferenceSchema
>;

export const SelectedSecondaryReferenceSchema = z
  .object({
    assetId: z.string().min(1),
    perspectiveId: PerspectiveIdSchema,
    role: z.literal("secondary"),
    /** Eine sekundaere Referenz ohne deklarierten Scope ist unzulaessig. */
    scopes: z
      .array(VisualSurfaceSchema)
      .nonempty()
      .refine(uniqueArray, { message: "scopes must be unique" }),
  })
  .strict();
export type SelectedSecondaryReference = z.infer<
  typeof SelectedSecondaryReferenceSchema
>;

export const ReferenceSelectionSchema = z
  .object({
    primary: SelectedPrimaryReferenceSchema.optional(),
    secondaryReferences: z
      .array(SelectedSecondaryReferenceSchema)
      .max(PHASE2_MAX_SECONDARY_REFERENCES),
  })
  .strict()
  .superRefine((selection, ctx) => {
    const secondaryIds = selection.secondaryReferences.map((s) => s.assetId);
    if (!uniqueArray(secondaryIds)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryReferences"],
        message: "secondary asset IDs must be unique",
      });
    }
    if (selection.primary && secondaryIds.includes(selection.primary.assetId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryReferences"],
        message: "primary asset cannot also be a secondary reference",
      });
    }
  });
export type ReferenceSelection = z.infer<typeof ReferenceSelectionSchema>;

// --------------------------------------------------------------------------
// Substitution (contract only — no adjacency implementation in Phase 2.0)
// --------------------------------------------------------------------------

export const ReferenceSubstitutionSchema = z
  .object({
    sourcePerspectiveId: PerspectiveIdSchema,
    targetPerspectiveId: PerspectiveIdSchema,
    azimuthDeltaDeg: z.number().min(0).max(180),
    rationale: z.string().min(1),
  })
  .strict();
export type ReferenceSubstitution = z.infer<typeof ReferenceSubstitutionSchema>;

// --------------------------------------------------------------------------
// Output-format readiness (narrow Phase-2 wrapper)
// --------------------------------------------------------------------------

/**
 * Phase 1 exportiert fuer Output-Format-Readiness nur das TS-Interface
 * `OutputFormatReadiness`, kein Zod-Schema. Statt Phase 1 anzufassen (frozen)
 * spiegelt dieses Schema exakt dieselben Felder und verwendet das bestehende
 * `OutputFormatSchema` — identische Semantik, keine Duplizierung der
 * Format-Definition.
 */
export const PlannerOutputFormatReadinessSchema = z
  .object({
    format: OutputFormatSchema,
    ready: z.boolean(),
    reason: z.string().min(1).optional(),
  })
  .strict();
export type PlannerOutputFormatReadiness = z.infer<
  typeof PlannerOutputFormatReadinessSchema
>;

// --------------------------------------------------------------------------
// Planner item
// --------------------------------------------------------------------------

/** Fine-grained Readiness-Status, die zu state=BLOCKED gehoeren. */
const BLOCKED_READINESS_STATUSES = new Set<
  z.infer<typeof ReferenceReadinessStatusSchema>
>(["INSUFFICIENT_REFERENCE", "BLOCKED_IDENTITY_CONFLICT", "BLOCKED_FILE_UNAVAILABLE"]);

export const PlannerItemSchema = z
  .object({
    perspectiveSpecId: PerspectiveIdSchema,
    perspectiveSpecVersion: z.number().int().min(1),
    state: PlannerStateSchema,
    fineGrainedReadiness: ReferenceReadinessStatusSchema,
    selection: ReferenceSelectionSchema,
    coverage: PlannerCoverageSchema,
    outputFormatReadiness: z.array(PlannerOutputFormatReadinessSchema),
    substitution: ReferenceSubstitutionSchema.nullable(),
    reasons: z.array(PlannerReasonSchema),
    generationAllowed: z.boolean(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const hasBlocking = item.reasons.some((r) => r.severity === "BLOCKING");
    if (item.state === "BLOCKED") {
      if (item.generationAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["generationAllowed"],
          message: "BLOCKED items must not allow generation",
        });
      }
      if (!hasBlocking) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasons"],
          message: "BLOCKED items require at least one BLOCKING reason",
        });
      }
      if (!BLOCKED_READINESS_STATUSES.has(item.fineGrainedReadiness)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fineGrainedReadiness"],
          message: "BLOCKED requires a blocking/insufficient readiness status",
        });
      }
    }

    if (item.state === "READY") {
      if (!item.generationAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["generationAllowed"],
          message: "READY items must allow generation",
        });
      }
      const primary = item.selection.primary;
      if (!primary) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selection", "primary"],
          message: "READY requires a primary reference",
        });
      } else {
        if (!primary.exactPerspective) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["selection", "primary", "exactPerspective"],
            message: "READY requires an exact primary perspective",
          });
        }
        if (primary.perspectiveId !== item.perspectiveSpecId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["selection", "primary", "perspectiveId"],
            message: "READY primary perspective must equal perspectiveSpecId",
          });
        }
      }
      if (!item.coverage.allMandatorySurfacesMet) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["coverage", "allMandatorySurfacesMet"],
          message: "READY requires all mandatory surfaces to be met",
        });
      }
      if (!item.outputFormatReadiness.every((f) => f.ready)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["outputFormatReadiness"],
          message: "READY requires every requested output format to be ready",
        });
      }
      if (hasBlocking) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasons"],
          message: "READY must not carry BLOCKING reasons",
        });
      }
      if (item.substitution !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["substitution"],
          message: "READY must not use a substitution",
        });
      }
      if (
        item.fineGrainedReadiness !== "READY_EXACT" &&
        item.fineGrainedReadiness !== "READY_MULTI_REFERENCE"
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fineGrainedReadiness"],
          message: "READY requires READY_EXACT or READY_MULTI_REFERENCE",
        });
      }
      if (
        item.fineGrainedReadiness === "READY_MULTI_REFERENCE" &&
        item.selection.secondaryReferences.length < 1
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selection", "secondaryReferences"],
          message: "READY_MULTI_REFERENCE requires at least one secondary",
        });
      }
    }
    if (item.state === "REVIEW") {
      if (item.generationAllowed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["generationAllowed"],
          message: "REVIEW must not allow generation in Phase 2.0",
        });
      }
      if (item.fineGrainedReadiness !== "NEEDS_CONFIRMATION") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fineGrainedReadiness"],
          message: "REVIEW requires NEEDS_CONFIRMATION",
        });
      }
    }
    if (item.substitution) {
      if (item.substitution.targetPerspectiveId !== item.perspectiveSpecId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["substitution", "targetPerspectiveId"],
          message: "substitution target must equal perspectiveSpecId",
        });
      }
      const primary = item.selection.primary;
      if (
        primary &&
        primary.perspectiveId !== item.substitution.sourcePerspectiveId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["substitution", "sourcePerspectiveId"],
          message: "substitution source must equal the primary perspective",
        });
      }
    }
  });

export type PlannerItem = z.infer<typeof PlannerItemSchema>;

// --------------------------------------------------------------------------
// Planner input
// --------------------------------------------------------------------------

export const PlannerPolicySchema = z
  .object({
    maxSecondaryReferences: z
      .number()
      .int()
      .min(0)
      .max(PHASE2_MAX_SECONDARY_REFERENCES),
    /** Vertragsfeld — Adjazenz ist in Phase 2.0 NICHT implementiert. */
    allowAdjacentSubstitution: z.boolean().default(false),
  })
  .strict();
export type PlannerPolicy = z.infer<typeof PlannerPolicySchema>;

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const PlannerInputSchema = z
  .object({
    vehicleMaster: VehicleMasterRecordSchema,
    requestedPerspectiveIds: z
      .array(PerspectiveIdSchema)
      .nonempty()
      .refine(uniqueArray, {
        message: "requestedPerspectiveIds must be unique",
      }),
    requestedOutputFormats: z.array(OutputFormatSchema).optional(),
    policy: PlannerPolicySchema,
    nowIso: IsoDateTimeSchema,
  })
  .strict()
  .superRefine(assertIsoFields);
export type PlannerInput = z.infer<typeof PlannerInputSchema>;

// --------------------------------------------------------------------------
// Planner output
// --------------------------------------------------------------------------

export const PlannerSummarySchema = z
  .object({
    readyCount: z.number().int().min(0),
    reviewCount: z.number().int().min(0),
    blockedCount: z.number().int().min(0),
    generationAllowed: z.boolean(),
  })
  .strict();
export type PlannerSummary = z.infer<typeof PlannerSummarySchema>;

export const PlannerOutputSchema = z
  .object({
    plannerVersion: z.literal(PHASE2_PLANNER_VERSION),
    registryVersion: z.number().int().min(1),
    perspectiveMasterVersion: z.number().int().min(1),
    plannedAtIso: IsoDateTimeSchema,
    items: z.array(PlannerItemSchema).nonempty(),
    summary: PlannerSummarySchema,
  })
  .strict()
  .superRefine((output, ctx) => {
    const ids = output.items.map((i) => i.perspectiveSpecId);
    if (!uniqueArray(ids)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "perspectiveSpecId must be unique across items",
      });
    }
    const counts = { READY: 0, REVIEW: 0, BLOCKED: 0 } as Record<
      PlannerState,
      number
    >;
    for (const item of output.items) counts[item.state] += 1;
    if (
      counts.READY !== output.summary.readyCount ||
      counts.REVIEW !== output.summary.reviewCount ||
      counts.BLOCKED !== output.summary.blockedCount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary"],
        message: "summary counts must match item states exactly",
      });
    }
    const allReady = output.items.every(
      (i) => i.state === "READY" && i.generationAllowed,
    );
    if (output.summary.generationAllowed && !allReady) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["summary", "generationAllowed"],
        message:
          "summary.generationAllowed requires every item READY and generationAllowed",
      });
    }
  })
  .superRefine(assertIsoFields);
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

// --------------------------------------------------------------------------
// Structural timestamp handling + semantic firewall
// --------------------------------------------------------------------------

const ISO_KEY_SUFFIX = "Iso";
const ISO_PROJECTION_PLACEHOLDER = "TIMESTAMP";

function isIsoKey(key: string): boolean {
  return key.endsWith(ISO_KEY_SUFFIX);
}

const ISO_DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Rekursive Validierung: JEDES Feld, dessen Schluessel auf `Iso` endet — auch
 * in wiederverwendeten Phase-1/1.5-Records — muss ein gueltiger ISO-Zeitstempel
 * sein. Damit kann die spaetere Firewall-Projektion keinen semantischen Text
 * durchschmuggeln.
 */
function assertIsoFields(value: unknown, ctx: z.RefinementCtx): void {
  walkIso(value, [], ctx);
}

function walkIso(
  value: unknown,
  path: (string | number)[],
  ctx: z.RefinementCtx,
  depth = 0,
): void {
  if (depth > 12) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkIso(v, [...path, i], ctx, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isIsoKey(k) && (typeof v !== "string" || !ISO_DATE_TIME_RE.test(v))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, k],
          message: `${k} must be a valid ISO datetime string`,
        });
      }
      walkIso(v, [...path, k], ctx, depth + 1);
    }
  }
}

/**
 * Erzeugt eine reine In-Memory-Projektion: Werte von Schluesseln, die exakt auf
 * `Iso` enden, werden durch eine neutrale Konstante ersetzt. Keine Schluessel
 * werden entfernt, kein weiterer Wert wird ausgenommen.
 */
export function projectForSemanticFirewall(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((v) => projectForSemanticFirewall(v, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isIsoKey(k)
        ? ISO_PROJECTION_PLACEHOLDER
        : projectForSemanticFirewall(v, depth + 1);
    }
    return out;
  }
  return value;
}

export class PlannerContractError extends Error {
  readonly issues: readonly string[];
  constructor(label: string, issues: readonly string[]) {
    super(`${label} invalid: ${issues.join("; ")}`);
    this.name = "PlannerContractError";
    this.issues = issues;
  }
}

function parseStrict<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  label: string,
): z.infer<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new PlannerContractError(
      label,
      parsed.error.issues.map(
        (i) => `${i.path.join(".") || "root"}: ${i.message}`,
      ),
    );
  }
  assertNoSemanticIdentity(projectForSemanticFirewall(parsed.data), label);
  return parsed.data;
}

export function parsePlannerInput(raw: unknown): PlannerInput {
  return parseStrict(PlannerInputSchema, raw, "planner input");
}

export function parsePlannerOutput(raw: unknown): PlannerOutput {
  return parseStrict(PlannerOutputSchema, raw, "planner output");
}

export type { PerspectiveId };
