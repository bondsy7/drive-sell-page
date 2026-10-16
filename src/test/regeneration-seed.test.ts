import { describe, it, expect } from 'vitest';
import { resolveRegenerationSeed, pickOriginalSeed } from '@/lib/regeneration-seed';

const originals = [
  { name: '1700-0-original.jpg', url: 'o-front' },
  { name: '1700-1-original.jpg', url: 'o-side' },
  { name: '1700-2-original.jpg', url: 'o-rear' },
  { name: '1700-3-original.jpg', url: 'o-int' },
];

describe('Neu-Generierung nutzt nie das generierte Bild', () => {
  it('nimmt das gewählte Referenzbild', () => {
    expect(resolveRegenerationSeed({ selectedReferenceUrl: 'o-side', currentGeneratedUrl: 'gen', originals, jobKey: 'EXT_REAR' })).toBe('o-side');
  });
  it('ohne Auswahl: passendes Original zur Perspektive', () => {
    expect(resolveRegenerationSeed({ selectedReferenceUrl: null, currentGeneratedUrl: 'gen', originals, jobKey: 'EXT_REAR' })).toBe('o-rear');
    expect(pickOriginalSeed(originals, 'INT_DASHBOARD')?.url).toBe('o-int');
  });
  it('wählt man das generierte Bild selbst, wird es ignoriert', () => {
    expect(resolveRegenerationSeed({ selectedReferenceUrl: 'gen', currentGeneratedUrl: 'gen', originals, jobKey: 'EXT_FRONT' })).toBe('o-front');
  });
  it('ohne Originale gibt es keinen Seed (kein Rückfall aufs KI-Bild)', () => {
    expect(resolveRegenerationSeed({ selectedReferenceUrl: null, currentGeneratedUrl: 'gen', originals: [] })).toBeNull();
  });
});
