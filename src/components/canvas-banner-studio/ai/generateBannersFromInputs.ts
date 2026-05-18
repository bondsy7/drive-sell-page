/**
 * Quick-Mode Orchestrator: nimmt PDF + Fahrzeugbild, läuft komplett im Hintergrund
 * und liefert für jedes gewählte Format eine fertig gerenderte Banner-Composition.
 *
 * Pipeline:
 *   1. PDF → extract banner data
 *   2. Image → Reframe pro Zielformat (parallel via reframeJobManager)
 *   3. Pro Format: Composition aufbauen (Default-Template) + Reframe-Bild als Hintergrund
 *   4. Composition rendern → DataURL Thumbnail
 */

import type { BannerComposition, BannerFormat, BannerTextFields, CiState } from "../state/types";
import { buildDefaultComposition, DEFAULT_TEXT_FIELDS } from "../data/defaultComposition";
import { renderCompositionToDataURL } from "../export/renderComposition";
import { extractBannerDataFromPdf, type ExtractedBannerFields } from "./masterImageClient";
import { extractPDFAsBase64 } from "@/lib/pdf-utils";
import { startReframeJob, subscribeJob, disposeJob } from "./reframeJobManager";
import type { CiContext } from "../ci/profileSources";

export interface QuickGenerateInput {
  pdfFile: File;
  vehicleImageDataUrl: string;
  formats: BannerFormat[];
  ci?: CiState;
  ciContext?: CiContext | null;
  manufacturerLogoUrl?: string;
}

export interface QuickGenerateProgress {
  stage: "pdf" | "reframe" | "render" | "done" | "error";
  done: number;
  total: number;
  current?: string;
  errorMessage?: string;
}

export interface QuickBannerResult {
  formatId: string;
  format: BannerFormat;
  backgroundDataUrl: string;
  composition: BannerComposition;
  thumbnailDataUrl: string;
}

export interface QuickGenerateOutput {
  textFields: BannerTextFields;
  results: QuickBannerResult[];
  errors: { formatId: string; error: string }[];
}

function mergeFields(base: BannerTextFields, extracted: ExtractedBannerFields): BannerTextFields {
  const out: BannerTextFields = { ...base };
  (Object.keys(extracted) as (keyof ExtractedBannerFields)[]).forEach((k) => {
    const v = extracted[k];
    if (v && String(v).trim()) (out as Record<string, string>)[k] = String(v).trim();
  });
  return out;
}

export async function generateBannersFromInputs(
  input: QuickGenerateInput,
  onProgress?: (p: QuickGenerateProgress) => void,
): Promise<QuickGenerateOutput> {
  const { pdfFile, vehicleImageDataUrl, formats, ci, ciContext, manufacturerLogoUrl } = input;
  const totalSteps = 1 /* pdf */ + formats.length /* reframe */ + formats.length /* render */;
  let stepCounter = 0;
  const tick = (stage: QuickGenerateProgress["stage"], current?: string) => {
    stepCounter++;
    onProgress?.({ stage, done: stepCounter, total: totalSteps, current });
  };

  // 1) PDF analyse
  onProgress?.({ stage: "pdf", done: 0, total: totalSteps, current: "PDF wird analysiert" });
  let textFields: BannerTextFields = { ...DEFAULT_TEXT_FIELDS };
  try {
    const base64 = await extractPDFAsBase64(pdfFile);
    const extracted = await extractBannerDataFromPdf(base64);
    textFields = mergeFields(textFields, extracted);
  } catch (e: any) {
    console.warn("PDF Analyse fehlgeschlagen, weiter mit Defaults", e);
  }
  tick("pdf", "PDF analysiert");

  // 2) Reframe pro Format (parallel über JobManager)
  const reframeByFormat = new Map<string, { url: string; w: number; h: number }>();
  const errors: { formatId: string; error: string }[] = [];

  await new Promise<void>((resolve) => {
    const jobId = startReframeJob({
      source: vehicleImageDataUrl,
      formats: formats.map((f) => ({ formatId: f.id, width: f.width, height: f.height, label: f.name })),
    });
    let received = 0;
    const unsub = subscribeJob(jobId, {
      onResult: (r) => {
        reframeByFormat.set(r.formatId, { url: r.imageDataUrl, w: r.width, h: r.height });
        received++;
        tick("reframe", `Bild ${received}/${formats.length} angepasst`);
      },
      onProgress: (p) => {
        if (p.finished) {
          // Bump tick counter for any formats that failed reframe (we fall back to original image during render).
          const missing = formats.length - received;
          for (let i = 0; i < missing; i++) tick("reframe", "Original-Bild wird verwendet");
          unsub();
          disposeJob(jobId);
          resolve();
        }
      },
    });
  });

  // 3) Compositions bauen + rendern
  const results: QuickBannerResult[] = [];
  for (const format of formats) {
    try {
      const rf = reframeByFormat.get(format.id);
      const backgroundDataUrl = rf?.url ?? vehicleImageDataUrl;
      const ciOverrides = ci?.layerOverrides;
      let composition = buildDefaultComposition(format.id, "classic-offer", ciOverrides ?? null);
      composition = {
        ...composition,
        backgroundImageUrl: backgroundDataUrl,
        masterImageUrl: vehicleImageDataUrl,
        logoUrl: manufacturerLogoUrl ?? composition.logoUrl,
      };
      const thumbnailDataUrl = await renderCompositionToDataURL(
        format,
        composition,
        textFields,
        "png",
        ci,
        ciContext ?? null,
      );
      results.push({ formatId: format.id, format, backgroundDataUrl, composition, thumbnailDataUrl });
      tick("render", `${format.name} gerendert`);
    } catch (e: any) {
      errors.push({ formatId: format.id, error: e?.message ?? String(e) });
      tick("render", `${format.name} fehlgeschlagen`);
    }
  }

  onProgress?.({ stage: "done", done: totalSteps, total: totalSteps });
  return { textFields, results, errors };
}
