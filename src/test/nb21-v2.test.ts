import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ALL_PIPELINE_JOBS } from '@/lib/pipeline-jobs';
import { buildNb21V2Prompt, classifyV2Target, resolveV2Evidence, resolveNb21Version, originalSlotFromFilename, wireV2Evidence, v2Policy, type V2Reference } from '@/prompts/nb21/v2';
import { validateV2Wire, v2TransportManifest } from '../../supabase/functions/_shared/nb21-v2-wire';
import { NB21_SECTION_ORDER, nb21SectionHeader } from '@/prompts/nb21';
import type { RemasterConfig } from '@/lib/remaster-prompt';
const config = { scene: 'showroom-1', licensePlate: 'remove', changeColor: false, showManufacturerLogo: false, showDealerLogo: false } as RemasterConfig;
const source = (role: string, sourceType: V2Reference['sourceType'] = 'original', sourceId = role): V2Reference => ({ sourceId, sourceRole: role, sourceType, image: 'data:image/jpeg;base64,YQ==', fileUri: { uri: `files/${sourceId}`, mimeType: 'image/jpeg' }, openAIFile: { fileId: `file-${sourceId}` } });
const pool = ['front','34front','rear','side','side-right','interior-front','interior-rear','steering','cluster','screen','cargo','headlight','frontpanel','taillight'].map(r => source(r));

