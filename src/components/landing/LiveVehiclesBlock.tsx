import React, { useEffect, useMemo, useState } from 'react';
import { Car, Loader2, RefreshCw, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_LIVE_INVENTORY,
  matchesLiveFilter,
  resolveLiveVehicles,
  type LiveInventoryConfig,
  type LiveVehicle,
} from '@/lib/live-inventory';
import { fetchLiveInventory } from '@/lib/live-inventory-fetch';
import { useLiveVehicleCardDesign } from '@/hooks/useLiveVehicleCardDesign';
import { useDealerBanks } from '@/hooks/useDealerBanks';
import { findFinanceGaps } from '@/lib/finance-footnotes';

// Re-exported so existing importers keep working.
export { DEFAULT_LIVE_INVENTORY, matchesLiveFilter } from '@/lib/live-inventory';
export type { LiveInventoryConfig, LiveVehicle } from '@/lib/live-inventory';

const ALL = '__all__';
const NONE = '__none__';
const OTHER = '__other__';

interface Props {
  value: LiveInventoryConfig;
  onChange: (v: LiveInventoryConfig) => void;
  disabled?: boolean;
  /** Seitenmarke aus Schritt 1 – wird beim Aktivieren als Vorschlag übernommen. */
  suggestedBrand?: string;
}

