import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  FileText,
  Images,
  LayoutTemplate,
  MessageSquareQuote,
  Share2,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react';
import HomeHeader from '@/components/home/HomeHeader';
import HomeHero from '@/components/home/HomeHero';
import SiteFooter from '@/components/legal/SiteFooter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import stepPlaceholderImage from '@/assets/fahrzeug-perspektiven.webp.asset.json';
import stepFotoAufnehmen from '@/assets/foto-aufnehmen.webp.asset.json';
import stepFormateImage from '@/assets/marketing-formate.webp.asset.json';

const STEPS = [
  {
    num: '01',
    title: 'Foto aufnehmen',
    text: 'Mit dem Smartphone oder direkt aus deinem Bestand.',
    kind: 'phone',
    icon: Camera,
  },
  {
    num: '02',
    title: 'KI-Veredelung',
    text: 'Unsere KI optimiert Bilder und ergänzt Perspektiven.',
    kind: 'single',
    icon: WandSparkles,
  },
  {
    num: '03',
    title: 'Formate erstellen',
    text: 'Bilder, Videos, Social Media, Banner und Verkaufsseiten.',
    kind: 'grid',
    icon: LayoutTemplate,
  },
  {
    num: '04',
    title: 'Mehr verkaufen',
    text: 'Schneller online. Mehr Anfragen. Höhere Sichtbarkeit.',
    kind: 'chart',
    icon: BarChart3,
  },
] as const;

const PRODUCTS = [
  { icon: Images, title: 'Fahrzeugbilder', text: 'Professionelle Außen- und Innenansichten im einheitlichen Showroom.', image: stepPlaceholderImage.url, className: 'lg:col-span-7' },
  { icon: Share2, title: 'Social Media & Banner', text: 'Passende Werbemittel in den wichtigsten Formaten.', image: stepFormateImage.url, className: 'lg:col-span-5' },
  { icon: Video, title: 'Video & 360°', text: 'Bewegte Präsentationen und interaktive Rundumansichten.', className: 'lg:col-span-5' },
  { icon: FileText, title: 'Verkaufsseiten', text: 'Fahrzeugdaten, Medien und der KI-Verkaufsassistent auf einer klaren Angebotsseite.', className: 'lg:col-span-7' },
];

