import type { VehicleClassV2 } from "../domain/vehicle-classes";
import type { PerspectiveId } from "../domain/perspectives/types";
import type { VisionIntakeResult } from "../domain/vision-intake";
import type { SourceFramingInput } from "../phase1/output-format-policy";
import {
  AUTOMATIC_GATE_LABELS_DE,
  ANALYZER_SCHEMA_VERSION,
  evaluateAutomaticGate,
  normalizeToVisionIntake,
  type AnalyzerVisionResponse,
  type AutomaticGateCode,
} from "./analyzer-contract";
import {
  MAX_ANCHOR_FILES,
  type AnalyzeResult,
  type ReferenceV2AnalyzerPort,
  type ReferenceV2FileReference,
} from "./provider-adapter";
import type { ReferenceAnalysisRecord } from "./analysis-record";

/**
 * Reference V2 — Phase 1.5: Batch-Koordinator.
 *
 * The reference image defines WHAT the vehicle is. Metadata only describes
 * what we know ABOUT it. Metadata must never override visible vehicle identity.
 *
 * Jede Datei wird unabhaengig verarbeitet: ein Fehler darf weder andere
 * Dateien blockieren noch dazu fuehren, dass eine fehlgeschlagene Datei
 * stillschweigend als akzeptiert gilt (fail-closed pro Datei).
 */

export type AutomaticIntakeStage =
  | "queued"
  | "uploading"
  | "analyzing"
  | "classified"
  | "governed"
  | "failed";

export interface AutomaticIntakeProgress {
  readonly fileName: string;
  readonly stage: AutomaticIntakeStage;
  readonly perspectiveId?: PerspectiveId;
  readonly message?: string;
}

export interface AutomaticIntakeOutcome {
  readonly fileName: string;
  readonly ok: boolean;
  readonly gateCodes: readonly AutomaticGateCode[];
  readonly errorMessage?: string;
  readonly perspectiveId?: PerspectiveId;
  readonly response?: AnalyzerVisionResponse;
  readonly intake?: VisionIntakeResult;
  readonly analysis?: ReferenceAnalysisRecord;
  readonly file?: ReferenceV2FileReference;
  readonly framing?: SourceFramingInput;
}

export interface AnalyzeFileContext {
  readonly vehicleClass: VehicleClassV2;
  readonly identityClusterId: string;
  readonly allowedPerspectiveIds: readonly PerspectiveId[];
  readonly anchorFiles: readonly ReferenceV2FileReference[];
}

export interface AnalyzeFileDeps {
  readonly port: ReferenceV2AnalyzerPort;
  /** Seitenverhaeltnis des Quellbildes (DOM-unabhaengig injizierbar). */
  readonly measureAspectRatio: (file: File) => Promise<number>;
  readonly onProgress?: (progress: AutomaticIntakeProgress) => void;
}

function fail(
  fileName: string,
  message: string,
  gateCodes: readonly AutomaticGateCode[] = ["ANALYSIS_UNAVAILABLE"],
): AutomaticIntakeOutcome {
  return { fileName, ok: false, gateCodes, errorMessage: message };
}

