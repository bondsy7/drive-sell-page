// Lädt eine SVG-URL und ersetzt fill/stroke Attribute durch eine Zielfarbe.
// Gibt eine data:image/svg+xml URL zurück, die wie jedes Bild geladen werden kann.

const cache = new Map<string, string>();
const svgDetectionCache = new Map<string, boolean>();

export type LogoMode = "original" | "monochrome-light" | "monochrome-dark" | "custom";

function colorFor(mode: LogoMode, custom?: string): string | null {
  switch (mode) {
    case "monochrome-light":
      return "#ffffff";
    case "monochrome-dark":
      return "#000000";
    case "custom":
      return custom || null;
    case "original":
    default:
      return null;
  }
}

/** Schneller, synchroner Check anhand der URL (Endung / data-URI). */
export function isSvgUrlSync(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/svg")) return true;
  return /\.svg(\?|#|$)/i.test(url);
}

/**
 * Robuste, asynchrone SVG-Erkennung. Prüft erst die URL, danach (bei unklaren
 * URLs ohne Endung, z. B. signierte oder gehashte Storage-Links) per HEAD/GET
 * den Content-Type bzw. die ersten Bytes der Datei. Ergebnis wird gecached.
 */
export async function detectIsSvg(url?: string): Promise<boolean> {
  if (!url) return false;
  if (isSvgUrlSync(url)) return true;
  const hit = svgDetectionCache.get(url);
  if (hit !== undefined) return hit;
  try {
    // HEAD zuerst (billig). Manche CDNs blockieren HEAD → Fallback auf GET.
    let contentType: string | null = null;
    try {
      const h = await fetch(url, { method: "HEAD", mode: "cors" });
      if (h.ok) contentType = h.headers.get("content-type");
    } catch {
      /* ignore */
    }
    if (!contentType) {
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) {
        svgDetectionCache.set(url, false);
        return false;
      }
      contentType = r.headers.get("content-type");
      if (!contentType || !/svg/i.test(contentType)) {
        // Sniff first bytes als letztes Mittel.
        const txt = (await r.text()).trimStart().slice(0, 200).toLowerCase();
        const looksSvg = txt.startsWith("<?xml") ? txt.includes("<svg") : txt.startsWith("<svg");
        svgDetectionCache.set(url, looksSvg);
        return looksSvg;
      }
    }
    const isSvg = /svg/i.test(contentType || "");
    svgDetectionCache.set(url, isSvg);
    return isSvg;
  } catch {
    svgDetectionCache.set(url, false);
    return false;
  }
}

/** Returns a data: URL with the recolored SVG, or the original URL if not SVG / failed. */
export async function recolorSvg(url: string, mode: LogoMode, custom?: string): Promise<string> {
  if (!url) return url;
  const color = colorFor(mode, custom);
  if (!color) return url;
  const cacheKey = `${url}::${mode}::${color}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  // Erweiterte Erkennung: URL-Endung ODER Content-Type / Sniff.
  const isSvg = isSvgUrlSync(url) || (await detectIsSvg(url));
  if (!isSvg) return url;

  try {
    let raw: string;
    if (url.startsWith("data:image/svg+xml")) {
      const idx = url.indexOf(",");
      const enc = url.slice(idx + 1);
      raw = url.includes(";base64,") ? atob(enc) : decodeURIComponent(enc);
    } else {
      const r = await fetch(url, { mode: "cors" });
      if (!r.ok) return url;
      raw = await r.text();
    }
    const recolored = recolorSvgString(raw, color);
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(recolored)}`;
    cache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch {
    return url;
  }
}

export function recolorSvgString(svg: string, color: string): string {
  // Replace explicit fill/stroke attributes (skip 'none'). Add a fallback fill on root.
  let out = svg
    .replace(/fill="(?!none)([^"]*)"/g, `fill="${color}"`)
    .replace(/stroke="(?!none)([^"]*)"/g, `stroke="${color}"`)
    .replace(/fill:\s*(?!none)[^;"']+/g, `fill:${color}`)
    .replace(/stroke:\s*(?!none)[^;"']+/g, `stroke:${color}`);
  // If <svg> root has no fill, inject one.
  if (!/<svg[^>]*\sfill=/.test(out)) {
    out = out.replace(/<svg([^>]*)>/, `<svg$1 fill="${color}">`);
  }
  return out;
}

/**
 * Raster-Recolor: färbt ein PNG/WEBP-Logo (mit Alpha) auf eine Zielfarbe um.
 * Behält die Alpha-Maske und ersetzt RGB durch die Zielfarbe – ideal für
 * monochrome / silhouettenartige Logos. Ergebnis ist eine data:image/png URL.
 */
const rasterCache = new Map<string, string>();
export async function recolorRaster(url: string, color: string): Promise<string> {
  if (!url) return url;
  const key = `${url}::raster::${color}`;
  const hit = rasterCache.get(key);
  if (hit) return hit;
  const rgb = hexToRgb(color);
  if (!rgb) return url;
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const p = data.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) continue;
      p[i] = rgb.r;
      p[i + 1] = rgb.g;
      p[i + 2] = rgb.b;
    }
    ctx.putImageData(data, 0, 0);
    const out = canvas.toDataURL("image/png");
    rasterCache.set(key, out);
    return out;
  } catch {
    return url;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
