import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Car, Camera, Images, Megaphone, CheckCircle2, AlertTriangle,
  RotateCcw, Video, FileText, Plug, Building2, Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';

const TEST_URL = '/fahrzeug-testen?source=marketing';

const FLOW = [
  { icon: Car, title: 'Fahrzeug kommt an', desc: 'Der Prozess startet direkt bei der Fahrzeugannahme.' },
  { icon: Camera, title: 'Foto & Daten', desc: 'Aufnahmen und Fahrzeugdaten werden einmalig erfasst.' },
  { icon: Images, title: 'Professionelle Bilder', desc: 'Einheitliche Fahrzeugbilder für alle Ausspielwege.' },
  { icon: Megaphone, title: 'Kanäle bespielen', desc: 'Banner, Social, Video, Angebotsseiten und 360°-Ansicht.' },
];

const PROBLEMS = [
  'Manuelle Medienbrüche zwischen Einkauf, Aufbereitung und Marketing',
  'Unterschiedliche Bild- und Contentqualität je Standort',
  'Hoher Agentur- und Personalaufwand für wiederkehrende Aufgaben',
  'Fahrzeuge stehen zu lange ohne vollständigen Online-Auftritt',
];

const ROLES = [
  { title: 'Gebrauchtwagenleitung', desc: 'Fahrzeuge schneller und vollständig online bringen, ohne auf externe Dienstleister zu warten.' },
  { title: 'Marketing & Digital', desc: 'Einheitliche Bildsprache und wiederverwendbare Assets für alle Kanäle.' },
  { title: 'Geschäftsführung', desc: 'Ein nachvollziehbarer Prozess statt individueller Insellösungen je Betrieb.' },
  { title: 'Autohausgruppen', desc: 'Gleicher Standard über mehrere Standorte hinweg – zentral steuerbar.' },
];

const MODULES = [
  { icon: Images, title: 'Fahrzeugbilder', desc: 'Einheitliche Außen- und Innenaufnahmen aus vorhandenen Fotos.' },
  { icon: RotateCcw, title: '360°-Ansicht', desc: 'Interaktive Rundumansicht auf Basis derselben Aufnahmen.' },
  { icon: Megaphone, title: 'Banner', desc: 'Werbemittel in gängigen Formaten für Social Media und Website.' },
  { icon: Video, title: 'Video', desc: 'Kurze Fahrzeugvideos für Reels, Stories und Portale.' },
  { icon: FileText, title: 'Angebots- & Landingpages', desc: 'Fahrzeugseiten inklusive Pflichtangaben und Kontaktstrecke.' },
  { icon: Plug, title: 'Integrationen & API', desc: 'Anbindung an bestehende Systeme über die vorhandenen Schnittstellen.' },
];

const INTEGRATIONS = [
  { title: 'API', desc: 'Programmatischer Zugriff auf Fahrzeuge und Ergebnisse.' },
  { title: 'WordPress', desc: 'Einbindung erzeugter Fahrzeugseiten in bestehende Websites.' },
  { title: 'FTP / SFTP & Embed', desc: 'Automatisierte Übergabe von Medien sowie Einbettung per Embed-Skript.' },
];

const FAQ = [
  { q: 'Lässt sich der Prozess über mehrere Betriebe ausrollen?', a: 'Ja. Der Ablauf ist für jeden Standort identisch, sodass die Ergebnisse vergleichbar bleiben.' },
  { q: 'Können bestehende Systeme angebunden werden?', a: 'Autohaus.ai bietet eine API sowie Übergabewege per WordPress, FTP/SFTP und Embed. Welche Variante sinnvoll ist, klären wir anhand Ihres Setups.' },
  { q: 'Wer erstellt die Inhalte im Betrieb?', a: 'Die Aufnahmen entstehen im Betrieb, die Verarbeitung übernimmt Autohaus.ai. Zusätzliche Fotografie- oder Bildbearbeitungskenntnisse sind nicht erforderlich.' },
  { q: 'Wie starten wir am besten?', a: 'Mit einem echten Fahrzeug aus Ihrem Bestand. Daran lässt sich der Nutzen für Ihren konkreten Prozess am schnellsten beurteilen.' },
  { q: 'Gibt es feste Bearbeitungszeiten?', a: 'Wir nennen bewusst keine pauschalen Zeitangaben. Im Testlauf besprechen wir realistische Durchlaufzeiten für Ihren Bestand.' },
];

export default function AutohausMarketing() {
  usePageMeta({
    title: 'Fahrzeugmarketing für Autohäuser | Autohaus.ai',
    description: 'Ein Prozess von der Fahrzeugankunft bis zum fertigen Online-Auftritt: Bilder, 360°, Banner, Video und Angebotsseiten für Autohäuser und Händlergruppen.',
    canonicalPath: '/autohaus-marketing',
  });

  useEffect(() => { captureAttribution('lp_marketing'); }, []);

  return (
    <FunnelLayout
      ctaHref={TEST_URL}
      ctaLabel="Mit einem Fahrzeug testen"
      anchors={[{ href: '#workflow', label: 'So funktioniert es' }, { href: '#module', label: 'Funktionen' }]}
    >
      <section className="border-b border-border/60 bg-card/30">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Fahrzeugmarketing für Autohäuser</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
            Ein Fahrzeug. Ein Prozess. Alle Marketingkanäle.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Autohaus.ai verbindet Fahrzeugbilder, Content und digitale Vermarktung in einem skalierbaren
            Workflow – vom eintreffenden Fahrzeug bis zum fertigen Online-Auftritt.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to={TEST_URL}>Mit einem Fahrzeug testen <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#workflow">Workflow ansehen</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Für gewerbliche Fahrzeughändler · unverbindlicher Test · eigenes Fahrzeug verwenden
          </p>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Der Workflow im Überblick</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {FLOW.map((f, i) => (
            <li key={f.title} className="relative rounded-xl border border-border bg-card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-semibold text-muted-foreground">Schritt {i + 1}</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Problem */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Wo größere Händlergruppen Zeit verlieren</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li key={p} className="flex gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rollen */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Nutzen je Verantwortungsbereich</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ROLES.map((r) => (
            <article key={r.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">{r.title}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{r.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Module */}
      <section id="module" className="border-y border-border/60 bg-card/30 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Modulare Funktionen</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <article key={m.title} className="rounded-xl border border-border bg-card p-5">
                <m.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">{m.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{m.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Skalierung + Integrationen */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <Network className="h-5 w-5 text-accent" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">Ein Prozess für einen Standort oder viele Betriebe</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Der Ablauf bleibt identisch, unabhängig davon, ob ein Betrieb oder eine Gruppe damit arbeitet.
              Dadurch bleibt die Qualität vergleichbar und neue Standorte lassen sich ohne eigenen Sonderweg anbinden.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm text-foreground">
              <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
              Gedacht für gewerbliche Händler – nicht für private Fahrzeugverkäufe.
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Integrationen</h2>
            <ul className="mt-4 space-y-3">
              {INTEGRATIONS.map((i) => (
                <li key={i.title} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-semibold text-foreground">{i.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Fragen größerer Händlergruppen</h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm font-semibold">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          Mit einem echten Fahrzeug aus Ihrem Bestand testen.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Wir prüfen Fahrzeug und Einsatzziel und zeigen anschließend, wie sich der Ablauf in Ihrem Betrieb einsetzen lässt.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to={TEST_URL}>Mit einem Fahrzeug testen <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>
    </FunnelLayout>
  );
}
