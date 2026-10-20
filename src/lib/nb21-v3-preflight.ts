import { v3Policy, resolveV3Evidence, normalizeV3Role, type V3Reference, type V3LightingProfile } from '@/prompts/nb21/v3';
import type { V2PreflightJob, V2PreflightResult } from './nb21-v2-preflight';
export function checkV3Preflight(jobs: V2PreflightJob[], sources: V3Reference[], lightingProfile?: V3LightingProfile): V2PreflightResult[] {
  return jobs.map(job => {
    try {
      const policy = v3Policy(job.key,job.category);
      const missing = policy.requirements.filter(r => r.required && !sources.some(s => s.sourceType === 'original' && !!s.image && r.slots.includes(normalizeV3Role(s.sourceRole))));
      if (!missing.length && lightingProfile) resolveV3Evidence({jobKey:job.key,category:job.category,sources,lightingProfile});
      return {job,missing,ready:!missing.length};
    } catch (error) { return {job,missing:[],ready:false,error:error instanceof Error ? error.message : 'V3-Vertrag fehlt'}; }
  });
}
