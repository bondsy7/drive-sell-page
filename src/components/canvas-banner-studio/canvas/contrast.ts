// WCAG-Kontrast-Berechnung (relative Luminanz, 0..1).
// Eingabe: Hex/RGB/HSL/sCSS-Farbe.

function parseColor(input: string): { r: number; g: number; b: number } {
  if (typeof window === "undefined") return { r: 255, g: 255, b: 255 };
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { r: 255, g: 255, b: 255 };
  ctx.fillStyle = "#000";
  ctx.fillStyle = input;
  const m = ctx.fillStyle.match(/#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (m) {
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };
  }
  return { r: 255, g: 255, b: 255 };
}

function relLum(r: number, g: number, b: number): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fg: string, bg: string): number {
  const a = parseColor(fg);
  const b = parseColor(bg);
  const la = relLum(a.r, a.g, a.b);
  const lb = relLum(b.r, b.g, b.b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastVerdict = "AAA" | "AA" | "AA-large" | "fail";

export function contrastVerdict(ratio: number, isLargeText: boolean): ContrastVerdict {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (isLargeText && ratio >= 3) return "AA-large";
  return "fail";
}

/** Sample average RGB color of the rendered stage area beneath a layer rect.
 *  stageEl: HTMLCanvasElement created via stage.toCanvas(). */
export function sampleAverageColor(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const ctx = source.getContext("2d");
  if (!ctx) return "#000000";
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(source.width - sx, Math.floor(w)));
  const sh = Math.max(1, Math.min(source.height - sy, Math.floor(h)));
  const data = ctx.getImageData(sx, sy, sw, sh).data;
  let r = 0, g = 0, b = 0, n = 0;
  // Subsample für Performance.
  const step = Math.max(1, Math.floor((sw * sh) / 2000));
  for (let i = 0; i < data.length; i += 4 * step) {
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  if (n === 0) return "#000000";
  const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
