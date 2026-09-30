import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Camera, Check, ChevronRight, Clock3, CloudRain, FileCheck,
  Images, Layers3, Quote, ShieldCheck, Sparkles, Truck, Users, Warehouse, X, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import BeforeAfterShowcase from '@/components/funnel/BeforeAfterShowcase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';
import arrivalImage from '@/assets/funnel/standtage-arrival-local.webp';
import showroomImage from '@/assets/funnel/standtage-showroom-local.webp';
import processImage from '@/assets/funnel/standtage-prozessbild.webp';

const TEST_URL = '/fahrzeug-testen?source=standtage';

/** Der klassische Weg vom Wareneingang bis zur Anzeige – neun Schritte, viele Abhängigkeiten. */
const CLASSIC_STEPS = [
  'abladen',
  'reinigen / aufbereiten',
  'rangieren & platzieren',
  'Aufnahmeplatz finden',
  'ausrichten',
  'beleuchten',
  'fotografieren',
  'kontrollieren & freigeben',
  'online stellen',
];

const DROP_CHIPS = ['Aufbereitung', 'Fotograf', 'Fotobox', 'Ausrichten', 'Beleuchten', 'Warteschlange', 'Nachbearbeitung'];

const DEPENDENCIES = [
  { icon: CloudRain, title: 'Hängt am Wetter.', text: 'Regen, Sonne und Dunkelheit entscheiden über den Zeitpunkt.' },
  { icon: Users, title: 'Hängt an Personen.', text: 'Wer fotografieren kann oder darf, ist oft gerade beschäftigt.' },
  { icon: Warehouse, title: 'Hängt an Plätzen.', text: 'Die Fotobox ist besetzt oder der Hof ist voll.' },
  { icon: FileCheck, title: 'Hängt an Freigaben.', text: 'Bilder müssen kontrolliert werden, bevor etwas passiert.' },
];

const BENEFITS = [
  { icon: Zap, title: 'Verkaufsfähig, während es noch auf dem Hof steht.', text: 'Die Bilder entstehen dort, wo das Fahrzeug ohnehin steht.' },
  { icon: Clock3, title: 'Unabhängig von Wetter, Fotograf und freien Plätzen.', text: 'Niemand muss warten, bis ein Aufnahmeplatz frei wird.' },
  { icon: Layers3, title: 'Ein einheitlicher Auftritt über den gesamten Bestand.', text: 'Alle Fahrzeuge im selben Look, über Mitarbeiter und Standorte hinweg.' },
  { icon: Building2, title: 'Weniger Aufwand im Tagesgeschäft.', text: 'Wer ablädt, kann direkt fotografieren; der Rest läuft automatisch.' },
];

const TEST_STEPS = [
  { title: 'Ein konkretes Beispiel-Ergebnis', text: 'Ihr Fahrzeug in professioneller Qualität – angezeigt im autohaus.ai Look.' },
  { title: 'Eine kurze Prozesseinschätzung', text: 'Wie Sie autohaus.ai in Ihrem Autohaus einsetzen können – individuell auf Ihre Situation.' },
  { title: 'Eine Empfehlung für Ihren Einsatzfall', text: 'Konkrete nächste Schritte und Antworten auf Ihre Fragen im weiteren schriftlichen Austausch.' },
];

const TRUST = [
  'Angebot ausschließlich für Unternehmer i. S. d. § 14 BGB',
  'Das hochgeladene Bild wird nur für die Testanfrage verwendet und nicht veröffentlicht',
  'Rückmeldung in der Regel innerhalb eines Werktags',
  'KI-generierte Medien werden gekennzeichnet',
  'Ein Produkt der Breadcrumb Marketing GmbH, Hanau',
];

