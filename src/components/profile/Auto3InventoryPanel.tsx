import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

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

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'list' } });
    setLoading(false);
    if (error || data?.error) { toast.error(data?.error || 'Auto3-Bestand konnte nicht geladen werden.'); return; }
    setItems(data.items); setSel(new Set());
  };

  const run = async (ids: string[]) => {
    if (!ids.length) return;
    setImporting(true);
    const { data, error } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'import', externalVehicleIds: ids } });
    setImporting(false);
    if (error || data?.error) { toast.error(data?.error || 'Import fehlgeschlagen'); return; }
    const res = data.results as { externalVehicleId: string; ok: boolean; error?: string }[];
    const ok = res.filter((r) => r.ok).length;
    if (ok) toast.success(`${ok} Fahrzeug(e) übernommen – keine Pipeline gestartet, nichts veröffentlicht.`);
    res.filter((r) => !r.ok).forEach((r) => toast.error(`Auto3-ID ${r.externalVehicleId}: ${r.error}`));
    load();
  };

  const visible = useMemo(() => (items || []).filter((i) => {
    if (filter === 'open' && i.status !== 'not_imported') return false;
    if (filter === 'no_vin' && i.status !== 'no_vin') return false;
    if (filter === 'imported' && ['no_vin', 'not_imported'].includes(i.status)) return false;
    const s = `${i.brand} ${i.model} ${i.variant} ${i.internalNumber} ${i.externalVehicleId}`.toLowerCase();
    return s.includes(q.toLowerCase());
  }), [items, q, filter]);

  const importable = (i: Item) => i.vinValid && i.status === 'not_imported' && !i.conflict;
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
                </div>
                <Badge variant={i.status === 'website_live' ? 'default' : i.status === 'no_vin' ? 'outline' : 'secondary'} className="shrink-0">{STATUS_LABEL[i.status]}</Badge>
                {i.vehicleId ? (
                  <Button asChild size="sm" variant="ghost"><Link to={`/vehicle/${i.vehicleId}`}>Öffnen</Link></Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={!importable(i) || importing} onClick={() => run([i.externalVehicleId])}>In autohaus.ai übernehmen</Button>
                )}
              </li>
            ))}
            {!visible.length && <li className="p-3 text-xs text-muted-foreground">Keine Fahrzeuge für diesen Filter.</li>}
          </ul>
          <p className="text-[11px] text-muted-foreground">Übernehmen legt nur die Fahrzeugakte mit Auto3-Originalbildern an. Es startet keine Aufbereitung und es wird nichts veröffentlicht.</p>
        </>
      )}
    </div>
  );
}
