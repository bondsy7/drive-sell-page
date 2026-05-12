// Shared text measurement & auto-fit utilities used by both the live Konva
// preview and the offscreen renderComposition exporter so both produce identical
// visuals.

import type { BannerLayer } from "../state/types";

export const FONT_FAMILY = "Inter, Manrope, system-ui, sans-serif";

let measureCanvas: HTMLCanvasElement | null = null;
function getCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  return measureCanvas.getContext("2d");
}

export function applyFont(ctx: CanvasRenderingContext2D, size: number, weight: number) {
  const w = weight >= 600 ? "700" : "400";
  ctx.font = `${w} ${size}px ${FONT_FAMILY}`;
}

/** Greedy word wrap → array of lines for a given canvas font. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
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

/** Default per-layer auto-shrink hints derived from layer id/type when not set explicitly. */
export function getLayerFitDefaults(layer: BannerLayer): {
  autoShrink: boolean;
  maxLines: number;
  minFontSize: number;
} {
  if (layer.autoShrink === false) {
    return { autoShrink: false, maxLines: layer.maxLines ?? 99, minFontSize: layer.minFontSize ?? 8 };
  }
  // Legal is meant to wrap freely, no shrink.
  if (layer.type === "legal") {
    return { autoShrink: false, maxLines: layer.maxLines ?? 99, minFontSize: layer.minFontSize ?? 7 };
  }
  let maxLines = layer.maxLines;
  if (maxLines == null) {
    switch (layer.id) {
      case "headline":
      case "subline":
        maxLines = 2;
        break;
      case "price":
      case "cta":
      case "smallInfo":
        maxLines = 1;
        break;
      default:
        maxLines = 2;
    }
  }
  return { autoShrink: layer.autoShrink ?? true, maxLines, minFontSize: layer.minFontSize ?? 10 };
}

/**
 * Reduce fontSize in 1-px steps until the wrapped text fits within `maxLines`
 * lines AND no single line exceeds `maxWidth`. Returns at least `minFontSize`.
 */
export function fitFontSize(
  text: string,
  baseSize: number,
  weight: number,
  maxWidth: number,
  maxLines: number,
  minFontSize: number,
): number {
  const ctx = getCtx();
  if (!ctx || !text || baseSize <= minFontSize) return Math.max(minFontSize, baseSize);
  let size = Math.max(minFontSize, Math.round(baseSize));
  while (size > minFontSize) {
    applyFont(ctx, size, weight);
    const lines = wrapLines(ctx, text, maxWidth);
    const overflow = lines.some((ln) => ctx.measureText(ln).width > maxWidth + 0.5);
    if (lines.length <= maxLines && !overflow) return size;
    size -= 1;
  }
  return minFontSize;
}

/**
 * Effective fontSize for a text layer after applying the per-format scale and
 * the auto-shrink-to-fit pass. Pure function; does not mutate state.
 */
export function effectiveFontSize(
  layer: BannerLayer,
  text: string,
  formatScale: number,
): number {
  const base = (layer.fontSize ?? 24) * (formatScale || 1);
  const weight = layer.fontWeight ?? 400;
  const width = layer.width ?? 400;
  const { autoShrink, maxLines, minFontSize } = getLayerFitDefaults(layer);
  if (!autoShrink) return Math.max(minFontSize, Math.round(base));
  return fitFontSize(text, base, weight, width, maxLines, minFontSize);
}
