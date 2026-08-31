import { describe, expect, it } from 'vitest';
import { buildVehicleGenerationLock } from '@/lib/vehicle-generation-lock';

describe('buildVehicleGenerationLock', () => {
  it('makes reference pixels authoritative over model metadata and memory', () => {
    const lock = buildVehicleGenerationLock('Skoda Enyaq, Modelljahr 2026');

    expect(lock).toContain('Skoda Enyaq, Modelljahr 2026');
    expect(lock).toContain('PIXELS WIN');
    expect(lock).toContain('pre-facelift');
    expect(lock).toContain('training memory');
  });

  it('still creates a complete lock without metadata', () => {
    const lock = buildVehicleGenerationLock();

    expect(lock).toContain('<MODEL_GENERATION_LOCK>');
    expect(lock).not.toContain('undefined');
  });

  it('blocks the previous Enyaq grille for current model years', () => {
    const lock = buildVehicleGenerationLock('Skoda Enyaq Modelljahr 2026');

    expect(lock).toContain('<KNOWN_FACELIFT_FRONT_GUARD>');
    expect(lock).toContain('closed, broad, dark Tech-Deck');
    expect(lock).toContain('no vertical chrome grille bars');
    expect(lock).toContain('WRONG VEHICLE GENERATION');
  });

  it('does not force the current Enyaq front onto older model years', () => {
    const lock = buildVehicleGenerationLock('Skoda Enyaq Modelljahr 2023');

    expect(lock).not.toContain('<KNOWN_FACELIFT_FRONT_GUARD>');
  });
});