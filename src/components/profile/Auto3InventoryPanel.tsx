import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import Auto3JobCard from '@/components/vehicle/Auto3JobCard';
import { useCredits } from '@/hooks/useCredits';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import { useProcessingProfile, prepareAuto3Job, startAuto3Job } from '@/hooks/useProcessingProfile';
import { RUNNING_STATUSES, jobStatusLabel, type JobRow } from '@/lib/auto3-processing';

type Status = 'no_vin' | 'not_imported' | 'imported' | 'assets' | 'website_draft' | 'website_live';
interface Item {
  externalVehicleId: string; internalNumber: string | null; brand: string | null; model: string | null;
  variant: string | null; year: number | null; used: boolean | null; thumbnail: string | null;
  vinMasked: string | null; vinValid: boolean; status: Status; vehicleId: string | null; conflict: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  no_vin: 'Keine VIN (nicht importierbar)', not_imported: 'Nicht importiert', imported: 'Importiert',
  assets: 'Pipeline/Assets vorhanden', website_draft: 'Website Entwurf', website_live: 'Website Live',
};

/** Auto3 inventory (read-only, server-side). Import only links vehicle record + original sources. */
export default function Auto3InventoryPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'imported' | 'no_vin'>('all');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const { data: prof } = useProcessingProfile();
  const autopilot = prof?.mode || 'off';
  const { getCost } = useCredits();
  const { getLogoForMake } = useVehicleMakes();
  const [jobs, setJobs] = useState<Record<string, JobRow & { originals: number }>>({});
  const loadJobs = async (vids: string[]) => {
    if (!vids.length) return;
    const [{ data: rows }, { data: preps }] = await Promise.all([
      supabase.from('auto3_processing_jobs').select('id, vehicle_id, status, master_file, master_reason, progress_done, progress_total, progress_label, pause_reason, error, cost_estimate, credits_spent, updated_at').in('vehicle_id', vids),
      supabase.from('auto3_oneshot_preparations').select('vehicle_id, originals_count').in('vehicle_id', vids),
    ]);
    const counts = Object.fromEntries((preps || []).map((p) => [p.vehicle_id, p.originals_count]));
    setJobs(Object.fromEntries((rows || []).map((r) => [r.vehicle_id, { ...(r as unknown as JobRow), originals: counts[r.vehicle_id] || 0 }])));
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'list' } });
    setLoading(false);
    if (error || data?.error) { toast.error(data?.error || 'Auto3-Bestand konnte nicht geladen werden.'); return; }
    setItems(data.items); setSel(new Set());
    const vids = (data.items as Item[]).map((i) => i.vehicleId).filter(Boolean) as string[];
    await loadJobs(vids);
  };

  const [phase, setPhase] = useState<string | null>(null);
  const [ready, setReady] = useState<{ vehicleId: string; label: string; stored: number; total: number }[]>([]);

  const run = async (ids: string[]) => {
    if (!ids.length) return;
    setImporting(true); setReady([]);
    const done: typeof ready = [];
    for (const extId of ids) {
      const item = items?.find((i) => i.externalVehicleId === extId);
      const label = [item?.brand, item?.model].filter(Boolean).join(' ') || `Auto3-ID ${extId}`;
      setPhase(`${label}: Fahrzeugdaten werden übernommen …`);
      const { data, error } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'import', externalVehicleIds: [extId] } });
      const r = data?.results?.[0];
      if (error || data?.error || !r?.ok) { toast.error(`${label}: ${r?.error || data?.error || 'Import fehlgeschlagen'}`); continue; }
      const total: number = r.mediaTotal || 0;
      let offset = 0; let stored = 0; let skipped = 0; const warnings: string[] = [];
      while (offset < total) {
        setPhase(`${label}: Originalbilder werden gespeichert (${offset}/${total}) …`);
        const { data: b, error: be } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'import_images', externalVehicleId: extId, offset, limit: 4 } });
        if (be || b?.error) { warnings.push(b?.error || 'Bildimport unterbrochen'); break; }
        stored += b.stored; skipped += b.skipped; warnings.push(...(b.warnings || []));
        offset = b.processed;
      }
      const have = stored + skipped;
      if (have > 0 && autopilot !== 'off') {
        setPhase(`${label}: ${have} Originale werden analysiert, Masterbild wird gewählt …`);
        try {
          await prepareAuto3Job(r.vehicleId, { reanalyze: true });
          if (autopilot === 'full' && prof?.approved && prof.profile) {
            setPhase(`${label}: Aufbereitung wird im Hintergrund gestartet …`);
            const st = await startAuto3Job({ vehicleId: r.vehicleId, settings: prof.profile.settings, getCost, getLogoForMake });
            if (st.status === 'paused') toast.warning(`${label}: Pausiert – Credits erforderlich.`);
          }
        } catch (e) { toast.warning(`${label}: ${e instanceof Error ? e.message : 'Vorbereitung fehlgeschlagen'} – in der Fahrzeugakte erneut starten.`); }
      }
      if (warnings.length) toast.warning(`${label}: ${warnings.length} Bild(er) nicht übernommen – ${warnings.slice(0, 2).join('; ')}`);
      toast.success(`${label}: ${r.fieldCount} Datenfelder und ${have}/${total} Originalbilder übernommen.`);
      if (have > 0) done.push({ vehicleId: r.vehicleId, label, stored: have, total });
    }
    setImporting(false); setPhase(null); setReady(done);
    load();
  };

  const visible = useMemo(() => (items || []).filter((i) => {
    if (filter === 'open' && i.status !== 'not_imported') return false;
    if (filter === 'no_vin' && i.status !== 'no_vin') return false;
    if (filter === 'imported' && ['no_vin', 'not_imported'].includes(i.status)) return false;
    const s = `${i.brand} ${i.model} ${i.variant} ${i.internalNumber} ${i.externalVehicleId}`.toLowerCase();
    return s.includes(q.toLowerCase());
  }), [items, q, filter]);

  const importable = (i: Item) => i.vinValid && !i.conflict && ['not_imported', 'imported'].includes(i.status);
  const toggle = (id: string) => setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          {items ? 'Bestand aktualisieren' : 'Bestand laden'}
        </Button>
        {items && <span className="text-xs text-muted-foreground">{items.length} Fahrzeuge · {items.filter((i) => !i.vinValid).length} ohne gültige VIN</span>}
      </div>
      {phase && <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs"><Loader2 className="w-4 h-4 animate-spin" />{phase}</div>}
      {ready.map((r) => (
        <div key={r.vehicleId} className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2 text-sm">
          <span className="flex-1 min-w-0"><b>{r.label}</b> · {r.stored}/{r.total} Originale gespeichert</span>
          <Button asChild size="sm" variant="ghost"><Link to={`/vehicle/${r.vehicleId}`}>Fahrzeugakte</Link></Button>
          <div className="basis-full"><Auto3JobCard vehicleId={r.vehicleId} compact /></div>
        </div>
      ))}
      {loading && !items && <p className="text-xs text-muted-foreground">Lade Bestand und prüfe VINs … das kann einige Sekunden dauern.</p>}
      {items && (
        <>
          <div className="flex flex-wrap gap-2">
            <Input className="h-8 max-w-xs" placeholder="Suche Marke, Modell, Nummer" value={q} onChange={(e) => setQ(e.target.value)} />
            {(['all', 'open', 'imported', 'no_vin'] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                {{ all: 'Alle', open: 'Nicht importiert', imported: 'Importiert', no_vin: 'Keine VIN' }[f]}
              </Button>
            ))}
            <Button size="sm" disabled={!sel.size || importing} onClick={() => run([...sel])}>
              {importing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
              Auswahl übernehmen ({sel.size})
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border max-h-[480px] overflow-auto">
            {visible.map((i) => (
              <li key={i.externalVehicleId} className="flex items-center gap-3 p-2 text-sm">
                <Checkbox checked={sel.has(i.externalVehicleId)} disabled={!importable(i)} onCheckedChange={() => toggle(i.externalVehicleId)} />
                {i.thumbnail ? <img src={i.thumbnail} alt="" className="w-16 h-12 object-cover rounded" loading="lazy" /> : <div className="w-16 h-12 rounded bg-muted" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{[i.brand, i.model].filter(Boolean).join(' ') || '—'} <span className="text-muted-foreground font-normal">{i.variant}</span></div>
                  <div className="text-xs text-muted-foreground">
                    Auto3-ID {i.externalVehicleId}{i.internalNumber ? ` · Nr. ${i.internalNumber}` : ''}{i.year ? ` · ${i.year}` : ''}{i.used != null ? ` · ${i.used ? 'Gebraucht' : 'Neu'}` : ''}
                    {i.vinMasked ? ` · VIN ${i.vinMasked}` : ''}
                  </div>
                  {i.conflict && <div className="text-xs text-destructive">{i.conflict}</div>}
                  {i.vehicleId && jobs[i.vehicleId] && <div className={`text-xs ${['paused', 'failed'].includes(jobs[i.vehicleId].status) ? 'text-destructive' : 'text-primary'}`}>{jobStatusLabel(jobs[i.vehicleId], jobs[i.vehicleId].originals)}</div>}
                </div>
                <Badge variant={i.status === 'website_live' ? 'default' : i.status === 'no_vin' ? 'outline' : 'secondary'} className="shrink-0">{STATUS_LABEL[i.status]}</Badge>
                {i.vehicleId && i.status !== 'no_vin' && (
                  <Button asChild size="sm" variant={jobs[i.vehicleId] ? 'default' : 'outline'}>
                    <Link to={`/vehicle/${i.vehicleId}`}>{!jobs[i.vehicleId] ? 'Masterbild bestimmen' : jobs[i.vehicleId].status === 'master_selected' ? 'Jetzt automatisch aufbereiten' : ['paused', 'failed'].includes(jobs[i.vehicleId].status) ? 'Erneut versuchen' : 'Job ansehen'}</Link>
                  </Button>
                )}
                {importable(i) && (
                  <Button size="sm" variant="outline" disabled={importing} onClick={() => run([i.externalVehicleId])}>{i.vehicleId ? 'Daten & Bilder abgleichen' : 'In autohaus.ai übernehmen'}</Button>
                )}
              </li>
            ))}
            {!visible.length && <li className="p-3 text-xs text-muted-foreground">Keine Fahrzeuge für diesen Filter.</li>}
          </ul>
          <p className="text-[11px] text-muted-foreground">Übernehmen schreibt alle Auto3-Fahrzeugdaten in die Fahrzeugakte, speichert die Originalbilder und wählt automatisch ein Masterbild. Die OneShot-Aufbereitung läuft im Hintergrund – nur mit freigegebenem Aufbereitungsprofil; auf der Website wird nichts veröffentlicht.</p>
        </>
      )}
    </div>
  );
}
