import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveV3Evidence, validateV3Wire, wireV3Evidence, v3ViewForJob, V3_VIEW_CONTRACTS, v3ResultMetadata, V3_RETRY_REASONS, type V3Reference, type V3LightingProfile } from '@/prompts/nb21/v3';
import { createV3LightingProfile, validateV3LightingProfile } from '../../supabase/functions/_shared/nb21-v3-lighting';
import { enforceV3ServerPrompt } from '../../supabase/functions/_shared/nb21-v3-prompt';
import { checkV3Preflight } from '@/lib/nb21-v3-preflight';
import { resolveStoredNb21Version } from '@/lib/nb21-version-dispatch';
import { buildNb21V3Prompt } from '@/prompts/nb21/v3';
import { buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';
import { ALL_PIPELINE_JOBS } from '@/lib/pipeline-jobs';
let lightingProfile: V3LightingProfile;
beforeAll(async () => {
  Object.defineProperty(globalThis, 'crypto', { value:webcrypto, configurable:true });
  lightingProfile = await createV3LightingProfile('test-run');
});
const original = (role:string):V3Reference => ({sourceId:`original:${role}`,sourceRole:role,sourceType:'original',image:'data:image/jpeg;base64,YQ=='});
const plan = (jobKey:string,sources:V3Reference[]) => resolveV3Evidence({jobKey,sources,lightingProfile});
const config = {scene:'showroom-1',licensePlate:'remove',changeColor:false,showManufacturerLogo:false,showDealerLogo:false} as RemasterConfig;
describe('V3 physical authority - concrete required originals', () => {
  it('side-right blocks without physical right original', () => expect(() => plan('side-right',[original('side')])).toThrow(/right_original/));
  it('side-left blocks without physical left original', () => expect(() => plan('side-left',[original('side-right')])).toThrow(/left_original/));
  it('34-front-right blocks without front', () => expect(() => plan('34-front-right',[original('side-right')])).toThrow(/front_original/));
  it('34-front-right blocks without right', () => expect(() => plan('34-front-right',[original('front')])).toThrow(/right_original/));
  it('34-front-left blocks without front', () => expect(() => plan('34-front-left',[original('side')])).toThrow(/front_original/));
  it('34-front-left blocks without left', () => expect(() => plan('34-front-left',[original('front')])).toThrow(/left_original/));
  it('34-rear-right blocks without rear', () => expect(() => plan('34-rear-right',[original('side-right')])).toThrow(/rear_original/));
  it('34-rear-right blocks without right', () => expect(() => plan('34-rear-right',[original('rear')])).toThrow(/right_original/));
  it('34-rear-left blocks without rear', () => expect(() => plan('34-rear-left',[original('side')])).toThrow(/rear_original/));
  it('34-rear-left blocks without left', () => expect(() => plan('34-rear-left',[original('rear')])).toThrow(/left_original/));
  it('left source cannot enter right authority', async () => {
    const p = plan('side-right',[original('side-right')]);
    p.references[0].sourceRole='side'; p.manifest.entries[0].sourceRole='side';
    await expect(validateV3Wire(p.manifest,wireV3Evidence(p))).rejects.toThrow(/right_original/);
  });
  it('generated context never fills side geometry authority', () => expect(() => plan('side-right',[{...original('side-right'),sourceType:'generated context'}])).toThrow(/right_original/));
  it('immutable wheel asset never fills side geometry authority', () => expect(() => plan('side-right',[{...original('side-right'),sourceType:'immutable asset'}])).toThrow(/right_original/));
  it.each(Object.keys(V3_VIEW_CONTRACTS))('all valid contracts select exact physical surface sources: %s', async key => {
    const p=plan(key,[original('front'),original('rear'),original('side'),original('side-right')]);
    await validateV3Wire(p.manifest,wireV3Evidence(p));
    const side = key.endsWith('right') ? 'right' : 'left';
    expect(p.manifest.surfaceAuthority[side]).toEqual([`original:${side==='right' ? 'side-right' : 'side'}`]);
    expect(p.manifest.surfaceAuthority[side==='right' ? 'left' : 'right']).toBeUndefined();
  });
  it('forged visible surface is rejected by server guard', async () => {
    const p=plan('side-right',[original('side-right')]); p.manifest.visibleSurfaces.push('left');
    await expect(validateV3Wire(p.manifest,wireV3Evidence(p))).rejects.toThrow(/View/);
  });
  it('forged tier is rejected', async () => {
    const p=plan('side-right',[original('side-right')]); p.manifest.entries[0].authorityTier='C';
    await expect(validateV3Wire(p.manifest,wireV3Evidence(p))).rejects.toThrow(/View/);
  });
  it('maps actual Volvo, van and reordered job names exactly', () => {
    expect(v3ViewForJob('CI_VOLVO_SIDE')?.key).toBe('side-right');
    expect(v3ViewForJob('CI_VOLVO_34_REAR_RIGHT')?.key).toBe('34-rear-right');
    expect(v3ViewForJob('VAN_EXT_FRONT_34_RIGHT')?.key).toBe('34-front-right');
    expect(v3ViewForJob('WOMO_EXT_REAR_34')?.key).toBe('34-rear-right');
    expect(v3ViewForJob('MASTER_IMAGE')?.key).toBe('34-front-left');
  });
  it('preflight marks wrong side missing with concrete required role', () => {
    const [r] = checkV3Preflight([{key:'CI_VOLVO_34_FRONT_RIGHT'}],[original('front'),original('side')]);
    expect(r.ready).toBe(false); expect(r.missing.map(m=>m.role)).toEqual(['right_original']);
  });
  it('unmapped views and composites block instead of guessing', () => {
    expect(() => plan('UNKNOWN_VIEW',[original('front')])).toThrow(/View-Contract/);
    expect(checkV3Preflight([{key:'GRID_SOCIAL_MEDIA'}],[original('front'),original('side'),original('rear')])[0].ready).toBe(false);
  });
  it('interior grid requires steering original and seat-bearing overview', () => {
    expect(() => plan('GRID_INTERIOR_4',[original('interior-front'),original('interior-rear')])).toThrow(/interior_detail_original/);
    expect(() => plan('GRID_INTERIOR_4',[original('dashboard'),original('interior-rear'),original('steering')])).toThrow(/cabin_original/);
  });
});
describe('V3 shared relighting and metadata', () => {
  it('every job across exterior, cabin, detail, cargo and grid gets same hash/version/run profile', () => {
    const sources=['front','rear','side','side-right','interior-front','interior-rear','steering','screen','cargo','wheel'].map(original);
    const jobs=['EXT_SIDE_LEFT','EXT_SIDE_RIGHT','EXT_34_FRONT_RIGHT','EXT_34_REAR_LEFT','CI_VOLVO_REAR','INT_DRIVER','CI_VOLVO_DET_SCREEN','CI_VOLVO_INT_BOOT','GRID_INTERIOR_4','GRID_EXTERIOR_4'];
    const profiles=jobs.map(j => plan(j,sources).manifest.lightingProfile);
    expect(new Set(profiles.map(p=>p.hash)).size).toBe(1);
    expect(profiles.every(p=>p===lightingProfile && p.version==='nb21-v3-lighting-1' && p.runId==='test-run')).toBe(true);
  });
  it('server rejects changed brightness profile or hash', async () => {
    await expect(validateV3LightingProfile({...lightingProfile,hash:'forged'})).rejects.toThrow(/Lichtprofil/);
    await expect(validateV3LightingProfile({...lightingProfile,spec:{...lightingProfile.spec,whiteBalanceKelvin:4000} as never})).rejects.toThrow(/Lichtprofil/);
  });
  it('metadata contains original IDs per surface without image data', () => {
    const p=plan('34-front-right',[original('front'),original('side-right')]);
    const m=v3ResultMetadata(p.manifest);
    expect(m.authoritativeOriginalSourceIds).toEqual({front:['original:front'],right:['original:side-right']});
    expect(m.requestedPhysicalSide).toBe('right'); expect(m.lightingProfileHash).toBe(lightingProfile.hash);
    expect(JSON.stringify(m)).not.toContain('base64');
  });
  it('manual retry reason is preserved, unknown reasons rejected', () => {
    for (const retryReason of V3_RETRY_REASONS) {
      const p=resolveV3Evidence({jobKey:'side-right',sources:[original('side-right')],lightingProfile,retryReason});
      expect(v3ResultMetadata(p.manifest).retryReason).toBe(retryReason);
    }
    expect(() => resolveV3Evidence({jobKey:'side-right',sources:[original('side-right')],lightingProfile,retryReason:'automatic-paid-qa' as never})).toThrow(/Retry/);
  });
  it('server reconstructs view/light authority rather than trusting client prose', () => {
    const p=plan('34-front-right',[original('front'),original('side-right')]);
    const prompt=buildNb21V3Prompt({manifest:p.manifest,config});
    const enforced=enforceV3ServerPrompt(prompt.replace('Visible surfaces ONLY: front + right','Visible surfaces ONLY: left').replace(lightingProfile.hash,'fake'),p.manifest);
    expect(enforced).toContain('Visible surfaces ONLY: front + right');
    expect(enforced).toContain(lightingProfile.hash); expect(enforced).not.toContain('fake');
  });
});
describe('historical reproducibility and explicit opt-in', () => {
  it('stored v1/v2 and unversioned nb21 retain their versions', () => {
    expect(resolveStoredNb21Version({modelTier:'nb21'})).toBe('nb21-v1');
    expect(resolveStoredNb21Version({modelTier:'nb21',promptVersion:'nb21-v2'})).toBe('nb21-v2');
    expect(resolveStoredNb21Version({modelTier:'nb21',promptVersion:'nb21-v3'})).toBe('nb21-v3');
    expect(()=>resolveStoredNb21Version({modelTier:'qualitaet',promptVersion:'nb21-v3'})).toThrow();
  });
  it('V1/V2 source baselines remain byte-identical', () => {
    const baseline:Record<string,string>={
      'src/prompts/nb21/v2/builder.ts':'1659d2af4835b4f8f47481544b933b5e635c65a2a7d54ddd621a9ca827ff303a',
      'src/prompts/nb21/v2/index.ts':'9fc243e76be537b57c3719045c7ccaab22fd951c2c98c0597b2de054a33b4eaa',
      'supabase/functions/_shared/nb21-v2-contract.ts':'24a1924a0d4f32d66b28acb5b9787e565553d3e24c1b214a1bfe9b6c4203ed1e',
      'supabase/functions/_shared/nb21-v2-wire.ts':'bf4d661ce7ec3b873316f74b0153c4a4da0ad598e3456ffe4545af4317015997',
      'supabase/functions/_shared/nb21-v2-class.ts':'dcee47c4da24a55108a0d10d364159f6dae4ca0293953aa1aae550ed90abde4b',
      'src/prompts/nb21/version.ts':'2377d35efcd4dc4ced67c87fa759bf67b43bfb37470aa2d929532f8c5af31d1c',
      'src/prompts/nb21/builder.ts':'a44480f125ce74e897618dd27c9a7d83ec2678a2b051dfd00a8b68c2ca8b422b',
      'src/prompts/nb21/perspectives.ts':'0795ef02c20e8d6ba7ea6e455e1d68bbd42ec7fd4d39cd35bd820d81f73a2ce6',
    };
    for (const [file,hash] of Object.entries(baseline)) expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(hash);
  });
  it('all 2.0 job/master outputs contain no V3 marker', () => {
    for (const j of ALL_PIPELINE_JOBS) expect(j.prompt).not.toContain('nb21-v3');
    expect(buildMasterPrompt(config,'Volvo','side',{}, {vehicleClass:'car'} as never)).not.toContain('nb21-v3');
  });
});
