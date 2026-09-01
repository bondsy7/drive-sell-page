import { z } from "zod";
import { PerspectiveIdSchema } from "./perspectives/types";
import { EDITING_MODULES, EditingModuleIdSchema } from "./editing-modules";

/**
 * Reference V2 — Strict Reference Generation Request (Phase 0).
 *
 * SZENE/LOGO GEHOEREN NICHT HIERHER: Der VEHICLE-Generation-Request kennt
 * ausschliesslich Fahrzeugreferenzen. Szenen-/Logo-Assets wuerden die Marke
 * verraten und den Katalog-Prior reaktivieren. Sie leben in der separaten
 * Composition-Orchestrierung (StrictReferenceCompositionRequest).
 *
 * PROVIDER-NEUTRAL und frei von Business-Kontext:
 * Der Request kennt AUSSCHLIESSLICH IDs (Job, OutputRequest, PerspectiveSpec,
 * Assets, ScenePack/Plate, Logo) sowie explizit aktivierte Module.
 *
 * VERBOTEN sind saemtliche semantischen Fahrzeug-Metadaten. Diese Felder
 * duerfen NIE Teil des Schemas werden und werden durch .strict() als
 * unbekannte Keys abgelehnt:
 *   brand, make, model, variant, trim, year, modelYear, vin,
 *   vehicleDescription, title
 *
 * Referenzbilder sind die alleinige Autoritaet fuer die visuelle
 * Fahrzeugidentitaet.
 */

export const FORBIDDEN_VEHICLE_METADATA_FIELDS = [
  "brand",
  "make",
  "model",
  "variant",
  "trim",
  "year",
  "modelYear",
  "vin",
  "vehicleDescription",
  "title",
] as const;
export type ForbiddenVehicleMetadataField =
  (typeof FORBIDDEN_VEHICLE_METADATA_FIELDS)[number];

/**
 * Referenzbudget: Primary + maximal 3 gezielte Secondary References.
 * Mehr Referenzen verwaessern die Identitaet statt sie zu schaerfen.
 */
export const MAX_SECONDARY_REFERENCES = 3;

export const PROVIDER_TIERS = ["economy", "standard", "premium"] as const;
export type ProviderTier = (typeof PROVIDER_TIERS)[number];
export const ProviderTierSchema = z.enum(PROVIDER_TIERS);

export const StrictReferenceGenerationRequestBaseSchema = z
  .object({
    jobId: z.string().min(1),
    outputRequestId: z.string().min(1),
    perspectiveSpecId: PerspectiveIdSchema,
    perspectiveSpecVersion: z.number().int().min(1),
    primaryReferenceAssetId: z.string().min(1),
    secondaryReferenceAssetIds: z
      .array(z.string().min(1))
      .max(MAX_SECONDARY_REFERENCES)
      .default([]),
    enabledModules: z.array(EditingModuleIdSchema).default([]),
    providerTier: ProviderTierSchema.optional(),
  })
  .strict();

export const StrictReferenceGenerationRequestSchema =
  StrictReferenceGenerationRequestBaseSchema.superRefine((v, ctx) => {
    for (const moduleId of v.enabledModules) {
      if (EDITING_MODULES[moduleId].riskClass === "TRANSFORMATION") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["enabledModules"],
          message: `TRANSFORMATION module '${moduleId}' is not permitted in strict_reference generation requests`,
        });
      }
    }
    if (v.secondaryReferenceAssetIds.includes(v.primaryReferenceAssetId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryReferenceAssetIds"],
        message:
          "primaryReferenceAssetId must not appear in secondaryReferenceAssetIds",
      });
    }
    const uniqueSecondary = new Set(v.secondaryReferenceAssetIds);
    if (uniqueSecondary.size !== v.secondaryReferenceAssetIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryReferenceAssetIds"],
        message: "secondaryReferenceAssetIds must be unique",
      });
    }
  });

export type StrictReferenceGenerationRequest = z.infer<
  typeof StrictReferenceGenerationRequestSchema
>;

export function parseStrictReferenceGenerationRequest(
  input: unknown,
): StrictReferenceGenerationRequest {
  return StrictReferenceGenerationRequestSchema.parse(input);
}

/**
 * Separate Orchestrierungs-Ebene fuer eine spaetere deterministische
 * Composition (Szene/Logo). Diese IDs erreichen NIEMALS den Bildmodell-Prompt
 * der Fahrzeuggenerierung.
 */
export const StrictReferenceCompositionRequestSchema = z
  .object({
    jobId: z.string().min(1),
    outputRequestId: z.string().min(1),
    scenePackId: z.string().min(1).optional(),
    scenePlateId: z.string().min(1).optional(),
    logoAssetId: z.string().min(1).optional(),
  })
  .strict();
export type StrictReferenceCompositionRequest = z.infer<
  typeof StrictReferenceCompositionRequestSchema
>;
