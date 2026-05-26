/**
 * Quick-Mode Orchestrator – läuft komplett im Hintergrund.
 *
 * Pipeline (parallel wo möglich):
 *   1a. Datenblatt (PDF oder Bild) → Texte extrahieren
 *   1b. Fahrzeugbild → Masterbild in aufregendem CI-Showroom (Gemini)
 *   2.  Masterbild → pro Zielformat per Ideogram reframen (parallel)
 *   3.  Composition pro Format aufbauen + rendern → DataURL Thumbnail
 */

import type { BannerComposition, BannerFormat, BannerTextFields, CiState } from "../state/types";
import { buildDefaultComposition, DEFAULT_TEXT_FIELDS } from "../data/defaultComposition";
import { loadTemplate } from "../data/templateRegistry";
import { specToBannerLayers } from "../data/templateToLayers";
import { detectBrandKey } from "../ci/brandPresets";
import { renderCompositionToDataURL } from "../export/renderComposition";
import {
  extractBannerDataFromImage,
  extractBannerDataFromPdf,
  generateMasterBannerImage,
  type ExtractedBannerFields,
} from "./masterImageClient";
import { extractPDFAsBase64 } from "@/lib/pdf-utils";
import { startReframeJob, subscribeJob, disposeJob } from "./reframeJobManager";
import type { CiContext } from "../ci/profileSources";

export interface QuickGenerateInput {
  /** PDF-Exposé ODER Datenblatt-Bild (z.B. Screenshot, Foto). Optional, wenn `preExtractedTextFields` gesetzt ist (z.B. wenn Fahrzeugdaten aus dem verknüpften Fahrzeug stammen). */
  datenblattFile?: File | null;
  vehicleImageDataUrl: string;
  formats: BannerFormat[];
  ci?: CiState;
  ciContext?: CiContext | null;
  manufacturerLogoUrl?: string;
  /** CI Akzent-Hex Farben aus dem User-Profil (für aufregenden Master-Showroom). */
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  /** Bereits analysierte Textfelder – überspringt die Datenblatt-Analyse. */
  preExtractedTextFields?: BannerTextFields;
  /** Bereits erkannte Marke – überspringt die Marken-Erkennung. */
  preDetectedBrand?: string;
  /** Eigener Master-Prompt – ersetzt den Default-Showroom-Prompt. */
  masterPromptOverride?: string;
}

export interface QuickGenerateProgress {
  stage: "analyze" | "master" | "reframe" | "render" | "done" | "error";
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
  detectedBrand: string;
  masterImageDataUrl: string | null;
  results: QuickBannerResult[];
  errors: { formatId: string; error: string }[];
}

const TEXT_FIELD_KEYS: (keyof BannerTextFields)[] = [
  "headline", "subline", "price", "cta", "smallInfo", "legalText",
];

function mergeFields(base: BannerTextFields, extracted: ExtractedBannerFields): BannerTextFields {
  const out: BannerTextFields = { ...base };
  TEXT_FIELD_KEYS.forEach((k) => {
    const v = (extracted as Record<string, string>)[k];
    if (v && String(v).trim()) (out as Record<string, string>)[k] = String(v).trim();
  });
  return out;
}

function sanitizeHex(v?: string | null, fallback = "#174f6b"): string {
  if (!v) return fallback;
  const s = String(v).trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(s)) return s.startsWith("#") ? s : `#${s}`;
  return fallback;
}

/**
 * Aufregender, CI-eingefärbter Master-Showroom-Prompt.
 * Inspiriert vom Referenz-Banner (heller Showroom mit Neon-/Light-Streaks in CI-Farben).
 */
function buildMasterPrompt(primary: string, secondary: string): string {
  return [
    "Re-stage the EXACT same vehicle inside a modern, bright premium car dealership showroom.",
    "Background: a real showroom with polished glossy concrete floor, white ceiling with linear LED light strips, glass walls, two or three other modern cars softly visible in the background (out of focus, no logos).",
    `Atmosphere: dynamic energetic ad scene with bold diagonal NEON LIGHT STREAKS and beams of colored light radiating from behind the car towards the corners, in the brand colors ${primary} (primary, dominant) and ${secondary} (secondary accent). Light streaks must look like long-exposure light trails / motion light effects – sharp, vivid, with subtle glow and bloom – NOT flat shapes.`,
    "The vehicle itself stays perfectly sharp, photoreal, centered, slight 3/4 front hero angle, clean reflections on the bodywork picking up hints of the brand-colored light.",
    "Floor reflects the colored light streaks softly. Background light wraps around the car with a subtle rim light in the secondary brand color.",
    "Cinematic automotive advertising photography, 35mm, shallow depth of field, ultra crisp on the car, premium magazine quality.",
    "Strictly NO text, NO logos, NO watermarks, NO badges, NO visible license plate text (blank plate allowed).",
  ].join(" ");
}