const LiveVehiclesBlock: React.FC<Props> = ({ value, onChange, disabled, suggestedBrand }) => {
  const { data: cardDesign } = useLiveVehicleCardDesign();
  const [items, setItems] = useState<LiveVehicle[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { banks } = useDealerBanks();
  const profileBankNames = useMemo(() => [...new Set(banks.filter(b => b.bank_type === 'financing' || b.bank_type === 'leasing').map(b => b.bank_name.trim()).filter(Boolean))], [banks]);
  const [customBank, setCustomBank] = useState(false);
  const set = (p: Partial<LiveInventoryConfig>) => onChange({ ...value, cardDesign: cardDesign || undefined, ...p });

  const load = async () => {
    setLoading(true); setError(null);
    const res = await fetchLiveInventory();
    setLoading(false);
    if (res.error) { setError(res.error); return; }
    setItems(res.items);
  };

  useEffect(() => { if (value.enabled && !items && !loading) load(); /* eslint-disable-next-line */ }, [value.enabled]);

  // Seitenmarke als Vorschlag übernehmen, wenn sie im Bestand vorkommt
  useEffect(() => {
    if (!items || value.brand || !suggestedBrand) return;
    const hit = items.find(v => (v.brand || '').toLowerCase() === suggestedBrand.toLowerCase());
    if (hit?.brand) set({ brand: hit.brand });
    // eslint-disable-next-line
  }, [items]);

  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of items || []) if (v.brand) m.set(v.brand, (m.get(v.brand) || 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
  }, [items]);

  const models = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of items || []) {
      if (!v.model || (value.brand && v.brand !== value.brand)) continue;
      m.set(v.model, (m.get(v.model) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
  }, [items, value.brand]);

  const filtered = useMemo(() => (items || []).filter(v => matchesLiveFilter(v, value)), [items, value]);
  const gaps = useMemo(() => findFinanceGaps(resolveLiveVehicles(items || [], { ...value, cardDesign: cardDesign || value.cardDesign }), { ...value, cardDesign: cardDesign || value.cardDesign }), [items, value, cardDesign]);
  const selected = new Set(value.selectedIds);
  const shownCount = value.mode === 'manual' ? value.selectedIds.length : Math.min(filtered.length, value.maxItems);

  const toggle = (id: string) => {
    const next = selected.has(id) ? value.selectedIds.filter(x => x !== id) : [...value.selectedIds, id];
    set({ selectedIds: next });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-bold">3</span>
          Live-Fahrzeuge
          <span className="text-xs font-normal text-muted-foreground">(optional)</span>
        </div>
        <Switch checked={value.enabled} onCheckedChange={(c) => set({ enabled: c })} disabled={disabled} aria-label="Live-Fahrzeuge anzeigen" />
      </div>
      <p className="text-xs text-muted-foreground">
        Zeigt auf der Landingpage einen Mini-Fahrzeugshop mit Fahrzeugen aus Ihrem echten Bestand. Gespeichert wird die Auswahl – die Fahrzeuge bleiben dadurch aktuell, verkaufte verschwinden automatisch.
      </p>

      {value.enabled && (
        <>
          {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Bestand wird geladen …</div>}
          {error && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground space-y-2">
              <p>{error}</p>
              <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3 h-3 mr-1" />Erneut versuchen</Button>
            </div>
          )}

          {items && (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{items.length} Fahrzeuge im Live-Bestand</span>
                <button type="button" onClick={load} className="flex items-center gap-1 hover:text-foreground"><RefreshCw className="w-3 h-3" />Aktualisieren</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['filter', 'manual'] as const).map(m => (
                  <button key={m} type="button" disabled={disabled} onClick={() => set({ mode: m })}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${value.mode === m ? 'border-accent bg-accent/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40'}`}>
                    <strong className="block">{m === 'filter' ? 'Automatisch nach Filter' : 'Fahrzeuge einzeln wählen'}</strong>
                    {m === 'filter' ? 'Neue passende Fahrzeuge erscheinen automatisch' : 'Nur die angehakten Fahrzeuge'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Marke</label>
                  <Select value={value.brand || ALL} onValueChange={(b) => set({ brand: b === ALL ? '' : b, model: '' })} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Alle Marken</SelectItem>
                      {brands.map(([b, n]) => <SelectItem key={b} value={b}>{b} ({n})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Modell</label>
                  <Select value={value.model || ALL} onValueChange={(m) => set({ model: m === ALL ? '' : m })} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Alle Modelle</SelectItem>
                      {models.map(([m, n]) => <SelectItem key={m} value={m}>{m} ({n})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Zustand</label>
                  <Select value={value.condition} onValueChange={(c) => set({ condition: c as LiveInventoryConfig['condition'] })} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Neu & gebraucht</SelectItem>
                      <SelectItem value="new">Neuwagen</SelectItem>
                      <SelectItem value="used">Gebrauchtwagen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <label className="text-xs font-medium text-muted-foreground">Darstellung</label>
                  <Select value={value.layout} onValueChange={(l) => set({ layout: l as LiveInventoryConfig['layout'] })} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slider">Slider</SelectItem>
                      <SelectItem value="grid">Raster</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {value.mode === 'filter' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Max. Fahrzeuge</label>
                    <Select value={String(value.maxItems)} onValueChange={(n) => set({ maxItems: Number(n) })} disabled={disabled}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{[4, 6, 8, 12, 16, 24].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className={`space-y-1.5 ${value.mode === 'filter' ? '' : 'col-span-2'}`}>
                  <label className="text-xs font-medium text-muted-foreground">Überschrift</label>
                  <Input value={value.title} maxLength={120} onChange={e => set({ title: e.target.value })} disabled={disabled} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Bank für Finanzierungsangaben</label>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={profileBankNames.includes(value.financeBank || '') ? value.financeBank! : (value.financeBank ? OTHER : NONE)}
                    onValueChange={(b) => { if (b === OTHER) { setCustomBank(true); set({ financeBank: '' }); } else { setCustomBank(false); set({ financeBank: b === NONE ? '' : b }); } }} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Keine Bank gewählt</SelectItem>
                      {profileBankNames.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      <SelectItem value={OTHER}>Andere Bank eingeben …</SelectItem>
                    </SelectContent>
                  </Select>
                  {(customBank || (value.financeBank && !profileBankNames.includes(value.financeBank))) && (
                    <Input placeholder="Name und Anschrift der Bank" value={value.financeBank || ''} maxLength={200} onChange={e => set({ financeBank: e.target.value })} disabled={disabled} />
                  )}
                </div>
              </div>

              {gaps.length > 0 && (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs text-foreground space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="w-3.5 h-3.5" />Bei {gaps.length} Fahrzeug{gaps.length === 1 ? '' : 'en'} wird die Monatsrate nicht angezeigt</p>
                  <p className="text-muted-foreground">Für eine rechtssichere Rate (§ 17 PAngV) fehlen Angaben. Preis und Fahrzeug werden trotzdem gezeigt.</p>
                  <ul className="max-h-40 overflow-y-auto space-y-0.5">
                    {gaps.map(g => <li key={g.vehicleId}><strong>{g.title}{g.internalNumber ? ` (Nr. ${g.internalNumber})` : ''}:</strong> fehlt {g.missing.join(', ')}</li>)}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {value.mode === 'manual' ? `${value.selectedIds.length} ausgewählt` : `${filtered.length} passende Fahrzeuge · ${shownCount} werden gezeigt`}
                  </span>
                  {value.mode === 'manual' && filtered.length > 0 && (
                    <div className="flex gap-3 text-muted-foreground">
                      <button type="button" className="hover:text-foreground" onClick={() => set({ selectedIds: [...new Set([...value.selectedIds, ...filtered.map(v => v.externalVehicleId)])] })}>Alle markieren</button>
                      <button type="button" className="hover:text-foreground" onClick={() => set({ selectedIds: [] })}>Auswahl leeren</button>
                    </div>
                  )}
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {filtered.length === 0 && <p className="p-4 text-xs text-muted-foreground">Keine Fahrzeuge für diese Auswahl im Bestand.</p>}
                  {filtered.map((v, idx) => {
                    const isSel = selected.has(v.externalVehicleId);
                    const inShow = value.mode === 'manual' ? isSel : idx < value.maxItems;
                    return (
                      <button key={v.externalVehicleId} type="button" disabled={disabled || value.mode !== 'manual'}
                        onClick={() => toggle(v.externalVehicleId)}
                        className={`w-full flex items-center gap-3 p-2 text-left transition-colors ${value.mode === 'manual' ? 'hover:bg-muted/40 cursor-pointer' : 'cursor-default'} ${inShow ? '' : 'opacity-50'}`}>
                        {value.mode === 'manual' && (isSel ? <CheckSquare className="w-4 h-4 text-accent shrink-0" /> : <Square className="w-4 h-4 text-muted-foreground shrink-0" />)}
                        <div className="w-16 h-12 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                          {v.thumbnail ? <img src={v.thumbnail} alt={`${v.brand ?? ''} ${v.model ?? ''}`} loading="lazy" className="w-full h-full object-cover" /> : <Car className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">{[v.brand, v.model].filter(Boolean).join(' ')}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{v.variant}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {[v.used === false ? 'Neuwagen' : v.used ? 'Gebraucht' : null, v.year, v.mileage != null ? `${v.mileage.toLocaleString('de-DE')} km` : null].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-foreground">{v.priceEur ? `${v.priceEur.toLocaleString('de-DE')} €` : 'Auf Anfrage'}</p>
                          {v.monthlyRate && <p className="text-[11px] text-muted-foreground">ab {v.monthlyRate.toLocaleString('de-DE')} €/Monat</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LiveVehiclesBlock;
