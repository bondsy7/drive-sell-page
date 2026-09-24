import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { VOLUME_OPTIONS, LOCATION_OPTIONS } from '@/lib/b2b-funnel-options';
import { appendAttribution } from '@/lib/funnel-submit';
import { trackFunnelEvent } from '@/lib/funnel-tracking';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** Kurzer Prozesscheck für Händlergruppen – 4 Felder, ohne Upload. */
export default function ProcessCheckForm() {
  const navigate = useNavigate();
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [locations, setLocations] = useState('');
  const [volume, setVolume] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);

  const onStart = () => trackFunnelEvent('process_check_started', { funnel_type: 'process_check' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!company.trim() || !EMAIL_RE.test(email.trim()) || !locations || !volume) {
      toast({ title: 'Bitte alle vier Felder ausfüllen', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const body = new FormData();
      body.append('funnel_type', 'process_check');
      body.append('company_name', company.trim());
      body.append('business_email', email.trim());
      body.append('location_count', locations);
      body.append('monthly_vehicle_volume', volume);
      body.append('company_website_confirm', honeypot);
      appendAttribution(body, 'lp_marketing_prozesscheck');
      const { data, error } = await supabase.functions.invoke('submit-b2b-lead', { body });
      const p = data as { success?: boolean; leadId?: string; token?: string; error?: string } | null;
      if (error || !p?.success) {
        let msg = p?.error;
        try {
          const ctx = (error as { context?: Response } | null)?.context;
          if (!msg && ctx && typeof ctx.json === 'function') msg = (await ctx.json())?.error;
        } catch { /* ignore */ }
        toast({ title: 'Senden nicht möglich', description: msg || 'Bitte später erneut versuchen.', variant: 'destructive' });
        return;
      }
      if (p.leadId) {
        trackFunnelEvent('generate_lead', { funnel_type: 'process_check' }, { eventId: `generate_lead:${p.leadId}`, leadId: p.leadId });
      }
      navigate(`/fahrzeug-testen/danke?lead=${p.leadId ?? ''}&t=${p.token ?? ''}&typ=prozess`);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} onFocus={onStart} noValidate className="rounded-xl border border-border bg-card p-5 text-left">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Building2 className="h-4 w-4 text-accent" aria-hidden="true" /> 15-Minuten-Prozesscheck für Gruppen
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Ohne Upload. Wir melden uns per E-Mail zur Terminabstimmung.</p>
      <div className="hidden" aria-hidden="true">
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pc-company">Unternehmen / Gruppe</Label>
          <Input id="pc-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={160} autoComplete="organization" />
        </div>
        <div>
          <Label htmlFor="pc-email">Geschäftliche E-Mail</Label>
          <Input id="pc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="pc-loc">Standorte</Label>
          <Select value={locations} onValueChange={setLocations}>
            <SelectTrigger id="pc-loc"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
            <SelectContent>{LOCATION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="pc-vol">Fahrzeuge pro Monat</Label>
          <Select value={volume} onValueChange={setVolume}>
            <SelectTrigger id="pc-vol"><SelectValue placeholder="Bitte auswählen" /></SelectTrigger>
            <SelectContent>{VOLUME_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Hinweise zur Verarbeitung: <a href="/datenschutz" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">Datenschutzerklärung</a>
      </p>
      <Button type="submit" className="mt-4 w-full sm:w-auto" disabled={sending} data-cta="prozess_check_submit">
        {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet …</> : 'Prozesscheck anfragen'}
      </Button>
    </form>
  );
}
