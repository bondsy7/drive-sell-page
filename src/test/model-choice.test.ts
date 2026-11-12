import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_TIER, MODEL_CHOICES, resolveSelectableModelTier,
  getSelectableModelTiers, hasFullModelAccess, FULL_MODEL_ACCESS_EMAILS, ALL_MODEL_TIERS,
} from '@/lib/model-choice';
import { MODEL_TIER_OPTIONS } from '@/lib/auto3-processing';

const BONDS = 'd.bonds@autoactiva.de';

describe('public model selection', () => {
  it('hides provider names and parenthetical model details in every customer-facing quality choice', () => {
    const visibleTexts = [
      ...MODEL_TIER_OPTIONS.map((tier) => tier.label),
      ...ALL_MODEL_TIERS.flatMap((tier) => [tier.label, tier.sublabel]),
    ];
    expect(visibleTexts).toEqual([
      'Schnell', 'Qualität', 'Premium', 'Advanced', 'Neu',
      'Schnell', 'Schnelle Verarbeitung', 'Qualität', 'Ausgewogene Qualität',
      'Premium', 'Standard', 'Advanced', 'Upgrade', 'Turbo', 'Erweiterte Qualität',
      'Ultra', 'Hohe Qualität', 'Neu', 'Aktuelle Qualität', 'Sunburst', 'Maximale Qualität',
      'NB 2.1', 'Test',
    ]);
    for (const text of visibleTexts) {
      expect(text).not.toMatch(/gemini|gpt|openai|nano banana/i);
      expect(text).not.toMatch(/[()]/);
    }
  });
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
      .toEqual(['schnell', 'qualitaet', 'premium', 'flare', 'turbo', 'ultra', 'neu', 'sunburst', 'nb21']);
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
  it('nb21 ist nur für den Testaccount wählbar und nur beim Remastering', () => {
    expect(resolveSelectableModelTier('nb21', BONDS)).toBe('nb21');
    expect(resolveSelectableModelTier('nb21', 'jemand@example.com')).toBe('premium');
    expect(getSelectableModelTiers('image_generate', BONDS).some((t) => t.id === 'nb21')).toBe(false);
  });
  it('Banner-unsupported Tiers fallen für den Testaccount auf Premium zurück', () => {
    expect(resolveSelectableModelTier('flare', BONDS, 'image_generate')).toBe('premium');
    expect(resolveSelectableModelTier('sunburst', BONDS, 'image_generate')).toBe('premium');
  });
});
