import { describe, expect, it } from 'vitest';
import { resolveRemasterCost } from '../../supabase/functions/_shared/remaster-cost';
import { creditCostFloor } from '../../supabase/functions/_shared/image-credit-floor';
import { estimateJobCost, DEFAULT_PROCESSING_SETTINGS } from '@/lib/auto3-processing';

describe('Premium and Advanced vehicle image prices', () => {
  for (const tier of ['premium', 'flare']) {
    it(`${tier} costs one credit per remastered image, including the fallback`, () => {
      expect(resolveRemasterCost({}, tier)).toBe(1);
      expect(resolveRemasterCost({ image_remaster: { [tier]: 1 } }, tier)).toBe(1);
      expect(creditCostFloor('image_remaster', tier, 2)).toBe(1);
    });
    it(`${tier} generation permits exactly one credit without the old two-credit minimum`, () => {
      expect(Math.max(creditCostFloor('image_generate', tier, 2), 1)).toBe(1);
    });
  }
  it('OneShot estimates one credit for each Premium image without a hidden price floor', () => {
    const result = estimateJobCost({ ...DEFAULT_PROCESSING_SETTINGS, modelTier: 'premium', bannerEnabled: false, socialSet: false, videoEnabled: false }, () => 1);
    expect(result.perImage).toBe(1);
    expect(result.imageCost).toBe(result.images);
    expect(result.total).toBe(result.images);
  });
  it('retains floors for unrelated actions and historical tiers', () => {
    expect(creditCostFloor('video_generate', 'premium', 17)).toBe(17);
    expect(creditCostFloor('image_generate', 'qualitaet', 2)).toBe(2);
    expect(resolveRemasterCost({}, 'nb21')).toBe(3);
  });
});