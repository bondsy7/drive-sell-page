import { describe, it, expect } from 'vitest';
import { landingGenerationCost, normalizeImageLink } from '../landing-generation-cost';

describe('landingGenerationCost', () => {
  it('nur KI-Bilder kostet 5', () => expect(landingGenerationCost(0, 'fill')).toBe(5));
  it('ohne eigene Bilder bleibt es 5, auch bei own_only', () => expect(landingGenerationCost(0, 'own_only')).toBe(5));
  it('eigene Bilder + KI auffüllen kostet 3', () => expect(landingGenerationCost(3, 'fill')).toBe(3));
  it('ausschließlich eigene Bilder kostet 1', () => expect(landingGenerationCost(3, 'own_only')).toBe(1));
});

describe('normalizeImageLink', () => {
  it('akzeptiert https', () => expect(normalizeImageLink(' https://a.de/b.jpg ')).toBe('https://a.de/b.jpg'));
  it('blockiert javascript:', () => expect(normalizeImageLink('javascript:alert(1)')).toBeNull());
  it('blockiert Unsinn', () => expect(normalizeImageLink('kein link')).toBeNull());
});
