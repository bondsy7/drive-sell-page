import { describe, expect, it } from 'vitest';
import { normalizeSectionHeight, resizeSectionHeight, sectionHeightVars } from './landing-section-height';

describe('section height values', () => {
  it('grows and shrinks from the lower edge', () => {
    expect(resizeSectionHeight(600, 120, 'bottom')).toBe(720);
    expect(resizeSectionHeight(600, -120, 'bottom')).toBe(480);
  });
  it('reverses direction at the upper edge', () => {
    expect(resizeSectionHeight(600, -120, 'top')).toBe(720);
    expect(resizeSectionHeight(600, 120, 'top')).toBe(480);
  });
  it('never accepts negative or nonfinite heights', () => {
    expect(normalizeSectionHeight(-50)).toBe(64);
    expect(normalizeSectionHeight(Infinity)).toBeUndefined();
    expect(normalizeSectionHeight('600')).toBeUndefined();
  });
  it('keeps pages without a custom height unchanged', () => {
    expect(sectionHeightVars(undefined)).toEqual({});
    expect(sectionHeightVars(600)).toEqual({ '--lp-section-height': '600px' });
  });
});