import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import VehicleBrandModelPicker from '@/components/VehicleBrandModelPicker';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Car, TrendingDown, Trash2, Sparkles, Loader2, Search, Tag, ChevronDown, ChevronUp, Camera } from 'lucide-react';

interface Valuation {
  id: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  mileage_km: number | null;
  condition: string | null;
  estimated_value_min: number | null;
  estimated_value_max: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  vin: string | null;
  variant: string | null;
  equipment: string[] | null;
}

const CONDITIONS = [
  { value: 'excellent', label: 'Ausgezeichnet' },
  { value: 'good', label: 'Gut' },
  { value: 'fair', label: 'Befriedigend' },
  { value: 'poor', label: 'Mangelhaft' },
];

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Entwurf', variant: 'outline' },
  sent: { label: 'Dem Kunden mitgeteilt', variant: 'default' },
  accepted: { label: 'Akzeptiert', variant: 'default' },
  rejected: { label: 'Abgelehnt', variant: 'destructive' },
};

interface FormState {
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  mileage_km: string;
  condition: string;
  estimated_value_min: string;
  estimated_value_max: string;
  notes: string;
  vin: string;
  variant: string;
  equipment: string[];
}

const EMPTY_FORM: FormState = {
  vehicle_make: '', vehicle_model: '', vehicle_year: '', mileage_km: '',
  condition: 'good', estimated_value_min: '', estimated_value_max: '',
  notes: '', vin: '', variant: '', equipment: [],
};

