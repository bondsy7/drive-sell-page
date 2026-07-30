// Zentrale KI-Kennzeichnung gem. EU AI Act (VO (EU) 2024/1689), Art. 50 Abs. 4.
// Gilt ab 2. August 2026 für alle veröffentlichten KI-generierten oder
// KI-veränderten Bild-, Video- und Audioinhalte.
//
// HINWEIS: Phase 3 des Plans (maschinenlesbare Markierung / C2PA-Manifest)
// ist bewusst NICHT umgesetzt und bleibt offen — siehe
// .lovable/ki-kennzeichnungspflicht-plan.md.

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

const CONTEXT_TEXT: Record<AiDisclosureContext, string> = {
  banner: "KI-generiert",
  landing: "Fahrzeugbilder mit KI erstellt oder verändert (EU AI Act Art. 50).",
  pdf: "Fahrzeugbilder mit KI aufbereitet gem. EU AI Act Art. 50.",
  spin: "KI-optimierte Ansicht",
  repair: "KI-VISUALISIERUNG – nicht bindend",
  music: "KI-generierte Musik",
  video: "KI-generiertes Video",
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

/** Inline-Badge für HTML-Bilder. */
export function buildAiDisclosureBadgeHTML(): string {
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;font-weight:600;letter-spacing:0.02em">${AI_DISCLOSURE_LABEL_DE}</span>`;
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
 * Brennt das sichtbare KI-Label unten rechts in ein Canvas ein.
 * Mindesthöhe ~3 % der Bildhöhe, halbtransparenter Chip, hoher Kontrast.
 */
export function drawAiDisclosureOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string = AI_DISCLOSURE_LABEL_DE,
) {
  const fontSize = Math.max(10, Math.round(Math.min(width, height) * 0.03));
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.4);
  const margin = Math.round(Math.min(width, height) * 0.02);

  ctx.save();
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textBaseline = "top";
  const textW = ctx.measureText(text).width;
  const boxW = textW + padX * 2;
  const boxH = fontSize * 1.25 + padY * 2;
  const x = width - boxW - margin;
  const y = height - boxH - margin;
  const r = Math.min(boxH / 2, 8);

  ctx.fillStyle = "rgba(0,0,0,0.62)";
  if (typeof (ctx as unknown as { roundRect?: unknown }).roundRect === "function") {
    ctx.beginPath();
    (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
      .roundRect(x, y, boxW, boxH, r);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, boxW, boxH);
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + padX, y + padY);
  ctx.restore();
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
    drawAiDisclosureOnCanvas(ctx, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return src;
  }
}
