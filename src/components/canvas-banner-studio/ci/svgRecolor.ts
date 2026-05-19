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
