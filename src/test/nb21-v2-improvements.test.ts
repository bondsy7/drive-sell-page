import { describe, expect, it } from 'vitest';
import { assignV2DetailRoles, checkV2Preflight } from '@/lib/nb21-v2-preflight';
import { buildNb21V2Prompt, resolveV2Evidence, type V2Reference } from '@/prompts/nb21/v2';
import { buildV2SubjectClassLock, enforceV2SubjectClassLock } from '../../supabase/functions/_shared/nb21-v2-class';
import type { RemasterConfig } from '@/lib/remaster-prompt';
const config = { scene: 'showroom-1', licensePlate: 'remove', changeColor: false } as RemasterConfig;
const source = (role: string): V2Reference => ({ sourceId: role, sourceRole: role, sourceType: 'original', image: 'data:image/jpeg;base64,YQ==' });
const jobs = ['EXT_ELEVATED_FRONT', 'DET_FRONTPANEL', 'CI_VOLVO_INT_BOOT', 'CI_VOLVO_INT_STEERING', 'CI_VOLVO_DET_CLUSTER', 'CI_VOLVO_INT_REAR'].map(key => ({ key }));

describe('V2 authoritative-role preflight', () => {
  it('all six critical jobs are ready with explicitly assigned original evidence', () => {
    const pool = ['front', 'frontpanel', 'cargo', 'rear', 'steering', 'cluster', 'interior-rear'].map(source);
    expect(checkV2Preflight(jobs, pool).map(r => r.ready)).toEqual([true, true, true, true, true, true]);
  });
  it.each(jobs)('$key cannot guess missing authority from unassigned or generated images', job => {
    const unassigned = source('unassigned-detail');
    const generated = { ...source('front'), sourceType: 'generated context' as const };
    const result = checkV2Preflight([job], [unassigned, generated])[0];
    expect(result?.ready).toBe(false);
    expect(result?.missing.length).toBeGreaterThan(0);
  });
  it('cargo must have both cargo and rear original roles', () => {
    expect(checkV2Preflight([jobs[2]], [source('cargo')])[0]?.missing.map(m => m.role)).toEqual(['rear_evidence']);
    expect(checkV2Preflight([jobs[2]], [source('rear')])[0]?.missing.map(m => m.role)).toEqual(['cargo_original']);
  });
  it('manual assignment unblocks cargo and retains stable source identity', () => {
    const detail = { ...source('unassigned-detail'), sourceId: 'detail:9', assetId: 'archive/detail-original.jpg' };
    const sources = [detail, source('rear')];
    const assigned = assignV2DetailRoles(sources, { 'detail:9': 'cargo' });
    expect(checkV2Preflight([jobs[2]], assigned)[0]?.ready).toBe(true);
    expect(assigned[0]?.assetId).toBe(detail.assetId);
    expect(sources[0]?.sourceRole).toBe('unassigned-detail');
    const generated = { ...detail, sourceType: 'generated context' as const };
    expect(assignV2DetailRoles([generated], { 'detail:9': 'cargo' })[0]?.sourceRole).toBe('unassigned-detail');
  });
  it('conscious skip removes only the missing job from the launch plan', () => {
    const selected = jobs.slice(0, 3);
    const sources = [source('front'), source('frontpanel')];
    const checks = checkV2Preflight(selected, sources);
    expect(checks.filter(r => !r.ready).map(r => r.job.key)).toEqual(['CI_VOLVO_INT_BOOT']);
    const remaining = selected.filter(job => job.key !== 'CI_VOLVO_INT_BOOT');
    expect(checkV2Preflight(remaining, sources).every(r => r.ready)).toBe(true);
  });
});

describe('V2 compact class lock in final provider prompt', () => {
  it.each([
    ['car', undefined, 'passenger car'], ['van', undefined, 'van/transporter'],
    ['motorhome', 'alcove', 'motorhome'], ['motorhome', 'caravan', 'caravan (towable, no powered cab)'],
    ['motorcycle', undefined, 'motorcycle'], ['truck', undefined, 'truck'], ['machinery', undefined, 'machinery'],
  ])('preserves %s / %s in all six jobs', (vehicleClass, motorhomeBodyType, label) => {
    const context = { vehicleClass, motorhomeBodyType };
    const pool = ['front', 'frontpanel', 'cargo', 'rear', 'steering', 'cluster', 'interior-rear'].map(source);
    for (const job of jobs) {
      const manifest = resolveV2Evidence({ jobKey: job.key, sources: pool }).manifest;
      const client = buildNb21V2Prompt({ manifest, config, classContext: context });
      const final = enforceV2SubjectClassLock(client, context);
      expect(final).toContain(`Subject class: ${label}`);
      expect(final).toContain('Reference Evidence overrides model/brand knowledge');
      expect(final.match(/<NB21_V2_SUBJECT_CLASS_LOCK>/g)).toHaveLength(1);
      expect(final.indexOf('<NB21_V2_SUBJECT_CLASS_LOCK>')).toBeGreaterThan(final.indexOf('SECTION 4/9'));
      expect(final.indexOf('</NB21_V2_SUBJECT_CLASS_LOCK>')).toBeLessThan(final.indexOf('SECTION 5/9'));
    }
  });
  it('server replaces a mismatched client class and restores omitted locks', () => {
    const manifest = resolveV2Evidence({ jobKey: 'EXT_FRONT', sources: [source('front')] }).manifest;
    const client = buildNb21V2Prompt({ manifest, config, vehicleClass: 'car' });
    expect(enforceV2SubjectClassLock(client, { vehicleClass: 'van' })).not.toContain('Subject class: passenger car');
    const oldClient = client.replace(/<NB21_V2_SUBJECT_CLASS_LOCK>[\s\S]*?<\/NB21_V2_SUBJECT_CLASS_LOCK>/, '');
    expect(enforceV2SubjectClassLock(oldClient, { vehicleClass: 'motorcycle' })).toContain('Subject class: motorcycle');
    expect(buildV2SubjectClassLock({ vehicleClass: 'truck', truckConfiguration: 'trailer_only' })).toContain('Subject class: trailer (no powered cab)');
    expect(() => buildV2SubjectClassLock({ vehicleClass: 'unknown' })).toThrow();
  });
});