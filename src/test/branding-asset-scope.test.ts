import { expect, it } from 'vitest';
import { brandingAssetScope, resolveBrandingPlacement } from '../../supabase/functions/_shared/branding-asset-scope';

it('plate alone never authorizes a wall logo', () => {
  const policy = brandingAssetScope(['plate']);
  expect(policy).toContain('No manufacturer or dealer wall logo is authorized');
  expect(policy).toContain('ONLY at existing vehicle license-plate mounting positions');
  expect(policy).toContain('must NEVER appear on walls');
});
it.each(['manufacturer-logo', 'dealer-logo'])('only separately selected %s authorizes wall branding', role => {
  expect(brandingAssetScope(['plate', role])).toContain(`explicitly selected ${role} assets`);
});
it('source-photo branding cannot become environmental branding', () => {
  expect(brandingAssetScope([])).toContain('Never copy, promote or reinterpret them as output branding');
});
it.each(['manufacturer-logo', 'dealer-logo'])('%s is assigned to square-cornered rectangular frosted glass on the rear wall', role => {
  expect(resolveBrandingPlacement([role]).wall).toEqual({
    roles: [role], position: 'rear-wall', material: 'frosted-glass', shape: 'rectangle', corners: 'square',
  });
});
it('a selected custom plate requires replacement at the vehicle, never authorizes wall branding', () => {
  const placement = resolveBrandingPlacement(['plate']);
  expect(placement.plate).toEqual({ replaceExisting: true, position: 'existing-vehicle-plate-mounts' });
  expect(placement.wall.roles).toEqual([]);
});
it('logos and plate retain independent assignments when selected together', () => {
  const placement = resolveBrandingPlacement(['plate', 'dealer-logo', 'manufacturer-logo', 'dealer-logo']);
  expect(placement.wall.roles).toEqual(['dealer-logo', 'manufacturer-logo']);
  expect(placement.plate.replaceExisting).toBe(true);
  expect(resolveBrandingPlacement(['dealer-logo']).plate.replaceExisting).toBe(false);
});