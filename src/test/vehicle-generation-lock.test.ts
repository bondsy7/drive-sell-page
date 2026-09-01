import { describe, expect, it } from 'vitest';
import { buildVehicleGenerationLock, sanitizeVehicleDescriptionForPrompt } from '@/lib/vehicle-generation-lock';

describe('sanitizeVehicleDescriptionForPrompt', () => {
  it('removes brand and model names but keeps neutral attributes', () => {
    const neutral = sanitizeVehicleDescriptionForPrompt('Skoda Enyaq 85 Sportline, grau metallic, Modelljahr 2026');

    expect(neutral.toLowerCase()).not.toContain('skoda');
    expect(neutral.toLowerCase()).not.toContain('enyaq');
    expect(neutral).toContain('grau metallic');
    expect(neutral).toContain('2026');
  });
});

describe('buildVehicleGenerationLock', () => {
  it('makes reference pixels authoritative and never names the model', () => {
    const lock = buildVehicleGenerationLock('Skoda Enyaq, Modelljahr 2026');

    expect(lock).toContain('PIXELS WIN');
    expect(lock).toContain('pre-facelift');
    expect(lock).toContain('DELIBERATELY WITHHELD');
    expect(lock).not.toContain('Neutral context only: "Skoda');
  });


  it('still creates a complete lock without metadata', () => {
    const lock = buildVehicleGenerationLock();

    expect(lock).toContain('<MODEL_GENERATION_LOCK>');
    expect(lock).not.toContain('undefined');
  });

  it('blocks the previous Enyaq grille for current model years', () => {
    const lock = buildVehicleGenerationLock('Skoda Enyaq 85 Sportline Modelljahr 2026');

    expect(lock).toContain('<KNOWN_FACELIFT_FRONT_GUARD>');
    expect(lock).toContain('closed, broad, dark front panel');
    expect(lock).toContain('no vertical chrome grille bars');
    expect(lock).toContain('SIDE IDENTITY');
    expect(lock).toContain('WRONG VEHICLE GENERATION');
    expect(lock).not.toContain('SKODA ENYAQ');
    expect(lock).not.toContain('Sportline');
    expect(lock).toContain('Neutral context only: "Modelljahr 2026"');
    expect(lock).not.toContain('Tech-Deck');
  });

  it('does not force the current Enyaq front onto older model years', () => {
    const lock = buildVehicleGenerationLock('Skoda Enyaq Modelljahr 2023');

    expect(lock).not.toContain('<KNOWN_FACELIFT_FRONT_GUARD>');
  });
});