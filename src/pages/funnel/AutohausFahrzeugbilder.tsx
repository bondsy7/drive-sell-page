import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera, Sparkles, Megaphone, CheckCircle2, AlertTriangle, ArrowRight,
  Images, Layers, ShieldCheck, RotateCcw, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';
import heroShowroom from '@/assets/hero-showroom.webp';

const TEST_URL = '/fahrzeug-testen?source=fahrzeugbilder';

const STEPS = [
  { icon: Camera, title: 'Fahrzeug fotografieren', desc: 'Aufnahmen mit dem Smartphone direkt auf dem Hof – ohne Studio, ohne Stativ.' },
  { icon: Sparkles, title: 'Autohaus.ai verarbeitet', desc: 'Die Aufnahmen werden zu einheitlichen Fahrzeugbildern in einer festen Bildsprache verarbeitet.' },
  { icon: Megaphone, title: 'Bilder für die Vermarktung nutzen', desc: 'Fertige Bilder für Portale, Website und Social Media – im gleichen Look über den gesamten Bestand.' },
];

const PROBLEMS = [
  'Uneinheitliche Hintergründe je nach Standort und Stellplatz',
  'Aufnahmen sind abhängig von Wetter und Tageslicht',
  'Nachbearbeitung bindet Zeit im Verkaufs- oder Marketingteam',
  'Unterschiedliche Bildqualität zwischen Betrieben und Mitarbeitenden',
];

const BENEFITS = [
  { title: 'Einheitlicher Auftritt', desc: 'Alle Fahrzeuge erscheinen in derselben Bildsprache – unabhängig davon, wer fotografiert hat.' },
  { title: 'Schneller online', desc: 'Der Weg vom Foto zum verwendbaren Bild läuft ohne externe Bildbearbeitung.' },
  { title: 'Skalierbar', desc: 'Der gleiche Ablauf funktioniert für einzelne Fahrzeuge und für größere Bestände.' },
  { title: 'CI-fähig', desc: 'Hintergrund, Kennzeichen-Handling und Logoeinsatz lassen sich an Ihr Corporate Design anpassen.' },
];

const FEATURES = [
  { icon: Images, title: 'Perspektiven', desc: 'Definierte Außen- und Innenansichten je Fahrzeugart – Pkw, Lkw und Motorrad.' },
  { icon: Layers, title: 'Hintergrund & Showroom', desc: 'Auswahl aus Showroom- und Außensettings für einen konsistenten Bildhintergrund.' },
  { icon: ShieldCheck, title: 'Kennzeichen & CI', desc: 'Kennzeichen beibehalten, entfernen, neutralisieren oder durch Ihr eigenes ersetzen.' },
  { icon: RotateCcw, title: '360° als Erweiterung', desc: 'Aufbauend auf denselben Aufnahmen lässt sich eine 360°-Ansicht erzeugen.' },
];

const AUDIENCE = ['Autohausgruppen', 'Markenbetriebe', 'Freie Händler', 'Gebrauchtwagenzentren'];

const FAQ = [
  { q: 'Brauche ich eine professionelle Kamera?', a: 'Nein. Aufnahmen mit einem aktuellen Smartphone genügen. Wichtig sind vollständige Perspektiven und ein frei stehendes Fahrzeug.' },
  { q: 'Kann unser eigenes Corporate Design verwendet werden?', a: 'Ja. Hintergrund, Kennzeichen-Handling sowie Hersteller- und Autohauslogo lassen sich passend zu Ihrem Auftritt konfigurieren.' },
  { q: 'Eignet es sich für mehrere Standorte?', a: 'Ja. Der Ablauf ist für alle Betriebe identisch, wodurch die Bildsprache standortübergreifend gleich bleibt.' },
  { q: 'Was passiert mit dem Testfoto?', a: 'Das Bild wird ausschließlich zur Bearbeitung Ihrer Testanfrage verwendet und nicht öffentlich zugänglich gespeichert.' },
  { q: 'Wie lange dauert ein Test?', a: 'Wir prüfen Ihr Fahrzeug und Ihr Einsatzziel und melden uns anschließend mit einem passenden Beispiel. Eine feste Bearbeitungszeit sagen wir bewusst nicht zu.' },
];

