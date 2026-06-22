// ============================================================
// Credit-Ökonomie – Single Source of Truth
// ============================================================
// EK = echte API-Kosten in USD je Aufruf (offizielle Preislisten,
//      Stand: 2026-06-22). Quellen sind pro Eintrag dokumentiert.
// VK = Verkaufspreis pro Credit, abgeleitet aus stripe-plans.ts.
// Verbund-Aktionen (z. B. Landingpage) listen alle echten Sub-EKs
// auf, damit nichts unbemerkt im Minus läuft.
// ============================================================

export const USD_TO_EUR = 0.92;

// Verkaufspreis pro Credit (€) – aus CREDIT_PACKS:
//   10 Cr → 5,00 € = 0,500 €/Cr (worst margin for us)
//   50 Cr → 15,00 € = 0,300 €/Cr
//  200 Cr → 45,00 € = 0,225 €/Cr (best margin for us)
export const VK_PER_CREDIT = {
  best: 0.225,   // 200er-Pack – Worst-Case-Marge
  mid: 0.30,     // 50er-Pack
  worst: 0.50,   // 10er-Pack – Best-Case-Marge
} as const;

export type Category =
  | "image"        // Reine Bildgenerierung
  | "remaster"     // Foto-Aufbereitung
  | "banner"       // Marketing-Banner
  | "video"        // Video
  | "landing"      // Landingpages (Verbund)
  | "damage"       // Schadensanalyse / -reparatur
  | "analysis"     // PDF / VIN / Bilderkennung
  | "spin";        // 360° (optional, nicht in Kunden-Mix)

export interface ActionTier {
  /** Eindeutige UI-/Map-ID */
  id: string;
  /** Kategorie für Slider-Gruppierung */
  category: Category;
  /** key in admin_settings.credit_costs (action_type) */
  action: string;
  /** tier-key in credit_costs */
  tier: string;
  /** Display-Label */
  label: string;
  icon: string;
  /** Default-Credits, falls DB-Override fehlt */
  defaultCredits: number;
  /** Hauptmodell (für Anzeige) */
  model: string;
  /** EK in USD pro **Kunden-Aktion** (inkl. aller Sub-Calls) */
  ekUsd: number;
  /** Wie sich der EK zusammensetzt (für Transparenz im Admin) */
  ekBreakdown: string;
  /** Quelle */
  source: string;
  /** Was Kunde damit erzeugt */
  produces: string;
  /** Im Kunden-Mix-Allokator anzeigen? */
  inMix: boolean;
}

// ─── Preisliste der APIs (USD) ────────────────────────────────
// Gemini API:   https://ai.google.dev/gemini-api/docs/pricing
// OpenAI API:   https://openai.com/api/pricing
// Veo:          https://ai.google.dev/gemini-api/docs/pricing  (Video)
// Ideogram:     https://about.ideogram.ai/api-pricing          (v3 Reframe ≈ $0.06/image)
// OUTVIN:       Vertrag mit OUTVIN.com (intern, ≈ $0.05/VIN)
// ──────────────────────────────────────────────────────────────
const API = {
  geminiFlashImage: 0.039,         // gemini-2.5-flash-image (Nano Banana) – 1024px
  geminiFlashImage2_1k: 0.067,     // gemini-3.1-flash-image-preview – 1K
  geminiFlashImage2_2k: 0.101,     // gemini-3.1-flash-image-preview – 2K
  geminiProImage_2k: 0.134,        // gemini-3-pro-image-preview – 1-2K
  geminiProImage_4k: 0.24,         // gemini-3-pro-image-preview – 4K
  gptImage1_low: 0.011,            // openai gpt-image-1 low
  gptImage1_med: 0.042,            // medium
  gptImage1_high: 0.167,           // high
  gptImage2: 0.04,                 // openai gpt-image-2 (approx)
  ideogramV3Reframe: 0.06,         // Ideogram v3 reframe / image
  geminiFlashText: 0.003,          // gemini-2.5-flash (kurzer Vision-Call)
  geminiProText: 0.025,            // gemini-2.5-pro (komplexer Prompt-Aufbau)
  geminiFlashLite: 0.0005,         // gemini-2.5-flash-lite (VIN-OCR Fallback)
  veo31PerSec: 0.40,               // veo-3.1-generate-preview, $/sec
  outvinLookup: 0.05,              // pro VIN-Lookup
} as const;

