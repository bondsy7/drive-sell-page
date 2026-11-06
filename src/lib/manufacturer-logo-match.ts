/**
 * Single source for picking a manufacturer logo file for a brand.
 * Exact filename match always wins; sub-brand files (e.g. bmw-alpina, bmw-m)
 * are only used when explicitly requested, never as a partial hit for "BMW".
 */
export interface NamedLogo { name: string; url: string }

const norm = (s: string) => s.toLowerCase().replace(/[-_\s.]+/g, '').trim();

const ALIASES: Record<string, string[]> = {
  volkswagen: ['vw'], vw: ['volkswagen'],
  mercedesbenz: ['mercedes', 'mb', 'mercedesamg'], mercedes: ['mercedesbenz', 'mb'], mb: ['mercedesbenz', 'mercedes'],
  bmw: ['bayerischemotorenwerke'],
  alfaromeo: ['alfa'], alfa: ['alfaromeo'],
  astonmartin: [], landrover: [], rollsroyce: [],
  citroen: ['citroën'], 'citroën': ['citroen'], skoda: ['škoda'], 'škoda': ['skoda'],
};

export function pickManufacturerLogo<T extends NamedLogo>(logos: T[], brand: string | null | undefined): T | null {
  if (!brand) return null;
  const b = norm(brand);
  if (!b) return null;
  const keys = [b, ...(ALIASES[b] || []).map(norm)];
  for (const k of keys) {
    const exact = logos.find(l => norm(l.name) === k);
    if (exact) return exact;
  }
  // Fallback only if no exact file exists: shortest partial name (closest to the brand).
  const partial = logos
    .filter(l => { const n = norm(l.name); return keys.some(k => n.startsWith(k) || k.startsWith(n)); })
    .sort((a, b2) => norm(a.name).length - norm(b2.name).length);
  return partial[0] ?? null;
}
