import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchPromptOverrides } from '@/lib/remaster-prompt';
import {
  compileJobPlan, normalizeSettings, planTotal, settingsHash,
  type AutomationMode, type Datasheet, type ProcessingSettings, type RunOptions,
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
  runOptions?: RunOptions;
}) {
  const [{ data: job }, { data: prep }] = await Promise.all([
    supabase.from('auto3_processing_jobs').select('id, datasheet').eq('vehicle_id', args.vehicleId).maybeSingle(),
    supabase.from('auto3_oneshot_preparations').select('analysis').eq('vehicle_id', args.vehicleId).maybeSingle(),
  ]);
  if (!job) throw new Error('Job ist noch nicht vorbereitet.');
  const datasheet = (job.datasheet || {}) as Datasheet;
  const overrides = await fetchPromptOverrides();
  let profileShowroomUrl: string | null = null;
  if (args.settings.scene === 'custom-showroom') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('custom_showroom_url').eq('id', user.id).maybeSingle();
      profileShowroomUrl = (prof as { custom_showroom_url?: string | null } | null)?.custom_showroom_url || null;
    }
  }
  const dealer = await resolveDealerBranding();
  const compiled = compileJobPlan({
    profileShowroomUrl,
    settings: args.settings, datasheet, overrides,
    analysis: Array.isArray(prep?.analysis) ? (prep!.analysis as never) : [],
    manufacturerLogoUrl: datasheet.brand ? args.getLogoForMake?.(datasheet.brand) || null : null,
    getCost: args.getCost, runOptions: args.runOptions,
  });
  const plan = { ...compiled, dealer };
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

/**
 * Dealer name + raster logo for banners. Image models cannot read SVG, so the profile
 * logo is rasterised once in the browser and stored as PNG next to the dealer's files.
 */
async function resolveDealerBranding(): Promise<{ name: string | null; logoUrl: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { name: null, logoUrl: null };
  const { data: prof } = await supabase.from('profiles').select('company_name, logo_url').eq('id', user.id).maybeSingle();
  const name = (prof?.company_name || '').trim() || null;
  const src = prof?.logo_url || null;
  if (!src) return { name, logoUrl: null };
  if (!/\.svg(\?|$)/i.test(src)) return { name, logoUrl: src };
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('logo')); img.src = src; });
    const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 200;
    const scale = 1200 / Math.max(w0, h0);
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * scale); c.height = Math.round(h0 * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
    const path = `${user.id}/dealer-branding/logo.png`;
    const { error } = await supabase.storage.from('vehicle-images').upload(path, blob, { contentType: 'image/png', upsert: true });
    if (error) return { name, logoUrl: null };
    return { name, logoUrl: `${supabase.storage.from('vehicle-images').getPublicUrl(path).data.publicUrl}?v=${Date.now()}` };
  } catch { return { name, logoUrl: null }; }
}
