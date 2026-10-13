import { describe, it, expect } from 'vitest';
import { hasChromeTrimFeature } from '@/lib/remaster-prompt';

describe('hasChromeTrimFeature', () => {
  it('aktiviert bei belegtem Chrom-Paket', () => {
    expect(hasChromeTrimFeature(['Chrompaket außen', 'LED-Heckleuchten'])).toBe(true);
  });
  it('bleibt aus ohne Chrom-Merkmal (California Beach)', () => {
    expect(hasChromeTrimFeature(['LED-Heckleuchten', 'Aufstelldach mit 3 Fenstern', 'Area View inkl. Rückfahrkamera'])).toBe(false);
  });
  it('ignoriert "Ohne"-Einträge', () => {
    expect(hasChromeTrimFeature(['Ohne Chromleisten'])).toBe(false);
  });
  it('bleibt aus ohne Daten', () => {
    expect(hasChromeTrimFeature(undefined)).toBe(false);
  });
});