export default function AutohausFahrzeugbilder() {
  usePageMeta({
    title: 'KI-Fahrzeugbilder für Autohäuser | Autohaus.ai',
    description: 'Aus Smartphone-Fotos werden einheitliche Fahrzeugbilder für Autohäuser und Fahrzeughändler. Jetzt mit einem Fahrzeug aus Ihrem Bestand testen.',
    canonicalPath: '/autohaus-fahrzeugbilder',
  });

  useEffect(() => { captureAttribution('lp_fahrzeugbilder'); }, []);

  return (
    <FunnelLayout
      ctaHref={TEST_URL}
      ctaLabel="1 Fahrzeug kostenlos testen"
      anchors={[{ href: '#prozess', label: 'So funktioniert es' }, { href: '#funktionen', label: 'Funktionen' }]}
    >
      {/* Hero */}
      <section className="border-b border-border/60 bg-card/30">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Für Autohäuser &amp; Fahrzeughändler</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-foreground sm:text-4xl lg:text-5xl">
              Vom Smartphone-Foto zum professionellen Fahrzeugbild.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Autohaus.ai verwandelt echte Fahrzeugfotos aus Ihrem Bestand in einheitliche, professionelle
              Showroom-Aufnahmen – ohne Fotostudio und ohne aufwendige Nachbearbeitung.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to={TEST_URL}>1 Fahrzeug kostenlos testen <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#prozess">So funktioniert es</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Für gewerbliche Fahrzeughändler · unverbindlicher Test · eigenes Fahrzeug verwenden
            </p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <img
              src={heroShowroom}
              alt="Beispielhafte Showroom-Darstellung eines Fahrzeugs"
              className="h-full w-full object-cover"
              loading="eager"
              width={1200}
              height={800}
            />
            <p className="absolute bottom-0 left-0 right-0 bg-background/85 px-3 py-2 text-[11px] text-muted-foreground">
              Beispielhafte Darstellung – kein Kundenergebnis.
            </p>
          </div>
        </div>
      </section>

      {/* Vorher / Nachher */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Vom Hofbild zur einheitlichen Aufnahme</h2>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Die folgende Gegenüberstellung zeigt schematisch, worin sich Ausgangsaufnahme und verarbeitetes
          Fahrzeugbild unterscheiden. Es handelt sich um eine beispielhafte Darstellung, nicht um Kundenergebnisse.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vorher · Ausgangsfoto</p>
            <div className="mt-4 aspect-[4/3] rounded-lg border border-dashed border-border bg-muted/40 p-4">
              <ul className="flex h-full flex-col justify-center gap-2 text-sm text-muted-foreground">
                <li>Wechselnde Hintergründe auf dem Hof</li>
                <li>Unterschiedliches Tageslicht</li>
                <li>Abweichende Perspektiven je Aufnahme</li>
              </ul>
            </div>
          </article>

          <article className="rounded-xl border border-accent/40 bg-card p-5 ring-1 ring-accent/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Nachher · Showroom-Ergebnis</p>
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <img
                src="/images/showrooms/showroom-1.webp"
                alt="Beispielhafte Showroom-Umgebung für Fahrzeugbilder"
                className="aspect-[4/3] w-full object-cover"
                loading="lazy"
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Beispielhafte Darstellung der Zielbildsprache.</p>
          </article>
        </div>
      </section>

      {/* Prozess */}
      <section id="prozess" className="border-y border-border/60 bg-card/30 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">So funktioniert es</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <s.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">Schritt {i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Problem + Nutzen */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Typische Hürden im Bestandsfoto-Alltag</h2>
            <ul className="mt-6 space-y-3">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Was sich dadurch ändert</h2>
            <ul className="mt-6 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b.title} className="flex gap-3 rounded-lg border border-border bg-card p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{b.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Funktionen */}
      <section id="funktionen" className="border-y border-border/60 bg-card/30 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Funktionen rund um das Fahrzeugbild</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-border bg-card p-5">
                <f.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Zielgruppe */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Für wen ist Autohaus.ai gedacht?</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a) => (
            <div key={a} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
              {a}
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm font-medium text-foreground">Nicht für private Fahrzeugverkäufe gedacht.</p>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Häufige Fragen</h2>
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

      {/* Schluss-CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          Testen Sie Autohaus.ai mit einem Fahrzeug aus Ihrem Bestand.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Ein Fahrzeugfoto, wenige Angaben zu Ihrem Betrieb – und wir prüfen den Einsatz passend zu Ihrem Prozess.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to={TEST_URL}>1 Fahrzeug kostenlos testen <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </section>
    </FunnelLayout>
  );
}
