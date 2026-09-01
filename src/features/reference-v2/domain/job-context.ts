import { z } from "zod";
import { PerspectiveIdSchema } from "./perspectives/types";
import { EDITING_MODULES, EditingModuleIdSchema } from "./editing-modules";
import { VisionIntakeResultSchema } from "./vision-intake";

/**
 * Reference V2 — Kontext-Trennung als Code (Phase 0).
 *
 * BUSINESS VEHICLE CONTEXT:
 *   Existiert ausserhalb der Bildgeneration. Im internen Job erscheint er
 *   AUSSCHLIESSLICH als vehicleId (FK/Referenz) — niemals Marke, Modell,
 *   Variante, Baujahr, VIN oder Titel.
 *
 * VISUAL REFERENCE CONTEXT:
 *   Nur Asset-IDs, visuelle Analysen (Vision Intake), Perspektiven und
 *   explizite Bearbeitungsmodule.
 *
 * Der StrictReferenceGenerationRequest (generation-request.ts) erhaelt
 * NIEMALS den Business-Kontext — nicht einmal die vehicleId.
 */

export const BusinessVehicleRefSchema = z
  .object({
    /** Einzige zulaessige Business-Referenz im internen Job. */
    vehicleId: z.string().min(1),
  })
  .strict();
export type BusinessVehicleRef = z.infer<typeof BusinessVehicleRefSchema>;

export const VisualReferenceContextSchema = z
  .object({
    referenceAssetIds: z.array(z.string().min(1)).nonempty(),
    intakeResults: z.array(VisionIntakeResultSchema).optional(),
    enabledModules: z.array(EditingModuleIdSchema).default([]),
  })
  .strict();
export type VisualReferenceContext = z.infer<
  typeof VisualReferenceContextSchema
>;

export const StrictReferenceOutputRequestSchema = z
  .object({
    outputRequestId: z.string().min(1),
    perspectiveSpecId: PerspectiveIdSchema,
    perspectiveSpecVersion: z.number().int().min(1),
  })
  .strict();
export type StrictReferenceOutputRequest = z.infer<
  typeof StrictReferenceOutputRequestSchema
>;

const StrictReferenceJobBaseSchema = z
  .object({
    jobId: z.string().min(1),
    mode: z.literal("strict_reference"),
    business: BusinessVehicleRefSchema,
    visual: VisualReferenceContextSchema,
    outputRequests: z.array(StrictReferenceOutputRequestSchema).nonempty(),
    createdAtIso: z.string().min(1).optional(),
  })
  .strict();

/**
 * Im strict_reference Modus sind TRANSFORMATION-Module auf JEDER Ebene
 * unzulaessig — auch im visuellen Kontext des Jobs, nicht nur im
 * Generation-Request.
 */
export const StrictReferenceJobSchema =
  StrictReferenceJobBaseSchema.superRefine((job, ctx) => {
    if (job.mode !== "strict_reference") return;
    for (const moduleId of job.visual.enabledModules) {
      if (EDITING_MODULES[moduleId].riskClass === "TRANSFORMATION") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["visual", "enabledModules"],
          message: `TRANSFORMATION module '${moduleId}' is not permitted in strict_reference jobs`,
        });
      }
    }
  });
export type StrictReferenceJob = z.infer<typeof StrictReferenceJobSchema>;