describe('NB21 v2 evidence contracts', () => {
  it('classifies every existing CI interior, cargo and wheel job semantically', () => {
    const cases: Record<string,string> = { CI_BMW_INTERIOR: 'interior_cabin', CI_MERCEDES_MBUX: 'interior_detail', CI_VOLVO_INT_PASSENGER: 'interior_cabin', CI_VOLVO_INT_CENTER: 'interior_cabin', CI_VOLVO_INT_REAR: 'interior_cabin', CI_VOLVO_INT_BOOT: 'cargo_area', CI_VOLVO_INT_STEERING: 'interior_detail', CI_VOLVO_DET_CLUSTER: 'interior_detail', CI_VOLVO_DET_SCREEN: 'interior_detail', CI_BMW_WHEEL: 'wheel_detail', CI_MERCEDES_WHEEL: 'wheel_detail', CI_VOLVO_DET_WHEEL: 'wheel_detail' };
    for (const [key, target] of Object.entries(cases)) {
      expect(ALL_PIPELINE_JOBS.some(j => j.key === key)).toBe(true);
      expect(classifyV2Target(key, 'ci'), key).toBe(target);
    }
    for (const j of ALL_PIPELINE_JOBS.filter(j => j.key.startsWith('CI_') && /INT_|INTERIOR|MBUX|CLUSTER|SCREEN/.test(j.key))) expect(classifyV2Target(j.key, j.category)).not.toBe('exterior');
  });
  it('cargo requires separate original cargo and rear authorities', () => {
    const plan = resolveV2Evidence({ jobKey: 'CI_VOLVO_INT_BOOT', sources: pool });
    expect(plan.manifest.entries.map(e => [e.role,e.sourceRole,e.authorityTier])).toEqual([['cargo_original','cargo','A'], ['rear_evidence','rear','A']]);
    expect(() => resolveV2Evidence({ jobKey: 'CI_VOLVO_INT_BOOT', sources: pool.filter(s => s.sourceRole !== 'cargo') })).toThrow(/cargo_original/);
    expect(() => resolveV2Evidence({ jobKey: 'CI_VOLVO_INT_BOOT', sources: [source('cargo')] })).toThrow(/rear_evidence/);
  });
  it.each(['CI_VOLVO_INT_STEERING','CI_VOLVO_DET_CLUSTER','CI_VOLVO_DET_SCREEN'])('%s receives interior originals, no wheel or exterior identity', key => {
    const plan = resolveV2Evidence({ jobKey: key, sources: [...pool, source('wheel','immutable asset')] });
    expect(plan.manifest.entries.filter(e => e.authorityTier === 'A').map(e => e.sourceRole)).toEqual([key.includes('STEERING') ? 'steering' : key.includes('CLUSTER') ? 'cluster' : 'screen', 'interior-front']);
    expect(plan.manifest.entries.some(e => e.sourceRole === 'wheel')).toBe(false);
    validateV2Wire(plan.manifest, wireV2Evidence(plan));
  });
  it('front and elevated front select late originals before any remastered context', () => {
    const sources = [...Array.from({ length: 20 }, (_, i) => source('front','generated context',`generated-${i}`)), ...pool];
    for (const key of ['EXT_FRONT','EXT_ELEVATED_FRONT']) {
      const plan = resolveV2Evidence({ jobKey: key, sources });
      expect(plan.manifest.entries[0].sourceId).toBe('front');
      expect(plan.manifest.entries[1].sourceId).toBe('frontpanel');
      expect(plan.manifest.entries.length).toBeLessThanOrEqual(5);
      expect(plan.manifest.entries.filter(e => e.sourceType === 'generated context').every(e => e.authorityTier === 'C' && e.role === 'presentation_context')).toBe(true);
    }
  });
  it('generated context never substitutes missing identity or physical-side evidence', () => {
    expect(() => resolveV2Evidence({ jobKey: 'EXT_FRONT', sources: [source('front','generated context')] })).toThrow(/Originalbeleg/);
    expect(() => resolveV2Evidence({ jobKey: 'EXT_SIDE_RIGHT', sources: [source('side'),source('side-right','generated context')] })).toThrow(/physical_side_original/);
    expect(resolveV2Evidence({ jobKey: 'EXT_SIDE_RIGHT', sources: pool }).manifest.entries[0].sourceRole).toBe('side-right');
  });
  it('rear seats prefer exact original rear cabin, not front or wheel', () => {
    const p = resolveV2Evidence({ jobKey: 'CI_VOLVO_INT_REAR', sources: pool });
    expect(p.manifest.entries[0].sourceRole).toBe('interior-rear');
  });
  it('all three transports retain identical selected IDs and roles, even mixed fallback', () => {
    const p = resolveV2Evidence({ jobKey: 'EXT_ELEVATED_FRONT', sources: pool });
    p.references[1] = { ...p.references[1], fileUri: null, openAIFile: null };
    const expected = p.manifest.entries.map(e => [e.sourceId,e.role]);
    for (const transport of ['gemini','openai','inline'] as const) {
      const wire = wireV2Evidence(p, transport);
      expect(wire.map(e => [e.sourceId,e.role])).toEqual(expected);
      validateV2Wire(p.manifest, wire);
    }
  });
  it('edit contract takes only exact original slot and scoped assets, never all originals', () => {
    const p = resolveV2Evidence({ jobKey: 'rear', editSlot: 'rear', sources: [...pool, source('environment','generated context'), source('plate','immutable asset')] });
    expect(p.manifest.mode).toBe('edit');
    expect(p.manifest.entries.filter(e => e.authorityTier === 'A').map(e => e.sourceRole)).toEqual(['rear']);
    expect(buildNb21V2Prompt({ manifest: p.manifest, config })).toContain('EDIT CONTRACT');
    expect(buildNb21V2Prompt({ manifest: resolveV2Evidence({ jobKey: 'EXT_FRONT', sources: pool }).manifest, config })).toContain('VIEW SYNTHESIS CONTRACT');
  });
  it('all jobs have a V2 policy and 9 sections, independent of legacy prompt bodies', () => {
    const enriched = [...pool, ...['living','kitchen','bath','bed','garage','controls','cabin','cockpit'].map(r => source(r))];
    for (const j of ALL_PIPELINE_JOBS) {
      const suitable = v2Policy(j.key, j.category).requirements.flatMap(r => r.slots.slice(0,1)).filter(r => !enriched.some(s => s.sourceRole === r));
      const plan = resolveV2Evidence({ jobKey: j.key, category: j.category, sources: [...enriched, ...suitable.map(r => source(r))] });
      const prompt = buildNb21V2Prompt({ manifest: plan.manifest, config });
      validateV2Wire(plan.manifest, wireV2Evidence(plan));
      const positions = NB21_SECTION_ORDER.map(name => { const h = nb21SectionHeader(name); expect(prompt.split(h).length - 1, j.key).toBe(1); return prompt.indexOf(h); });
      expect(positions).toEqual([...positions].sort((a,b) => a-b));
      expect(prompt).not.toContain('{{NB21_SERVER_');
    }
  });
  it('server rejects reordered references and generated context masquerading as identity', () => {
    const p = resolveV2Evidence({ jobKey: 'EXT_FRONT', sources: pool });
    const wire = wireV2Evidence(p);
    expect(() => validateV2Wire(p.manifest, [...wire].reverse())).toThrow(/Referenzidentität/);
    const r = { ...wire[0], sourceType: 'generated context' as const, authorityTier: 'C' as const };
    expect(() => validateV2Wire({ ...p.manifest, entries: [r] }, [r])).toThrow(/Identitätsrolle/);
  });
  it('telemetry excludes inline content and signed URL query tokens', async () => {
    const p = resolveV2Evidence({ jobKey: 'EXT_FRONT', sources: pool });
    const inline = await v2TransportManifest(wireV2Evidence(p, 'inline'));
    expect(inline[0].inlineSha256).toHaveLength(64);
    expect(JSON.stringify(inline)).not.toContain('YQ==');
    p.references[0].fileUri = { uri: 'https://files/item?token=private', mimeType: 'image/jpeg' };
    expect((await v2TransportManifest(wireV2Evidence(p)))[0].fileIdentifier).toBe('https://files/item');
  });
  it('unassigned legacy details are not guessed from array position', () => {
    expect(originalSlotFromFilename('123-9-original.jpg')).toBeNull();
    expect(originalSlotFromFilename('123-9-cargo-original.jpg')).toBe('cargo');
    expect(() => resolveV2Evidence({ jobKey: 'CI_VOLVO_INT_BOOT', sources: [source('unassigned-detail'), source('rear')] })).toThrow(/cargo_original/);
  });
  it('non-visible specialty details never silently substitute a front overview', () => {
    expect(() => resolveV2Evidence({ jobKey: 'MACH_DET_UNDERCARRIAGE', sources: pool })).toThrow(/local_detail_original/);
    expect(resolveV2Evidence({ jobKey: 'MACH_DET_UNDERCARRIAGE', sources: [...pool, source('undercarriage')] }).manifest.entries[0].sourceRole).toBe('undercarriage');
  });
  it('composites and motorhome edit interiors retain semantic scope', () => {
    expect(classifyV2Target('GRID_INTERIOR_4')).toBe('composite');
    expect(classifyV2Target('VAN_SOCIAL_COLLAGE')).toBe('composite');
    for (const slot of ['living','kitchen','bath','bed']) {
      const p = resolveV2Evidence({ jobKey: slot, editSlot: slot, sources: [source(slot), source('wheel','immutable asset')] });
      expect(p.manifest.target).toBe('interior_cabin');
      expect(p.manifest.entries.some(e => e.sourceRole === 'wheel')).toBe(false);
    }
  });
  it('scene and enabled assets never displace mandatory originals', () => {
    const p = resolveV2Evidence({ jobKey: 'EXT_ELEVATED_FRONT', sources: [...pool, ...['wheel','plate','manufacturer-logo','dealer-logo'].map(r => source(r,'immutable asset')), source('environment','generated context')] });
    expect(p.manifest.entries.slice(0,3).map(e => e.sourceRole)).toEqual(['front','frontpanel','side']);
    expect(p.manifest.entries.map(e => e.sourceRole)).toContain('environment');
    expect(p.manifest.entries).toHaveLength(8);
    validateV2Wire(p.manifest, wireV2Evidence(p));
  });
  it('Volvo CI side keeps its existing physical RIGHT direction', () => {
    const p = resolveV2Evidence({ jobKey: 'CI_VOLVO_SIDE', sources: pool });
    expect(p.manifest.entries[0].sourceRole).toBe('side-right');
    expect(buildNb21V2Prompt({ manifest: p.manifest, config })).toContain('Physical RIGHT side; never mirror.');
  });
  it('edit remasters never inject a synthesized detail or camera contract', () => {
    const p = resolveV2Evidence({ jobKey: 'interior-front', editSlot: 'interior-front', sources: pool });
    const prompt = buildNb21V2Prompt({ manifest: p.manifest, config });
    expect(prompt).toContain('EDIT CONTRACT');
    expect(prompt).toContain('Exactly the original camera');
    expect(prompt).not.toContain('VIEW SYNTHESIS CONTRACT');
  });
  it('v1, v2, unversioned historic nb21 and non-NB21 remain separate', () => {
    expect(resolveNb21Version({ modelTier: 'nb21', promptVersion: 'nb21-v1' })).toBe('nb21-v1');
    expect(resolveNb21Version({ modelTier: 'nb21', promptVersion: 'nb21-v2' })).toBe('nb21-v2');
    expect(resolveNb21Version({ modelTier: 'nb21' })).toBe('nb21-v1');
    expect(resolveNb21Version({ modelTier: 'qualitaet' })).toBeUndefined();
    expect(() => resolveNb21Version({ modelTier: 'nb21', promptVersion: 'nb21-v3' })).toThrow();
    expect(() => resolveNb21Version({ modelTier: 'qualitaet', promptVersion: 'nb21-v2' })).toThrow();
  });
  it('all five frozen V1 module files are byte-identical', () => {
    const hashes = { builder: 'a44480f125ce74e897618dd27c9a7d83ec2678a2b051dfd00a8b68c2ca8b422b', perspectives: '0795ef02c20e8d6ba7ea6e455e1d68bbd42ec7fd4d39cd35bd820d81f73a2ce6', sections: '3601f41cea5b49f6021fcbb6f859bf1f3354fedb2070c8ee99161d79bcad9c6e', version: '2377d35efcd4dc4ced67c87fa759bf67b43bfb37470aa2d929532f8c5af31d1c', index: '415a9b6e2f0e0c79805cb34570d4aeda9d4ed87566b8ce69dd493bad953bed2c' };
    for (const [name,hash] of Object.entries(hashes)) expect(createHash('sha256').update(readFileSync(`src/prompts/nb21/${name}.ts`)).digest('hex')).toBe(hash);
  });
});