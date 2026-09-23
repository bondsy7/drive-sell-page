import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  FileText,
  LayoutTemplate,
  MoveRight,
  Quote,
  Share2,
  Video,
} from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import vorherImage from '@/assets/referenzen-vorher.jpg';
import nachherImage from '@/assets/referenzen-nachher.jpg';
import heroImage from '@/assets/autohaus-ai-hero.jpg';

const STATS = [
  { value: '+43 %', label: 'mehr Anfragen' },
  { value: '−70 %', label: 'Zeitaufwand' },
  { value: '95 %', label: 'zufriedene Kunden' },
];

const SIDE_CARDS = [
  { value: '320+', label: 'Fahrzeuge pro Monat mit autohaus.ai aufbereitet' },
  { value: '+58 %', label: 'mehr Online-Anfragen bei aktiven Kunden' },
];

type MediaCategory = 'Social Media' | 'Banner' | 'Landingpages' | 'Video' | 'Verkaufstexte';

interface MediaExample {
  category: MediaCategory;
  title: string;
  text: string;
  image?: string;
}

const MEDIA_EXAMPLES: MediaExample[] = [
  {
    category: 'Banner',
    title: 'Der neue GLC. Bereit für mehr.',
    text: 'Werbebanner in allen gängigen Formaten – automatisch in deiner CI.',
    image: nachherImage,
  },
  {
    category: 'Social Media',
    title: 'Stil. Leistung. Zuverlässigkeit.',
    text: 'Posts und Storys für Instagram, Facebook und LinkedIn.',
    image: heroImage,
  },
  {
    category: 'Landingpages',
    title: 'Fahrzeugdetails',
    text: 'Komplette Angebotsseite mit Bildern, Daten und Pflichtangaben.',
    image: nachherImage,
  },
  {
    category: 'Video',
    title: '360°-Präsentation',
    text: 'Bewegte Rundumansichten aus deinen Standbildern.',
    image: heroImage,
  },
  {
    category: 'Verkaufstexte',
    title: 'Starke Performance. Zeitloses Design.',
    text: 'Überzeugende Fahrzeugbeschreibungen für alle Portale.',
  },
  {
    category: 'Banner',
    title: 'Herbstaktion: Jetzt Probefahrt sichern.',
    text: 'Saisonale Kampagnen-Motive auf Knopfdruck.',
    image: nachherImage,
  },
  {
    category: 'Social Media',
    title: 'Neuzugang im Autohaus',
    text: 'Fertige Vorlagen für deine Fahrzeug-Highlights.',
    image: vorherImage,
  },
];

const FILTERS: Array<'Alle' | MediaCategory> = ['Alle', 'Social Media', 'Banner', 'Landingpages', 'Video', 'Verkaufstexte'];

const CATEGORY_ICONS: Record<MediaCategory, typeof Share2> = {
  'Social Media': Share2,
  Banner: LayoutTemplate,
  Landingpages: FileText,
  Video: Video,
  Verkaufstexte: FileText,
};

function scrollRow(id: string, direction: number) {
  const row = document.getElementById(id);
  if (row) row.scrollBy({ left: direction * 360, behavior: 'smooth' });
}

