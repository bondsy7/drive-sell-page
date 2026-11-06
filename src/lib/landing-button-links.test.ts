import { describe, it, expect } from 'vitest';
import { normalizeButtonLink, resolveButtonLink } from './landing-button-links';

describe('button links', () => {
  it('adds https to bare domains', () => {
    expect(normalizeButtonLink('jacobs.indicar.de/cars')).toBe('https://jacobs.indicar.de/cars');
  });
  it('rejects javascript links', () => {
    expect(normalizeButtonLink('javascript:alert(1)')).toBeNull();
  });
  it('keeps anchors, mailto and tel', () => {
    expect(normalizeButtonLink('#kontakt')).toBe('#kontakt');
    expect(normalizeButtonLink('tel:+4930123')).toBe('tel:+4930123');
  });
  it('falls back to the default link', () => {
    expect(resolveButtonLink(undefined, '#kontakt')).toEqual({ href: '#kontakt', external: false });
    expect(resolveButtonLink('https://a.de', '#kontakt').external).toBe(true);
  });
});
