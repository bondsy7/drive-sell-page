// Kuratierte Google-Fonts-Liste für den CI-Picker.
// Format: { family, googleSpec, category }. googleSpec wird an fontLoader übergeben.

export type FontPreset = {
  family: string;
  googleSpec: string;
  category: "display" | "body";
  note?: string;
};

export const BRAND_FONTS: FontPreset[] = [
  { family: "VW Headline", googleSpec: "local:VW+Headline:wght@400;600;900", category: "display", note: "Volkswagen CI" },
  { family: "Opel Sans", googleSpec: "local:Opel+Sans:wght@400;700", category: "display", note: "Opel CI" },
  { family: "Opel Sans Condensed", googleSpec: "local:Opel+Sans+Condensed:wght@400;700;800", category: "display", note: "Opel CI (Condensed)" },
  { family: "Ford Antenna", googleSpec: "local:Ford+Antenna:wght@300;400;700;900", category: "display", note: "Ford CI" },
  { family: "Ford Antenna Cond", googleSpec: "local:Ford+Antenna+Cond:wght@400;700", category: "display", note: "Ford CI (Condensed)" },
  { family: "Cupra", googleSpec: "local:Cupra:wght@300;400;500", category: "display", note: "CUPRA CI" },
  { family: "BMW Helvetica", googleSpec: "local:BMW+Helvetica:wght@700", category: "display", note: "BMW CI" },
];

export const DISPLAY_FONTS: FontPreset[] = [
  { family: "Space Grotesk", googleSpec: "Space+Grotesk:wght@500;700", category: "display", note: "AUTO3 Default" },
  { family: "Inter", googleSpec: "Inter:wght@600;800", category: "display" },
  { family: "Manrope", googleSpec: "Manrope:wght@600;800", category: "display" },
  { family: "Montserrat", googleSpec: "Montserrat:wght@600;800", category: "display" },
  { family: "Poppins", googleSpec: "Poppins:wght@600;800", category: "display" },
  { family: "Bebas Neue", googleSpec: "Bebas+Neue", category: "display", note: "Massiv, sportlich" },
  { family: "Oswald", googleSpec: "Oswald:wght@500;700", category: "display", note: "Schmal, plakativ" },
  { family: "Anton", googleSpec: "Anton", category: "display", note: "Sehr fett" },
  { family: "Archivo Black", googleSpec: "Archivo+Black", category: "display" },
  { family: "Barlow Condensed", googleSpec: "Barlow+Condensed:wght@600;800", category: "display" },
  { family: "Rubik", googleSpec: "Rubik:wght@600;800", category: "display" },
  { family: "DM Serif Display", googleSpec: "DM+Serif+Display", category: "display", note: "Edel/Premium" },
  { family: "Playfair Display", googleSpec: "Playfair+Display:wght@600;800", category: "display", note: "Edel/Editorial" },
  { family: "Cormorant Garamond", googleSpec: "Cormorant+Garamond:wght@600;700", category: "display" },
  { family: "Audiowide", googleSpec: "Audiowide", category: "display", note: "Tech/Futuristisch" },
  { family: "Orbitron", googleSpec: "Orbitron:wght@600;800", category: "display", note: "Tech/Futuristisch" },
];

export const BODY_FONTS: FontPreset[] = [
  { family: "Inter", googleSpec: "Inter:wght@400;500;700", category: "body", note: "AUTO3 Default" },
  { family: "Manrope", googleSpec: "Manrope:wght@400;500;700", category: "body" },
  { family: "Roboto", googleSpec: "Roboto:wght@400;500;700", category: "body" },
  { family: "Open Sans", googleSpec: "Open+Sans:wght@400;600;700", category: "body" },
  { family: "Lato", googleSpec: "Lato:wght@400;700", category: "body" },
  { family: "Source Sans 3", googleSpec: "Source+Sans+3:wght@400;600;700", category: "body" },
  { family: "Nunito", googleSpec: "Nunito:wght@400;600;700", category: "body" },
  { family: "DM Sans", googleSpec: "DM+Sans:wght@400;500;700", category: "body" },
  { family: "Work Sans", googleSpec: "Work+Sans:wght@400;500;700", category: "body" },
  { family: "Plus Jakarta Sans", googleSpec: "Plus+Jakarta+Sans:wght@400;600;700", category: "body" },
  { family: "Karla", googleSpec: "Karla:wght@400;600;700", category: "body" },
  { family: "IBM Plex Sans", googleSpec: "IBM+Plex+Sans:wght@400;500;700", category: "body" },
];

export function findFontPreset(family: string, list: FontPreset[]): FontPreset | undefined {
  const f = family.trim().toLowerCase();
  return list.find((p) => p.family.toLowerCase() === f);
}
