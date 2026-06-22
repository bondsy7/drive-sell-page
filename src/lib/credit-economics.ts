// ============================================================
// Credit-Ökonomie – Single Source of Truth
// ============================================================
// EK = echte API-Kosten in USD je Aufruf (offizielle Preislisten,
//      Stand: 2026-06-22, verifiziert via ai.google.dev, openai.com,
//      ideogram.ai). Jede Position dokumentiert ihr Setup.
// VK = Verkaufspreis pro Credit (€), abgeleitet aus CREDIT_PACKS.
// Verbund-Aktionen (Landingpage, Schadensanalyse, 360°-Spin) listen
// alle echten Sub-EKs auf, damit nichts unbemerkt im Minus läuft.
// ============================================================

export const USD_TO_EUR = 0.92;

// Overhead pro Kunden-Aktion (USD), gemittelt über alle Aktionen.
// Enthält:
//  • Stripe-Gebühr (~1,5 % + 0,25 € auf Credit-Kauf, umgelegt auf ~50 Cr/Kauf) ≈ $0,010
//  • Resend-Mailversand (Bestätigungs-/System-Mails)                            ≈ $0,0005
//  • Supabase Egress + DB-Writes (Projekt-Row, Logs, RLS)                       ≈ $0,0020
//  • Gemini File-API Upload-Quota & Retention (frei, aber Bandbreite/Latenz)   ≈ $0,0003
//  • CDN/Edge-Function Cold-Start & Runtime (Supabase Edge)                    ≈ $0,0012
//  → Summe ≈ $0,014 pro Aktion
export const OVERHEAD_USD = 0.014;

// Infrastruktur-Kosten pro **transportiertem Bild** (Upload zu Gemini File API
// + Supabase Storage Egress + signed URLs + Re-Download in Edge Function).
// Gemini File API selbst ist gratis, aber jeder Bild-Roundtrip kostet
// Supabase-Egress ≈ $0,09/GB → bei ~2 MB/Bild ≈ $0,00018 + Edge-Function
// Compute ≈ $0,00012 → konservativ $0,0005 pro Bild im Workflow.
export const INFRA_PER_IMAGE_USD = 0.0005;


// Verkaufspreis pro Credit (€) – aus CREDIT_PACKS in stripe-plans.ts.
// Aktuell:
//   10 Cr  →  5,00 € = 0,500 €/Cr (worst margin for us)
//   50 Cr  → 18,00 € = 0,360 €/Cr
//  200 Cr  → 55,00 € = 0,275 €/Cr (best margin for us)
// (Anpassung 2026-06-22: Pack-Preise erhöht, damit auch Video-Mix
//  bei 200er-Pack noch ≥30 % Marge fährt.)
export const VK_PER_CREDIT = {
  best: 0.275,   // 200er-Pack – Worst-Case-Marge
  mid: 0.36,     // 50er-Pack
  worst: 0.50,   // 10er-Pack – Best-Case-Marge
} as const;

export type Category =
  | "image"        // Reine Bildgenerierung
  | "remaster"     // Foto-Aufbereitung
  | "banner"       // Marketing-Banner
  | "video"        // Video
  | "landing"      // Landingpages (Verbund)
  | "damage"       // Schadensanalyse / -reparatur
  | "analysis"     // PDF / VIN / Bild / Angebot
  | "sales"        // Sales-Assistent / KI-Chat
  | "spin"         // 360° (optional, nicht in Kunden-Mix)
  | "bundle";      // End-to-End-Workflows (Gesamtkosten)

export interface ActionTier {
  id: string;
  category: Category;
  action: string;
  tier: string;
  label: string;
  icon: string;
  defaultCredits: number;
  model: string;
  /** EK in USD pro **Kunden-Aktion** (inkl. aller Sub-Calls) */
  ekUsd: number;
  ekBreakdown: string;
  source: string;
  produces: string;
  /** Im Kunden-Mix-Allokator anzeigen? */
  inMix: boolean;
}

