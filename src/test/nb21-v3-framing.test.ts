import { describe, it, expect } from 'vitest';
import { buildNb21V3Prompt, v3Framing, v3ShotContract } from '@/prompts/nb21/v3/builder';
import type { V3Manifest } from '../../supabase/functions/_shared/nb21-v3-contract';

const base = (jobKey: string, target: string, mode: 'edit' | 'view_synthesis' = 'view_synthesis') => ({
  version: 'nb21-v3', jobKey, mode, target, budget: 6, visibleSurfaces: [], surfaceAuthority: {},
  entries: [{ role: 'cabin_original', sourceType: 'original', sourceRole: 'interior-rear', authorityTier: 'A', authority: 'x' }],
  lightingProfile: { version: 'nb21-v3-lighting-1', hash: 'h', runId: 'r', spec: {} },
}) as unknown as V3Manifest;

describe('nb21-v3 shot/framing contract', () => {
  it('rear-seat job names a straight-rearward camera with the complete bench', () => {
    expect(v3ShotContract('CI_VOLVO_INT_REAR', 'interior' as never).join(' ')).toMatch(/looking straight rearward at the complete rear bench/);
  });
  it('screen detail never substitutes the instrument cluster', () => {
    expect(v3ShotContract('CI_VOLVO_DET_SCREEN', 'interior_detail' as never).join(' ')).toMatch(/central display/);
    expect(v3Framing(base('CI_VOLVO_DET_SCREEN', 'interior_detail'))).toMatch(/Never substitute a neighbouring part/);
  });
  it('full exterior views require the whole vehicle inside the frame with margin', () => {
    expect(v3Framing(base('CI_VOLVO_SIDE', 'exterior'))).toMatch(/never touch or cut the frame edge/);
  });
  it('overview preserves connected door and pillar structure without forcing whole seats in frame', () => {
    const framing = v3Framing(base('CI_VOLVO_INT_CENTER', 'interior'));
    expect(framing).toContain('Preserve visible door and pillar structure');
    expect(framing).toContain('seats behind the camera remain physically present');
    expect(framing).toContain('no cutaway or transparent surfaces');
  });
  it('edit mode keeps original framing and gets no synthesized camera', () => {
    expect(v3Framing(base('X', 'exterior', 'edit'))).toMatch(/exact original camera position/);
  });
  it('shot contract survives into the final prompt', () => {
    const p = buildNb21V3Prompt({ manifest: base('CI_VOLVO_INT_REAR', 'interior'), config: { scene: 'showroom-1' } as never });
    expect(p).toMatch(/PROMPT_VERSION: nb21-v3/);
    expect(p).toMatch(/complete rear bench/);
    expect(p).toMatch(/Never cut seats or roof/);
  });
});
