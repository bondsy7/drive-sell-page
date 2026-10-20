import { beforeAll, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { buildNb21V3Prompt, createV3LightingProfile, resolveV3Evidence, validateV3Wire, wireV3Evidence, type V3Reference, type V3LightingProfile } from '@/prompts/nb21/v3';
import { enforceV3ServerPrompt } from '../../supabase/functions/_shared/nb21-v3-prompt';
import type { RemasterConfig } from '@/lib/remaster-prompt';

let lightingProfile: V3LightingProfile;
beforeAll(async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  lightingProfile = await createV3LightingProfile('minimal-cabin');
});
const original = (role: string): V3Reference => ({ sourceId: `original:${role}`, sourceRole: role, sourceType: 'original', image: 'data:image/jpeg;base64,YQ==' });
const sources: V3Reference[] = [
  ...['interior-front', 'interior-rear', 'dashboard', 'screen', 'steering', 'front', 'rear', 'side', 'side-right', 'cargo', 'headlight'].map(original),
  ...['plate', 'wheel', 'manufacturer-logo', 'dealer-logo', 'scene-logo'].map(role => ({ ...original(role), sourceId: `asset:${role}`, sourceType: 'immutable asset' as const })),
  { ...original('environment'), sourceId: 'generated:environment', sourceType: 'generated context' },
];
const plan = (jobKey: string, selected = sources) => resolveV3Evidence({ jobKey, sources: selected, lightingProfile });

describe('V3 job-minimal reference transport', () => {
  it('cabin overview sends only its front cabin original, not rear cabin, details, branding or generated context', async () => {
    const p = plan('CI_VOLVO_INT_CENTER');
    expect(p.references.map(r => r.sourceId)).toEqual(['original:interior-front']);
    expect(p.manifest.surfaceAuthority).toEqual({ cabin_original: ['original:interior-front'] });
    await validateV3Wire(p.manifest, wireV3Evidence(p));
  });
  it('screen detail sends only the assigned screen original', async () => {
    const p = plan('CI_VOLVO_DET_SCREEN');
    expect(p.references.map(r => r.sourceId)).toEqual(['original:screen']);
    await validateV3Wire(p.manifest, wireV3Evidence(p));
  });
  it('rear cabin sends only the rear original', () => {
    expect(plan('CI_VOLVO_INT_REAR').references.map(r => r.sourceId)).toEqual(['original:interior-rear']);
  });
  it('headlight detail excludes full-body references and logos', () => {
    expect(plan('DET_HEADLIGHT').references.map(r => r.sourceId)).toEqual(['original:headlight']);
  });
  it('side-right still needs its physical original despite reference reduction', () => {
    expect(() => plan('side-right', sources.filter(s => s.sourceRole !== 'side-right'))).toThrow(/right_original/);
  });
  it('cargo keeps both cargo and rear originals because the opening needs both', () => {
    const p = plan('CI_VOLVO_INT_BOOT');
    expect(p.references.filter(r => r.sourceType === 'original').map(r => r.sourceId)).toEqual(['original:cargo', 'original:rear']);
  });
  it('interior grid retains all three distinct per-cell evidence roles', () => {
    expect(plan('GRID_INTERIOR_4').references.map(r => r.sourceId)).toEqual(['original:interior-front', 'original:interior-rear', 'original:steering']);
  });
  it('duplicate eligible originals select one deterministically', () => {
    const extra = { ...original('interior-front'), sourceId: 'a:front-overview' };
    expect(plan('CI_VOLVO_INT_CENTER', [...sources, extra]).references.map(r => r.sourceId)).toEqual(['a:front-overview']);
  });
  it('server rejects extra rear evidence inserted into the cabin manifest and wire', async () => {
    const p = plan('CI_VOLVO_INT_CENTER');
    const rear = plan('CI_VOLVO_INT_REAR');
    p.references.push(...rear.references);
    p.manifest.entries.push(...rear.manifest.entries);
    await expect(validateV3Wire(p.manifest, wireV3Evidence(p))).rejects.toThrow(/Evidenzvertrag/);
  });
});

describe('V3 natural dashboard overview instead of information packing', () => {
  it('final server prompt keeps centred dashboard camera without demanding both complete seats in frame', () => {
    const p = plan('CI_VOLVO_INT_CENTER');
    const prompt = enforceV3ServerPrompt(buildNb21V3Prompt({ manifest: p.manifest, config: { scene: 'showroom-1' } as RemasterConfig }), p.manifest);
    expect(prompt).toContain('single centred dashboard-forward photograph from the rear-seat centre');
    expect(prompt).toContain('front backrests and rear bench need not be in frame');
    expect(prompt).toContain('both A-pillars, windshield surround');
    expect(prompt).toContain('never pack all cabin information');
    expect(prompt).toContain('Never cut away doors, pillars or roof');
    expect(prompt).not.toContain('both front seat assemblies in frame');
  });
  it('editing still keeps the original camera rather than replacing it with overview framing', () => {
    const p = resolveV3Evidence({ jobKey: 'EDIT', editSlot: 'interior-front', sources, lightingProfile });
    const prompt = buildNb21V3Prompt({ manifest: p.manifest, config: { scene: 'showroom-1' } as RemasterConfig });
    expect(prompt).toContain('Keep the exact original camera position');
    expect(prompt).not.toContain('single centred dashboard-forward photograph');
  });
});