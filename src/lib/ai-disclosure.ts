// Zentrale KI-Kennzeichnung gem. EU AI Act (VO (EU) 2024/1689), Art. 50 Abs. 4.
// Gilt ab 2. August 2026 für alle veröffentlichten KI-generierten oder
// KI-veränderten Bild-, Video- und Audioinhalte.
//
// HINWEIS: Phase 3 des Plans (maschinenlesbare Markierung / C2PA-Manifest)
// ist bewusst NICHT umgesetzt und bleibt offen — siehe
// .lovable/ki-kennzeichnungspflicht-plan.md.

import aiLabelAsset from "@/assets/ai-labels/ai-black.png.asset.json";
import aiGeneratedLabelAsset from "@/assets/ai-labels/ai-generated-black.png.asset.json";
import aiModifiedLabelAsset from "@/assets/ai-labels/ai-modified-black.png.asset.json";

export const AI_DISCLOSURE_LABEL_DE = "KI-generiert";
export const AI_DISCLOSURE_LABEL_EN = "AI-generated";
export const AI_DISCLOSURE_LONG_DE =
  "Mit KI erstellt oder verändert (EU AI Act Art. 50)";

export type AiDisclosureContext =
  | "banner"
  | "landing"
  | "pdf"
  | "spin"
  | "repair"
  | "music"
  | "video"
  | "social"
  | "text";

export type AiDisclosureKind = "basic" | "generated" | "modified";

// Zuordnung nach EU-Leitfaden: "AI GENERATED" nur für vollständig synthetische
// Inhalte ohne menschliches Ausgangsmaterial (z. B. KI-Musik). Alles, was auf
// echten Fahrzeugfotos basiert (Remastering, Video, 360°-Spin, Banner, Seiten),
// ist teilweise KI-verändert → "AI MODIFIED".
const CONTEXT_KIND: Record<AiDisclosureContext, AiDisclosureKind> = {
  banner: "modified",
  landing: "modified",
  pdf: "modified",
  spin: "modified",
  repair: "modified",
  music: "generated",
  video: "modified",
  social: "modified",
  text: "basic",
};

const LABEL_ASSETS: Record<AiDisclosureKind, string> = {
  basic: aiLabelAsset.url,
  generated: aiGeneratedLabelAsset.url,
  modified: aiModifiedLabelAsset.url,
};

const LABEL_ALT: Record<AiDisclosureKind, string> = {
  basic: "AI",
  generated: "AI GENERATED",
  modified: "AI MODIFIED",
};

export function getAiDisclosureKind(context: AiDisclosureContext): AiDisclosureKind {
  return CONTEXT_KIND[context];
}

export function getAiDisclosureLabelAsset(context: AiDisclosureContext): string {
  return LABEL_ASSETS[getAiDisclosureKind(context)];
}

export function getAiDisclosureLabelAlt(context: AiDisclosureContext): string {
  return LABEL_ALT[getAiDisclosureKind(context)];
}

const CONTEXT_TEXT: Record<AiDisclosureContext, string> = {
  banner: "KI-generiert",
  landing: "Fahrzeugbilder mit KI erstellt oder verändert (EU AI Act Art. 50).",
  pdf: "Fahrzeugbilder mit KI aufbereitet gem. EU AI Act Art. 50.",
  spin: "KI-veränderte Fahrzeugansicht",
  repair: "KI-VISUALISIERUNG – nicht bindend",
  music: "KI-generierte Musik",
  video: "Mit KI verändertes Fahrzeugvideo",
  social: "Bild künstlich erstellt/verändert (EU AI Act)",
  text: "Mit KI-Unterstützung erstellt",
};

export function getAiDisclosureText(context: AiDisclosureContext): string {
  return CONTEXT_TEXT[context] ?? AI_DISCLOSURE_LABEL_DE;
}

/** Footer-Zeile für alle HTML-Ausgaben (Angebotsseiten, Landingpages, PDF-Export). */
export function buildAiDisclosureFooterHTML(
  context: AiDisclosureContext = "landing",
  color = "#94a3b8",
): string {
  return `<p class="ai-disclosure" style="margin-top:10px;font-size:11px;line-height:1.6;color:${color}">${getAiDisclosureText(context)}</p>`;
}

