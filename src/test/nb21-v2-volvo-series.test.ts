import { describe, expect, it } from 'vitest';
import { resolveV2Evidence, wireV2Evidence, type V2Reference } from '@/prompts/nb21/v2';
import { validateV2Wire } from '../../supabase/functions/_shared/nb21-v2-wire';

const original = (sourceRole: string, sourceId = sourceRole): V2Reference => ({ sourceRole, sourceId, sourceType: 'original', image: 'data:image/jpeg;base64,YQ==' });

describe('V2 Volvo series evidence regressions', () => {
  it('rear retains rear geometry and adds original front paint authority rather than generated colour', () => {
    const plan = resolveV2Evidence({ jobKey: 'CI_VOLVO_REAR', sources: [original('rear'), original('side'), original('front'), { ...original('front', 'generated-front'), sourceType: 'generated context' }] });
    expect(plan.manifest.entries.filter(e => e.authorityTier === 'A').map(e => [e.role, e.sourceRole])).toEqual([
      ['rear_original', 'rear'], ['physical_side_original', 'side'], ['paint_evidence', 'front'],
    ]);
    validateV2Wire(plan.manifest, wireV2Evidence(plan));
  });
  it('full cabin views prefer the seat-bearing overview even when dashboard detail sorts earlier', () => {
    const plan = resolveV2Evidence({ jobKey: 'CI_VOLVO_INT_CENTER', sources: [original('dashboard', 'a-detail'), original('interior-front', 'z-cabin'), original('interior-rear')] });
    expect(plan.manifest.entries[0]?.sourceId).toBe('z-cabin');
    expect(plan.manifest.entries[0]?.role).toBe('cabin_original');
    validateV2Wire(plan.manifest, wireV2Evidence(plan));
  });
  it('four-view cabin grid carries front seats, rear seats and a separately scoped steering detail', () => {
    const plan = resolveV2Evidence({ jobKey: 'GRID_INTERIOR_4', sources: [original('interior-front'), original('interior-rear'), original('dashboard')] });
    expect(plan.manifest.entries.map(e => [e.role, e.sourceRole])).toEqual([
      ['cabin_original', 'interior-front'], ['rear_cabin_original', 'interior-rear'], ['interior_detail_original', 'dashboard'],
    ]);
    validateV2Wire(plan.manifest, wireV2Evidence(plan));
  });
  it('dashboard detail plus rear seats cannot substitute a missing front cabin in the grid', () => {
    expect(() => resolveV2Evidence({ jobKey: 'GRID_INTERIOR_4', sources: [original('dashboard'), original('interior-rear')] })).toThrow(/cabin_original/);
  });
});