import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Building2, CalendarCheck, CalendarDays, Check, CheckCircle2, ClipboardList, Home, Loader2,
  Mail, ShieldCheck, Sparkles, Users, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from '@/hooks/use-toast';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { supabase } from '@/integrations/supabase/client';
import LeadDetailsStep from '@/components/funnel/LeadDetailsStep';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { ROLE_OPTIONS } from '@/lib/b2b-funnel-options';

/** Calendly-Terminseite – Farben an das Designsystem angepasst (Primär #00A98F). */
const CALENDLY_URL =
  'https://calendly.com/autohaus-info/30min?hide_event_type_details=1&hide_gdpr_banner=1&hide_landing_page_details=1&primary_color=00a98f&text_color=182430&background_color=ffffff';

const TRUST = [
  { icon: Zap, title: 'Schnell & unkompliziert', desc: 'Nur 15 Minuten Ihrer Zeit' },
  { icon: Users, title: 'Persönlich mit Produktexperten', desc: 'Individuell auf Ihren Betrieb' },
  { icon: ShieldCheck, title: '100 % unverbindlich', desc: 'Ohne Verpflichtungen' },
];

const AGENDA = [
  { title: 'Beispielbild & Qualitätsniveau', desc: 'Wir zeigen Ihnen ein konkretes Vorher-Nachher-Beispiel mit Ihrem eingereichten Fahrzeug.' },
  { title: 'Empfohlener Ablauf für Website, Marktplätze & Social Media', desc: 'Sie sehen, wie autohaus.ai in Ihre bestehenden Prozesse passt – mit minimalem Aufwand für Ihr Team.' },
  { title: 'Nächster sinnvoller Schritt für Ihren Bestand', desc: 'Gemeinsam klären wir, wie Sie schnell starten und den größten Nutzen für Ihr Autohaus erzielen.' },
];

const NEXT = [
  { title: 'Fahrzeug und Ziel prüfen', desc: 'Wir analysieren Ihr Fahrzeugbild, Ihre Angaben und Ihre Ziele für professionelle Fahrzeugbilder.' },
  { title: 'Beispiel & Workflow vorbereiten', desc: 'Wir erstellen passende Bildbeispiele und zeigen Ihnen live, wie autohaus.ai für Ihr Autohaus arbeitet.' },
  { title: 'Ergebnisse besprechen & nächsten Schritt festlegen', desc: 'In der Präsentation zeigen wir die Ergebnisse und wie Sie autohaus.ai optimal einsetzen können.' },
];

const FAQ = [
  { q: 'Wie lange dauert die Demo?', a: 'Die Online-Präsentation dauert rund 15 Minuten – kompakt und auf Ihren Betrieb zugeschnitten.' },
  { q: 'Wer nimmt am Termin teil?', a: 'Ein Produktexperte von autohaus.ai. Von Ihrer Seite gern alle, die mit Fahrzeugvermarktung zu tun haben.' },
  { q: 'Was brauche ich für den Termin?', a: 'Nur einen Rechner mit Internetzugang. Den Zugangslink erhalten Sie nach der Buchung per E-Mail.' },
  { q: 'Ist die Demo wirklich unverbindlich?', a: 'Ja. Die Präsentation ist kostenlos und verpflichtet zu nichts.' },
  { q: 'Kann ich den Termin später verschieben?', a: 'Ja, über den Link in Ihrer Bestätigungs-E-Mail können Sie den Termin jederzeit verschieben oder absagen.' },
];

type Details = { first_name: string; last_name: string; role: string; phone: string; website: string };

declare global {
  interface Window { Calendly?: { initInlineWidget: (o: { url: string; parentElement: HTMLElement }) => void } }
}

function CalendlyInline({ prefillName }: { prefillName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!active) return;
    const url = prefillName ? `${CALENDLY_URL}&name=${encodeURIComponent(prefillName)}` : CALENDLY_URL;
    const init = () => {
      if (!ref.current || !window.Calendly) return;
      ref.current.innerHTML = '';
      window.Calendly.initInlineWidget({ url, parentElement: ref.current });
    };
    if (window.Calendly) { init(); return; }
    let s = document.querySelector<HTMLScriptElement>('script[data-calendly]');
    if (!s) {
      s = document.createElement('script');
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      s.dataset.calendly = '1';
      document.body.appendChild(s);
    }
    s.addEventListener('load', init);
    return () => s?.removeEventListener('load', init);
  }, [prefillName, active]);
  if (!active) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg bg-muted/40 p-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Der Terminkalender wird von Calendly bereitgestellt. Beim Laden werden Daten an Calendly übertragen – mehr dazu in der{' '}
          <Link to="/datenschutz" className="underline hover:text-accent">Datenschutzerklärung</Link>.
        </p>
        <Button type="button" onClick={() => setActive(true)} data-cta="calendly_laden">Kalender laden</Button>
      </div>
    );
  }
  return <div ref={ref} className="h-[700px] min-w-[300px] overflow-hidden rounded-lg" aria-label="Terminkalender" />;
}

