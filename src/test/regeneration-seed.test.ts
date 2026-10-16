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

describe('Rundgang-Originale mit Slot-Key', () => {
  const withRoles = [
    { name: '1800-0-34front-original.jpg', url: 'r-34front' },
    { name: '1800-1-side-original.jpg', url: 'r-side-left' },
    { name: '1800-2-rear-original.jpg', url: 'r-rear' },
    { name: '1800-3-side-right-original.jpg', url: 'r-side-right' },
    { name: '1800-4-front-original.jpg', url: 'r-front' },
  ];
  it('rechte Seite bekommt das rechte Foto, nie das linke', () => {
    expect(pickOriginalSeed(withRoles, 'EXT_SIDE_RIGHT')?.url).toBe('r-side-right');
    expect(pickOriginalSeed(withRoles, 'EXT_SIDE_LEFT')?.url).toBe('r-side-left');
  });
  it('Totalfront nutzt das Frontfoto, das Master-Bild weiter die 3/4 Front', () => {
    expect(pickOriginalSeed(withRoles, 'EXT_FRONT')?.url).toBe('r-front');
    expect(pickOriginalSeed(withRoles, 'MASTER_IMAGE')?.url).toBe('r-34front');
  });
  it('Innenraum-Job greift ohne Innenraumfoto nicht auf Index 3 (rechte Seite)', () => {
    expect(pickOriginalSeed(withRoles, 'INT_DASHBOARD')?.url).toBe('r-34front');
  });
});
