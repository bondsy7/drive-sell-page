/**
 * Originalschreibweise von Markennamen in sichtbaren Landingpage-Texten
 * (Citroën, Škoda). URLs, E-Mails, Dateinamen und HTML-Attribute bleiben unverändert.
 */
const RULES: [RegExp, string][] = [
  [/(?<![\w./@-])CITROEN(?![\w./@-])/g, 'CITROËN'],
  [/(?<![\w./@-])Citroen(?![\w./@-])/g, 'Citroën'],
  [/(?<![\w./@-])SKODA(?![\w./@-])/g, 'ŠKODA'],
  [/(?<![\w./@-])Skoda(?![\w./@-])/g, 'Škoda'],
];

export function fixBrandSpelling(text: string): string {
  if (!text) return text;
  return text.split(/(<[^>]*>)/).map(part => part.startsWith('<') ? part
    : RULES.reduce((s, [re, to]) => s.replace(re, to), part)).join('');
}

/** Wendet die Schreibweise auf alle Textfelder an (keine Bild-/Link-Maps). */
export function fixBrandSpellingDeep<T>(value: T, skipKeys = new Set(['imageMap', 'imageSources', 'imageFrames', 'links', 'buttonLinks', 'logoLinks', 'url', 'href', 'src'])): T {
  if (typeof value === 'string') return fixBrandSpelling(value) as T;
  if (Array.isArray(value)) return value.map(v => fixBrandSpellingDeep(v, skipKeys)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, skipKeys.has(k) ? v : fixBrandSpellingDeep(v, skipKeys)])) as T;
  }
  return value;
}
