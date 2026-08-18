/**
 * Dedizierte FELGENREFERENZ (Phase 1: genau EIN Bild).
 *
 * Diese Typen sind bewusst getrennt von den allgemeinen Detailaufnahmen
 * (`detailImages`). Eine Felgenreferenz ist eine hoch priorisierte,
 * verbindliche Bildquelle für alle sichtbaren Räder/Felgen.
 */

export type WheelConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface WheelAnalysis {
  /** Anzahl der Speichen; null wenn nicht sicher erkennbar. */
  spokeCount: number | null;
  /** z.B. "double-5-spoke", "y-spoke", "multi-spoke", "turbine", "unknown". */
  spokeStyle: string | null;
  /** z.B. "diamond-cut", "gloss black", "silver", "bicolor", "polished". */
  finish: string | null;
  /** Zweitfarbe bei Bicolor-Felgen. */
  secondaryColor: string | null;
  /** "flat" | "concave" | "deep-concave" | "unknown". */
  concavity: string | null;
  /** Nabendeckel-Beschreibung (Logo/Farbe) oder null. */
  centerCap: string | null;
  tireVisible: boolean | null;
  brakeCaliperVisible: boolean | null;
  brakeCaliperColor: string | null;
  /** Kurze, faktische Beschreibung ohne Spekulation. */
  description: string | null;
}

export interface WheelReference {
  /** Base64-Data-URL der dedizierten Felgenaufnahme. */
  image: string;
  /** Strukturierte Vision-Analyse; null wenn Analyse fehlschlug (blockiert nichts). */
  analysis: WheelAnalysis | null;
  /** Vertrauen der Analyse. */
  confidence: WheelConfidence;
}

export const EMPTY_WHEEL_ANALYSIS: WheelAnalysis = {
  spokeCount: null,
  spokeStyle: null,
  finish: null,
  secondaryColor: null,
  concavity: null,
  centerCap: null,
  tireVisible: null,
  brakeCaliperVisible: null,
  brakeCaliperColor: null,
  description: null,
};
