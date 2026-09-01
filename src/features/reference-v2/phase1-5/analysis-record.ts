import { z } from "zod";
import { VisualIdentityEvidenceSchema } from "./analyzer-contract";

/**
 * Reference V2 — Phase 1.5: Persistierbarer Analyse-Nachweis eines Assets.
 *
 * Backwards-safe: das Feld ist am Asset-Record OPTIONAL. Phase-1-Assets ohne
 * automatische Analyse bleiben gueltig (Diagnose-Fallback), koennen aber im
 * Produktivpfad nicht akzeptiert werden.
 */

export const ANALYSIS_STATUSES = [
  "pending",
  "uploading",
  "analyzing",
  "analyzed",
  "failed",
] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];
export const AnalysisStatusSchema = z.enum(ANALYSIS_STATUSES);

export const ReferenceAnalysisRecordSchema = z
  .object({
    /** Provider-Dateireferenz — niemals Base64. */
    fileId: z.string().min(1),
    providerId: z.string().min(1),
    /** Echter MIME-Type der Provider-Datei (Lifecycle-Metadaten). */
    mimeType: z.string().min(1).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    fileExpiresAtIso: z.string().min(1).optional(),
    status: AnalysisStatusSchema,
    analyzerSchemaVersion: z.string().min(1),
    analyzedAtIso: z.string().min(1),
    perspectiveConfidence: z.number().min(0).max(1),
    identityEvidence: VisualIdentityEvidenceSchema.optional(),
    correlationId: z.string().min(1).optional(),
  })
  .strict();
export type ReferenceAnalysisRecord = z.infer<typeof ReferenceAnalysisRecordSchema>;