// ─── API-Preisliste (USD, offiziell, Stand 2026-06-22) ────────
// Gemini:    https://ai.google.dev/gemini-api/docs/pricing
// OpenAI:    https://openai.com/api/pricing
// Ideogram:  https://ideogram.ai/api-pricing (4.0 Turbo $0.03, 4.0/3.0 $0.06)
// Veo:       https://ai.google.dev/gemini-api/docs/video
// OUTVIN:    interner Vertrag (~$0.05/VIN)
// ──────────────────────────────────────────────────────────────
const API = {
  // Bildgenerierung
  geminiFlashImage:        0.039,   // gemini-2.5-flash-image (Nano Banana) 1K
  geminiFlashImage2_1k:    0.067,   // gemini-3.1-flash-image-preview 1K
  geminiFlashImage2_2k:    0.101,   // gemini-3.1-flash-image-preview 2K
  geminiFlashImage2_4k:    0.151,   // gemini-3.1-flash-image-preview 4K
  geminiProImage_2k:       0.134,   // gemini-3-pro-image-preview 1-2K
  geminiProImage_4k:       0.240,   // gemini-3-pro-image-preview 4K
  gptImage1_low:           0.011,
  gptImage1_med:           0.042,
  gptImage1_high:          0.167,
  gptImage2:               0.040,   // gpt-image-2 (approx)
  ideogramV3Reframe:       0.060,   // Ideogram 3.0 reframe
  ideogramV4Default:       0.060,   // Ideogram 4.0 default
  ideogramV4Turbo:         0.030,   // Ideogram 4.0 turbo
  // Text / Vision (typische Kosten je Call, gemittelt)
  geminiFlashText:         0.003,   // gemini-2.5-flash (kurze Vision/Text)
  geminiFlashTextLong:     0.010,   // gemini-2.5-flash (lange Vision-PDF)
  geminiProText:           0.025,   // gemini-2.5-pro (komplexer Prompt)
  geminiFlashLite:         0.0005,  // gemini-2.5-flash-lite (OCR)
  // Embeddings
  geminiEmbedding:         0.0001,  // gemini-embedding-001 pro Chunk
  // Video
  veo31Fast_PerSec:        0.15,    // veo-3.1-fast / lite
  veo31Std_PerSec:         0.40,    // veo-3.1 standard (mit Audio)
  // Daten-APIs
  outvinLookup:            0.05,
} as const;

