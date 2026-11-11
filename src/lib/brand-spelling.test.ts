import { describe, it, expect } from 'vitest';
import { fixBrandSpelling } from './brand-spelling';
describe('fixBrandSpelling', () => {
  it('setzt Ë bei Citroën', () => expect(fixBrandSpelling('Der CITROEN C3 von Citroen')).toBe('Der CITROËN C3 von Citroën'));
  it('setzt Š bei Škoda', () => expect(fixBrandSpelling('SKODA Elroq, Skoda Peaq')).toBe('ŠKODA Elroq, Škoda Peaq'));
  it('lässt Links und Attribute unverändert', () => {
    const h = '<a href="https://x.de/Citroen-c3">Citroen</a> info@Skoda.de';
    expect(fixBrandSpelling(h)).toBe('<a href="https://x.de/Citroen-c3">Citroën</a> info@Skoda.de');
  });
});