function StepVisual({ kind }: { kind: (typeof STEPS)[number]['kind'] }) {
  if (kind === 'phone') {
    return (
      <div className="relative mt-6 h-44 w-full overflow-hidden rounded-md bg-secondary">
        <img src={stepFotoAufnehmen.url} alt="Fahrzeugaufnahme mit dem Smartphone auf dem Hof" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
    );
  }

  if (kind === 'single') {
    return (
      <div className="mt-6 h-44 overflow-hidden rounded-md bg-secondary">
        <img src={stepPlaceholderImage.url} alt="KI-veredeltes Fahrzeugbild in verschiedenen Perspektiven" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
    );
  }

  if (kind === 'grid') {
    return (
      <div className="mt-6 h-44 overflow-hidden rounded-md bg-secondary">
        <img src={stepFormateImage.url} alt="Erstellte Marketing-Formate: Fahrzeugbilder, Social Post, Verkaufsanzeige und Video" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
    );
  }

  return (
    <div className="relative mt-6 flex h-44 flex-col justify-end overflow-hidden rounded-md bg-primary/10 px-5 pb-5">
      <div className="absolute right-5 top-5 flex size-10 items-center justify-center rounded-full bg-card text-primary shadow-card"><Check className="size-5" /></div>
      <svg viewBox="0 0 180 72" className="h-16 w-full text-primary transition-transform duration-500 group-hover:-translate-y-1" aria-hidden="true">
        <polyline points="4,58 40,32 74,43 110,18 142,26 176,5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M164 5h12v12" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <p className="mt-1 text-2xl font-bold text-primary">Mehr Sichtbarkeit</p>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const destination = user ? '/generator' : '/auth?plan=free';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HomeHeader />

      <main>
        <HomeHero />

        <section className="relative -mt-px bg-card px-4 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-2 border-y border-border md:grid-cols-4">
            {[
              ['Wenige Min.', 'bis zum Ergebnis'],
              ['18+', 'Perspektiven'],
              ['Professionelle', 'Ergebnisse'],
              ['WLTP-konform', 'für relevante Portale'],
            ].map(([value, label], index) => (
              <div key={value} className={`px-4 py-7 text-center sm:py-9 ${index % 2 !== 0 ? 'border-l border-border' : ''} ${index > 1 ? 'border-t border-border md:border-t-0' : ''} md:border-l md:first:border-l-0`}>
                <p className="font-display text-2xl font-bold text-primary sm:text-3xl">{value}</p>
                <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="so-funktionierts" className="scroll-mt-20 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase text-primary">Vom Foto zum Verkaufspaket</p>
              <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">So einfach funktioniert autohaus.ai</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">Ein klarer Ablauf, der aus vorhandenen Aufnahmen konsistente Inhalte für deinen gesamten Fahrzeugverkauf macht.</p>
            </div>
            <div className="relative mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-border lg:block" aria-hidden="true" />
              {STEPS.map((step) => (
                <article key={step.num} className="group relative flex min-h-[390px] flex-col rounded-lg border border-transparent bg-secondary/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-border hover:bg-card hover:shadow-elevated">
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-glow">{step.num}</span>
                    <step.icon className="size-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-6 font-display text-xl font-bold">{step.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  <div className="mt-auto"><StepVisual kind={step.kind} /></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="referenzen" className="bg-foreground py-16 text-background sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <MessageSquareQuote className="size-5" />
              </div>
              <p className="mt-6 text-xs font-bold uppercase text-primary">Aus der Praxis</p>
              <p className="mt-3 text-sm leading-6 text-background/60">Ein einheitlicher Auftritt beginnt nicht im Fotostudio, sondern direkt am Fahrzeug.</p>
            </div>
            <div>
              <blockquote className="font-display text-2xl font-semibold leading-tight sm:text-3xl lg:text-4xl">„Mit autohaus.ai sparen wir pro Fahrzeug wertvolle Zeit und präsentieren unseren Bestand durchgehend professionell.“</blockquote>
              <div className="mt-7 flex flex-col gap-4 border-t border-background/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-background/50">Beispiel für eine Kundenstimme · wird nach Lieferung deiner Referenzen ersetzt</p>
                <Button asChild variant="secondary" className="w-fit">
                  <Link to="/referenzen">Referenzen ansehen <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="ergebnisse" className="scroll-mt-20 bg-background py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase text-primary">Eine Plattform</p>
                <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Ein Fahrzeug.<br />Alle Formate für den Verkauf.</h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">Vom einheitlichen Bilderset bis zur vollständigen Angebotsseite entstehen alle Inhalte aus demselben Fahrzeugbestand.</p>
              </div>
              <Button asChild variant="outline"><Link to="/pricing">Pakete vergleichen <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
            <div className="mt-12 grid gap-5 lg:grid-cols-12">
              {PRODUCTS.map((product) => (
                <article key={product.title} className={`${product.className} group relative min-h-72 overflow-hidden rounded-lg border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated`}>
                  {product.image && <img src={product.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 transition-transform duration-500 group-hover:scale-[1.03]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/30" />
                  <div className="relative flex h-full min-h-72 flex-col justify-end p-6 sm:p-8">
                    <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground"><product.icon className="size-5" /></div>
                    <h3 className="mt-6 font-display text-2xl font-bold">{product.title}</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{product.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="unternehmen" className="border-t border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-lg bg-primary px-6 py-10 text-primary-foreground shadow-glow sm:px-10 sm:py-14 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase text-primary-foreground/70">Direkt mit eigenem Fahrzeug testen</p>
              <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Bereit für modernes Fahrzeugmarketing?</h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/80 sm:text-base">Starte mit deinen eigenen Fahrzeugfotos und erlebe den vollständigen Ablauf direkt.</p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-12 px-6"><Link to={destination}>Jetzt starten <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}