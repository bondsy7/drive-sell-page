import { describe, it, expect } from 'vitest';
import { readRegenerationContext, restoreRemasterConfig, showroomUrlForScene, pickSeriesEnvironmentImage, REGEN_CONTEXT_KEY } from './regeneration-context';

describe('regeneration context', () => {
  it('restores the saved scene of the original run', () => {
    const ctx = readRegenerationContext({ [REGEN_CONTEXT_KEY]: { scene: 'showroom-2', licensePlate: 'remove', changeColor: false, showManufacturerLogo: true, showDealerLogo: false, savedAt: 'x' } });
    const cfg = restoreRemasterConfig(ctx, null);
    expect(cfg.scene).toBe('showroom-2');
    expect(cfg.licensePlate).toBe('remove');
    expect(cfg.showManufacturerLogo).toBe(true);
  });
  it('never uses the profile showroom for legacy vehicles; uses a series image instead', () => {
    expect(pickSeriesEnvironmentImage([
      { id: 'a', src: 'grid.jpg', perspective: 'Interieur-Grid' },
      { id: 'b', src: 'front.jpg', perspective: '3/4 Front' },
    ], 'a')).toBe('front.jpg');
    expect(restoreRemasterConfig(null, null).scene).toBe('none');
  });
  it('resolves the showroom image for custom and built-in scenes', () => {
    expect(showroomUrlForScene('custom-showroom', 'https://x/s.jpg')).toBe('https://x/s.jpg');
    expect(showroomUrlForScene('showroom-4', null)).toBe('/images/showrooms/showroom-4.jpg');
  });
});
