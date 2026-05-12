// On-demand Google-Font-Loader. Injektiert <link>-Tags genau einmal pro Family,
// triggert dann document.fonts.load() damit Canvas-Messung korrekt ist.

const loaded = new Set<string>();

export function ensureFontLoaded(spec: string): void {
  if (typeof document === "undefined") return;
  if (loaded.has(spec)) return;
  loaded.add(spec);
  const id = `gf-${spec.replace(/[^a-z0-9]/gi, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec)}&display=swap`;
  document.head.appendChild(link);
  // Best-effort: trigger font load so Konva measurement picks it up after a tick.
  try {
    const family = spec.split(":")[0];
    (document as any).fonts?.load?.(`16px "${family}"`);
  } catch { /* noop */ }
}

export function ensureBrandFonts(googleFonts?: string[]): void {
  if (!googleFonts) return;
  googleFonts.forEach(ensureFontLoaded);
}
