/**
 * Landingpage-Generierungspreis. Muss mit `landingCost` in
 * supabase/functions/generate-landing-page/index.ts übereinstimmen.
 * - nur KI-Bilder (keine eigenen): 5
 * - eigene Bilder + KI auffüllen: 3
 * - ausschließlich eigene Bilder: 1
 */
export type LandingImageFill = 'fill' | 'own_only';

export function landingGenerationCost(ownImageCount: number, fill: LandingImageFill): number {
  if (ownImageCount <= 0) return 5;
  return fill === 'own_only' ? 1 : 3;
}

/** Erlaubt nur http(s)-Bildlinks. */
export function normalizeImageLink(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch { return null; }
}
