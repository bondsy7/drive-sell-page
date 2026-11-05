import { describe, it, expect } from 'vitest';
import { applyRunOptions, DEFAULT_PROCESSING_SETTINGS, estimateJobCost } from '@/lib/auto3-processing';
import { buildThemeBlock } from '@/lib/seasonal-themes';

const s = { ...DEFAULT_PROCESSING_SETTINGS, bannerEnabled: true, bannerFormats: ['story' as const], videoEnabled: true };
describe('Auto3 Lauf-Optionen', () => {
  it('Nur Titelbild erzeugt und berechnet genau ein Bild', () => {
    const c = estimateJobCost(applyRunOptions(s, { scope: 'hero', theme: 'none' }), () => 4);
    expect(c.images).toBe(1); expect(c.banners).toBe(0); expect(c.video).toBe(0); expect(c.total).toBe(4);
  });
  it('Alle Bilder lässt das Profil unverändert', () => {
    expect(applyRunOptions(s, { scope: 'all', theme: 'black-friday' })).toBe(s);
  });
  it('Thema wird zusätzlich zum Showroom angehängt, ohne Thema nichts', () => {
    expect(buildThemeBlock('black-friday')).toContain('Black Friday');
    expect(buildThemeBlock('none')).toBe('');
    expect(buildThemeBlock('custom', '  ')).toBe('');
  });
});
