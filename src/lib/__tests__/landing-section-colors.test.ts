import { describe, it, expect } from 'vitest';
import { normalizeSectionColor, sectionColorTheme } from '@/lib/landing-section-colors';

describe('section background colors', () => {
  it('accepts freely selected RGB colors', () => {
    expect(normalizeSectionColor('#A1B2C3')).toBe('#a1b2c3');
    expect(normalizeSectionColor('red; background:url(x)')).toBeUndefined();
  });
  it('overrides the section background with the selected profile color', () => {
    expect(sectionColorTheme('#e00000', 'light', '#000000').background).toBe('#e00000');
  });
  it('keeps text readable when switching from dark to light and back', () => {
    expect(sectionColorTheme('#ffffff', 'dark', '#000000').foreground).toBe('#0f172a');
    expect(sectionColorTheme('#000000', 'white', '#000000').foreground).toBe('#ffffff');
  });
  it('restores the existing section style without an override', () => {
    expect(sectionColorTheme(undefined, 'accent', '#174f6b').background).toBe('#174f6b');
  });
});