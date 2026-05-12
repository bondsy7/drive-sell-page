// Lädt eine SVG-URL und ersetzt fill/stroke Attribute durch eine Zielfarbe.
// Gibt eine data:image/svg+xml URL zurück, die wie jedes Bild geladen werden kann.

const cache = new Map<string, string>();

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

/** Returns a data: URL with the recolored SVG, or the original URL if not SVG / failed. */
export async function recolorSvg(url: string, mode: LogoMode, custom?: string): Promise<string> {
  if (!url) return url;
  const color = colorFor(mode, custom);
  if (!color) return url;
  const cacheKey = `${url}::${mode}::${color}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const isSvg = /\.svg(\?|$)/i.test(url) || url.startsWith("data:image/svg");
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