const FAQ = [
  ['Brauche ich eine bestimmte Kamera?', 'Nein. Ein aktuelles Smartphone genügt. Wichtig sind vollständige Perspektiven und ein frei stehendes Fahrzeug.'],
  ['Wer fotografiert bei uns?', 'Jede Person, die das Fahrzeug ohnehin anfasst. Eine Schulung ist nicht nötig, der Ablauf ist immer identisch.'],
  ['Funktioniert das auch für Transporter, Motorrad oder LKW?', 'Ja. Die Aufnahmeabläufe sind je Fahrzeugart aufgebaut und unterscheiden sich in den benötigten Ansichten.'],
  ['Was passiert mit meinem Bild?', 'Das Bild wird ausschließlich zur Bearbeitung Ihrer Testanfrage verwendet und nicht öffentlich zugänglich gespeichert.'],
];

export default function StandtageVermeiden() {
  usePageMeta({
    title: 'Standtage vermeiden – Fahrzeugbilder direkt vom Hof | autohaus.ai',
    description: 'Jeder Standtag kostet Geld. autohaus.ai macht aus Smartphone-Aufnahmen direkt am Fahrzeug professionelle, einheitliche Fahrzeugbilder – ohne Aufbereitung, Fotograf oder Fotobox.',
    canonicalPath: '/standtage-vermeiden',
  });

  useEffect(() => { captureAttribution('lp_standtage'); }, []);

  return (
    <FunnelLayout
      ctaHref={TEST_URL}
      ctaLabel="Fahrzeug kostenlos testen"
      anchors={[{ href: '#ablauf', label: 'Ablauf' }, { href: '#fragen', label: 'Fragen' }]}
    >
      {/* S1 · Hero: Kontrast zwischen Ankunft und Online in einem Blick */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:py-16">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Für Autohäuser, Fahrzeughändler und Händlergruppen</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.04] text-foreground sm:text-5xl">Jeder Standtag kostet Geld.</h1>
            <p className="mt-3 font-display text-lg font-bold text-accent sm:text-xl">Vom LKW ins Netz – noch am selben Tag online.</p>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Wenn der Autotransporter vorfährt, beginnt der Verkauf. Ihre Mitarbeiter machen wenige Smartphone-Aufnahmen direkt am Fahrzeug – autohaus.ai erzeugt daraus professionelle, einheitliche Bilder im Showroom- und CI-Look. Kein Reinigen, kein Fotograf, keine Fotobox.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-glow">
                <Link to={TEST_URL}>Ein Fahrzeug kostenlos testen <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#ablauf">So läuft es ab <ChevronRight className="h-4 w-4" /></a>
              </Button>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {['Kein Fotostudio nötig', 'Keine manuelle Nachbearbeitung', 'Für Händler und Gruppen'].map((item) => (
                <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{item}</span>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <figure className="relative overflow-hidden rounded-lg border border-border bg-secondary shadow-card">
                <img src={arrivalImage} alt="Fahrzeug auf dem Anhänger eines Autotransporters, direkt nach der Ankunft" className="aspect-[4/3] w-full object-cover" loading="eager" />
                <figcaption className="absolute left-2 top-2 rounded-md bg-foreground/85 px-2.5 py-1.5 text-[10px] font-semibold leading-tight text-background shadow-card sm:left-3 sm:top-3 sm:text-xs">
                  Ankunft<br /><span className="font-normal opacity-80">auf dem Anhänger</span>
                </figcaption>
              </figure>
              <figure className="relative overflow-hidden rounded-lg border border-accent/50 bg-card shadow-elevated">
                <img src={showroomImage} alt="Dasselbe Fahrzeug als professionelles Showroom-Motiv" className="aspect-[4/3] w-full object-cover" loading="eager" />
                <figcaption className="absolute right-2 top-2 rounded-md bg-accent px-2.5 py-1.5 text-[10px] font-semibold leading-tight text-accent-foreground shadow-card sm:right-3 sm:top-3 sm:text-xs">
                  Online<br /><span className="font-normal opacity-90">im Showroom-Look</span>
                </figcaption>
              </figure>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-xs">
              <span className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 font-semibold text-muted-foreground">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" /> {CLASSIC_STEPS.length} Schritte
              </span>
              <ArrowRight className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-2.5 py-1.5 font-semibold text-foreground">
                <Camera className="h-3.5 w-3.5 text-accent" aria-hidden="true" /> 3 Schritte
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Der gelieferte Vorher/Heute-Vergleich als große, bereinigte Bildgeschichte */}
      <section id="ablauf" className="scroll-mt-20 border-b border-border bg-secondary/45 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Der Unterschied im Alltag</p>
              <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">Vom Hoftermin zum Handgriff.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">Dasselbe Ziel, ein kürzerer Weg: vom angelieferten Fahrzeug zu Bildern für den Verkauf.</p>
          </div>
          <figure>
            <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-elevated sm:block">
              <img src={processImage} alt="Vergleich: Links aufwendige Fahrzeugaufbereitung und Fotografie bei Regen, rechts Smartphone-Aufnahmen direkt am angelieferten Fahrzeug" className="aspect-[16/9] w-full object-cover" loading="eager" />
            </div>
            <div className="grid gap-3 sm:hidden">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-card">
                <img src={processImage} alt="Klassischer Prozess: Reinigung und professionelle Fotografie im Regen am Autohaus" className="absolute left-0 top-0 h-full w-[200%] max-w-none object-cover" loading="eager" />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-card">
                <img src={processImage} alt="Mit autohaus.ai: Mitarbeiter fotografiert das angelieferte Fahrzeug direkt mit dem Smartphone" className="absolute right-0 top-0 h-full w-[200%] max-w-none object-cover" loading="eager" />
              </div>
            </div>
            <figcaption className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5">
              <div className="flex items-start gap-3 border-l-2 border-destructive pl-4">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                <div><strong className="block text-sm">Klassisch: erst vorbereiten, dann fotografieren.</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Aufbereitung, Aufnahmeplatz, Beleuchtung und Freigaben kosten Zeit.</span></div>
              </div>
              <div className="flex items-start gap-3 border-l-2 border-accent pl-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <div><strong className="block text-sm">Mit autohaus.ai: direkt am Fahrzeug aufnehmen.</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Smartphone-Fotos am Standort werden zu einheitlichen Verkaufsbildern.</span></div>
              </div>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* S2 · Problem: was zwischen Ankunft und Anzeige passiert */}
      <section className="border-b border-border bg-secondary/55 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Zwischen Ankunft und Anzeige liegen Stunden.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Sobald ein Fahrzeug da ist, beginnt der eigentliche Aufwand: ein Weg durch mehrere Abteilungen, Personen und Termine – bevor überhaupt ein Bild entsteht.
          </p>

          <ol className="mt-7 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {CLASSIC_STEPS.map((step, i) => (
              <li key={step} className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-semibold shadow-card">
                <span className="text-muted-foreground">{i + 1}</span>{step}
              </li>
            ))}
          </ol>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DEPENDENCIES.map((d) => (
              <div key={d.title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"><d.icon className="h-4 w-4" /></span>
                <p className="mt-3 text-sm font-bold">{d.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{d.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-7 text-sm font-semibold text-foreground">
            In dieser Zeit steht das Fahrzeug. Es ist bezahlt, finanziert und noch nicht sichtbar.
          </p>
        </div>
      </section>

      {/* S3 · Prozessvergleich klassisch vs. autohaus.ai */}
      <section className="funnel-section-tint border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Vom LKW ins Netz – in drei Schritten.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ein Handgriff statt eines Hoftermins.</p>

          <div className="relative mt-7 grid gap-5 lg:grid-cols-2 lg:gap-10">
            <div className="rounded-lg border border-border bg-card p-6 shadow-card">
              <h3 className="font-display text-lg font-bold">Der klassische Weg</h3>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                {CLASSIC_STEPS.map((step) => (
                  <li key={step} className="flex gap-3"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={2.5}/>{step}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-accent/30 bg-card p-6 shadow-card">
              <h3 className="font-display text-lg font-bold text-accent">Mit autohaus.ai</h3>
              <ul className="mt-5 space-y-4 text-sm">
                {[
                  ['Ankommen und fotografieren', 'Ein Smartphone genügt – am Standort, direkt am Fahrzeug.'],
                  ['autohaus.ai verarbeitet', 'Aus den Aufnahmen werden einheitliche Motive im Showroom- und CI-Look.'],
                  ['Vermarkten', 'Bilder für Website, Marktplätze und Social Media aus einem Ablauf.'],
                ].map(([title, text]) => (
                  <li key={title} className="flex gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.5} />
                    <span><span className="block font-bold text-foreground">{title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{text}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-accent shadow-card lg:flex">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-7 rounded-lg border border-border bg-card p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Fällt weg</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DROP_CHIPS.map((chip) => (
                <span key={chip} className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs font-semibold text-muted-foreground line-through decoration-destructive/60">{chip}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* S4 · Nutzen */}
      <section className="border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Was sich für Ihren Bestand ändert.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <article key={b.title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent"><b.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-sm font-bold leading-snug">{b.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{b.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-secondary/40 p-6 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Images className="h-5 w-5" /></span>
            <div>
              <h3 className="text-sm font-bold">Skaliert mit dem Wareneingang.</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Mehrere Fahrzeuge nacheinander folgen demselben Ablauf, ohne dass der Prozess jedes Mal neu gestartet wird.</p>
            </div>
          </div>
        </div>
      </section>

      {/* S5 · Beweise und Vertrauen */}
      <section className="funnel-section-tint border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">So sieht das Ergebnis aus.</h2>
          <div className="mt-7 grid items-start gap-8 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <BeforeAfterShowcase />
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Das Ergebnis hängt von der Qualität Ihrer Aufnahme ab. Im Test zeigen wir es an einem Ihrer eigenen Fahrzeuge.
              </p>
            </div>
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card p-6 shadow-card">
                <h3 className="font-display text-lg font-bold">So läuft der Test ab</h3>
                <ol className="mt-5 space-y-4">
                  {TEST_STEPS.map((s, i) => (
                    <li key={s.title} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-display text-sm font-bold text-accent">{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold leading-tight">{s.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <figure className="rounded-lg border border-accent/25 bg-accent/5 p-5">
                <Quote className="h-6 w-6 text-accent/40" aria-hidden="true" />
                <blockquote className="mt-2 text-sm italic leading-6 text-foreground">„Wir sparen enorm viel Zeit und haben endlich eine einheitliche Aufnahmequalität über alle Standorte hinweg. Die Bildqualität ist überzeugend."</blockquote>
                <figcaption className="mt-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">Thomas R.</span> · Geschäftsführer, Mehrmarken-Autohaus</figcaption>
              </figure>
            </div>
          </div>

          <ul className="mt-8 grid gap-2 rounded-lg border border-border bg-card p-5 shadow-card sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => (
              <li key={t} className="flex gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* S6 · Kurz-FAQ */}
      <section id="fragen" className="scroll-mt-20 border-b border-border bg-secondary/45 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Häufige Fragen</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Noch Fragen?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Kurze Antworten zum Ablauf bei Ihnen im Haus.</p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQ.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`} className="rounded-lg border border-border bg-card px-5 shadow-card last:border-b">
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* S7 · Abschluss-CTA */}
      <section className="px-4 py-14 sm:px-6">
        <div className="gradient-hero mx-auto flex max-w-6xl flex-col justify-between gap-6 rounded-lg px-6 py-8 text-primary-foreground sm:px-8 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold">Machen Sie Ihr nächstes Fahrzeug zum Test.</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">Ein Smartphone-Foto vom Hof genügt. Sie sehen das Ergebnis und entscheiden dann.</p>
          </div>
          <div className="shrink-0">
            <Button asChild size="lg" variant="secondary">
              <Link to={TEST_URL}>Ein Fahrzeug kostenlos testen <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <p className="mt-2 text-xs text-primary-foreground/70">Dauert nur eine Minute · Rückmeldung innerhalb eines Werktags</p>
          </div>
        </div>
      </section>
    </FunnelLayout>
  );
}
