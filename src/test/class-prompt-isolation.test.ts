import { describe, it, expect } from 'vitest';
import { buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';

const config = { cleanupItems: ['trailer'] } as unknown as RemasterConfig;

describe('Prompt-Trennung nach Fahrzeugklasse', () => {
  it('Pkw-Prompt enthält keine Lkw-/Anhänger-Regeln', () => {
    const p = buildMasterPrompt(config, undefined, '34front', {}, { vehicleClass: 'car' });
    expect(p).not.toContain('TRACTOR_TRAILER_SEPARATION');
    expect(p).not.toContain('TRUCKS / LORRIES');
    expect(p).not.toContain('SEMI-TRAILERS');
  });
  it('Lkw-Prompt behält Anhänger-Trennung und Lkw-Kennzeichen', () => {
    const p = buildMasterPrompt(config, undefined, '34front', {}, { vehicleClass: 'truck' });
    expect(p).toContain('TRACTOR_TRAILER_SEPARATION');
    expect(p).toContain('TRUCKS / LORRIES');
  });
});
