import { describe, it, expect } from 'vitest';
import { compileJobPlan, DEFAULT_PROCESSING_SETTINGS } from '@/lib/auto3-processing';

const base = { datasheet: { brand: 'Volkswagen', model: 'Golf' }, analysis: [], overrides: {} };

describe('Auto3 plan carries the chosen showroom image', () => {
  it('showroom-4 sends its reference image', () => {
    const plan = compileJobPlan({ ...base, settings: { ...DEFAULT_PROCESSING_SETTINGS, scene: 'showroom-4' } });
    expect(plan.showroomUrl).toBe('/images/showrooms/showroom-4.jpg');
  });
  it('custom showroom uses the dealer image', () => {
    const plan = compileJobPlan({ ...base, profileShowroomUrl: 'https://x/own.jpg', settings: { ...DEFAULT_PROCESSING_SETTINGS, scene: 'custom-showroom' } });
    expect(plan.showroomUrl).toBe('https://x/own.jpg');
  });
});
