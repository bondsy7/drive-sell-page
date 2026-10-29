/**
 * Shared colour resolver for generated landing pages.
 *
 * The React editor, the delivered HTML and the contact widget must resolve the
 * same brand colours, otherwise a page shows one colour for its own buttons and
 * another colour for the floating enquiry button.
 */

export const LANDING_PRIMARY_FALLBACK = '#174f6b';
export const LANDING_SECONDARY_FALLBACK = '#e2b04a';

export interface LandingColorSource {
  primaryColor?: string;
  secondaryColor?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** Dealer primary colour, or the neutral petrol-blue fallback for invalid input. */
export function landingPrimary(source?: LandingColorSource | null): string {
  const raw = source?.primaryColor || '';
  return HEX.test(raw) ? raw : LANDING_PRIMARY_FALLBACK;
}

/** Dealer secondary colour, or the gold fallback for invalid input. */
export function landingSecondary(source?: LandingColorSource | null): string {
  const raw = source?.secondaryColor || '';
  return HEX.test(raw) ? raw : LANDING_SECONDARY_FALLBACK;
}

export function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(23,79,107,${alpha})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

/** Relative luminance of a colour (0 dark … 1 light); -1 for unparsable input. */
function luminanceOf(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return -1;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** True when a surface is light enough that controls on it need a dark fill. */
export function isLightSurface(hex: string): boolean {
  return luminanceOf(hex) > 0.55;
}

/** Text colour with enough contrast on the given background. */
export function readableOn(hex: string): string {
  return isLightSurface(hex) ? '#0f172a' : '#ffffff';
}

export interface EditorControlColors {
  background: string;
  foreground: string;
}

/**
 * Fill and label colours for the floating editor controls (delete pill, colour
 * buttons). On light surfaces such as a white header the pill turns dark, so it
 * never disappears into the page behind it.
 */
export function editorControlColors(surface: string): EditorControlColors {
  return isLightSurface(surface)
    ? { background: '#0f172a', foreground: '#ffffff' }
    : { background: '#ffffff', foreground: '#0f172a' };
}

/**
 * CSS custom properties recolouring the editor controls of a subtree. Returns
 * undefined for unknown surfaces so the inherited default stays in place.
 */
export function editorControlStyle(surface?: string): Record<string, string> | undefined {
  if (!surface || !HEX.test(surface)) return undefined;
  const colors = editorControlColors(surface);
  return {
    '--lp-editor-control-bg': colors.background,
    '--lp-editor-control-fg': colors.foreground,
  };
}
