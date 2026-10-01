import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Sparkles, Check, Circle, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CAR_CAPTURE_SLOTS } from '@/config/profiles/car-profile';
import {
  AUTO3_STANDARD_PRESET, CATEGORY_LABEL, estimatePresetCredits, missingRequiredSlots, oneshotHandoffUrl,
  preparationStatusLabel, selectReferences,
  type OriginalAnalysis, type PreparationStatus, type PresetOptions, type ReferenceSelection,
} from '@/lib/auto3-oneshot';

interface PrepRow {
  status: PreparationStatus; options: PresetOptions; analysis: OriginalAnalysis[];
  selection: Record<string, string>; detail_selection: string[]; originals_count: number; error: string | null;
}

export const auto3PrepQueryKey = (vehicleId: string) => ['auto3-prep', vehicleId];

/** Runs the free perspective/quality analysis of stored Auto3 originals. */
export async function analyzeAuto3Originals(vehicleId: string) {
  const { data, error } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'analyze_originals', vehicleId } });
  if (error || data?.error) throw new Error(data?.error || 'Bildanalyse fehlgeschlagen');
  return data as { analysis: OriginalAnalysis[] };
}

const SLOTS = CAR_CAPTURE_SLOTS.filter((s) => !s.isVin);

/** Auto3 Standard-Aufbereitung: shows analysis, editable reference choice, real credits and hands off to the existing pipeline. */
export default function Auto3PrepCard({ vehicleId, compact = false }: { vehicleId: string; compact?: boolean }) {
  const { user } = useAuth();
  const { balance } = useCredits();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const [opts, setOpts] = useState<PresetOptions>(AUTO3_STANDARD_PRESET);
  const [sel, setSel] = useState<ReferenceSelection>({ slots: {}, details: [] });
  const [expanded, setExpanded] = useState(!compact);

  const { data } = useQuery({
    queryKey: auto3PrepQueryKey(vehicleId),
    enabled: !!user,
    refetchInterval: (q) => ((q.state.data as { prep?: PrepRow } | undefined)?.prep?.status === 'analyzing_originals' ? 4000 : false),
    queryFn: async () => {
      const [{ data: prep }, { data: veh }, { data: files }] = await Promise.all([
        supabase.from('auto3_oneshot_preparations').select('status, options, analysis, selection, detail_selection, originals_count, error').eq('vehicle_id', vehicleId).maybeSingle(),
        supabase.from('vehicles').select('brand, model, title').eq('id', vehicleId).maybeSingle(),
        supabase.storage.from('originals').list(`${user!.id}/${vehicleId}`, { limit: 200, sortBy: { column: 'name', order: 'asc' } }),
      ]);
      const names = (files || []).filter((f) => f.name.startsWith('auto3-')).map((f) => f.name);
      let urls: Record<string, string> = {};
      if (names.length) {
        const { data: signed } = await supabase.storage.from('originals').createSignedUrls(names.map((n) => `${user!.id}/${vehicleId}/${n}`), 3600);
        urls = Object.fromEntries((signed || []).map((s, i) => [names[i], s.signedUrl || '']));
      }
      return { prep: prep as unknown as PrepRow | null, veh, names, urls };
    },
  });

  const prep = data?.prep;
  const analysis = useMemo(() => (Array.isArray(prep?.analysis) ? prep!.analysis : []), [prep]);
  useEffect(() => {
    if (!prep) return;
    setOpts({ ...AUTO3_STANDARD_PRESET, ...(prep.options || {}), video: !!prep.options?.video });
    const hasSaved = prep.selection && Object.keys(prep.selection).length > 0;
    setSel(hasSaved ? { slots: prep.selection, details: prep.detail_selection || [] } : selectReferences(analysis, SLOTS.map((s) => s.key)));
  }, [prep, analysis]);

  const brand = data?.veh?.brand || null;
  const cost = estimatePresetCredits(opts, brand, data?.veh?.title || '');
  const missing = missingRequiredSlots(sel);
  const byFile = useMemo(() => new Map(analysis.map((a) => [a.file, a])), [analysis]);
  const originals = data?.names.length || 0;

  if (!data || (!originals && !prep)) return null;

  const runAnalysis = async () => {
    setAnalyzing(true);
    try { await analyzeAuto3Originals(vehicleId); toast.success('Originale analysiert – Referenzen automatisch gewählt.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Bildanalyse fehlgeschlagen'); }
    finally { setAnalyzing(false); qc.invalidateQueries({ queryKey: auto3PrepQueryKey(vehicleId) }); }
  };

  const start = async () => {
    if (missing.length) { toast.error(`Bitte Referenz wählen für: ${missing.map((k) => SLOTS.find((s) => s.key === k)?.label).join(', ')}`); return; }
    const { error } = await supabase.from('auto3_oneshot_preparations')
      .update({ selection: sel.slots, detail_selection: sel.details, options: opts as unknown as Record<string, boolean> }).eq('vehicle_id', vehicleId);
    if (error) { toast.error('Auswahl konnte nicht gespeichert werden.'); return; }
    navigate(oneshotHandoffUrl(vehicleId));
  };

  const status = prep?.status || 'imported';
  const ready = status === 'ready_for_oneshot' || status === 'started';
  const toggleDetail = (f: string) => setSel((p) => ({ ...p, details: p.details.includes(f) ? p.details.filter((x) => x !== f) : [...p.details, f].slice(0, 10) }));

  const Opt = ({ k, label, locked, hint }: { k: keyof PresetOptions; label: string; locked?: boolean; hint?: string }) => (
    <label className="flex items-center gap-2 text-sm">
      {locked ? <Check className="w-4 h-4 text-primary" /> : <Switch checked={opts[k]} onCheckedChange={(v) => setOpts((o) => ({ ...o, [k]: v }))} />}
      {!locked && !opts[k] && <Circle className="hidden" />}
      <span>{label}</span>{hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Auto3 Standard-Aufbereitung</span>
        <Badge variant={ready ? 'default' : 'secondary'}>{preparationStatusLabel(status, prep?.originals_count || originals)}</Badge>
        <div className="flex-1" />
        {compact && ready && <Button size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)}>{expanded ? 'Weniger' : 'Auswahl prüfen'}</Button>}
        {!ready && status !== 'analyzing_originals' && (
          <Button size="sm" variant="outline" onClick={runAnalysis} disabled={analyzing}>
            {analyzing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}Originale analysieren
          </Button>
        )}
        {status === 'analyzing_originals' && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" />Analyse läuft …</span>}
      </div>
      {prep?.error && status !== 'ready_for_oneshot' && <p className="text-xs text-destructive">{prep.error}</p>}

      {ready && expanded && (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Opt k="remaster" label="Fahrzeugbilder remastern" locked />
            <Opt k="perspectives" label="Showroom-Hintergrund & Standardperspektiven" locked />
            <Opt k="banner" label="Marketing-Banner" hint="danach im Banner-Generator" />
            <Opt k="social" label="Social-Media-Set" hint="optional" />
            <Opt k="video" label="Video" hint="optional" />
          </div>

          <div>
            <p className="text-xs font-medium mb-1.5">Automatisch gewählte Referenzen (änderbar)</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SLOTS.map((slot) => {
                const f = sel.slots[slot.key];
                const a = f ? byFile.get(f) : undefined;
                return (
                  <div key={slot.key} className="space-y-1">
                    <div className="aspect-[4/3] rounded bg-muted overflow-hidden">{f && data.urls[f] ? <img src={data.urls[f]} alt={slot.label} className="w-full h-full object-cover" loading="lazy" /> : null}</div>
                    <div className="text-[11px] font-medium">{slot.label}{slot.required ? ' *' : ''}</div>
                    <select className="w-full rounded border border-border bg-background text-[11px] p-1" value={f || ''}
                      onChange={(e) => setSel((p) => { const slots = { ...p.slots }; if (e.target.value) slots[slot.key] = e.target.value; else delete slots[slot.key]; return { ...p, slots }; })}>
                      <option value="">— keine —</option>
                      {data.names.map((n, i) => { const x = byFile.get(n); return <option key={n} value={n}>{`Bild ${i + 1}${x ? ` · ${CATEGORY_LABEL[x.category]} · ${x.quality}` : ''}`}</option>; })}
                    </select>
                    {a && <div className="text-[10px] text-muted-foreground">{CATEGORY_LABEL[a.category]} · Qualität {a.quality}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-1.5">Zusätzliche Detail-Referenzen ({sel.details.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {data.names.filter((n) => !Object.values(sel.slots).includes(n)).map((n) => {
                const a = byFile.get(n); const on = sel.details.includes(n);
                return (
                  <button key={n} type="button" onClick={() => toggleDetail(n)} title={a ? `${CATEGORY_LABEL[a.category]} · ${a.quality}` : n}
                    className={`relative w-16 h-12 rounded overflow-hidden border-2 ${on ? 'border-primary' : 'border-transparent opacity-50'}`}>
                    {data.urls[n] && <img src={data.urls[n]} alt="" className="w-full h-full object-cover" loading="lazy" />}
                    {a && <span className="absolute bottom-0 inset-x-0 bg-background/80 text-[9px] leading-tight">{CATEGORY_LABEL[a.category]}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-md bg-background p-2 text-sm space-y-1">
            {cost.lines.map((l) => (
              <div key={l.key} className="flex justify-between gap-2"><span>{l.label} <span className="text-xs text-muted-foreground">({l.note})</span></span><span className="font-medium whitespace-nowrap">{l.credits} Credits</span></div>
            ))}
            <div className="flex justify-between border-t border-border pt-1 font-semibold"><span>Jetzt zu bestätigen</span><span>{cost.pipelineCredits} Credits</span></div>
            <div className="text-xs text-muted-foreground">Guthaben: {balance} Credits. Abgebucht wird erst nach Ihrer Bestätigung im nächsten Schritt.{cost.optionalCredits ? ` Optionale Marketing-Leistungen (${cost.optionalCredits} Credits laut Preisliste) werden jeweils separat bestätigt.` : ''}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={start} disabled={!!missing.length}><Zap className="w-4 h-4 mr-1.5" />Aufbereitung starten</Button>
            {missing.length > 0 && <span className="text-xs text-destructive">Pflichtperspektive fehlt: {missing.map((k) => SLOTS.find((s) => s.key === k)?.label).join(', ')}</span>}
            <span className="text-[11px] text-muted-foreground">Ergebnisse landen in der Galerie. Website-Veröffentlichung bleibt manuell.</span>
          </div>
        </>
      )}
    </div>
  );
}