export async function generateBannersFromInputs(
  input: QuickGenerateInput,
  onProgress?: (p: QuickGenerateProgress) => void,
): Promise<QuickGenerateOutput> {
  const {
    datenblattFile,
    vehicleImageDataUrl,
    formats,
    ci,
    ciContext,
    manufacturerLogoUrl,
    primaryColorHex,
    secondaryColorHex,
    preExtractedTextFields,
    preDetectedBrand,
    masterPromptOverride,
  } = input;

  const skipAnalyze = !!preExtractedTextFields;

  // Schritte: (1 analyse, falls nicht vorab) + 1 master + N reframe + N render
  const totalSteps = (skipAnalyze ? 1 : 2) + formats.length * 2;
  let stepCounter = 0;
  const tick = (stage: QuickGenerateProgress["stage"], current?: string) => {
    stepCounter++;
    onProgress?.({ stage, done: stepCounter, total: totalSteps, current });
  };

  const primary = sanitizeHex(primaryColorHex, "#174f6b");
  const secondary = sanitizeHex(secondaryColorHex, "#e94f6b");

  onProgress?.({
    stage: skipAnalyze ? "master" : "analyze",
    done: 0,
    total: totalSteps,
    current: skipAnalyze ? "Masterbild wird erstellt…" : "Datenblatt & Masterbild werden parallel erstellt…",
  });

  // 1) Datenblatt-Analyse + Masterbild PARALLEL
  const isPdf =
    datenblattFile.type === "application/pdf" ||
    datenblattFile.name.toLowerCase().endsWith(".pdf");

  const analyzePromise: Promise<{ textFields: BannerTextFields; brand: string }> = skipAnalyze
    ? Promise.resolve({
        textFields: preExtractedTextFields!,
        brand: (preDetectedBrand ?? "").trim(),
      })
    : (async () => {
        try {
          let extracted: ExtractedBannerFields;
          if (isPdf) {
            const base64 = await extractPDFAsBase64(datenblattFile);
            extracted = await extractBannerDataFromPdf(base64);
          } else {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onerror = () => reject(r.error ?? new Error("FileReader Fehler"));
              r.onload = () => resolve(String(r.result));
              r.readAsDataURL(datenblattFile);
            });
            extracted = await extractBannerDataFromImage(dataUrl);
          }
          return {
            textFields: mergeFields({ ...DEFAULT_TEXT_FIELDS }, extracted),
            brand: String(extracted.brand ?? "").trim(),
          };
        } catch (e) {
          console.warn("Datenblatt-Analyse fehlgeschlagen, Defaults werden verwendet", e);
          return { textFields: { ...DEFAULT_TEXT_FIELDS }, brand: "" };
        }
      })();

  const masterPromise: Promise<string | null> = (async () => {
    try {
      const promptText = masterPromptOverride && masterPromptOverride.trim()
        ? masterPromptOverride.trim()
        : buildMasterPrompt(primary, secondary);
      const colorHint = `Add subtle accent highlights / rim light using the brand colors ${primary} (primary) and ${secondary} (secondary).`;
      const out = await generateMasterBannerImage({
        sourceImageUrl: vehicleImageDataUrl,
        promptText,
        extraInstruction: [
          ciContext?.marke
            ? `Vehicle make: ${ciContext.marke}${ciContext.modell ? ` ${ciContext.modell}` : ""}. Keep make/model/color identical to the source photo.`
            : "Keep make, model and color identical to the source photo.",
          masterPromptOverride ? colorHint : "",
        ].filter(Boolean).join(" "),
      });
      return out.imageDataUrl;
    } catch (e) {
      console.warn("Masterbild fehlgeschlagen, Original wird verwendet", e);
      return null;
    }
  })();

  const [analyze, masterImageDataUrl] = await Promise.all([analyzePromise, masterPromise]);
  const textFields = analyze.textFields;
  const detectedBrand = analyze.brand;
  if (!skipAnalyze) tick("analyze", "Datenblatt ausgewertet");
  tick("master", masterImageDataUrl ? "Masterbild erstellt" : "Masterbild übersprungen");

  // 2) Reframe pro Format – Quelle: Masterbild (Fallback Original)
  const reframeSource = masterImageDataUrl ?? vehicleImageDataUrl;
  const reframeByFormat = new Map<string, { url: string; w: number; h: number }>();
  const errors: { formatId: string; error: string }[] = [];

  await new Promise<void>((resolve) => {
    const jobId = startReframeJob({
      source: reframeSource,
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
          const missing = formats.length - received;
          for (let i = 0; i < missing; i++) tick("reframe", "Masterbild wird verwendet");
          unsub();
          disposeJob(jobId);
          resolve();
        }
      },
    });
  });

  // 3) Compositions bauen + rendern (brand-spezifische DB-Templates bevorzugen)
  const brandKey =
    (ci?.brandKey && ci.brandKey !== "custom" ? ci.brandKey : undefined) ||
    detectBrandKey(detectedBrand) ||
    detectBrandKey(ciContext?.marke ?? "");

  const results: QuickBannerResult[] = [];
  for (const format of formats) {
    try {
      const rf = reframeByFormat.get(format.id);
      const backgroundDataUrl = rf?.url ?? reframeSource;
      const ciOverrides = ci?.layerOverrides;

      // DB-Template laden (User → Brand → Global → Bundle-Fallback)
      let composition: BannerComposition;
      try {
        const loaded = await loadTemplate(format.id, "classic-offer", brandKey ?? null);
        composition = {
          formatId: format.id,
          backgroundFit: "cover",
          overlayDirection: "none",
          overlayStrength: 0,
          selectedTemplateId: "classic-offer",
          layers: specToBannerLayers(loaded.spec, (ciOverrides ?? null) as never),
        };
      } catch {
        composition = buildDefaultComposition(format.id, "classic-offer", ciOverrides ?? null);
      }

      composition = {
        ...composition,
        backgroundImageUrl: backgroundDataUrl,
        masterImageUrl: reframeSource,
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
  return { textFields, detectedBrand, masterImageDataUrl, results, errors };
}