export async function analyzeSingleFile(
  file: File,
  ctx: AnalyzeFileContext,
  deps: AnalyzeFileDeps,
): Promise<AutomaticIntakeOutcome> {
  const report = (p: Omit<AutomaticIntakeProgress, "fileName">) =>
    deps.onProgress?.({ fileName: file.name, ...p });

  let fileRef: ReferenceV2FileReference;
  try {
    report({ stage: "uploading" });
    fileRef = await deps.port.uploadFile(file);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen";
    report({ stage: "failed", message: msg });
    return fail(file.name, msg);
  }

  let result: AnalyzeResult;
  try {
    report({ stage: "analyzing" });
    result = await deps.port.analyze({
      file: fileRef,
      anchorFiles: ctx.anchorFiles.slice(0, MAX_ANCHOR_FILES),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "KI-Analyse fehlgeschlagen";
    report({ stage: "failed", message: msg });
    return fail(file.name, msg);
  }

  const response = result.response;
  const anchorsProvided = ctx.anchorFiles.length > 0;
  const gateCodes = [
    ...evaluateAutomaticGate({
      response,
      expectedVehicleClass: ctx.vehicleClass,
      anchorsProvided,
    }),
  ];
  // Lokaler Soll-Ist-Abgleich: die erkannte Perspektive muss fuer diesen
  // Vehicle Master ueberhaupt zulaessig sein.
  if (
    response.canonicalPerspectiveId &&
    !ctx.allowedPerspectiveIds.includes(response.canonicalPerspectiveId) &&
    !gateCodes.includes("PERSPECTIVE_UNDETERMINED")
  ) {
    gateCodes.push("PERSPECTIVE_UNDETERMINED");
  }

  const analysis: ReferenceAnalysisRecord = {
    fileId: fileRef.fileId,
    providerId: fileRef.providerId,
    mimeType: fileRef.mimeType,
    ...(typeof fileRef.sizeBytes === "number" ? { sizeBytes: fileRef.sizeBytes } : {}),
    ...(fileRef.expiresAtIso ? { fileExpiresAtIso: fileRef.expiresAtIso } : {}),
    status: gateCodes.length > 0 ? "failed" : "analyzed",
    analyzerSchemaVersion: ANALYZER_SCHEMA_VERSION,
    analyzedAtIso: new Date().toISOString(),
    perspectiveConfidence: response.perspectiveConfidence,
    identityEvidence: response.identityEvidence,
    ...(result.correlationId ? { correlationId: result.correlationId } : {}),
  };

  if (gateCodes.length > 0) {
    report({
      stage: "failed",
      message: gateCodes.map((c) => AUTOMATIC_GATE_LABELS_DE[c]).join(", "),
    });
    return {
      fileName: file.name,
      ok: false,
      gateCodes,
      errorMessage: gateCodes.map((c) => AUTOMATIC_GATE_LABELS_DE[c]).join(", "),
      response,
      analysis,
      file: fileRef,
      ...(response.canonicalPerspectiveId
        ? { perspectiveId: response.canonicalPerspectiveId }
        : {}),
    };
  }

  const perspectiveId = response.canonicalPerspectiveId as PerspectiveId;
  report({ stage: "classified", perspectiveId });

  const assetId = `${fileRef.fileId}`;
  const intake = normalizeToVisionIntake(response, {
    assetId,
    identityClusterId: ctx.identityClusterId,
    anchorsProvided,
  });

  let aspectRatio = 1.5;
  try {
    aspectRatio = await deps.measureAspectRatio(file);
  } catch {
    aspectRatio = 1.5;
  }

  return {
    fileName: file.name,
    ok: true,
    gateCodes: [],
    perspectiveId,
    response,
    intake,
    analysis,
    file: fileRef,
    framing: {
      sourceAspectRatio: aspectRatio,
      fullVehicleVisible: response.framing.fullVehicleVisible,
      paddingPct: response.framing.estimatedPaddingPct,
    },
  };
}

/**
 * Verarbeitet mehrere Dateien STRENG SEQUENZIELL; Teilfehler bleiben isoliert.
 *
 * Das erste akzeptierte Bild eines Batches wird zum Identitaets-Anker fuer die
 * folgenden Dateien desselben Batches — auch dann, wenn der Vehicle Master
 * vorher noch gar keine Referenz besass. Abgelehnte Dateien werden niemals
 * Anker.
 */
export async function analyzeFileBatch(
  files: readonly File[],
  ctx: AnalyzeFileContext,
  deps: AnalyzeFileDeps,
): Promise<readonly AutomaticIntakeOutcome[]> {
  const outcomes: AutomaticIntakeOutcome[] = [];
  const anchors: ReferenceV2FileReference[] = [...ctx.anchorFiles];

  for (const file of files) {
    const stepCtx: AnalyzeFileContext = {
      ...ctx,
      anchorFiles: anchors.slice(0, MAX_ANCHOR_FILES),
    };
    let outcome: AutomaticIntakeOutcome;
    try {
      outcome = await analyzeSingleFile(file, stepCtx, deps);
    } catch (e) {
      outcome = fail(file.name, e instanceof Error ? e.message : "Unbekannter Fehler");
    }
    outcomes.push(outcome);
    if (outcome.ok && outcome.file && anchors.length < MAX_ANCHOR_FILES) {
      anchors.push(outcome.file);
    }
  }
  return outcomes;
}
