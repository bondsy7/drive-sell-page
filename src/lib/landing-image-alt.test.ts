import { describe, it, expect } from 'vitest';
import { landingImageAlt } from './landing-image-alt';

describe('landingImageAlt', () => {
  it('combines vehicle and headline', () => {
    expect(landingImageAlt('Škoda Peaq', 'Innenraum mit Weitblick')).toBe('Škoda Peaq – Innenraum mit Weitblick');
  });
  it('makes stacked images unique', () => {
    expect(landingImageAlt('Škoda Peaq', 'Innenraum', 1)).toBe('Škoda Peaq – Innenraum (Bild 2)');
  });
  it('avoids duplicating the vehicle name', () => {
    expect(landingImageAlt('Škoda Peaq', 'Der neue Škoda Peaq')).toBe('Der neue Škoda Peaq');
  });
});
