import { z } from "zod";
import type { PerspectiveId } from "../domain/perspectives/types";
import { getPerspectiveMasterEntry } from "./perspective-master";

/**
 * Reference V2 — Phase 1: 4:5 + 1.91:1 Output-Policy.
 *
 * Die Policy ist eine reine READINESS-Aussage: Kann aus einer Referenz ohne
 * Anschnitt des Fahrzeugs sowohl ein 4:5 Portrait- als auch ein 1.91:1
 * Landscape-Crop erzeugt werden? Sie erzeugt selbst KEINE Bilder (Phase 2).
 */

export const OUTPUT_FORMATS = ["4:5", "1.91:1"] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export const OutputFormatSchema = z.enum(OUTPUT_FORMATS);

export const OUTPUT_FORMAT_RATIOS: Record<OutputFormat, number> = {
  "4:5": 4 / 5,
  "1.91:1": 1.91,
};

export interface OutputFormatReadiness {
  readonly format: OutputFormat;
  readonly ready: boolean;
  readonly reason?: string;
}

export interface SourceFramingInput {
  /** Bildseitenverhaeltnis der Quelle (Breite / Hoehe). */
  readonly sourceAspectRatio: number;
  /** Fahrzeug vollstaendig im Bild? */
  readonly fullVehicleVisible: boolean;
  /** Geschaetzter Rand um das Fahrzeug in % der kuerzeren Bildkante. */
  readonly paddingPct: number;
}

/**
 * Ein Crop ist zulaessig, wenn das Fahrzeug vollstaendig sichtbar ist und der
 * vorhandene Rand mindestens dem von der PerspectiveMaster-Zeile geforderten
 * Mindestrand entspricht — plus dem Rand, den der Formatwechsel kostet.
 */
export function evaluateOutputFormatReadiness(
  perspectiveId: PerspectiveId,
  source: SourceFramingInput,
): readonly OutputFormatReadiness[] {
  const entry = getPerspectiveMasterEntry(perspectiveId);
  return OUTPUT_FORMATS.map<OutputFormatReadiness>((format) => {
    if (entry.fullVehicle && !source.fullVehicleVisible) {
      return {
        format,
        ready: false,
        reason: "Fahrzeug ist angeschnitten — Crop nicht zulässig",
      };
    }
    const target = OUTPUT_FORMAT_RATIOS[format];
    const src = source.sourceAspectRatio;
    // Relativer Verlust an der Achse, die beim Crop beschnitten wird.
    const lossPct =
      src > target
        ? (1 - target / src) * 50 // links/rechts beschneiden
        : (1 - src / target) * 50; // oben/unten beschneiden
    const requiredPadding = entry.paddingMinPct + lossPct;
    if (source.paddingPct < requiredPadding) {
      return {
        format,
        ready: false,
        reason: `Rand ${source.paddingPct.toFixed(0)}% < benötigt ${requiredPadding.toFixed(0)}%`,
      };
    }
    return { format, ready: true };
  });
}

export function isFullyOutputReady(
  readiness: readonly OutputFormatReadiness[],
): boolean {
  return (
    readiness.length === OUTPUT_FORMATS.length && readiness.every((r) => r.ready)
  );
}
