import type { LandingPageContent } from '@/lib/landing-page-builder';

export const LANDING_UPLOAD_DISCLOSURE_NOTICE = 'Bitte achten Sie darauf, selbst hochgeladene KI-erstellte oder KI-veränderte Bilder entsprechend zu kennzeichnen.';

/** Unknown legacy images stay labelled; an exemption is bound to the exact uploaded URL. */
export function shouldLabelLandingImage(content: Pick<LandingPageContent, 'imageSources'>, id: string, url?: string): boolean {
  if (!url) return false;
  const source = content.imageSources?.[id];
  return source?.kind !== 'upload' || source.url !== url;
}

/** Keep image URL and its origin in one editor snapshot so undo restores both. */
export function replaceLandingImage<T extends { content: LandingPageContent; images: Record<string, string> }>(
  state: T, id: string, url: string, kind: 'upload' | 'ai',
): T {
  return {
    ...state,
    images: { ...state.images, [id]: url },
    content: { ...state.content, imageSources: { ...state.content.imageSources, [id]: { kind, url } } },
  };
}