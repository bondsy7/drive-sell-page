import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles, RefreshCw, Zap, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useProcessingProfile, prepareAuto3Job, startAuto3Job, retryAuto3Job } from '@/hooks/useProcessingProfile';
import { DATASHEET_LABELS, formatDatasheetValue, RUNNING_STATUSES, estimateJobCost, jobStatusLabel, type Datasheet, type JobRow } from '@/lib/auto3-processing';

export const auto3JobQueryKey = (vehicleId: string) => ['auto3-job', vehicleId];

type FullJob = JobRow & { datasheet: Datasheet; master_alternatives: { file: string; category: string; quality: number }[] };

/** Auto3 → OneShot background job: master photo, Auto3 datasheet, one-click start, live status. */
export default function Auto3JobCard({ vehicleId, compact = false }: { vehicleId: string; compact?: boolean }) {
  const { user } = useAuth();
  const { getCost, balance } = useCredits();
  const { getLogoForMake } = useVehicleMakes();
  const { data: prof } = useProcessingProfile();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: auto3JobQueryKey(vehicleId),
    enabled: !!user,
    refetchInterval: (q) => {
      const st = (q.state.data as { job?: FullJob } | undefined)?.job?.status;
      return st && RUNNING_STATUSES.includes(st) ? 5000 : false;
    },
    queryFn: async () => {
      const { data: job } = await supabase.from('auto3_processing_jobs')
        .select('id, vehicle_id, status, master_file, master_reason, master_alternatives, datasheet, progress_done, progress_total, progress_label, pause_reason, error, cost_estimate, credits_spent, updated_at')
        .eq('vehicle_id', vehicleId).maybeSingle();
      const { data: prep } = await supabase.from('auto3_oneshot_preparations').select('originals_count').eq('vehicle_id', vehicleId).maybeSingle();
      let masterUrl: string | null = null;
      if (job?.master_file) {
        const { data: s } = await supabase.storage.from('originals').createSignedUrl(`${user!.id}/${vehicleId}/${job.master_file}`, 3600);
        masterUrl = s?.signedUrl || null;
      }
      return { job: job as unknown as FullJob | null, originals: prep?.originals_count || 0, masterUrl };
    },
  });

  const job = data?.job;
  useEffect(() => {
    if (!job) return;
    if (lastStatus.current && lastStatus.current !== job.status) {
      if (job.status === 'ready_for_review') toast.success('Auto3-Aufbereitung fertig – Ergebnisse in der Fahrzeugakte prüfen.');
      if (job.status === 'paused') toast.warning(jobStatusLabel(job));
      if (job.status === 'failed') toast.error(job.error || 'Aufbereitung fehlgeschlagen');
      qc.invalidateQueries({ queryKey: ['vehicle-images', vehicleId] });
    }
    lastStatus.current = job.status;
  }, [job, qc, vehicleId]);

  const reload = () => qc.invalidateQueries({ queryKey: auto3JobQueryKey(vehicleId) });
  const act = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Aktion fehlgeschlagen'); }
    finally { setBusy(null); reload(); }
  };

  const settings = prof?.profile?.settings;
  const cost = settings ? estimateJobCost(settings, getCost) : null;
  const running = !!job && RUNNING_STATUSES.includes(job.status);
  const canStart = !!job && ['master_selected', 'ready_for_review'].includes(job.status);
  const sheet = Object.entries(job?.datasheet || {}) as [keyof Datasheet, string][];

  const start = () => act('start', async () => {
    if (!settings || !prof?.approved) throw new Error('Bitte im Profil das Fahrzeug-Aufbereitungsprofil speichern und freigeben.');
    const r = await startAuto3Job({ vehicleId, settings, getCost, getLogoForMake });
    if (r.status === 'paused') toast.warning('Pausiert – nicht genügend Credits.'); else toast.success(`Aufbereitung läuft im Hintergrund (${r.total} Credits).`);
  });

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Auto3 → OneShot-Aufbereitung</span>
        <Badge variant={job?.status === 'ready_for_review' ? 'default' : job?.status === 'failed' || job?.status === 'paused' ? 'destructive' : 'secondary'}>
          {jobStatusLabel(job, data?.originals)}
        </Badge>
        <div className="flex-1" />
        {(!job || job.status === 'master_selected' || job.status === 'failed') && (
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act('prepare', () => prepareAuto3Job(vehicleId, { reanalyze: !!job && job.status === 'failed' }))}>
            {busy === 'prepare' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}{job ? 'Master neu bestimmen' : 'Masterbild bestimmen'}
          </Button>
        )}
      </div>

      {running && (
        <div className="space-y-1">
          <Progress value={job!.progress_total ? (job!.progress_done / job!.progress_total) * 100 : 5} />
          <p className="text-xs text-muted-foreground">{job!.progress_label} · läuft auf dem Server weiter, auch wenn Sie die Seite schließen.</p>
        </div>
      )}
      {job?.error && !running && <p className="text-xs text-destructive">{job.error}</p>}

      {job?.master_file && (!compact || !running) && (
        <div className="flex flex-wrap gap-3">
          <div className="w-40 shrink-0">
            <div className="aspect-[4/3] overflow-hidden rounded bg-muted">{data?.masterUrl && <img src={data.masterUrl} alt="Masterbild" className="h-full w-full object-cover" />}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">{job.master_reason}</p>
            {job.status === 'master_selected' && job.master_alternatives?.length > 0 && (
              <select className="mt-1 w-full rounded border border-border bg-background p-1 text-[11px]" value="" disabled={!!busy}
                onChange={(e) => e.target.value && act('prepare', () => prepareAuto3Job(vehicleId, { masterFile: e.target.value }))}>
                <option value="">Anderes Masterbild …</option>
                {job.master_alternatives.map((a) => <option key={a.file} value={a.file}>{a.file} · {a.category} · {a.quality}</option>)}
              </select>
            )}
          </div>
          <div className="min-w-[200px] flex-1">
            <p className="text-xs font-medium mb-1">Datenblatt aus Auto3</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              {sheet.filter(([k]) => k !== 'consumption').map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{DATASHEET_LABELS[k]}</dt><dd className="truncate" title={v}>{formatDatasheetValue(k, v)}</dd></Fragment>))}
            </dl>
          </div>
        </div>
      )}

      {job && !running && (
        <div className="flex flex-wrap items-center gap-2">
          {canStart && (
            <Button size="sm" onClick={start} disabled={!!busy || !prof?.approved}>
              {busy === 'start' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}
              Jetzt automatisch aufbereiten{cost ? ` (${cost.total} Credits)` : ''}
            </Button>
          )}
          {(job.status === 'paused' || job.status === 'failed') && (
            <Button size="sm" onClick={() => act('retry', () => retryAuto3Job(vehicleId))} disabled={!!busy}>
              {busy === 'retry' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}Erneut versuchen
            </Button>
          )}
          {job.status === 'ready_for_review' && <Button asChild size="sm" variant="outline"><Link to={`/vehicle/${vehicleId}`}>Ergebnisse prüfen</Link></Button>}
          {compact && <Button asChild size="sm" variant="ghost"><Link to={`/vehicle/${vehicleId}`}>Job ansehen</Link></Button>}
          {canStart && !prof?.approved && <span className="text-xs text-muted-foreground">Start erst nach Freigabe des Aufbereitungsprofils: <Link className="underline" to="/profile">Profil → Fahrzeug-Aufbereitung → „Profil freigeben“</Link>.</span>}
          {canStart && prof?.approved && cost && balance < cost.total && <span className="text-xs text-destructive">Guthaben {balance} Credits reicht nicht – der Job würde pausieren.</span>}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Ergebnisse landen in Galerie und Bannern der Fahrzeugakte. Website-Veröffentlichung bleibt eine bewusste Freigabe.</p>
    </div>
  );
}