const Card = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={`rounded-xl border border-border bg-card shadow-card ${className}`}>{children}</div>
);

export default function FahrzeugTestenDanke() {
  usePageMeta({
    title: 'Fast geschafft – 15-Minuten-Demo buchen | autohaus.ai',
    description: 'Ihre Testanfrage ist eingegangen. Buchen Sie jetzt Ihre kostenlose 15-Minuten-Online-Präsentation von autohaus.ai.',
    canonicalPath: '/fahrzeug-testen/danke',
    noIndex: true,
  });

  const [searchParams] = useSearchParams();
  // Lead-ID und Token einmalig übernehmen, dann aus der Adresse entfernen (nie an Dritte)
  const [leadId] = useState(() => searchParams.get('lead'));
  const [token] = useState(() => searchParams.get('t'));
  const [isProcessCheck] = useState(() => searchParams.get('typ') === 'prozess');
  useEffect(() => {
    stripSensitiveParams();
    trackMetaPageView();
  }, []);
  const [details, setDetails] = useState<Details | null>(null);
  const [booked, setBooked] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailRequested, setEmailRequested] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== 'https://calendly.com') return;
      if ((e.data as { event?: string })?.event === 'calendly.event_scheduled') {
        setBooked(true);
        trackFunnelEvent('demo_requested', { method: 'calendly' }, { eventId: `demo_requested:${leadId ?? 'anon'}`, leadId: leadId ?? undefined });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [leadId]);

  const requestByEmail = async () => {
    if (!leadId) {
      toast({ title: 'Anfrage nicht zuordenbar', description: 'Bitte senden Sie das Testformular erneut.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-b2b-demo', {
        body: { leadId, preferredContact: 'Ergebnisse lieber per E-Mail' },
      });
      const payload = data as { success?: boolean; error?: string } | null;
      if (error || !payload?.success) {
        toast({ title: 'Anfrage nicht möglich', description: payload?.error || 'Bitte versuchen Sie es später erneut.', variant: 'destructive' });
        return;
      }
      setEmailRequested(true);
      trackFunnelEvent('demo_requested', { method: 'email' }, { eventId: `demo_requested:${leadId}`, leadId });
      toast({ title: 'Vermerkt', description: 'Wir senden Ihnen ein persönliches Beispiel per E-Mail.' });
    } finally {
      setSending(false);
    }
  };

  const roleLabel = details ? ROLE_OPTIONS.find((r) => r.value === details.role)?.label : '';
  const fullName = details ? `${details.first_name} ${details.last_name}`.trim() : undefined;

  const StepBar = (
    <div className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1120px] items-center justify-center gap-3 px-4 py-4 text-xs font-medium sm:px-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="h-4 w-4" /></span>
        <span className="hidden text-muted-foreground sm:inline">Daten eingeben</span>
        <span className="h-px w-8 bg-border sm:w-12" />
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${booked ? 'bg-accent text-accent-foreground' : 'bg-foreground text-background'}`}>{booked ? <Check className="h-4 w-4" /> : 2}</span>
        <span className="hidden text-foreground sm:inline">Termin buchen</span>
        <span className="h-px w-8 bg-border sm:w-12" />
        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${booked ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>3</span>
        <span className={`hidden sm:inline ${booked ? 'text-foreground' : 'text-muted-foreground'}`}>Bestätigung</span>
      </div>
    </div>
  );

  const FaqAndCta = (
    <>
      <section className="mx-auto grid max-w-[1120px] gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Häufige Fragen</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-foreground">Noch Fragen zum Termin?</h2>
          <p className="mt-2 text-sm text-muted-foreground">Hier finden Sie Antworten auf die häufigsten Fragen zur Demo.</p>
        </div>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q} className="rounded-lg border border-border bg-card px-4 shadow-card last:border-b">
              <AccordionTrigger className="py-3 text-sm font-medium hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Testen Sie autohaus.ai mit einem Fahrzeug aus Ihrem Bestand.</h2>
            <p className="mt-2 max-w-xl text-sm opacity-90">Ein Fahrzeugfoto, wenige Angaben – und Sie erhalten professionelle Fahrzeugbilder, die überzeugen.</p>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <Button asChild size="lg" variant="secondary">
              <a href={booked ? '/' : '#termin'}>{booked ? 'Zur Startseite' : 'Jetzt Demo-Termin sichern'} <ArrowRight className="ml-2 h-4 w-4" /></a>
            </Button>
            <div className="flex flex-wrap gap-4 text-xs opacity-90">
              {['Schnell', 'Unverbindlich', 'Persönlich mit Produktexperten'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );

  if (booked) {
    return (
      <FunnelLayout ctaHref="/" ctaLabel="Zurück zu autohaus.ai" showMobileCta={false}>
        {StepBar}
        <section className="mx-auto grid max-w-[1120px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="h-4 w-4" /></span>
              Termin erfolgreich gebucht
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">Vielen Dank – Ihr Demo-Termin ist bestätigt.</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
              Wir haben Ihr Fahrzeugbild und Ihre Angaben erhalten. Die Bestätigung mit Zugangslink zur Online-Präsentation erhalten Sie per E-Mail. Unser Team bereitet sich gezielt auf Ihren Betrieb vor.
            </p>
            <Button asChild size="lg" variant="outline" className="mt-6"><Link to="/">Zurück zu autohaus.ai <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"><CalendarCheck className="h-5 w-5" /></span>
                <h2 className="font-semibold text-foreground">Ihr Demo-Termin</h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"><CheckCircle2 className="h-3.5 w-3.5" />Bestätigt</span>
            </div>
            <ul className="mt-5 space-y-4 text-sm">
              <li className="flex gap-3"><CalendarDays className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Datum & Uhrzeit</p><p className="font-medium">Siehe Bestätigungs-E-Mail</p></div></li>
              <li className="flex gap-3"><Sparkles className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Format</p><p className="font-medium">15-Minuten-Online-Präsentation</p><p className="text-xs text-muted-foreground">Den Link erhalten Sie per E-Mail.</p></div></li>
              {fullName && <li className="flex gap-3"><Users className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Ansprechpartner</p><p className="font-medium">{fullName}</p></div></li>}
            </ul>
          </Card>
        </section>
        <section className="bg-secondary/45 py-14">
          <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Ihr Weg zum Erfolg</p>
            <h2 className="mt-2 font-display text-3xl font-bold text-foreground">So geht es jetzt weiter</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {NEXT.map((s, i) => (
                <li key={s.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 font-display text-lg font-bold text-accent">{i + 1}</span>
                  <p className="mt-4 font-semibold text-foreground">{s.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </li>
              ))}
            </ol>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card className="flex gap-4 p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Home className="h-5 w-5" /></span>
                <div><p className="font-semibold">Zur Hauptseite</p><p className="mt-1 text-sm text-muted-foreground">Entdecken Sie alle Funktionen und Beispiele von autohaus.ai.</p><Link to="/" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">Zur Startseite <ArrowRight className="h-4 w-4" /></Link></div>
              </Card>
              <Card className="flex gap-4 p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><Mail className="h-5 w-5" /></span>
                <div><p className="font-semibold">Fragen vor dem Termin?</p><p className="mt-1 text-sm text-muted-foreground">Schreiben Sie uns – wir antworten schriftlich.</p><a href="mailto:info@breadcrumb.de" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">info@breadcrumb.de <ArrowRight className="h-4 w-4" /></a></div>
              </Card>
            </div>
          </div>
        </section>
        {FaqAndCta}
      </FunnelLayout>
    );
  }

  return (
    <FunnelLayout ctaHref="/" ctaLabel="Zurück zu autohaus.ai" showMobileCta={false}>
      {StepBar}
      <section className="mx-auto max-w-[1120px] px-4 pt-10 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Nur noch ein kurzer Schritt</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          Fast geschafft – buchen Sie jetzt Ihre 15-Minuten-Demo.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Wir zeigen Ihnen ein konkretes Beispiel-Ergebnis mit Ihrem Fahrzeug und wie autohaus.ai in Ihren bestehenden Ablauf für Website, Marktplätze und Social Media passt.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-center gap-3">
              <t.icon className="h-7 w-7 shrink-0 text-accent" />
              <div><p className="text-sm font-semibold text-foreground">{t.title}</p><p className="text-xs text-muted-foreground">{t.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-xl font-bold text-foreground">Ihre Anfrage im Überblick</h2>

          <div className="mt-5 flex gap-4 border-b border-border pb-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><CheckCircle2 className="h-5 w-5" /></span>
            <div><p className="text-sm font-semibold text-foreground">Fahrzeugbild & Ziele erhalten</p><p className="text-sm text-muted-foreground">Ihr Testfahrzeug liegt uns vor und wird für die Demo vorbereitet.</p></div>
          </div>

          <div className="flex gap-4 border-b border-border py-5">
            <Building2 className="mt-1 h-6 w-6 shrink-0 text-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Ihre Kontaktdaten</p>
              {details ? (
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  <p className="text-foreground">{fullName}</p>
                  {roleLabel && <p>{roleLabel}</p>}
                  {details.phone && <p>{details.phone}</p>}
                  {details.website && <p>{details.website}</p>}
                  <p className="inline-flex items-center gap-1 pt-1 text-accent"><Check className="h-4 w-4" />Angaben vollständig</p>
                </div>
              ) : leadId && token ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">Vervollständigen Sie Ihre Angaben – so bereiten wir die Präsentation gezielt auf Ihren Betrieb vor.</p>
                  <LeadDetailsStep
                    leadId={leadId}
                    token={token}
                    askVolume={!isProcessCheck}
                    hideHeader
                    className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-4"
                    onDone={(d) => {
                      setDetails(d);
                      trackFunnelEvent('lead_details_completed', { funnel_type: isProcessCheck ? 'process_check' : 'vehicle_test' }, { eventId: `lead_details_completed:${leadId}`, leadId: leadId ?? undefined });
                    }}
                  />
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Ihre Angaben wurden übermittelt.</p>
              )}
            </div>
          </div>

          <div className="flex gap-4 py-5">
            <ClipboardList className="mt-1 h-6 w-6 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold text-foreground">Das erwartet Sie im Termin</p>
              <ol className="mt-3 space-y-4">
                {AGENDA.map((a, i) => (
                  <li key={a.title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">{i + 1}</span>
                    <div><p className="text-sm font-semibold text-foreground">{a.title}</p><p className="text-sm text-muted-foreground">{a.desc}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-lg bg-accent/10 p-5">
            <ShieldCheck className="h-8 w-8 shrink-0 text-accent" />
            <div><p className="text-sm font-semibold text-foreground">Kein Verkaufsgespräch ohne Mehrwert.</p><p className="text-sm text-muted-foreground">Kompakt, praxisnah, auf Ihren Betrieb zugeschnitten.</p></div>
          </div>
        </Card>

        <Card className="p-6" >
          <div id="termin" className="flex gap-3 scroll-mt-24">
            <CalendarDays className="h-7 w-7 shrink-0 text-accent" />
            <div><h2 className="font-semibold text-foreground">Termin für Ihre 15-Minuten-Demo buchen</h2><p className="text-sm text-muted-foreground">Wählen Sie einfach einen passenden Termin in unserem Kalender aus.</p></div>
          </div>
          <div className="mt-5 rounded-lg border border-border">
            <CalendlyInline prefillName={fullName} />
          </div>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />oder<span className="h-px flex-1 bg-border" /></div>
          <button
            type="button"
            onClick={requestByEmail}
            disabled={sending || emailRequested}
            className="flex w-full items-center gap-4 rounded-lg border border-accent/50 p-4 text-left transition-colors hover:bg-accent/5 disabled:opacity-70"
          >
            {sending ? <Loader2 className="h-6 w-6 animate-spin text-accent" /> : <Mail className="h-6 w-6 text-foreground" />}
            <div>
              <p className="text-sm font-semibold text-foreground">{emailRequested ? 'Vermerkt – wir melden uns per E-Mail' : 'Lieber Ergebnisse per E-Mail erhalten'}</p>
              <p className="text-xs text-muted-foreground">Wir senden Ihnen ein persönliches Beispiel inklusive Empfehlungen.</p>
            </div>
          </button>
        </Card>
      </section>

      {FaqAndCta}
    </FunnelLayout>
  );
}
