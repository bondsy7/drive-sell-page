import type { CaptureSlot } from '@/config/vehicle-class-types';

export interface CoverageResult {
  ok: boolean;
  /** Slot-Keys, die zwingend benötigt werden, aber kein Bild haben. */
  missingRequired: string[];
  /** Menschenlesbare Labels der fehlenden Pflichtaufnahmen. */
  missingLabels: string[];
  /** Optionale, aber empfohlene Aufnahmen ohne Bild. */
  missingOptional: string[];
  /** Coverage-Tags, die durch vorhandene Bilder abgedeckt sind. */
  coveredTags: string[];
}

/**
 * Prüft VOR dem Start der Generierung, ob die vorhandenen Quellbilder die
 * Pflichtperspektiven der aktuellen Fahrzeugklasse/Konfiguration abdecken.
 *
 * Es wird ausschließlich validiert – niemals eine fehlende Perspektive durch
 * eine andere ersetzt oder aus einer vorhandenen Aufnahme "hochgerechnet".
 */
export function checkSourceCoverage(
  slots: CaptureSlot[],
  images: Record<string, unknown>,
): CoverageResult {
  const has = (key: string) => Boolean(images[key]);

  const missingRequiredSlots = slots.filter((s) => s.required && !has(s.key));
  const missingOptional = slots.filter((s) => !s.required && !has(s.key)).map((s) => s.key);
  const coveredTags = slots.filter((s) => has(s.key)).flatMap((s) => s.coverageTags);

  return {
    ok: missingRequiredSlots.length === 0,
    missingRequired: missingRequiredSlots.map((s) => s.key),
    missingLabels: missingRequiredSlots.map((s) => s.label),
    missingOptional,
    coveredTags: Array.from(new Set(coveredTags)),
  };
}

/**
 * Prüft, ob ein einzelner Pipeline-Job durch die vorhandenen Quellbilder
 * gedeckt ist. `requiredTags` stammen aus dem Profil.
 */
export function isJobCovered(requiredTags: string[] | undefined, coveredTags: string[]): boolean {
  if (!requiredTags || requiredTags.length === 0) return true;
  return requiredTags.every((t) => coveredTags.includes(t));
}
