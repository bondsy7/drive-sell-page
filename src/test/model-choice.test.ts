import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_TIER, MODEL_CHOICES, resolveSelectableModelTier } from '@/lib/model-choice';

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