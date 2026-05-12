// Offscreen rendering of a BannerComposition into a real-size canvas DataURL.
// We replicate the visual logic from BannerCanvas without React/Konva to keep it
// dependency-light and predictable for batch exports.

import type {
  BannerComposition,
  BannerFormat,
  BannerLayer,
  BannerTextFields,
  CiState,
  OverlayDirection,
} from "../state/types";
import { effectiveFontSize, FONT_FAMILY as DEFAULT_FONT_FAMILY } from "../canvas/textFit";
import { resolveShortcodes } from "../ci/shortcodes";
import type { CiContext } from "../ci/profileSources";
import { recolorSvg } from "../ci/svgRecolor";

type ExportFormat = "png" | "jpg" | "webp";

function loadImage(src?: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitRect(iw: number, ih: number, cw: number, ch: number, mode: "cover" | "contain") {
  if (!iw || !ih) return { x: 0, y: 0, w: cw, h: ch };
  const ir = iw / ih;
  const cr = cw / ch;
  if (mode === "cover") {
    if (ir > cr) {
      const h = ch; const w = h * ir;
      return { x: (cw - w) / 2, y: 0, w, h };
    }
    const w = cw; const h = w / ir;
    return { x: 0, y: (ch - h) / 2, w, h };
  }
  if (ir > cr) {
    const w = cw; const h = w / ir;
    return { x: 0, y: (ch - h) / 2, w, h };
  }
  const h = ch; const w = h * ir;
  return { x: (cw - w) / 2, y: 0, w, h };
}

function drawOverlay(ctx: CanvasRenderingContext2D, dir: OverlayDirection, strength: number, w: number, h: number) {
  const a = Math.max(0, Math.min(1, strength / 100));
  if (dir === "none" || a === 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${(dir === "full-soft" ? a * 0.6 : a * 0.75).toFixed(3)})`;
  switch (dir) {
    case "full-soft":
      ctx.fillRect(0, 0, w, h); break;
    case "left":
      ctx.fillRect(0, 0, w * 0.6, h); break;
    case "right":
      ctx.fillRect(w * 0.4, 0, w * 0.6, h); break;
    case "top":
      ctx.fillRect(0, 0, w, h * 0.5); break;
    case "bottom":
      ctx.fillRect(0, h * 0.5, w, h * 0.5); break;
  }
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: BannerLayer,
  text: string,
  color: string,
  fontSize: number,
) {
  const weight = (layer.fontWeight ?? 400) >= 600 ? "700" : "400";
  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  if (layer.type !== "legal") {
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 8;
  }
  const maxW = layer.width ?? 1000;
  const lines = wrapText(ctx, text, maxW);
  const lineH = fontSize * 1.2;
  lines.forEach((ln, i) => {
    const w = ctx.measureText(ln).width;
    let x = layer.x;
    if (layer.align === "center") x = layer.x + (maxW - w) / 2;
    else if (layer.align === "right") x = layer.x + maxW - w;
    ctx.fillText(ln, x, layer.y + i * lineH);
  });
  ctx.restore();
}

function resolveColor(token?: string): string {
  if (!token) return "#ffffff";
  if (token.startsWith("#") || token.startsWith("rgb") || token.startsWith("hsl")) return token;
  if (typeof window === "undefined") return "#ffffff";
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return v ? `hsl(${v})` : "#ffffff";
}

export async function renderCompositionToDataURL(
  format: BannerFormat,
  composition: BannerComposition,
  textFields: BannerTextFields,
  type: ExportFormat = "png",
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, format.width, format.height);

  const bg = await loadImage(composition.backgroundImageUrl);
  if (bg) {
    const r = fitRect(bg.naturalWidth, bg.naturalHeight, format.width, format.height, composition.backgroundFit);
    ctx.drawImage(bg, r.x, r.y, r.w, r.h);
  }

  drawOverlay(ctx, composition.overlayDirection, composition.overlayStrength, format.width, format.height);

  const logo = await loadImage(composition.logoUrl);

  const formatScale = composition.scale ?? 1;

  for (const layer of composition.layers) {
    if (!layer.visible) continue;
    if (layer.type === "image" || layer.type === "overlay") continue;
    if (layer.type === "logo") {
      if (!logo) continue;
      const baseW = layer.width ?? format.width * 0.18;
      const w = baseW * formatScale;
      const ratio = logo.naturalHeight / logo.naturalWidth || 0.4;
      ctx.drawImage(logo, layer.x, layer.y, w, w * ratio);
      continue;
    }
    const text = layer.field ? textFields[layer.field] : "";
    if (!text) continue;
    const fontSize = effectiveFontSize(layer, text, formatScale);
    drawTextLayer(ctx, layer, text, resolveColor(layer.color), fontSize);
  }

  const mime = type === "png" ? "image/png" : type === "jpg" ? "image/jpeg" : "image/webp";
  return canvas.toDataURL(mime, 0.95);
}

export async function renderCompositionToBlob(
  format: BannerFormat,
  composition: BannerComposition,
  textFields: BannerTextFields,
  type: ExportFormat = "png",
): Promise<Blob> {
  const dataUrl = await renderCompositionToDataURL(format, composition, textFields, type);
  const res = await fetch(dataUrl);
  return await res.blob();
}
