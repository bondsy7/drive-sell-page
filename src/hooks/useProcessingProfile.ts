import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchPromptOverrides } from '@/lib/remaster-prompt';
import {
  compileJobPlan, normalizeSettings, planTotal, settingsHash,
  type AutomationMode, type Datasheet, type ProcessingSettings,
} from '@/lib/auto3-processing';

export interface ProcessingProfile {
  id: string; name: string; settings: ProcessingSettings; cost_per_job: number;
  approved_at: string | null; approved_max_credits_per_job: number | null; approved_settings_hash: string | null;
}

export function useProcessingProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['processing-profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: prof }, { data: p }] = await Promise.all([
        supabase.from('vehicle_processing_profiles').select('*').eq('user_id', user!.id).maybeSingle(),
        supabase.from('profiles').select('auto3_autopilot_mode').eq('id', user!.id).maybeSingle(),
      ]);
      const profile = prof ? { ...prof, settings: normalizeSettings(prof.settings) } as unknown as ProcessingProfile : null;
      // An approval is only valid for the exact settings it was given for.
      const approved = !!profile?.approved_at && profile.approved_settings_hash === settingsHash(profile.settings);
      return { profile, approved, mode: ((p?.auto3_autopilot_mode as AutomationMode) || 'off') };
    },
  });
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['processing-profile'] }), [qc]);
  return { ...q, refresh };
}

/** Compile the OneShot plan for a prepared Auto3 job and hand it to the server orchestrator. */
export async function startAuto3Job(args: {
  vehicleId: string; settings: ProcessingSettings;
  getCost?: (action: string, tier: string) => number;
  getLogoForMake?: (make: string) => string | null | undefined;
}) {
  const [{ data: job }, { data: prep }] = await Promise.all([
    supabase.from('auto3_processing_jobs').select('id, datasheet').eq('vehicle_id', args.vehicleId).maybeSingle(),
    supabase.from('auto3_oneshot_preparations').select('analysis').eq('vehicle_id', args.vehicleId).maybeSingle(),
  ]);
  if (!job) throw new Error('Job ist noch nicht vorbereitet.');
  const datasheet = (job.datasheet || {}) as Datasheet;
  const overrides = await fetchPromptOverrides();
  const plan = compileJobPlan({
    settings: args.settings, datasheet, overrides,
    analysis: Array.isArray(prep?.analysis) ? (prep!.analysis as never) : [],
    manufacturerLogoUrl: datasheet.brand ? args.getLogoForMake?.(datasheet.brand) || null : null,
    getCost: args.getCost,
  });
  const { data, error } = await supabase.functions.invoke('auto3-processing-job', { body: { action: 'start', vehicleId: args.vehicleId, plan } });
  if (error || data?.error) throw new Error(data?.error || 'Start fehlgeschlagen');
  return { ...data, total: planTotal(plan) } as { status: string; pause_reason?: string; total: number };
}

export async function prepareAuto3Job(vehicleId: string, opts: { masterFile?: string; reanalyze?: boolean } = {}) {
  const { data, error } = await supabase.functions.invoke('auto3-processing-job', { body: { action: 'prepare', vehicleId, ...opts } });
  if (error || data?.error) throw new Error(data?.error || 'Vorbereitung fehlgeschlagen');
  return data as { master: { file: string; reason: string }; originals: number };
}

export async function retryAuto3Job(vehicleId: string) {
  const { data, error } = await supabase.functions.invoke('auto3-processing-job', { body: { action: 'retry', vehicleId } });
  if (error || data?.error) throw new Error(data?.error || 'Fortsetzen fehlgeschlagen');
  return data;
}
