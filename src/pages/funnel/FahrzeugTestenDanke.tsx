import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Loader2, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { supabase } from '@/integrations/supabase/client';

const STEPS = [
  { title: 'Fahrzeug und Einsatzziel prüfen', desc: 'Wir sehen uns Ihr Fahrzeugbild und Ihre Angaben zum Betrieb an.' },
  { title: 'Beispiel bzw. passenden Workflow vorbereiten', desc: 'Wir bereiten einen Ablauf vor, der zu Ihrem Bestand und Ihren Kanälen passt.' },
  { title: 'Ergebnis und mögliche Skalierung besprechen', desc: 'Gemeinsam klären wir, wie sich der Prozess auf Ihren Betrieb oder mehrere Standorte übertragen lässt.' },
];

export default function FahrzeugTestenDanke() {
  usePageMeta({
    title: 'Vielen Dank – Ihr Fahrzeug ist angekommen | autohaus.ai',
    description: 'Ihre Testanfrage ist eingegangen. Wir prüfen Fahrzeug und Einsatzziel und melden uns mit den nächsten Schritten.',
    canonicalPath: '/fahrzeug-testen/danke',
    noIndex: true,
  });

  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead');

  const [open, setOpen] = useState(false);
  const [preferredContact, setPreferredContact] = useState('');
  const [sending, setSending] = useState(false);
  const [requested, setRequested] = useState(false);

  const submitDemo = async () => {
    if (!leadId) {
      toast({ title: 'Anfrage nicht zuordenbar', description: 'Bitte senden Sie das Testformular erneut.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-b2b-demo', {
        body: { leadId, preferredContact: preferredContact.slice(0, 300) },
      });
      const payload = data as { success?: boolean; error?: string } | null;
      if (error || !payload?.success) {
        toast({ title: 'Anfrage nicht möglich', description: payload?.error || 'Bitte versuchen Sie es später erneut.', variant: 'destructive' });
        return;
      }
      setRequested(true);
      setOpen(false);
      toast({ title: 'Demo-Interesse vermerkt', description: 'Wir melden uns zur Terminabstimmung bei Ihnen.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <FunnelLayout ctaHref="/" ctaLabel="Zurück zu autohaus.ai" showMobileCta={false}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Anfrage eingegangen
        </span>
        <h1 className="mt-5 text-2xl font-bold text-foreground sm:text-3xl">
          Vielen Dank – Ihr Fahrzeug ist bei uns angekommen.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Wir prüfen Ihre Angaben und das hochgeladene Fahrzeug. Im nächsten Schritt zeigen wir Ihnen, wie
          autohaus.ai in Ihrem Händlerprozess eingesetzt werden kann.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-foreground">Die nächsten Schritte</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-xl border border-border bg-card p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-sm font-semibold text-accent">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => setOpen(true)} disabled={requested}>
            <CalendarClock className="mr-2 h-4 w-4" />
            {requested ? 'Demo-Interesse vermerkt' : '15-Minuten-Demo anfragen'}
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/">Zurück zu autohaus.ai <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>15-Minuten-Demo anfragen</DialogTitle>
            <DialogDescription>
              Wir melden uns zur Terminabstimmung. Optional können Sie uns Ihre bevorzugte Erreichbarkeit nennen.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="preferred-contact">Bevorzugte Erreichbarkeit (optional)</Label>
            <Textarea
              id="preferred-contact"
              rows={3}
              maxLength={300}
              value={preferredContact}
              onChange={(e) => setPreferredContact(e.target.value)}
              placeholder="z. B. werktags vormittags, Durchwahl …"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Abbrechen</Button>
            <Button onClick={submitDemo} disabled={sending}>
              {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet …</> : 'Demo anfragen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FunnelLayout>
  );
}
