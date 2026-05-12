// Markenspezifische CI-Vorlagen (vereinfacht; Schriften sind Web-Font-Äquivalente,
// keine lizenzpflichtigen Brand-Fonts werden ausgeliefert).

export type BrandCiPreset = {
  key: string;
  label: string;
  /** Schlüssel für getLogoForMake() – Kleinbuchstaben mit Bindestrich */
  logoKey: string;
  fonts: { display: string; body: string };
  /** Google-Font-Familien zum on-demand Laden */
  googleFonts?: string[];
  colors: {
    primary: string;
    secondary: string;
    text: string;
    bg: string;
  };
  /** Empfohlene Logo-Behandlung */
  logoMode?: "original" | "monochrome-light" | "monochrome-dark";
};

export const BRAND_PRESETS: BrandCiPreset[] = [
  {
    key: "custom",
    label: "Custom (eigene CI)",
    logoKey: "",
    fonts: { display: "Space Grotesk", body: "Inter" },
    googleFonts: ["Space Grotesk:wght@500;700", "Inter:wght@400;600"],
    colors: { primary: "#174f6b", secondary: "#0a2c3d", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "bmw",
    label: "BMW",
    logoKey: "bmw",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;600;700"],
    colors: { primary: "#1c69d4", secondary: "#0653b6", text: "#262626", bg: "#ffffff" },
  },
  {
    key: "mini",
    label: "MINI",
    logoKey: "mini",
    fonts: { display: "Oswald", body: "Inter" },
    googleFonts: ["Oswald:wght@500;700", "Inter:wght@400;600"],
    colors: { primary: "#000000", secondary: "#cf0a2c", text: "#000000", bg: "#ffffff" },
  },
  {
    key: "mercedes-benz",
    label: "Mercedes-Benz",
    logoKey: "mercedes-benz",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#000000", secondary: "#00adef", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "audi",
    label: "Audi",
    logoKey: "audi",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#bb0a30", secondary: "#000000", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "volkswagen",
    label: "Volkswagen",
    logoKey: "volkswagen",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#001e50", secondary: "#00b0f0", text: "#001e50", bg: "#ffffff" },
  },
  {
    key: "porsche",
    label: "Porsche",
    logoKey: "porsche",
    fonts: { display: "Roboto", body: "Roboto" },
    googleFonts: ["Roboto:wght@400;500;700"],
    colors: { primary: "#000000", secondary: "#d5001c", text: "#000000", bg: "#ffffff" },
  },
  {
    key: "ford",
    label: "Ford",
    logoKey: "ford",
    fonts: { display: "Antonio", body: "Inter" },
    googleFonts: ["Antonio:wght@500;700", "Inter:wght@400;600"],
    colors: { primary: "#003478", secondary: "#0072ce", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "opel",
    label: "Opel",
    logoKey: "opel",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#f7ff14", secondary: "#000000", text: "#000000", bg: "#1a1a1a" },
  },
  {
    key: "skoda",
    label: "Skoda",
    logoKey: "skoda",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#0e3a2f", secondary: "#78faae", text: "#0e3a2f", bg: "#ffffff" },
  },
  {
    key: "hyundai",
    label: "Hyundai",
    logoKey: "hyundai",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#002c5f", secondary: "#00aad2", text: "#002c5f", bg: "#ffffff" },
  },
  {
    key: "kia",
    label: "Kia",
    logoKey: "kia",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#05141f", secondary: "#bb162b", text: "#05141f", bg: "#ffffff" },
  },
  {
    key: "tesla",
    label: "Tesla",
    logoKey: "tesla",
    fonts: { display: "Manrope", body: "Manrope" },
    googleFonts: ["Manrope:wght@400;600;800"],
    colors: { primary: "#cc0000", secondary: "#000000", text: "#171a20", bg: "#ffffff" },
  },
  {
    key: "toyota",
    label: "Toyota",
    logoKey: "toyota",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#eb0a1e", secondary: "#000000", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "renault",
    label: "Renault",
    logoKey: "renault",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#ffcb00", secondary: "#000000", text: "#000000", bg: "#ffffff" },
  },
  {
    key: "peugeot",
    label: "Peugeot",
    logoKey: "peugeot",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#1f2532", secondary: "#c9a86a", text: "#1f2532", bg: "#ffffff" },
  },
  {
    key: "fiat",
    label: "Fiat",
    logoKey: "fiat",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#a4123f", secondary: "#000000", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "volvo",
    label: "Volvo",
    logoKey: "volvo",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#1a1a1a", secondary: "#003057", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "seat",
    label: "SEAT",
    logoKey: "seat",
    fonts: { display: "Inter", body: "Inter" },
    googleFonts: ["Inter:wght@400;500;700"],
    colors: { primary: "#a72124", secondary: "#1a1a1a", text: "#1a1a1a", bg: "#ffffff" },
  },
  {
    key: "cupra",
    label: "CUPRA",
    logoKey: "cupra",
    fonts: { display: "Oswald", body: "Inter" },
    googleFonts: ["Oswald:wght@500;700", "Inter:wght@400;600"],
    colors: { primary: "#b08a4a", secondary: "#1a1a1a", text: "#1a1a1a", bg: "#ffffff" },
  },
];

export function getBrandPreset(key?: string): BrandCiPreset {
  if (!key) return BRAND_PRESETS[0];
  const k = key.toLowerCase().trim();
  return (
    BRAND_PRESETS.find((b) => b.key === k) ||
    BRAND_PRESETS.find((b) => b.label.toLowerCase() === k) ||
    BRAND_PRESETS[0]
  );
}

/** Deutet einen Marken-Freitext (z.B. "VW", "BMW M") auf einen Preset-Key. */
export function detectBrandKey(brand?: string): string | undefined {
  if (!brand) return undefined;
  const t = brand.toLowerCase();
  if (t.includes("vw") || t.includes("volkswagen")) return "volkswagen";
  if (t.includes("mercedes")) return "mercedes-benz";
  if (t.includes("mini")) return "mini";
  for (const p of BRAND_PRESETS) {
    if (p.key !== "custom" && t.includes(p.key)) return p.key;
  }
  return undefined;
}
