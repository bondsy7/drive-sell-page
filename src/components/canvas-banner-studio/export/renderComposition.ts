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
  fontFamily: string,
) {
  const weight = (layer.fontWeight ?? 400) >= 600 ? "700" : "400";
  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  // No shadow — produced a visible gray haze across the lower half of the banner.

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

function resolveColor(token: string | undefined, ci?: CiState): string {
  if (!token) return "#ffffff";
  if (token.startsWith("#") || token.startsWith("rgb") || token.startsWith("hsl")) return token;
  if (ci?.colors) {
    const t = token.toLowerCase();
    if (t === "primary" || t === "accent") return ci.colors.primary;
    if (t === "secondary") return ci.colors.secondary;
    if (t === "text" || t === "foreground") return ci.colors.text;
    if (t === "bg" || t === "background") return ci.colors.bg;
  }
  if (typeof window === "undefined") return "#ffffff";
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  return v ? `hsl(${v})` : "#ffffff";
}

export async function renderCompositionToDataURL(
  format: BannerFormat,
  composition: BannerComposition,
  textFields: BannerTextFields,
  type: ExportFormat = "png",
  ci?: CiState,
  ciContext?: CiContext | null,
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
    const bx = composition.backgroundX ?? r.x;
    const by = composition.backgroundY ?? r.y;
    const bw = composition.backgroundWidth ?? r.w;
    const bh = composition.backgroundHeight ?? r.h;
    ctx.drawImage(bg, bx, by, bw, bh);
  }

  drawOverlay(ctx, composition.overlayDirection, composition.overlayStrength, format.width, format.height);

  const recolor = async (u?: string) =>
    u && ci && ci.logoMode !== "original" ? await recolorSvg(u, ci.logoMode, ci.logoCustomColor) : u;
  const [logoUrl, dealerUrl, customUrl] = await Promise.all([
    recolor(composition.logoUrl),
    recolor(composition.dealerLogoUrl),
    recolor(composition.customLogoUrl),
  ]);
  const [logo, dealerLogo, customLogo] = await Promise.all([
    loadImage(logoUrl),
    loadImage(dealerUrl),
    loadImage(customUrl),
  ]);

  const formatScale = composition.scale ?? 1;
  const FONT_DISPLAY = ci?.fontDisplay ? `"${ci.fontDisplay}", ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY;
  const FONT_BODY = ci?.fontBody ? `"${ci.fontBody}", ${DEFAULT_FONT_FAMILY}` : DEFAULT_FONT_FAMILY;

  for (const layer of composition.layers) {
    if (!layer.visible) continue;
    if (layer.type === "overlay") continue;
    if (layer.type === "shape") {
      const w = (layer.width ?? 200) * formatScale;
      const h = (layer.height ?? 100) * formatScale;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      const r = Math.max(0, layer.borderRadius ?? 0);
      if (layer.gradient) {
        const c = layer.gradient.color || "#000000";
        const hexToRgba = (hex: string, a: number) => {
          const m = /^#?([a-f\d]{6})$/i.exec(hex);
          if (!m) return hex;
          const n = parseInt(m[1], 16);
          return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
        };
        let x0 = layer.x, y0 = layer.y, x1 = layer.x, y1 = layer.y + h;
        if (layer.gradient.direction === "bottom-top") { y0 = layer.y + h; y1 = layer.y; }
        else if (layer.gradient.direction === "left-right") { x0 = layer.x; x1 = layer.x + w; y0 = layer.y; y1 = layer.y; }
        else if (layer.gradient.direction === "right-left") { x0 = layer.x + w; x1 = layer.x; y0 = layer.y; y1 = layer.y; }
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, hexToRgba(c, 1));
        g.addColorStop(1, hexToRgba(c, 0));
        ctx.fillStyle = g;
      } else {
        const fill = layer.backgroundColor
          ? resolveColor(layer.backgroundColor, ci)
          : resolveColor(layer.color, ci);
        ctx.fillStyle = fill;
      }
      if (r > 0 && typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        (ctx as any).roundRect(layer.x, layer.y, w, h, r);
        ctx.fill();
      } else {
        ctx.fillRect(layer.x, layer.y, w, h);
      }
      ctx.restore();
      continue;
    }
    if (layer.type === "image") {
      if (!layer.imageUrl) continue;
      const img = await loadImage(layer.imageUrl);
      if (!img) continue;
      const w = (layer.width ?? 200) * formatScale;
      const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
      const h = (layer.height ?? (layer.width ?? 200) * ratio) * formatScale;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.drawImage(img, layer.x, layer.y, w, h);
      ctx.restore();
      continue;
    }
    if (layer.type === "logo") {
      const slotImg =
        layer.id === "logo-dealer" ? dealerLogo :
        layer.id === "logo-custom" ? customLogo :
        logo;
      const slotUrl =
        layer.id === "logo-dealer" ? dealerUrl :
        layer.id === "logo-custom" ? customUrl :
        logoUrl;
      let img: HTMLImageElement | null = null;
      if (layer.imageUrl) {
        img = await loadImage(layer.imageUrl);
      } else if (layer.color && /^#?[0-9a-f]{3,8}$/i.test(layer.color.trim()) && slotUrl) {
        const tinted = await recolorSvg(slotUrl, "custom", layer.color);
        img = await loadImage(tinted);
      }
      if (!img) img = slotImg;
      if (!img) continue;
      const baseW = layer.width ?? format.width * 0.18;
      const w = baseW * formatScale;
      const ratio = img.naturalHeight / img.naturalWidth || 0.4;
      ctx.save();
      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.drawImage(img, layer.x, layer.y, w, w * ratio);
      ctx.restore();
      continue;
    }
    const raw = layer.field ? textFields[layer.field] : "";
    const text = resolveShortcodes(raw, ciContext);
    if (!text) continue;
    const fontSize = effectiveFontSize(layer, text, formatScale);
    const baseFamily = (layer.id === "headline" || layer.id === "subline") ? FONT_DISPLAY : FONT_BODY;
    const family = layer.fontFamily ? `"${layer.fontFamily}", ${DEFAULT_FONT_FAMILY}` : baseFamily;
    let textColor = resolveColor(layer.color, ci);

    // CTA als Button rendern (Primary-Hintergrund + Padding).
    const isCta = layer.id === "cta" || layer.field === "cta";
    if (isCta) {
      const weight = (layer.fontWeight ?? 400) >= 600 ? "700" : "400";
      ctx.save();
      ctx.font = `${weight} ${fontSize}px ${family}`;
      const measuredW = ctx.measureText(text).width;
      ctx.restore();
      const padX = fontSize * 0.9;
      const padY = fontSize * 0.5;
      const boxW = measuredW + padX * 2;
      const boxH = fontSize * 1.2 + padY * 2;
      let bx = layer.x - padX;
      if (layer.width && layer.align === "center") bx = layer.x + (layer.width - measuredW) / 2 - padX;
      else if (layer.width && layer.align === "right") bx = layer.x + layer.width - measuredW - padX;
      const by = layer.y - padY;
      const fill = ci?.colors?.primary || resolveColor("primary", ci) || "#174f6b";
      const r = Math.min(boxH / 2, 10);
      ctx.save();
      ctx.fillStyle = fill;
      if (typeof (ctx as any).roundRect === "function") {
        ctx.beginPath();
        (ctx as any).roundRect(bx, by, boxW, boxH, r);
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, boxW, boxH);
      }
      ctx.restore();
      const tokenIsPrimary = (layer.color ?? "").toLowerCase() === "primary"
        || (layer.color ?? "").toLowerCase() === "accent"
        || textColor.toLowerCase() === fill.toLowerCase();
      if (tokenIsPrimary) textColor = "#ffffff";
    }

    drawTextLayer(ctx, layer, text, textColor, fontSize, family);
  }

  const mime = type === "png" ? "image/png" : type === "jpg" ? "image/jpeg" : "image/webp";
  return canvas.toDataURL(mime, 0.95);
}

export async function renderCompositionToBlob(
  format: BannerFormat,
  composition: BannerComposition,
  textFields: BannerTextFields,
  type: ExportFormat = "png",
  ci?: CiState,
  ciContext?: CiContext | null,
): Promise<Blob> {
  const dataUrl = await renderCompositionToDataURL(format, composition, textFields, type, ci, ciContext);
  const res = await fetch(dataUrl);
  return await res.blob();
}
