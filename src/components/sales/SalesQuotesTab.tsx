import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Plus, FileText, Send, Trash2, Euro, Car } from 'lucide-react';

interface Quote {
  id: string;
  vehicle_title: string | null;
  base_price: number | null;
  discount_amount: number | null;
  trade_in_value: number | null;
  final_price: number | null;
  financing_monthly_rate: number | null;
  financing_term_months: number | null;
  leasing_monthly_rate: number | null;
  leasing_term_months: number | null;
  valid_until: string | null;
  status: string;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Entwurf', variant: 'outline' },
  sent: { label: 'Gesendet', variant: 'default' },
  accepted: { label: 'Akzeptiert', variant: 'default' },
  rejected: { label: 'Abgelehnt', variant: 'destructive' },
  expired: { label: 'Abgelaufen', variant: 'secondary' },
};

export default function SalesQuotesTab() {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_title: '', base_price: '', discount_amount: '0', trade_in_value: '0', financing_monthly_rate: '', financing_term_months: '48', leasing_monthly_rate: '', leasing_term_months: '36', valid_until: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const loadQuotes = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('sales_quotes' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setQuotes((data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);

  const createQuote = async () => {
    if (!user) return;
    setSaving(true);
    const base = parseInt(form.base_price) || 0;
    const discount = parseInt(form.discount_amount) || 0;
    const tradeIn = parseInt(form.trade_in_value) || 0;
    const final_price = base - discount - tradeIn;
    const { error } = await supabase.from('sales_quotes' as any).insert({
      user_id: user.id, vehicle_title: form.vehicle_title, base_price: base,
      discount_amount: discount, trade_in_value: tradeIn, final_price,
      financing_monthly_rate: parseInt(form.financing_monthly_rate) || null,
      financing_term_months: parseInt(form.financing_term_months) || null,
      leasing_monthly_rate: parseInt(form.leasing_monthly_rate) || null,
      leasing_term_months: parseInt(form.leasing_term_months) || null,
      valid_until: form.valid_until || null, notes: form.notes || null, status: 'draft',
    } as any);
    if (error) toast.error('Fehler'); else { toast.success('Angebot erstellt'); setCreateOpen(false); }
    setSaving(false);
    loadQuotes();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('sales_quotes' as any).update({ status, updated_at: new Date().toISOString(), ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}) } as any).eq('id', id);
    toast.success('Status aktualisiert');
    loadQuotes();
  };

  const deleteQuote = async (id: string) => {
    await supabase.from('sales_quotes' as any).delete().eq('id', id);
    toast.success('Angebot gelöscht');
    loadQuotes();
  };

  const fmt = (v: number | null) => v != null ? `${(v).toLocaleString('de-DE')} €` : '–';

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Laden...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Angebote</h3>
          <p className="text-sm text-muted-foreground">{quotes.length} Angebote erstellt</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Neues Angebot</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Angebot erstellen</DialogTitle></DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div><Label>Fahrzeug</Label><Input value={form.vehicle_title} onChange={e => setForm(p => ({ ...p, vehicle_title: e.target.value }))} placeholder="z.B. BMW 320i Touring" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Grundpreis (€)</Label><Input type="number" value={form.base_price} onChange={e => setForm(p => ({ ...p, base_price: e.target.value }))} /></div>
                <div><Label>Rabatt (€)</Label><Input type="number" value={form.discount_amount} onChange={e => setForm(p => ({ ...p, discount_amount: e.target.value }))} /></div>
              </div>
              <div><Label>Inzahlungnahme (€)</Label><Input type="number" value={form.trade_in_value} onChange={e => setForm(p => ({ ...p, trade_in_value: e.target.value }))} /></div>
              <div className="p-2 bg-muted rounded text-sm">Endpreis: <strong>{((parseInt(form.base_price) || 0) - (parseInt(form.discount_amount) || 0) - (parseInt(form.trade_in_value) || 0)).toLocaleString('de-DE')} €</strong></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Finanzierung mtl. (€)</Label><Input type="number" value={form.financing_monthly_rate} onChange={e => setForm(p => ({ ...p, financing_monthly_rate: e.target.value }))} /></div>
                <div><Label>Laufzeit (Monate)</Label><Input type="number" value={form.financing_term_months} onChange={e => setForm(p => ({ ...p, financing_term_months: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Leasing mtl. (€)</Label><Input type="number" value={form.leasing_monthly_rate} onChange={e => setForm(p => ({ ...p, leasing_monthly_rate: e.target.value }))} /></div>
                <div><Label>Laufzeit (Monate)</Label><Input type="number" value={form.leasing_term_months} onChange={e => setForm(p => ({ ...p, leasing_term_months: e.target.value }))} /></div>
              </div>
              <div><Label>Gültig bis</Label><Input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} /></div>
              <div><Label>Notizen</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
              <Button onClick={createQuote} disabled={saving || !form.vehicle_title} className="w-full">Angebot erstellen</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="max-h-[600px]">
        {quotes.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Noch keine Angebote erstellt</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {quotes.map(q => (
              <Card key={q.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{q.vehicle_title || 'Ohne Titel'}</span>
                        <Badge variant={STATUS_LABELS[q.status]?.variant || 'outline'} className="text-xs">{STATUS_LABELS[q.status]?.label || q.status}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Grundpreis: {fmt(q.base_price)}</span>
                        {(q.discount_amount || 0) > 0 && <span>Rabatt: -{fmt(q.discount_amount)}</span>}
                        {(q.trade_in_value || 0) > 0 && <span>Inzahlungnahme: -{fmt(q.trade_in_value)}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Euro className="w-3.5 h-3.5 text-accent" />
                        <span className="text-sm font-bold text-accent">{fmt(q.final_price)}</span>
                      </div>
                      {q.financing_monthly_rate && <p className="text-xs text-muted-foreground">Finanzierung: {fmt(q.financing_monthly_rate)}/Monat × {q.financing_term_months} Mon.</p>}
                      {q.leasing_monthly_rate && <p className="text-xs text-muted-foreground">Leasing: {fmt(q.leasing_monthly_rate)}/Monat × {q.leasing_term_months} Mon.</p>}
                      {q.valid_until && <p className="text-xs text-muted-foreground">Gültig bis: {new Date(q.valid_until).toLocaleDateString('de-DE')}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Erstellt: {new Date(q.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {q.status === 'draft' && <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => updateStatus(q.id, 'sent')}><Send className="w-3 h-3 mr-1" /> Senden</Button>}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteQuote(q.id)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
