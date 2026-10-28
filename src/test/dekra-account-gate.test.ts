import { describe, it, expect } from 'vitest';
import { isDekraAccount, DEKRA_SCENE_EMAILS } from '@/lib/remaster-prompt';

// Erklärvideo & DEKRA-Showroom sind ausschließlich DEKRA-Accounts zugänglich.
describe('dekra account gate', () => {
  it('grants access only to the three DEKRA accounts', () => {
    for (const email of DEKRA_SCENE_EMAILS) {
      expect(isDekraAccount(email)).toBe(true);
    }
    expect(isDekraAccount('p.erhard@autoactiva.de')).toBe(false);
    expect(isDekraAccount('d.bonds@autoactiva.de')).toBe(false);
  });

  it('is case- and whitespace-insensitive, and rejects missing emails', () => {
    expect(isDekraAccount(' DEKRA@autohaus.ai ')).toBe(true);
    expect(isDekraAccount('dekra3@AUTOHAUS.ai')).toBe(true);
    expect(isDekraAccount('')).toBe(false);
    expect(isDekraAccount(null)).toBe(false);
    expect(isDekraAccount(undefined)).toBe(false);
  });
});