export default function SalesTradeInTab() {
  const { user } = useAuth();
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const vinFileRef = React.useRef<HTMLInputElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleVinPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    setOcrLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('ocr-vin', { body: { imageBase64: base64 } });
      if (data?.error === 'insufficient_credits') {
        toast.error('Nicht genügend Credits für VIN-Erkennung.');
        return;
      }
      if (!error && data?.vin) {
        const vin = data.vin.toUpperCase();
        setForm(p => ({ ...p, vin }));
        toast.success(`VIN erkannt: ${vin}`);
        // Auto-trigger lookup
        setVinLoading(true);
        try {
          const { data: lookupData, error: lookupErr } = await supabase.functions.invoke('lookup-vin', { body: { vin } });
          if (!lookupErr && !lookupData?.error) {
            const v = lookupData.vehicle;
            setForm(p => ({
              ...p,
              vehicle_make: v.brand || p.vehicle_make,
              vehicle_model: v.model || p.vehicle_model,
              variant: v.variant || p.variant,
              vehicle_year: v.year ? String(v.year) : p.vehicle_year,
              equipment: v.equipment?.length > 0 ? v.equipment : p.equipment,
            }));
            const count = v.equipment?.length || 0;
            toast.success(`Fahrzeugdaten geladen${count > 0 ? ` – ${count} Ausstattungsmerkmale` : ''}`);
          }
        } finally {
          setVinLoading(false);
        }
      } else {
        toast.warning('VIN konnte nicht erkannt werden. Bitte prüfe das Foto.');
      }
    } catch {
      toast.error('VIN-Erkennung fehlgeschlagen');
    } finally {
      setOcrLoading(false);
    }
  };

  const vinLookup = async () => {
    const vin = form.vin.trim().toUpperCase();
    if (vin.length !== 17) {
      toast.error('VIN muss 17 Zeichen lang sein');
      return;
    }
    setVinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-vin', { body: { vin } });
      if (error || data?.error) {
        toast.error(data?.error || 'VIN-Abfrage fehlgeschlagen');
        return;
      }
      const v = data.vehicle;
      setForm(p => ({
        ...p,
        vehicle_make: v.brand || p.vehicle_make,
        vehicle_model: v.model || p.vehicle_model,
        variant: v.variant || p.variant,
        vehicle_year: v.year ? String(v.year) : p.vehicle_year,
        equipment: v.equipment?.length > 0 ? v.equipment : p.equipment,
      }));
      const count = v.equipment?.length || 0;
      toast.success(`Fahrzeugdaten geladen${count > 0 ? ` – ${count} Ausstattungsmerkmale` : ''}`);
    } catch (e) {
      console.error(e);
      toast.error('VIN-Abfrage fehlgeschlagen');
    } finally {
      setVinLoading(false);
    }
  };

  const aiEstimate = async () => {
    if (!form.vehicle_make || !form.vehicle_model) {
      toast.error('Bitte Marke und Modell angeben');
      return;
    }
    setEstimating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Nicht eingeloggt');

      const equipmentInfo = form.equipment.length > 0
        ? `\nAusstattung: ${form.equipment.join(', ')}`
        : '';

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `Schätze den Inzahlungnahme-Wert für: ${form.vehicle_make} ${form.vehicle_model}${form.variant ? ` ${form.variant}` : ''}, Baujahr ${form.vehicle_year || 'unbekannt'}, ${form.mileage_km || 'unbekannt'} km, Zustand: ${form.condition}.${equipmentInfo}\nErstelle eine Bewertung.`,
            }],
          }),
        }
      );
      const data = await resp.json();
      if (data.actions?.length > 0) {
        toast.success('KI-Bewertung erstellt');
        setCreateOpen(false);
        setForm({ ...EMPTY_FORM });
        load();
      } else {
        toast.info('KI konnte keine Bewertung erstellen. Versuche es manuell.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Fehler bei der KI-Schätzung');
    } finally {
      setEstimating(false);
    }
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('trade_in_valuations' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setValuations((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('trade_in_valuations' as any).insert({
      user_id: user.id,
      vehicle_make: form.vehicle_make || null,
      vehicle_model: form.vehicle_model || null,
      vehicle_year: parseInt(form.vehicle_year) || null,
      mileage_km: parseInt(form.mileage_km) || null,
      condition: form.condition,
      estimated_value_min: parseInt(form.estimated_value_min) || null,
      estimated_value_max: parseInt(form.estimated_value_max) || null,
      notes: form.notes || null,
      vin: form.vin || null,
      variant: form.variant || null,
      equipment: form.equipment.length > 0 ? form.equipment : null,
      status: 'draft',
    } as any);
    toast.success('Bewertung erstellt');
    setCreateOpen(false);
    setForm({ ...EMPTY_FORM });
    setSaving(false);
    load();
  };

  const del = async (id: string) => {
    await supabase.from('trade_in_valuations' as any).delete().eq('id', id);
    toast.success('Gelöscht');
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('trade_in_valuations' as any).update({ status, updated_at: new Date().toISOString() } as any).eq('id', id);
    toast.success('Status aktualisiert');
    load();
  };

  const fmt = (v: number | null) => v != null ? `${v.toLocaleString('de-DE')} €` : '–';

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Laden...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Inzahlungnahme-Bewertungen</h3>
          <p className="text-sm text-muted-foreground">{valuations.length} Bewertungen</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Neue Bewertung</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Inzahlungnahme bewerten</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {/* VIN Lookup */}
              <div>
                <Label>FIN / VIN (optional)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.vin}
                    onChange={e => setForm(p => ({ ...p, vin: e.target.value.toUpperCase() }))}
                    placeholder="WVWZZZ3CZWE123456"
                    maxLength={17}
                    className="font-mono text-xs tracking-wider"
                  />
                  <input
                    ref={vinFileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleVinPhoto}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => vinFileRef.current?.click()}
                    disabled={ocrLoading || vinLoading}
                    title="VIN per Foto erkennen"
                  >
                    {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={vinLookup}
                    disabled={vinLoading || ocrLoading || form.vin.trim().length !== 17}
                    title="Fahrzeugdaten per VIN laden"
                  >
                    {vinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">VIN eingeben oder fotografieren – Ausstattung wird automatisch geladen</p>
              </div>

              <VehicleBrandModelPicker
                brand={form.vehicle_make}
                model={form.vehicle_model}
                onBrandChange={v => setForm(p => ({ ...p, vehicle_make: v, vehicle_model: '' }))}
                onModelChange={v => setForm(p => ({ ...p, vehicle_model: v }))}
                compact
              />

              {form.variant && (
                <div>
                  <Label>Variante / Bezeichnung</Label>
                  <Input value={form.variant} onChange={e => setForm(p => ({ ...p, variant: e.target.value }))} placeholder="z.B. GTI Performance" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Baujahr</Label><Input type="number" value={form.vehicle_year} onChange={e => setForm(p => ({ ...p, vehicle_year: e.target.value }))} placeholder="2020" /></div>
                <div><Label>Laufleistung (km)</Label><Input type="number" value={form.mileage_km} onChange={e => setForm(p => ({ ...p, mileage_km: e.target.value }))} placeholder="50000" /></div>
              </div>

              <div>
                <Label>Zustand</Label>
                <Select value={form.condition} onValueChange={v => setForm(p => ({ ...p, condition: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Equipment list from VIN */}
              {form.equipment.length > 0 && (
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Ausstattung ({form.equipment.length})
                  </Label>
                  <div className="mt-1.5 max-h-40 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {form.equipment.map((item, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Wert von (€)</Label><Input type="number" value={form.estimated_value_min} onChange={e => setForm(p => ({ ...p, estimated_value_min: e.target.value }))} /></div>
                <div><Label>Wert bis (€)</Label><Input type="number" value={form.estimated_value_max} onChange={e => setForm(p => ({ ...p, estimated_value_max: e.target.value }))} /></div>
              </div>

              <div><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>

              <div className="flex gap-2">
                <Button onClick={create} disabled={saving || estimating} className="flex-1">Bewertung erstellen</Button>
                <Button variant="outline" onClick={aiEstimate} disabled={estimating || saving || !form.vehicle_make || !form.vehicle_model} className="flex-1">
                  {estimating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  KI-Schätzung
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="max-h-[600px]">
        {valuations.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Noch keine Bewertungen</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {valuations.map(v => {
              const equip = Array.isArray(v.equipment) ? v.equipment : [];
              const isExpanded = expandedCards.has(v.id);
              return (
                <Card key={v.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">{v.vehicle_make} {v.vehicle_model} {v.variant || ''} {v.vehicle_year || ''}</span>
                          <Badge variant={STATUS_LABELS[v.status]?.variant || 'outline'} className="text-xs">{STATUS_LABELS[v.status]?.label || v.status}</Badge>
                        </div>
                        {v.vin && <p className="text-[10px] text-muted-foreground font-mono tracking-wider">VIN: {v.vin}</p>}
                        {v.mileage_km && <p className="text-xs text-muted-foreground">{v.mileage_km.toLocaleString('de-DE')} km • {CONDITIONS.find(c => c.value === v.condition)?.label || v.condition}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-bold">{fmt(v.estimated_value_min)} – {fmt(v.estimated_value_max)}</span>
                        </div>

                        {/* Equipment */}
                        {equip.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleExpand(v.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Tag className="w-3 h-3" />
                              <span>{equip.length} Ausstattungsmerkmale</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {equip.map((item, i) => (
                                  <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                                    {item}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {v.notes && <p className="text-xs text-muted-foreground italic mt-1">{v.notes}</p>}
                        <p className="text-xs text-muted-foreground">Erstellt: {new Date(v.created_at).toLocaleDateString('de-DE')}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {v.status === 'draft' && <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => updateStatus(v.id, 'sent')}>Mitteilen</Button>}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del(v.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