/** Offizielles Inline-Label für HTML-Bilder. */
export function buildAiDisclosureBadgeHTML(context: AiDisclosureContext = "banner"): string {
  return `<img src="${getAiDisclosureLabelAsset(context)}" alt="${getAiDisclosureLabelAlt(context)}" style="display:block;width:auto;height:24px" />`;
}

/**
 * Eigenständiges (offline-taugliches) Label als SVG-DataURI.
 * Wird in exportierten HTML-/PDF-Ausgaben verwendet, damit die Kennzeichnung
 * auch nach Download/Weitergabe sichtbar bleibt.
 */
export function buildAiDisclosureLabelDataUri(context: AiDisclosureContext = "landing"): string {
  const kind = getAiDisclosureKind(context);
  const text = LABEL_ALT[kind];
  const svg =
    kind === "basic"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44"><circle cx="22" cy="22" r="22" fill="#000"/><text x="22" y="28" font-family="Helvetica,Arial,sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">AI</text></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${text.length * 9 + 34} 40" width="${text.length * 9 + 34}" height="40"><rect x="0" y="0" width="${text.length * 9 + 34}" height="40" rx="20" fill="#000"/><text x="${(text.length * 9 + 34) / 2}" y="26" font-family="Helvetica,Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="0.5" fill="#fff" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Nicht entfernbares Overlay-Label oben rechts auf einem Bild in HTML-Ausgaben.
 * Muss innerhalb eines Elements mit position:relative liegen.
 */
export function buildAiDisclosureImageOverlayHTML(
  context: AiDisclosureContext = "landing",
): string {
  return `<img class="ai-disclosure-badge" src="${buildAiDisclosureLabelDataUri(context)}" alt="${getAiDisclosureLabelAlt(context)}" title="${getAiDisclosureText(context)}" style="position:absolute;top:10px;right:10px;z-index:5;height:22px;width:auto;pointer-events:none" />`;
}

/** Bild + Overlay-Label als eigenständiger Wrapper. */
export function wrapImageWithAiDisclosure(
  imgHTML: string,
  context: AiDisclosureContext = "landing",
  wrapperStyle = "position:relative;display:block",
): string {
  return `<span style="${wrapperStyle}">${imgHTML}${buildAiDisclosureImageOverlayHTML(context)}</span>`;
}

/** Alt-Text erweitern (Barrierefreiheit + Transparenz). */
export function withAiDisclosureAlt(alt: string): string {
  if (!alt) return AI_DISCLOSURE_LABEL_DE;
  return alt.toLowerCase().includes("ki-generiert") ? alt : `${alt} – ${AI_DISCLOSURE_LABEL_DE}`;
}

const CAPTION_SUFFIX = `\n\n${getAiDisclosureText("social")}\n#KIgeneriert #AIgenerated`;

/** Pflicht-Suffix für Social-Captions. Nicht deaktivierbar bei Deepfake-Kategorien. */
export function appendAiDisclosureToCaption(caption: string): string {
  const base = (caption || "").trimEnd();
  if (base.toLowerCase().includes("#kigeneriert")) return base;
  return `${base}${CAPTION_SUFFIX}`;
}

/**
 * Brennt das passende offizielle KI-Label oben rechts in ein Canvas ein.
 * So bleiben Preis- und Verbrauchsangaben im unteren Bannerbereich frei.
 */
export async function drawAiDisclosureOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  context: AiDisclosureContext = "banner",
): Promise<void> {
  const margin = Math.round(Math.min(width, height) * 0.02);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const label = new Image();
    label.crossOrigin = "anonymous";
    label.onload = () => resolve(label);
    label.onerror = () => reject(new Error("AI label load failed"));
    label.src = getAiDisclosureLabelAsset(context);
  });
  const targetHeight = Math.max(22, Math.round(Math.min(width, height) * 0.045));
  const targetWidth = targetHeight * (img.naturalWidth / img.naturalHeight);
  ctx.drawImage(img, width - targetWidth - margin, margin, targetWidth, targetHeight);
}

/**
 * Brennt das KI-Label in ein vorhandenes Bild (DataURL/URL) ein.
 * Fällt bei Fehlern auf das Originalbild zurück.
 */
export async function stampAiDisclosureOnDataUrl(src: string): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image load failed"));
      i.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.drawImage(img, 0, 0);
    await drawAiDisclosureOnCanvas(ctx, canvas.width, canvas.height, "banner");
    return canvas.toDataURL("image/png");
  } catch {
    return src;
  }
}
