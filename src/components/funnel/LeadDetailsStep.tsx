import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { VOLUME_OPTIONS, LOCATION_OPTIONS, ROLE_OPTIONS } from '@/lib/b2b-funnel-options';

interface Props {
  leadId: string;
  token: string;
  askVolume: boolean;
  onDone: () => void;
}

/** Schritt 2: ergänzende Angaben zu einem bereits gespeicherten Lead. */
export default function LeadDetailsStep({ leadId, token, askVolume, onDone }: Props) {
  const [f, setF] = useState({ first_name: '', last_name: '', role: '', monthly_vehicle_volume: '', location_count: '', website: '', phone: '', note: '' });
  const [sending, setSending] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.first_name.trim() || !f.last_name.trim() || !f.role) {
      toast({ title: 'Bitte Name und Rolle angeben', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-b2b-lead-step2', { body: { leadId, token, ...f } });
      const p = data as { success?: boolean; error?: string } | null;
      if (error || !p?.success) {
        toast({ title: 'Speichern nicht möglich', description: p?.error || 'Bitte später erneut versuchen.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Danke – Angaben ergänzt' });
      onDone();
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto mt-10 max-w-3xl rounded-lg border border-accent/40 bg-card p-5 shadow-card sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Schritt 2 von 2 · optional, aber hilfreich</p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">Damit wir den Test passend vorbereiten</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="s2-fn">Vorname *</Label><Input id="s2-fn" value={f.first_name} onChange={(e) => set('first_name', e.target.value)} maxLength={80} autoComplete="given-name" /></div>
        <div><Label htmlFor="s2-ln">Nachname *</Label><Input id="s2-ln" value={f.last_name} onChange={(e) => set('last_name', e.target.value)} maxLength={80} autoComplete="family-name" /></div>
        <div className="sm:col-span-2">
          <Label htmlFor="s2-role">Rolle / Funktion *</Label>
          <Select value={f.role} onValueChange={(v) => set('role', v)}>
            <SelectTrigger id="s2-role"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {askVolume && (
          <>
            <div>
              <Label htmlFor="s2-vol">Fahrzeuge pro Monat</Label>
              <Select value={f.monthly_vehicle_volume} onValueChange={(v) => set('monthly_vehicle_volume', v)}>
                <SelectTrigger id="s2-vol"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
                <SelectContent>{VOLUME_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="s2-loc">Standorte</Label>
              <Select value={f.location_count} onValueChange={(v) => set('location_count', v)}>
                <SelectTrigger id="s2-loc"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
                <SelectContent>{LOCATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        )}
        <div><Label htmlFor="s2-web">Website</Label><Input id="s2-web" value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="www.ihr-autohaus.de" maxLength={300} autoComplete="url" /></div>
        <div><Label htmlFor="s2-tel">Telefon</Label><Input id="s2-tel" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} autoComplete="tel" /></div>
        <div className="sm:col-span-2">
          <Label htmlFor="s2-note">Worauf sollen wir besonders achten?</Label>
          <Textarea id="s2-note" rows={3} value={f.note} onChange={(e) => set('note', e.target.value.slice(0, 500))} maxLength={500} />
        </div>
      </div>
      <Button type="submit" className="mt-4" disabled={sending}>
        {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gespeichert …</> : 'Angaben speichern'}
      </Button>
    </form>
  );
}