// ─── Katalog ──────────────────────────────────────────────────
export const CATALOG: ActionTier[] = [
  // ── Reine Bildgenerierung ────────────────────────────────
  {
    id: "image-schnell", category: "image",
    action: "image_generate", tier: "schnell",
    label: "Bild · schnell", icon: "🖼️", defaultCredits: 3,
    model: "gemini-2.5-flash-image (Nano Banana)",
    ekUsd: API.geminiFlashImage,
    ekBreakdown: `1× Bild $${API.geminiFlashImage}`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 KI-Bild, 1024px",
    inMix: true,
  },
  {
    id: "image-qualitaet", category: "image",
    action: "image_generate", tier: "qualitaet",
    label: "Bild · Qualität", icon: "🖼️", defaultCredits: 5,
    model: "gemini-3.1-flash-image-preview (Nano Banana 2)",
    ekUsd: API.geminiFlashImage2_1k,
    ekBreakdown: `1× Bild 1K $${API.geminiFlashImage2_1k}`,
    source: "Gemini 3.1 Flash Image",
    produces: "1 KI-Bild, 1K",
    inMix: true,
  },
  {
    id: "image-ultra", category: "image",
    action: "image_generate", tier: "ultra",
    label: "Bild · Ultra", icon: "✨", defaultCredits: 10,
    model: "gemini-3-pro-image-preview",
    ekUsd: API.geminiProImage_2k,
    ekBreakdown: `1× Bild 2K $${API.geminiProImage_2k}`,
    source: "Gemini 3 Pro Image",
    produces: "1 Premium-Bild, 2K",
    inMix: true,
  },

  // ── Remastering (pro Bild) ────────────────────────────────
  {
    id: "remaster-schnell", category: "remaster",
    action: "image_remaster", tier: "schnell",
    label: "Remaster · schnell", icon: "🎨", defaultCredits: 2,
    model: "gemini-2.5-flash-image",
    ekUsd: API.geminiFlashImage + 0.0006,
    ekBreakdown: `1× Edit $${API.geminiFlashImage} + Input`,
    source: "Gemini 2.5 Flash Image (Edit)",
    produces: "1 aufbereitetes Foto",
    inMix: true,
  },
  {
    id: "remaster-qualitaet", category: "remaster",
    action: "image_remaster", tier: "qualitaet",
    label: "Remaster · Qualität", icon: "🎨", defaultCredits: 3,
    model: "gemini-3.1-flash-image-preview",
    ekUsd: API.geminiFlashImage2_1k + 0.0006,
    ekBreakdown: `1× Edit $${API.geminiFlashImage2_1k} + Input`,
    source: "Gemini 3.1 Flash Image (Edit)",
    produces: "1 aufbereitetes Foto, höhere Qualität",
    inMix: true,
  },
  {
    id: "remaster-ultra", category: "remaster",
    action: "image_remaster", tier: "ultra",
    label: "Remaster · Ultra", icon: "✨", defaultCredits: 7,
    model: "gemini-3-pro-image-preview",
    ekUsd: API.geminiProImage_2k + 0.001,
    ekBreakdown: `1× Edit $${API.geminiProImage_2k} + Input`,
    source: "Gemini 3 Pro Image (Edit)",
    produces: "1 Premium-Aufbereitung, 2K",
    inMix: true,
  },

  // ── Banner-Generator (Studio) ─────────────────────────────
  {
    id: "banner-studio-schnell", category: "banner",
    action: "image_generate", tier: "banner_schnell",
    label: "Banner-Studio · schnell", icon: "🎨", defaultCredits: 3,
    model: "gemini-2.5-flash-image",
    ekUsd: API.geminiFlashImage,
    ekBreakdown: `1× Bild $${API.geminiFlashImage}`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 Banner (schnell)",
    inMix: true,
  },
  {
    id: "banner-studio-qualitaet", category: "banner",
    action: "image_generate", tier: "banner_qualitaet",
    label: "Banner-Studio · Qualität", icon: "🎨", defaultCredits: 5,
    model: "gemini-3.1-flash-image-preview",
    ekUsd: API.geminiFlashImage2_1k,
    ekBreakdown: `1× Bild $${API.geminiFlashImage2_1k}`,
    source: "Gemini 3.1 Flash Image",
    produces: "1 Banner (Qualität)",
    inMix: true,
  },
  {
    id: "banner-studio-premium", category: "banner",
    action: "image_generate", tier: "banner_premium",
    label: "Banner-Studio · Premium", icon: "✨", defaultCredits: 8,
    model: "gemini-3-pro-image-preview",
    ekUsd: API.geminiProImage_2k + API.geminiProText,
    ekBreakdown: `1× Pro-Bild $${API.geminiProImage_2k} + Prompt-Aufbau $${API.geminiProText}`,
    source: "Gemini 3 Pro Image + 2.5 Pro",
    produces: "1 Premium-Banner",
    inMix: true,
  },
  {
    id: "banner-studio-ultra", category: "banner",
    action: "image_generate", tier: "banner_ultra",
    label: "Banner-Studio · Ultra (OpenAI)", icon: "✨", defaultCredits: 10,
    model: "openai/gpt-image-1 (high)",
    ekUsd: API.gptImage1_high,
    ekBreakdown: `1× gpt-image-1 high $${API.gptImage1_high}`,
    source: "OpenAI gpt-image-1",
    produces: "1 Premium-Banner via OpenAI",
    inMix: false,
  },

  // ── Canvas-Banner-Studio (Reframe + Master Image) ─────────
  {
    id: "banner-canvas-master", category: "banner",
    action: "image_generate", tier: "canvas_master",
    label: "Canvas-Banner Master-Bild", icon: "🖌️", defaultCredits: 4,
    model: "gemini-2.5-flash-image",
    ekUsd: API.geminiFlashImage,
    ekBreakdown: `1× Bild $${API.geminiFlashImage}`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 Master-Bild für Canvas-Banner",
    inMix: true,
  },
  {
    id: "banner-canvas-reframe", category: "banner",
    action: "image_generate", tier: "canvas_reframe",
    label: "Canvas-Banner Reframe", icon: "🖼️", defaultCredits: 5,
    model: "ideogram-v3 reframe",
    ekUsd: API.ideogramV3Reframe,
    ekBreakdown: `1× Ideogram Reframe $${API.ideogramV3Reframe}`,
    source: "Ideogram v3 API",
    produces: "1 umgerahmtes Banner-Bild (anderes Seitenverhältnis)",
    inMix: true,
  },

  // ── Video ─────────────────────────────────────────────────
  {
    id: "video-standard", category: "video",
    action: "video_generate", tier: "standard",
    label: "Video · 8 Sek.", icon: "🎬", defaultCredits: 15,
    model: "veo-3.1-generate-preview",
    ekUsd: API.veo31PerSec * 8,
    ekBreakdown: `8 Sek × $${API.veo31PerSec}/s`,
    source: "Veo 3.1 (mit Audio)",
    produces: "1 Showroom-Video, 8 Sek., mit Audio",
    inMix: true,
  },

  // ── Landingpage (Verbund-Aktion) ─────────────────────────
  {
    id: "landing-standard", category: "landing",
    action: "landing_page_export", tier: "standard",
    label: "Landingpage", icon: "📄", defaultCredits: 5,
    model: "gemini-2.5-flash + 7× gemini-2.5-flash-image",
    ekUsd: API.geminiProText + 7 * API.geminiFlashImage,
    ekBreakdown: `1× Content-Gen $${API.geminiProText} + 7× Bilder ${7 * API.geminiFlashImage} = $${(API.geminiProText + 7 * API.geminiFlashImage).toFixed(3)}`,
    source: "Gemini 2.5 Flash Text + 2.5 Flash Image",
    produces: "1 vollständige Landingpage (Content + 6-8 KI-Bilder)",
    inMix: true,
  },

  // ── Schadensanalyse (Verbund) ────────────────────────────
  {
    id: "damage-analysis", category: "damage",
    action: "damage_analyze", tier: "standard",
    label: "Schadensanalyse", icon: "🔧", defaultCredits: 4,
    model: "gemini-2.5-pro + gemini-3.1-flash-image (Annotation)",
    ekUsd: API.geminiProText + 3 * (API.geminiFlashImage2_1k + 0.0006),
    ekBreakdown: `1× Analyse Pro $${API.geminiProText} + ~3× annotierte Bilder ${(3 * API.geminiFlashImage2_1k).toFixed(3)}`,
    source: "Gemini 2.5 Pro + 3.1 Flash Image",
    produces: "1 Schadensbericht mit annotierten Fotos",
    inMix: true,
  },
  {
    id: "damage-repair", category: "damage",
    action: "image_remaster", tier: "damage_repair",
    label: "Schadensreparatur (Visualisierung)", icon: "🛠️", defaultCredits: 2,
    model: "gemini-3.1-flash-image-preview",
    ekUsd: API.geminiFlashImage2_1k + 0.0006,
    ekBreakdown: `1× Edit $${API.geminiFlashImage2_1k}`,
    source: "Gemini 3.1 Flash Image (Edit)",
    produces: "1 reparierte Schadens-Visualisierung",
    inMix: true,
  },

  // ── Analyse (PDF, VIN, Bild-Klassifikation) ──────────────
  {
    id: "pdf-analysis", category: "analysis",
    action: "pdf_analysis", tier: "standard",
    label: "PDF-Analyse", icon: "📑", defaultCredits: 1,
    model: "gemini-2.5-flash (Vision)",
    ekUsd: API.geminiFlashText,
    ekBreakdown: `1× Vision-Call $${API.geminiFlashText}`,
    source: "Gemini 2.5 Flash",
    produces: "1 PDF-Auswertung mit Fahrzeug-Daten",
    inMix: true,
  },
  {
    id: "vin-ocr", category: "analysis",
    action: "vin_ocr", tier: "standard",
    label: "VIN aus Foto", icon: "🔍", defaultCredits: 1,
    model: "gemini-2.5-flash-lite",
    ekUsd: API.geminiFlashLite,
    ekBreakdown: `1× OCR $${API.geminiFlashLite}`,
    source: "Gemini 2.5 Flash Lite",
    produces: "1 VIN-Erkennung aus Foto",
    inMix: true,
  },
  {
    id: "vin-lookup", category: "analysis",
    action: "vin_lookup", tier: "standard",
    label: "VIN-Lookup (Stammdaten)", icon: "🆔", defaultCredits: 2,
    model: "OUTVIN API + Gemini-Fallback",
    ekUsd: API.outvinLookup,
    ekBreakdown: `1× OUTVIN $${API.outvinLookup}`,
    source: "OUTVIN.com (intern)",
    produces: "1 Stammdaten-Lookup (Marke, Modell, Ausstattung)",
    inMix: true,
  },
  {
    id: "image-classify", category: "analysis",
    action: "image_classify", tier: "standard",
    label: "Bild-Klassifikation", icon: "🏷️", defaultCredits: 1,
    model: "gemini-2.5-flash",
    ekUsd: API.geminiFlashText,
    ekBreakdown: `1× Klassifikation $${API.geminiFlashText}`,
    source: "Gemini 2.5 Flash",
    produces: "1 automatische Bildtyp-Erkennung (front/heck/innen)",
    inMix: false,
  },

  // ── 360°-Spin (optional, nicht im Mix-Slider) ────────────
  {
    id: "spin-standard", category: "spin",
    action: "spin360_generate", tier: "standard",
    label: "360°-Spin Standard", icon: "🔄", defaultCredits: 20,
    model: "36× gemini-2.5-flash-image + Analyse",
    ekUsd: 36 * API.geminiFlashImage + API.geminiFlashText + 4 * API.geminiFlashImage,
    ekBreakdown: `Analyse + 4× Normalize + 36× Frames`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 vollständiger 360°-Spin (36 Frames)",
    inMix: false,
  },
];

// ─── Helpers ─────────────────────────────────────────────────
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

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  image:    { label: "Bilder",          icon: "🖼️", color: "from-sky-500/15 to-sky-500/5" },
  remaster: { label: "Remastering",     icon: "🎨", color: "from-violet-500/15 to-violet-500/5" },
  banner:   { label: "Banner",          icon: "🪧", color: "from-amber-500/15 to-amber-500/5" },
  video:    { label: "Video",           icon: "🎬", color: "from-rose-500/15 to-rose-500/5" },
  landing:  { label: "Landingpages",    icon: "📄", color: "from-emerald-500/15 to-emerald-500/5" },
  damage:   { label: "Schaden",         icon: "🔧", color: "from-orange-500/15 to-orange-500/5" },
  analysis: { label: "Analyse / Daten", icon: "🔍", color: "from-slate-500/15 to-slate-500/5" },
  spin:     { label: "360°-Spin",       icon: "🔄", color: "from-indigo-500/15 to-indigo-500/5" },
};
