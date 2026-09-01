import { z } from "zod";

/**
 * Reference V2 — Phase 1: Color families.
 *
 * Farbfamilie ist eine rein VISUELLE Kategorie (wie die Fahrzeugklasse in
 * Phase 0) — kein Herstellerlack-Name, keine Business-Metadaten. Sie dient
 * ausschliesslich der Sortierung/Vollstaendigkeitspruefung der Vehicle Master
 * Records und gelangt niemals in einen Generierungs-Prompt.
 */
export const COLOR_FAMILIES = [
  "white",
  "black",
  "grey",
  "silver",
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "brown_beige",
  "multi_or_wrap",
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number];
export const ColorFamilySchema = z.enum(COLOR_FAMILIES);

export const COLOR_FAMILY_LABELS_DE: Record<ColorFamily, string> = {
  white: "Weiß",
  black: "Schwarz",
  grey: "Grau",
  silver: "Silber",
  blue: "Blau",
  red: "Rot",
  green: "Grün",
  yellow: "Gelb",
  orange: "Orange",
  brown_beige: "Braun / Beige",
  multi_or_wrap: "Mehrfarbig / Folierung",
};

/** Swatch-Token fuer die Admin-UI (nur Darstellung, keine Prompt-Relevanz). */
export const COLOR_FAMILY_SWATCH: Record<ColorFamily, string> = {
  white: "hsl(0 0% 96%)",
  black: "hsl(0 0% 12%)",
  grey: "hsl(0 0% 55%)",
  silver: "hsl(210 6% 78%)",
  blue: "hsl(214 70% 45%)",
  red: "hsl(0 65% 45%)",
  green: "hsl(140 45% 35%)",
  yellow: "hsl(48 90% 55%)",
  orange: "hsl(26 85% 52%)",
  brown_beige: "hsl(30 30% 45%)",
  multi_or_wrap:
    "linear-gradient(135deg, hsl(214 70% 45%), hsl(0 65% 45%), hsl(48 90% 55%))",
};

export function isColorFamily(value: unknown): value is ColorFamily {
  return ColorFamilySchema.safeParse(value).success;
}
