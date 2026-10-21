// Public choices keep their existing wire IDs for provider routing and saved runs.
export const MODEL_CHOICES = ['premium', 'flare'] as const;
export const DEFAULT_MODEL_TIER = 'premium' as const;
export function resolveSelectableModelTier(tier: string): 'premium' | 'flare' {
  return tier === 'flare' ? 'flare' : DEFAULT_MODEL_TIER;
}