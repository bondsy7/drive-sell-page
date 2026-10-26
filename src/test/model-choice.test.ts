import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_TIER, MODEL_CHOICES, resolveSelectableModelTier,
  getSelectableModelTiers, hasFullModelAccess, FULL_MODEL_ACCESS_EMAILS,
} from '@/lib/model-choice';

const BONDS = 'd.bonds@autoactiva.de';

describe('public model selection', () => {
  it('offers only the existing Premium and Flare model IDs', () => {
    expect(MODEL_CHOICES).toEqual(['premium', 'flare']);
  });
  it('defaults new selections to Premium', () => {
    expect(DEFAULT_MODEL_TIER).toBe('premium');
    expect(resolveSelectableModelTier('qualitaet')).toBe('premium');
  });
  it('preserves Advanced selection instead of forcing the standard', () => {
    expect(resolveSelectableModelTier('flare')).toBe('flare');
  });
});

describe('full model access exception (nur d.bonds@autoactiva.de)', () => {
  it('ist genau auf die eine E-Mail beschränkt, Groß-/Kleinschreibung egal', () => {
    expect(FULL_MODEL_ACCESS_EMAILS).toEqual([BONDS]);
    expect(hasFullModelAccess(BONDS)).toBe(true);
    expect(hasFullModelAccess('D.Bonds@Autoactiva.de')).toBe(true);
    expect(hasFullModelAccess('p.erhard@autoactiva.de')).toBe(false);
    expect(hasFullModelAccess(undefined)).toBe(false);
  });
  it('Testaccount sieht alle unterstützten Remaster-Tiers', () => {
    expect(getSelectableModelTiers('image_remaster', BONDS).map((t) => t.id))
      .toEqual(['schnell', 'qualitaet', 'premium', 'flare', 'turbo', 'ultra', 'neu', 'sunburst']);
  });
  it('Testaccount sieht bei Bildgenerierung/Banner nur die dort unterstützten Tiers', () => {
    expect(getSelectableModelTiers('image_generate', BONDS).map((t) => t.id))
      .toEqual(['schnell', 'qualitaet', 'premium', 'turbo', 'ultra', 'neu']);
  });
  it('andere Accounts und Gäste behalten exakt die bisherige Auswahl', () => {
    for (const email of ['p.erhard@autoactiva.de', 'edin.ljevo@wirsindjacobs.de', undefined]) {
      expect(getSelectableModelTiers('image_remaster', email).map((t) => t.id)).toEqual(['premium', 'flare']);
      expect(getSelectableModelTiers('image_generate', email).map((t) => t.id)).toEqual(['premium', 'flare']);
    }
  });
  it('Testaccount behält gespeicherte Tier-Auswahl, andere werden auf Premium zurückgesetzt', () => {
    expect(resolveSelectableModelTier('ultra', BONDS)).toBe('ultra');
    expect(resolveSelectableModelTier('schnell', BONDS)).toBe('schnell');
    expect(resolveSelectableModelTier('ultra', 'edin.ljevo@wirsindjacobs.de')).toBe('premium');
  });
  it('nb21 bleibt auch für den Testaccount kein Dropdown-Tier (eigener Wire-Pfad)', () => {
    expect(resolveSelectableModelTier('nb21', BONDS)).toBe('premium');
    expect(getSelectableModelTiers('image_remaster', BONDS).some((t) => t.id === 'nb21')).toBe(false);
  });
  it('Banner-unsupported Tiers fallen für den Testaccount auf Premium zurück', () => {
    expect(resolveSelectableModelTier('flare', BONDS, 'image_generate')).toBe('premium');
    expect(resolveSelectableModelTier('sunburst', BONDS, 'image_generate')).toBe('premium');
  });
});
