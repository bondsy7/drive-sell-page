import { z } from "zod";

/**
 * Reference V2 — Modular Editing Options (Phase 0).
 *
 * Risikoklassen:
 *   SAFE_CLEANUP     — nicht-transformativ, standardmaessig aktiv.
 *   COSMETIC_REPAIR  — nicht-transformativ, standardmaessig INAKTIV (default false).
 *   TRANSFORMATION   — veraendert die Fahrzeugidentitaet; im strict_reference
 *                      Modus IMMER unzulaessig.
 */

export const EDITING_RISK_CLASSES = [
  "SAFE_CLEANUP",
  "COSMETIC_REPAIR",
  "TRANSFORMATION",
] as const;
export type EditingRiskClass = (typeof EDITING_RISK_CLASSES)[number];
export const EditingRiskClassSchema = z.enum(EDITING_RISK_CLASSES);

export const EDITING_MODULE_IDS = [
  // SAFE_CLEANUP
  "dirtRemoval",
  "dustRemoval",
  "fingerprintRemoval",
  "waterSpotRemoval",
  "glassCleanup",
  "whiteBalance",
  "exposureNormalization",
  "removableClutter",
  // COSMETIC_REPAIR
  "lightScratchRemoval",
  "minorRimScratchRemoval",
  "smallPaintDefectRemoval",
  "minorDentRepair",
  // TRANSFORMATION
  "paintColorChange",
  "wheelReplacement",
  "wrapChange",
  "addPart",
  "removePart",
] as const;
export type EditingModuleId = (typeof EDITING_MODULE_IDS)[number];
export const EditingModuleIdSchema = z.enum(EDITING_MODULE_IDS);

export interface EditingModuleDefinition {
  readonly id: EditingModuleId;
  readonly riskClass: EditingRiskClass;
  readonly labelDe: string;
  readonly labelEn: string;
  readonly defaultEnabled: boolean;
  /** Kurze, deterministische Direktive fuer den Prompt-Assembler (EN). */
  readonly promptDirective: string;
}

export const EDITING_MODULES: Readonly<
  Record<EditingModuleId, EditingModuleDefinition>
> = {
  dirtRemoval: {
    id: "dirtRemoval",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Schmutz entfernen",
    labelEn: "Dirt Removal",
    defaultEnabled: true,
    promptDirective:
      "Remove dirt and road grime from the exterior; paint, texture and geometry stay unchanged.",
  },
  dustRemoval: {
    id: "dustRemoval",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Staub entfernen",
    labelEn: "Dust Removal",
    defaultEnabled: true,
    promptDirective:
      "Remove dust films and loose particles; the underlying surfaces stay unchanged.",
  },
  fingerprintRemoval: {
    id: "fingerprintRemoval",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Fingerabdruecke entfernen",
    labelEn: "Fingerprint Removal",
    defaultEnabled: true,
    promptDirective:
      "Remove fingerprints and smudges from glossy surfaces and screens.",
  },
  waterSpotRemoval: {
    id: "waterSpotRemoval",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Wasserflecken entfernen",
    labelEn: "Water Spot Removal",
    defaultEnabled: true,
    promptDirective: "Remove water spots and drying marks.",
  },
  glassCleanup: {
    id: "glassCleanup",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Glasflaechen reinigen",
    labelEn: "Glass Cleanup",
    defaultEnabled: true,
    promptDirective:
      "Clean all glass surfaces; keep reflections physically plausible.",
  },
  whiteBalance: {
    id: "whiteBalance",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Weissabgleich",
    labelEn: "White Balance",
    defaultEnabled: true,
    promptDirective:
      "Neutralize color casts for a neutral white balance; the paint tone itself stays exactly as in the references.",
  },
  exposureNormalization: {
    id: "exposureNormalization",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Belichtung normalisieren",
    labelEn: "Exposure Normalization",
    defaultEnabled: true,
    promptDirective:
      "Normalize exposure and contrast to an even, natural level.",
  },
  removableClutter: {
    id: "removableClutter",
    riskClass: "SAFE_CLEANUP",
    labelDe: "Lose Fremdobjekte entfernen",
    labelEn: "Removable Clutter",
    defaultEnabled: true,
    promptDirective:
      "Remove loose foreign objects that do not belong to the vehicle (leaves, paper, cables, cones).",
  },
  lightScratchRemoval: {
    id: "lightScratchRemoval",
    riskClass: "COSMETIC_REPAIR",
    labelDe: "Leichte Kratzer entfernen",
    labelEn: "Light Scratch Removal",
    defaultEnabled: false,
    promptDirective:
      "Remove light surface scratches; shape, panel gaps and reflection structure stay unchanged.",
  },
  minorRimScratchRemoval: {
    id: "minorRimScratchRemoval",
    riskClass: "COSMETIC_REPAIR",
    labelDe: "Leichte Felgenkratzer entfernen",
    labelEn: "Minor Rim Scratch Removal",
    defaultEnabled: false,
    promptDirective:
      "Remove minor scratches on the visible rims; the rim design stays exactly as in the references.",
  },
  smallPaintDefectRemoval: {
    id: "smallPaintDefectRemoval",
    riskClass: "COSMETIC_REPAIR",
    labelDe: "Kleine Lackdefekte entfernen",
    labelEn: "Small Paint Defect Removal",
    defaultEnabled: false,
    promptDirective:
      "Remove small paint defects (stone chips, small blemishes); paint tone and texture stay unchanged.",
  },
  minorDentRepair: {
    id: "minorDentRepair",
    riskClass: "COSMETIC_REPAIR",
    labelDe: "Kleine Dellen glaetten",
    labelEn: "Minor Dent Repair",
    defaultEnabled: false,
    promptDirective:
      "Smooth out minor dents; body lines and panel geometry stay as in the references.",
  },
  paintColorChange: {
    id: "paintColorChange",
    riskClass: "TRANSFORMATION",
    labelDe: "Lackfarbe aendern",
    labelEn: "Paint Color Change",
    defaultEnabled: false,
    promptDirective: "TRANSFORMATION — not permitted in strict_reference mode.",
  },
  wheelReplacement: {
    id: "wheelReplacement",
    riskClass: "TRANSFORMATION",
    labelDe: "Felgen tauschen",
    labelEn: "Wheel Replacement",
    defaultEnabled: false,
    promptDirective: "TRANSFORMATION — not permitted in strict_reference mode.",
  },
  wrapChange: {
    id: "wrapChange",
    riskClass: "TRANSFORMATION",
    labelDe: "Folierung aendern",
    labelEn: "Wrap Change",
    defaultEnabled: false,
    promptDirective: "TRANSFORMATION — not permitted in strict_reference mode.",
  },
  addPart: {
    id: "addPart",
    riskClass: "TRANSFORMATION",
    labelDe: "Anbauteil hinzufuegen",
    labelEn: "Add Part",
    defaultEnabled: false,
    promptDirective: "TRANSFORMATION — not permitted in strict_reference mode.",
  },
  removePart: {
    id: "removePart",
    riskClass: "TRANSFORMATION",
    labelDe: "Anbauteil entfernen",
    labelEn: "Remove Part",
    defaultEnabled: false,
    promptDirective: "TRANSFORMATION — not permitted in strict_reference mode.",
  },
};

