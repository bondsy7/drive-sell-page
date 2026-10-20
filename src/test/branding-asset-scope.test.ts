import { expect, it } from 'vitest';
import { brandingAssetScope } from '../../supabase/functions/_shared/branding-asset-scope';

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