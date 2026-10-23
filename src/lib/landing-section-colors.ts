import { readableOn, rgba } from '@/lib/landing-theme';

export function normalizeSectionColor(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : undefined;
}

export function sectionColorTheme(custom: unknown, bgStyle: string, primary: string) {
  const override = normalizeSectionColor(custom);
  const defaults: Record<string, string> = { white: '#ffffff', light: rgba(primary, 0.04), dark: '#0b1220', accent: primary };
  const background = override || defaults[bgStyle] || defaults.white;
  const foreground = override ? readableOn(override) : ['dark', 'accent'].includes(bgStyle) ? '#ffffff' : '#0f172a';
  return { background, foreground, body: override ? rgba(foreground, 0.85) : ['dark', 'accent'].includes(bgStyle) ? 'rgba(255,255,255,0.85)' : '#475569', custom: !!override };
}

/** Stored text colour for a text element, falling back to the section's resolved colour. */
export function textColorOverride(custom: unknown, fallback: string): string {
  return normalizeSectionColor(custom) || fallback;
}