export default function Referenzen() {
  const { user } = useAuth();
  const destination = user ? '/generator' : '/auth?plan=free';
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Alle');

  const visibleExamples = useMemo(
    () => (filter === 'Alle' ? MEDIA_EXAMPLES : MEDIA_EXAMPLES.filter((item) => item.category === filter)),
    [filter],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main>
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <p className="text-xs font-bold uppercase text-primary">Echte Ergebnisse</p>
                <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] sm:text-5xl">
                  Mehr Sichtbarkeit.<br />Mehr Anfragen.<br />Mehr Verkäufe.
                </h1>
                <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                  Autohäuser und Händler nutzen autohaus.ai bereits – mit messbaren Ergebnissen bei Anfragen, Zeitaufwand und Online-Präsentation.
                </p>
                <div className="mt-8 flex gap-8">
                  {STATS.map((stat) => (
                    <div key={stat.value}>
                      <p className="font-display text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-8">
                  <a href="#werbemittel">Beispiele ansehen <ArrowRight className="h-4 w-4" /></a>
                </Button>
              </div>

              <div className="grid gap-4">
                <figure className="rounded-lg border border-border bg-background p-6 shadow-card">
                  <Quote className="h-5 w-5 text-primary" />
                  <blockquote className="mt-3 font-display text-lg font-semibold leading-7">
                    „Die Qualität der Bilder ist beeindruckend und die Zeitersparnis enorm.“
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">AS</span>
                    <span className="text-xs text-muted-foreground">Autohaus Schmidt · München</span>
                  </figcaption>
                </figure>
                <div className="grid grid-cols-2 gap-4">
                  {SIDE_CARDS.map((card) => (
                    <div key={card.value} className="rounded-lg border border-border bg-background p-5 shadow-card">
                      <p className="font-display text-2xl font-bold">{card.value}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-4 text-muted-foreground/70">
                  Beispielwerte und Muster-Kundenstimme – werden nach Lieferung deiner Referenzen durch echte Angaben ersetzt.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Der Unterschied auf einen Blick</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Links das Originalfoto vom Hof, rechts das Ergebnis nach der KI-Veredelung mit autohaus.ai.
          </p>
          <div className="relative mt-8 grid gap-4 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-card sm:grid-cols-2 sm:gap-6 sm:p-6">
            <figure className="overflow-hidden rounded-md">
              <div className="relative">
                <img src={vorherImage} alt="Muster: Originalfoto eines SUV auf einem Händlerhof" width={1024} height={768} loading="lazy" className="aspect-[4/3] w-full rounded-md object-cover" />
                <span className="absolute left-3 top-3 rounded-md bg-foreground/85 px-3 py-1 text-xs font-semibold text-background">Vorher</span>
              </div>
            </figure>
            <figure className="overflow-hidden rounded-md">
              <div className="relative">
                <img src={nachherImage} alt="Muster: KI-veredeltes Showroom-Foto desselben SUV" width={1024} height={768} loading="lazy" className="aspect-[4/3] w-full rounded-md object-cover" />
                <span className="absolute left-3 top-3 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Nachher · Mit autohaus.ai</span>
              </div>
            </figure>
            <span className="absolute left-1/2 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-primary shadow-elevated sm:flex" aria-hidden="true">
              <MoveRight className="h-5 w-5" />
            </span>
          </div>
        </section>

        <section id="werbemittel" className="border-y border-border bg-secondary/60 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-3xl font-bold sm:text-4xl">Beispiele für erstellte Werbemittel</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Ein Fahrzeug, viele Formate – diese Werbemittel entstehen automatisch aus deinen Fotos.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => scrollRow('referenzen-media-row', -1)} aria-label="Zurück">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => scrollRow('referenzen-media-row', 1)} aria-label="Weiter">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                    filter === item
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>

            <div id="referenzen-media-row" className="mt-8 flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
              {visibleExamples.map((example) => {
                const Icon = CATEGORY_ICONS[example.category];
                return (
                  <article key={example.title} className="flex w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
                    {example.image ? (
                      <div className="relative h-40 overflow-hidden">
                        <img src={example.image} alt={`Muster: ${example.category} – ${example.title}`} width={1024} height={768} loading="lazy" className="h-full w-full object-cover" />
                        {example.category === 'Video' && (
                          <span className="absolute inset-0 flex items-center justify-center bg-foreground/25">
                            <CirclePlay className="h-12 w-12 text-background" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-40 items-center justify-center bg-primary/5">
                        <Icon className="h-10 w-10 text-primary" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        <Icon className="h-3 w-3" /> {example.category}
                      </span>
                      <h3 className="mt-3 font-semibold leading-6">{example.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{example.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col justify-between gap-7 rounded-lg bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-bold">Überzeuge dich selbst</h2>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/75">Lade dein erstes Fahrzeug hoch und sieh das Ergebnis mit eigenen Augen.</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-primary-foreground/85">
                {['In wenigen Minuten startklar', 'Keine Installation', 'Für Autohäuser und Händler'].map((item) => (
                  <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4" />{item}</span>
                ))}
              </div>
            </div>
            <Button asChild size="lg" variant="secondary"><Link to={destination}>Jetzt starten <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