// ─── Katalog – ALLE kostenverursachenden Aktionen ────────────
export const CATALOG: ActionTier[] = [
  // ════════════════════════════════════════════════════════
  // BILDGENERIERUNG (Hero / freie Bilder)
  // ════════════════════════════════════════════════════════
  {
    id: "image-schnell", category: "image",
    action: "image_generate", tier: "schnell",
    label: "Bild · schnell", icon: "🖼️", defaultCredits: 3,
    model: "gemini-2.5-flash-image (Nano Banana)",
    ekUsd: API.geminiFlashImage,
    ekBreakdown: `1× Bild $${API.geminiFlashImage}`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 KI-Bild, 1K",
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
    label: "Bild · Ultra (2K)", icon: "✨", defaultCredits: 10,
    model: "gemini-3-pro-image-preview",
    ekUsd: API.geminiProImage_2k,
    ekBreakdown: `1× Bild 2K $${API.geminiProImage_2k}`,
    source: "Gemini 3 Pro Image",
    produces: "1 Premium-Bild, 2K",
    inMix: true,
  },
  {
    id: "image-ultra-4k", category: "image",
    action: "image_generate", tier: "ultra_4k",
    label: "Bild · Ultra 4K", icon: "✨", defaultCredits: 15,
    model: "gemini-3-pro-image-preview (4K)",
    ekUsd: API.geminiProImage_4k,
    ekBreakdown: `1× Bild 4K $${API.geminiProImage_4k}`,
    source: "Gemini 3 Pro Image",
    produces: "1 Premium-Bild, 4K",
    inMix: false,
  },

  // ─── OpenAI Image (gpt-image-1, 3 Qualitätsstufen) ───────
  {
    id: "image-openai-low", category: "image",
    action: "image_generate", tier: "openai_low",
    label: "Bild · OpenAI Low", icon: "🖼️", defaultCredits: 2,
    model: "openai/gpt-image-1 (low)",
    ekUsd: API.gptImage1_low,
    ekBreakdown: `1× gpt-image-1 low $${API.gptImage1_low}`,
    source: "OpenAI gpt-image-1",
    produces: "1 KI-Bild via OpenAI (günstig)",
    inMix: false,
  },
  {
    id: "image-openai-med", category: "image",
    action: "image_generate", tier: "openai_med",
    label: "Bild · OpenAI Medium", icon: "🖼️", defaultCredits: 4,
    model: "openai/gpt-image-1 (medium)",
    ekUsd: API.gptImage1_med,
    ekBreakdown: `1× gpt-image-1 medium $${API.gptImage1_med}`,
    source: "OpenAI gpt-image-1",
    produces: "1 KI-Bild via OpenAI (Standard)",
    inMix: false,
  },
  {
    id: "image-openai-high", category: "image",
    action: "image_generate", tier: "openai_high",
    label: "Bild · OpenAI High", icon: "✨", defaultCredits: 10,
    model: "openai/gpt-image-1 (high)",
    ekUsd: API.gptImage1_high,
    ekBreakdown: `1× gpt-image-1 high $${API.gptImage1_high}`,
    source: "OpenAI gpt-image-1",
    produces: "1 Premium-Bild via OpenAI (höchste Qualität)",
    inMix: false,
  },

  // ─── Ideogram Bilderweitern (Reframe = Outpainting) ──────
  {
    id: "image-extend-turbo", category: "image",
    action: "image_generate", tier: "extend_turbo",
    label: "Bilderweitern · Turbo (Ideogram)", icon: "↔️", defaultCredits: 2,
    model: "ideogram-v4 turbo",
    ekUsd: API.ideogramV4Turbo,
    ekBreakdown: `1× Ideogram 4.0 Turbo Reframe $${API.ideogramV4Turbo}`,
    source: "Ideogram API",
    produces: "1 erweitertes Bild (Outpainting, schnell)",
    inMix: false,
  },
  {
    id: "image-extend-default", category: "image",
    action: "image_generate", tier: "extend_default",
    label: "Bilderweitern · Default (Ideogram)", icon: "↔️", defaultCredits: 3,
    model: "ideogram-v3 reframe / v4 default",
    ekUsd: API.ideogramV3Reframe,
    ekBreakdown: `1× Ideogram Reframe $${API.ideogramV3Reframe}`,
    source: "Ideogram API",
    produces: "1 erweitertes Bild (Outpainting, höchste Qualität)",
    inMix: false,
  },
  // ════════════════════════════════════════════════════════
  {
    id: "remaster-schnell", category: "remaster",
    action: "image_remaster", tier: "schnell",
    label: "Remaster · schnell", icon: "🎨", defaultCredits: 2,
    model: "gemini-2.5-flash-image (Edit)",
    ekUsd: API.geminiFlashImage + 0.0006,
    ekBreakdown: `1× Edit $${API.geminiFlashImage} + Bild-Input`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 aufbereitetes Foto",
    inMix: true,
  },
  {
    id: "remaster-qualitaet", category: "remaster",
    action: "image_remaster", tier: "qualitaet",
    label: "Remaster · Qualität", icon: "🎨", defaultCredits: 3,
    model: "gemini-3.1-flash-image-preview (Edit)",
    ekUsd: API.geminiFlashImage2_1k + 0.0006,
    ekBreakdown: `1× Edit $${API.geminiFlashImage2_1k} + Bild-Input`,
    source: "Gemini 3.1 Flash Image",
    produces: "1 aufbereitetes Foto, höhere Qualität",
    inMix: true,
  },
  {
    id: "remaster-ultra", category: "remaster",
    action: "image_remaster", tier: "ultra",
    label: "Remaster · Ultra", icon: "✨", defaultCredits: 7,
    model: "gemini-3-pro-image-preview (Edit)",
    ekUsd: API.geminiProImage_2k + 0.001,
    ekBreakdown: `1× Edit $${API.geminiProImage_2k} + Bild-Input`,
    source: "Gemini 3 Pro Image",
    produces: "1 Premium-Aufbereitung, 2K",
    inMix: true,
  },

  // ════════════════════════════════════════════════════════
  // BANNER-STUDIO (klassisch, Gemini-Pipeline)
  // ════════════════════════════════════════════════════════
  {
    id: "banner-studio-schnell", category: "banner",
    action: "image_generate", tier: "banner_schnell",
    label: "Banner-Studio · schnell", icon: "🪧", defaultCredits: 3,
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
    label: "Banner-Studio · Qualität", icon: "🪧", defaultCredits: 5,
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
    model: "gemini-3-pro-image-preview + 2.5-pro",
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

  // ════════════════════════════════════════════════════════
  // CANVAS-BANNER-STUDIO (Master + Reframe)
  // ════════════════════════════════════════════════════════
  {
    id: "banner-canvas-master", category: "banner",
    action: "image_generate", tier: "canvas_master",
    label: "Canvas-Banner Master-Bild", icon: "🖌️", defaultCredits: 4,
    model: "gemini-2.5-flash-image",
    ekUsd: API.geminiFlashImage,
    ekBreakdown: `1× Master-Bild $${API.geminiFlashImage}`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 Master-Bild als Canvas-Basis",
    inMix: true,
  },
  {
    id: "banner-canvas-reframe-turbo", category: "banner",
    action: "image_generate", tier: "canvas_reframe_turbo",
    label: "Canvas-Reframe · Turbo (Ideogram)", icon: "🖼️", defaultCredits: 3,
    model: "ideogram-v4 turbo",
    ekUsd: API.ideogramV4Turbo,
    ekBreakdown: `1× Ideogram 4.0 Turbo $${API.ideogramV4Turbo}`,
    source: "Ideogram API",
    produces: "1 umgerahmtes Banner-Bild (schnell)",
    inMix: true,
  },
  {
    id: "banner-canvas-reframe", category: "banner",
    action: "image_generate", tier: "canvas_reframe",
    label: "Canvas-Reframe · Default (Ideogram)", icon: "🖼️", defaultCredits: 5,
    model: "ideogram-v3 reframe / v4 default",
    ekUsd: API.ideogramV3Reframe,
    ekBreakdown: `1× Ideogram Reframe $${API.ideogramV3Reframe}`,
    source: "Ideogram API",
    produces: "1 umgerahmtes Banner-Bild (höchste Qualität)",
    inMix: true,
  },

  // ════════════════════════════════════════════════════════
  // VIDEO (Veo 3.1)
  // ════════════════════════════════════════════════════════
  {
    id: "video-fast", category: "video",
    action: "video_generate", tier: "fast",
    label: "Video · Fast/Lite (8 Sek.)", icon: "🎬", defaultCredits: 8,
    model: "veo-3.1-fast / lite",
    ekUsd: API.veo31Fast_PerSec * 8,
    ekBreakdown: `8 Sek × $${API.veo31Fast_PerSec}/s`,
    source: "Veo 3.1 Fast",
    produces: "1 Video, 8 Sek., 720p, mit Audio",
    inMix: true,
  },
  {
    id: "video-standard", category: "video",
    action: "video_generate", tier: "standard",
    label: "Video · Standard (8 Sek.)", icon: "🎬", defaultCredits: 18,
    model: "veo-3.1-generate-preview",
    ekUsd: API.veo31Std_PerSec * 8,
    ekBreakdown: `8 Sek × $${API.veo31Std_PerSec}/s`,
    source: "Veo 3.1 Standard (mit Audio)",
    produces: "1 Showroom-Video, 8 Sek., 1080p, mit Audio",
    inMix: true,
  },

  // ════════════════════════════════════════════════════════
  // LANDINGPAGE (Verbund: Text + 7 Bilder)
  // ════════════════════════════════════════════════════════
  {
    id: "landing-standard", category: "landing",
    action: "landing_page_export", tier: "standard",
    label: "Landingpage (Verbund)", icon: "📄", defaultCredits: 5,
    model: "gemini-2.5-pro + 7× gemini-2.5-flash-image",
    ekUsd: API.geminiProText + 7 * API.geminiFlashImage,
    ekBreakdown: `1× Content-Gen $${API.geminiProText} + 7× Bilder $${(7 * API.geminiFlashImage).toFixed(3)} = $${(API.geminiProText + 7 * API.geminiFlashImage).toFixed(3)}`,
    source: "Gemini 2.5 Pro + 2.5 Flash Image",
    produces: "1 vollständige Landingpage (Content + 6–8 KI-Bilder)",
    inMix: true,
  },
  {
    id: "landing-premium", category: "landing",
    action: "landing_page_export", tier: "premium",
    label: "Landingpage · Premium", icon: "📄", defaultCredits: 10,
    model: "gemini-2.5-pro + 7× gemini-3.1-flash-image",
    ekUsd: API.geminiProText + 7 * API.geminiFlashImage2_1k,
    ekBreakdown: `1× Content-Gen $${API.geminiProText} + 7× Bilder 1K $${(7 * API.geminiFlashImage2_1k).toFixed(3)}`,
    source: "Gemini 2.5 Pro + 3.1 Flash Image",
    produces: "1 Premium-Landingpage mit hochwertigeren Bildern",
    inMix: false,
  },

  // ════════════════════════════════════════════════════════
  // SCHADEN (Analyse + Reparatur-Visualisierung)
  // ════════════════════════════════════════════════════════
  {
    id: "damage-analysis", category: "damage",
    action: "damage_analyze", tier: "standard",
    label: "Schadensanalyse (Verbund)", icon: "🔧", defaultCredits: 4,
    model: "gemini-2.5-pro + 3× gemini-3.1-flash-image (Annotation)",
    ekUsd: API.geminiProText + 3 * (API.geminiFlashImage2_1k + 0.0006),
    ekBreakdown: `1× Analyse Pro $${API.geminiProText} + ~3× annotierte Bilder $${(3 * API.geminiFlashImage2_1k).toFixed(3)}`,
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
    source: "Gemini 3.1 Flash Image",
    produces: "1 reparierte Schadens-Visualisierung",
    inMix: true,
  },

  // ════════════════════════════════════════════════════════
  // ANALYSE & DATEN (PDF, VIN, Bild, Angebot)
  // ════════════════════════════════════════════════════════
  {
    id: "pdf-analysis", category: "analysis",
    action: "pdf_analysis", tier: "standard",
    label: "PDF-Analyse (Fahrzeugdaten)", icon: "📑", defaultCredits: 1,
    model: "gemini-2.5-flash (Vision)",
    ekUsd: API.geminiFlashTextLong,
    ekBreakdown: `1× Vision-Call $${API.geminiFlashTextLong}`,
    source: "Gemini 2.5 Flash",
    produces: "1 PDF-Auswertung mit allen Fahrzeug-Stammdaten",
    inMix: true,
  },
  {
    id: "vin-ocr", category: "analysis",
    action: "vin_ocr", tier: "standard",
    label: "VIN aus Foto (OCR)", icon: "🔍", defaultCredits: 1,
    model: "gemini-2.5-flash-lite",
    ekUsd: API.geminiFlashLite,
    ekBreakdown: `1× OCR $${API.geminiFlashLite}`,
    source: "Gemini 2.5 Flash Lite",
    produces: "1 erkannte 17-stellige VIN",
    inMix: true,
  },
  {
    id: "vin-lookup", category: "analysis",
    action: "vin_lookup", tier: "standard",
    label: "VIN-Lookup (Stammdaten)", icon: "🆔", defaultCredits: 2,
    model: "OUTVIN API + Gemini-Fallback",
    ekUsd: API.outvinLookup,
    ekBreakdown: `1× OUTVIN $${API.outvinLookup}`,
    source: "OUTVIN.com",
    produces: "1 vollständiger Stammdaten-Lookup (Marke, Modell, Ausstattung)",
    inMix: true,
  },
  {
    id: "image-classify", category: "analysis",
    action: "image_classify", tier: "standard",
    label: "Bild-Klassifikation (auto)", icon: "🏷️", defaultCredits: 1,
    model: "gemini-2.5-flash",
    ekUsd: API.geminiFlashText,
    ekBreakdown: `1× Klassifikation $${API.geminiFlashText}`,
    source: "Gemini 2.5 Flash",
    produces: "1 Bildtyp-Erkennung (front/heck/seite/innen)",
    inMix: false,
  },
  {
    id: "brand-detect", category: "analysis",
    action: "image_classify", tier: "brand_detect",
    label: "Marken-/Modell-Erkennung", icon: "🚗", defaultCredits: 1,
    model: "gemini-2.5-flash",
    ekUsd: API.geminiFlashText,
    ekBreakdown: `1× Vision-Call $${API.geminiFlashText}`,
    source: "Gemini 2.5 Flash",
    produces: "1 Marken-/Modell-Vorschlag aus Foto",
    inMix: false,
  },
  {
    id: "offer-analysis", category: "analysis",
    action: "pdf_analysis", tier: "offer",
    label: "Angebots-/Inserat-Analyse", icon: "💰", defaultCredits: 2,
    model: "gemini-2.5-pro (Vision)",
    ekUsd: API.geminiProText,
    ekBreakdown: `1× Pro-Vision-Call $${API.geminiProText}`,
    source: "Gemini 2.5 Pro",
    produces: "1 strukturierte Angebots-Auswertung (Preis, Specs, Plausibilität)",
    inMix: true,
  },
  {
    id: "banner-data-extract", category: "analysis",
    action: "pdf_analysis", tier: "banner_data",
    label: "Banner-Daten aus PDF/Bild", icon: "📋", defaultCredits: 1,
    model: "gemini-2.5-flash",
    ekUsd: API.geminiFlashText,
    ekBreakdown: `1× Extraktion $${API.geminiFlashText}`,
    source: "Gemini 2.5 Flash",
    produces: "1 Datensatz für Banner-Generator (Preis, Marke, Modell)",
    inMix: false,
  },

  // ════════════════════════════════════════════════════════
  // SALES-ASSISTENT (Chat + E-Mail-Antwort + Knowledge)
  // ════════════════════════════════════════════════════════
  {
    id: "sales-chat", category: "sales",
    action: "sales_chat", tier: "standard",
    label: "Sales-Chat (Antwort)", icon: "💬", defaultCredits: 1,
    model: "gemini-2.5-flash",
    ekUsd: API.geminiFlashText,
    ekBreakdown: `1× Chat-Antwort $${API.geminiFlashText}`,
    source: "Gemini 2.5 Flash",
    produces: "1 KI-Antwort an Kunde (Chat oder E-Mail)",
    inMix: true,
  },
  {
    id: "sales-response-pro", category: "sales",
    action: "sales_chat", tier: "pro",
    label: "Sales-Antwort · Pro", icon: "💬", defaultCredits: 2,
    model: "gemini-2.5-pro",
    ekUsd: API.geminiProText,
    ekBreakdown: `1× Pro-Antwort $${API.geminiProText}`,
    source: "Gemini 2.5 Pro",
    produces: "1 hochwertige Sales-Antwort mit Kontext",
    inMix: false,
  },
  {
    id: "sales-knowledge-ingest", category: "sales",
    action: "sales_chat", tier: "ingest",
    label: "Wissens-Ingest (Embedding)", icon: "📚", defaultCredits: 1,
    model: "gemini-embedding-001",
    ekUsd: API.geminiEmbedding * 20,
    ekBreakdown: `~20 Chunks × $${API.geminiEmbedding}`,
    source: "Gemini Embedding 001",
    produces: "1 indiziertes Dokument für Sales-RAG",
    inMix: false,
  },

  // ════════════════════════════════════════════════════════
  // 360°-SPIN (Verbund, optional)
  // ════════════════════════════════════════════════════════
  {
    id: "spin-standard", category: "spin",
    action: "spin360_generate", tier: "standard",
    label: "360°-Spin (36 Frames)", icon: "🔄", defaultCredits: 20,
    model: "36× gemini-2.5-flash-image + Analyse + Normalize",
    ekUsd: 36 * API.geminiFlashImage + API.geminiFlashText + 4 * API.geminiFlashImage,
    ekBreakdown: `1× Analyse $${API.geminiFlashText} + 4× Normalize $${(4 * API.geminiFlashImage).toFixed(3)} + 36× Frames $${(36 * API.geminiFlashImage).toFixed(3)}`,
    source: "Gemini 2.5 Flash Image",
    produces: "1 vollständiger 360°-Spin (36 Frames)",
    inMix: false,
  },

  // ════════════════════════════════════════════════════════
  // KOMPLETT-WORKFLOWS (End-to-End-Gesamtkosten)
  // Summe aller Sub-Aufrufe, so wie sie der Kunde wirklich auslöst.
  // ════════════════════════════════════════════════════════
  {
    id: "bundle-banner-studio-complete", category: "bundle",
    action: "image_generate", tier: "bundle_banner_studio",
    label: "Banner-Studio · komplett (Master + Reframe + Analyse)",
    icon: "🪧", defaultCredits: 9,
    model: "Daten-Extract + Master-Bild + Ideogram-Reframe",
    ekUsd: API.geminiFlashText + API.geminiFlashImage + API.ideogramV3Reframe,
    ekBreakdown:
      `Daten-Extract (Gemini Flash) $${API.geminiFlashText} ` +
      `+ Master-Bild (Gemini 2.5 Flash Image) $${API.geminiFlashImage} ` +
      `+ Reframe (Ideogram v3) $${API.ideogramV3Reframe} ` +
      `= $${(API.geminiFlashText + API.geminiFlashImage + API.ideogramV3Reframe).toFixed(3)}`,
    source: "Gemini + Ideogram",
    produces: "1 fertiger Banner (Daten-Auslesen + KI-Bild + Format-Anpassung)",
    inMix: false,
  },
  {
    id: "bundle-banner-studio-premium", category: "bundle",
    action: "image_generate", tier: "bundle_banner_premium",
    label: "Banner-Studio · Premium komplett (Pro-Bild + Reframe)",
    icon: "✨", defaultCredits: 14,
    model: "Daten-Extract + Gemini 3 Pro Image + Ideogram-Reframe",
    ekUsd: API.geminiFlashText + API.geminiProImage_2k + API.ideogramV3Reframe,
    ekBreakdown:
      `Daten-Extract $${API.geminiFlashText} ` +
      `+ Pro-Bild 2K $${API.geminiProImage_2k} ` +
      `+ Reframe $${API.ideogramV3Reframe} ` +
      `= $${(API.geminiFlashText + API.geminiProImage_2k + API.ideogramV3Reframe).toFixed(3)}`,
    source: "Gemini Pro + Ideogram",
    produces: "1 Premium-Banner komplett (Pro-Bildqualität + Format-Reframe)",
    inMix: false,
  },
  {
    id: "bundle-pdf-full-pipeline", category: "bundle",
    action: "pdf_analysis", tier: "bundle_full",
    label: "PDF-Pipeline · komplett (PDF + VIN + 7 Bilder + Landingpage)",
    icon: "📑", defaultCredits: 12,
    model: "PDF-Analyse + OUTVIN + Content + 7× Hero-Bilder",
    ekUsd:
      API.geminiFlashTextLong +
      API.outvinLookup +
      API.geminiProText +
      7 * API.geminiFlashImage,
    ekBreakdown:
      `PDF-Analyse $${API.geminiFlashTextLong} ` +
      `+ VIN-Lookup (OUTVIN) $${API.outvinLookup} ` +
      `+ Content-Gen Pro $${API.geminiProText} ` +
      `+ 7× Bilder $${(7 * API.geminiFlashImage).toFixed(3)} ` +
      `= $${(API.geminiFlashTextLong + API.outvinLookup + API.geminiProText + 7 * API.geminiFlashImage).toFixed(3)}`,
    source: "Gemini Flash + OUTVIN + Gemini Pro + Gemini Flash Image",
    produces: "1 vollständige PDF→Landingpage-Pipeline (Daten + Bilder + Content)",
    inMix: false,
  },
  {
    id: "bundle-pdf-extract-only", category: "bundle",
    action: "pdf_analysis", tier: "bundle_extract",
    label: "PDF · Daten + VIN-Anreicherung",
    icon: "📋", defaultCredits: 3,
    model: "PDF-Vision + OUTVIN-Lookup",
    ekUsd: API.geminiFlashTextLong + API.outvinLookup,
    ekBreakdown:
      `PDF-Analyse $${API.geminiFlashTextLong} ` +
      `+ VIN-Lookup $${API.outvinLookup} ` +
      `= $${(API.geminiFlashTextLong + API.outvinLookup).toFixed(3)}`,
    source: "Gemini 2.5 Flash + OUTVIN",
    produces: "1 vollständiger Fahrzeug-Stammdatensatz aus PDF (inkl. VIN-Anreicherung)",
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
  return (t.ekUsd + OVERHEAD_USD) * USD_TO_EUR;
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
  sales:    { label: "Sales-Assistent", icon: "💬", color: "from-teal-500/15 to-teal-500/5" },
  spin:     { label: "360°-Spin",       icon: "🔄", color: "from-indigo-500/15 to-indigo-500/5" },
  bundle:   { label: "Komplett-Workflows", icon: "📦", color: "from-fuchsia-500/15 to-fuchsia-500/5" },
};