export function getModuleIdsByRiskClass(
  riskClass: EditingRiskClass,
): readonly EditingModuleId[] {
  return EDITING_MODULE_IDS.filter(
    (id) => EDITING_MODULES[id].riskClass === riskClass,
  );
}

export const GENERATION_MODES = ["strict_reference"] as const;
export type GenerationMode = (typeof GENERATION_MODES)[number];
export const GenerationModeSchema = z.enum(GENERATION_MODES);

export interface RejectedModule {
  readonly id: EditingModuleId;
  readonly riskClass: EditingRiskClass;
  readonly reason: string;
}

export interface ModuleSelectionValidation {
  readonly ok: boolean;
  readonly allowed: readonly EditingModuleId[];
  readonly rejected: readonly RejectedModule[];
}

/**
 * Validiert eine Modulauswahl gegen den Generierungsmodus.
 * Im strict_reference Modus werden TRANSFORMATION-Module IMMER abgelehnt.
 */
export function validateModuleSelection(
  mode: GenerationMode,
  moduleIds: readonly EditingModuleId[],
): ModuleSelectionValidation {
  const allowed: EditingModuleId[] = [];
  const rejected: RejectedModule[] = [];
  const seen = new Set<EditingModuleId>();

  for (const id of moduleIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const def = EDITING_MODULES[id];
    if (mode === "strict_reference" && def.riskClass === "TRANSFORMATION") {
      rejected.push({
        id,
        riskClass: def.riskClass,
        reason: `TRANSFORMATION module '${id}' is not permitted in strict_reference mode`,
      });
    } else {
      allowed.push(id);
    }
  }

  return { ok: rejected.length === 0, allowed, rejected };
}

/** Wirft einen Fehler, wenn die Auswahl unzulaessige Module enthaelt. */
export function assertModuleSelectionAllowed(
  mode: GenerationMode,
  moduleIds: readonly EditingModuleId[],
): void {
  const result = validateModuleSelection(mode, moduleIds);
  if (!result.ok) {
    const ids = result.rejected.map((r) => r.id).join(", ");
    throw new Error(
      `Module selection rejected in ${mode} mode: ${ids} (TRANSFORMATION not permitted)`,
    );
  }
}
