// Single source of truth for credit economics.
// EK = real API cost in USD per action (sourced from official pricing pages).
// VK = Verkaufspreis pro Credit basierend auf CREDIT_PACKS in stripe-plans.ts.
// Pflege: bei Modell-/Preisänderung HIER aktualisieren.

export const USD_TO_EUR = 0.92; // grobe Umrechnung, anpassbar

// Verkaufspreis pro Credit (€) – aus CREDIT_PACKS abgeleitet
export const VK_PER_CREDIT = {
  best: 0.225,    // 200er-Pack (Worst-Case für Marge)
  mid: 0.30,      // 50er-Pack
  worst: 0.50,    // 10er-Pack (Best-Case für Marge)
} as const;

export type ActionTier = {
  /** key in credit_costs jsonb */
  action: string;
  tier: string;
  /** Display-Label für Kunde */
  label: string;
  /** Emoji für UI */
  icon: string;
  /** Credits, die aktuell abgezogen werden (Default falls DB-Wert fehlt) */
  defaultCredits: number;
  /** Modell-ID (intern) */
  model: string;
  /** EK in USD pro Aufruf */
  ekUsd: number;
  /** Quelle der Preisangabe */
  source: string;
  /** Was Kunde mit dieser Aktion erzeugt */
  produces: string;
};

// Quellen:
//  Gemini API Pricing  → https://ai.google.dev/gemini-api/docs/pricing  (geprüft 2026-06-22)
//  OpenAI Image API    → https://openai.com/api/pricing
export const CATALOG: ActionTier[] = [
  {
    action: "image_generate", tier: "schnell",
    label: "Bild · schnell", icon: "🖼️",
    defaultCredits: 3, model: "gemini-2.5-flash-image (Nano Banana)",
    ekUsd: 0.039,
    source: "Gemini 2.5 Flash Image, $0.039 / 1024px",
    produces: "1 KI-Bild (1024px, schnellste Variante)",
  },
  {
    action: "image_generate", tier: "qualitaet",
    label: "Bild · Qualität", icon: "🖼️",
    defaultCredits: 5, model: "gemini-3.1-flash-image-preview (Nano Banana 2)",
    ekUsd: 0.067,
    source: "Gemini 3.1 Flash Image, $0.067 / 1K-Bild",
    produces: "1 KI-Bild in höherer Qualität (1K)",
  },
  {
    action: "image_generate", tier: "ultra",
    label: "Bild · Ultra", icon: "✨",
    defaultCredits: 10, model: "gemini-3-pro-image-preview",
    ekUsd: 0.134,
    source: "Gemini 3 Pro Image, $0.134 / 1K-2K-Bild",
    produces: "1 Premium-Bild (2K, höchste Detailtreue)",
  },
  {
    action: "image_remaster", tier: "qualitaet",
    label: "Remastering", icon: "🎨",
    defaultCredits: 3, model: "gemini-3.1-flash-image-preview",
    ekUsd: 0.067 + 0.0006, // output + image input
    source: "Gemini 3.1 Flash Image (Edit)",
    produces: "1 aufbereitetes Foto (Showroom-Look)",
  },
  {
    action: "image_generate", tier: "ultra",
    label: "Banner", icon: "🎨",
    defaultCredits: 10, model: "gemini-3-pro-image-preview + 2.5-pro (Text)",
    ekUsd: 0.134 + 0.03,
    source: "Gemini 3 Pro Image + Prompt-Aufbau via 2.5 Pro",
    produces: "1 Marketing-Banner",
  },
  {
    action: "spin360_generate", tier: "standard",
    label: "360°-Spin · Std", icon: "🔄",
    defaultCredits: 15, model: "36× gemini-2.5-flash-image",
    ekUsd: 36 * 0.039,
    source: "36 Frames × $0.039 (Nano Banana)",
    produces: "1 vollständiger 360°-Spin (36 Frames)",
  },
  {
    action: "spin360_generate", tier: "pro",
    label: "360°-Spin · Pro", icon: "🔄",
    defaultCredits: 25, model: "36× gemini-3.1-flash-image-preview",
    ekUsd: 36 * 0.067,
    source: "36 Frames × $0.067 (Nano Banana 2)",
    produces: "1 hochauflösender 360°-Spin",
  },
  {
    action: "video_generate", tier: "standard",
    label: "Video 8 Sek.", icon: "🎬",
    defaultCredits: 15, model: "veo-3.1-generate-preview (mit Audio)",
    ekUsd: 0.40 * 8,
    source: "Veo 3.1 Standard, $0.40/s × 8s",
    produces: "1 360°-Showroom-Video, 8 Sekunden, mit Audio",
  },
  {
    action: "landing_page_export", tier: "standard",
    label: "Landingpage", icon: "📄",
    defaultCredits: 1, model: "gemini-2.5-flash",
    ekUsd: 0.005,
    source: "Gemini 2.5 Flash, ca. $0,30/1M in · $2,50/1M out",
    produces: "1 fertige Landingpage-Generierung",
  },
  {
    action: "pdf_analysis", tier: "standard",
    label: "PDF-Analyse", icon: "📑",
    defaultCredits: 1, model: "gemini-2.5-flash (Vision)",
    ekUsd: 0.003,
    source: "Gemini 2.5 Flash",
    produces: "1 PDF-Auswertung (Fahrzeug-Daten)",
  },
  {
    action: "vin_ocr", tier: "standard",
    label: "VIN-Scan", icon: "🔍",
    defaultCredits: 1, model: "gemini-2.5-flash-image",
    ekUsd: 0.001,
    source: "Gemini 2.5 Flash (Vision)",
    produces: "1 VIN-Erkennung aus Foto",
  },
];

export function effectiveCredits(
  t: ActionTier,
  costs: Record<string, Record<string, number>>,
): number {
  return costs?.[t.action]?.[t.tier] ?? t.defaultCredits;
}

export function ekEur(t: ActionTier): number {
  return t.ekUsd * USD_TO_EUR;
}

export function vkEur(credits: number, tier: keyof typeof VK_PER_CREDIT = "best"): number {
  return credits * VK_PER_CREDIT[tier];
}

export function margeEur(
  t: ActionTier,
  credits: number,
  vkTier: keyof typeof VK_PER_CREDIT = "best",
): number {
  return vkEur(credits, vkTier) - ekEur(t);
}

export function formatEur(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
}
