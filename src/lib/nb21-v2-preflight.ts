import { normalizeV2Role, v2Policy, resolveV2Evidence, type V2Reference, type V2Requirement } from '../../supabase/functions/_shared/nb21-v2-contract';

export interface V2PreflightJob { key: string; category?: string; labelDe?: string }
export interface V2PreflightResult {
  job: V2PreflightJob;
  missing: V2Requirement[];
  ready: boolean;
  error?: string;
}
/** Same policy and duplicate-source handling as the evidence resolver, no image guessing. */
export function checkV2Preflight(jobs: V2PreflightJob[], sources: V2Reference[]): V2PreflightResult[] {
  return jobs.map(job => {
    const used = new Set<string>();
    const originals = sources.filter(s => s.sourceType === 'original' && s.image);
    const missing: V2Requirement[] = [];
    for (const requirement of v2Policy(job.key, job.category).requirements) {
      const candidates = requirement.slots.flatMap(slot => originals.filter(s => normalizeV2Role(s.sourceRole) === slot));
      const hit = candidates.find(s => !used.has(s.sourceId));
      if (hit) used.add(hit.sourceId);
      else if (requirement.required && !candidates.some(s => used.has(s.sourceId))) missing.push(requirement);
    }
    try {
      resolveV2Evidence({ jobKey: job.key, category: job.category, sources });
      return { job, missing, ready: missing.length === 0 };
    } catch (error) {
      return { job, missing, ready: false, error: error instanceof Error ? error.message : 'Referenz fehlt' };
    }
  });
}

/** User-assigned roles only apply to genuine detail originals, never generated context. */
export function assignV2DetailRoles(sources: V2Reference[], assignments: Record<string, string>): V2Reference[] {
  return sources.map(source => source.sourceType === 'original' && (source.sourceId.startsWith('detail:') || normalizeV2Role(source.sourceRole).startsWith('unassigned')) && assignments[source.sourceId]
    ? { ...source, sourceRole: assignments[source.sourceId] }
    : source);
}