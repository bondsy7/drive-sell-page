import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  CirclePlay,
  FileText,
  Images,
  LayoutTemplate,
  MessageSquareQuote,
  Share2,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import heroImage from '@/assets/hero-autohaus-ai.png.asset.json';
import stepPlaceholderImage from '@/assets/autohaus-ai-hero.jpg';

const BENEFITS = [
  'In wenigen Minuten startklar',
  'Keine Installation',
  'Für Autohäuser und Händler',
];

const OUTPUTS = [
  { icon: Camera, label: 'Fahrzeugbilder' },
  { icon: Share2, label: 'Social Media' },
  { icon: LayoutTemplate, label: 'Banner' },
  { icon: FileText, label: 'Verkaufsseiten' },
  { icon: Video, label: 'Video & 360°' },
  { icon: Sparkles, label: 'KI-Verkaufsassistent' },
];

const STEPS = [
  {
    num: '01',
    title: 'Foto aufnehmen',
    text: 'Mit dem Smartphone oder direkt aus deinem Bestand.',
    kind: 'phone',
  },
  {
    num: '02',
    title: 'KI-Veredelung',
    text: 'Unsere KI optimiert Bilder und ergänzt Perspektiven.',
    kind: 'single',
  },
  {
    num: '03',
    title: 'Formate erstellen',
    text: 'Bilder, Videos, Social Media, Banner und Verkaufsseiten.',
    kind: 'grid',
  },
  {
    num: '04',
    title: 'Mehr verkaufen',
    text: 'Schneller online. Mehr Anfragen. Höhere Sichtbarkeit.',
    kind: 'chart',
  },
] as const;

const PRODUCTS = [
  { icon: Images, title: 'Fahrzeugbilder', text: 'Professionelle Außen- und Innenansichten im einheitlichen Showroom.' },
  { icon: Share2, title: 'Social Media', text: 'Passende Posts und Banner in allen wichtigen Formaten.' },
  { icon: Video, title: 'Video & 360°', text: 'Bewegte Präsentationen und interaktive Rundumansichten.' },
  { icon: FileText, title: 'Verkaufsseiten', text: 'Fahrzeugdaten und Medien auf einer klaren Angebotsseite.' },
];

function StepVisual({ kind }: { kind: (typeof STEPS)[number]['kind'] }) {
  if (kind === 'phone') {
    return (
      <div className="relative mx-auto mt-6 h-36 w-full overflow-hidden rounded-md bg-secondary">
        <img src={stepPlaceholderImage} alt="Platzhalter für eine Fahrzeugaufnahme mit dem Smartphone" className="h-full w-full object-cover" />
        <div className="absolute inset-y-3 left-1/2 w-16 -translate-x-1/2 rounded-lg border-[3px] border-foreground bg-card p-1 shadow-elevated">
          <img src={stepPlaceholderImage} alt="" className="h-full w-full rounded-sm object-cover" />
        </div>
      </div>
    );
  }

  if (kind === 'single') {
    return (
      <div className="mt-6 h-36 overflow-hidden rounded-md bg-secondary">
        <img src={heroImage} alt="Platzhalter für ein KI-veredeltes Fahrzeugbild" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (kind === 'grid') {
    return (
      <div className="mt-6 grid h-36 grid-cols-2 gap-1.5 overflow-hidden rounded-md bg-secondary p-1.5">
        {[0, 1, 2, 3].map((item) => (
          <img key={item} src={heroImage} alt="" className="h-full min-h-0 w-full rounded-sm object-cover" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative mt-6 flex h-36 flex-col justify-end overflow-hidden rounded-md bg-primary/5 px-5 pb-4">
      <svg viewBox="0 0 180 72" className="h-16 w-full text-primary" aria-hidden="true">
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
      <PublicHeader />

      <main>
        <section className="overflow-hidden border-b border-border bg-card">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-10 pt-12 sm:px-6 sm:pt-16 lg:min-h-[620px] lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:gap-4 lg:pb-14 lg:pt-14">
            <div className="relative z-10 max-w-xl lg:pr-3">
              <p className="text-xs font-bold uppercase text-primary">Für Autohäuser. Für mehr Umsatz.</p>
              <h1 className="mt-6 font-display text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.6rem]">
                Aus Fahrzeugfotos wird verkaufsstarkes Marketing.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                autohaus.ai erstellt aus deinen Fahrzeugfotos professionelle Bilder, Videos, Social-Media-Posts, Banner und Verkaufsseiten – automatisch, in Minuten, in deiner CI.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6 shadow-glow">
                  <Link to={destination}>Jetzt starten <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6">
                  <Link to="/produkte"><CirclePlay className="h-4 w-4" /> Produkte ansehen</Link>
                </Button>
              </div>
              <div className="mt-7 grid gap-2 text-sm text-muted-foreground">
                {BENEFITS.map((item) => (
                  <span key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{item}</span>
                ))}
              </div>
            </div>

            <div className="relative min-h-[400px] lg:-mr-20 lg:min-h-[520px]">
              <div className="absolute inset-0 overflow-hidden rounded-l-lg bg-card">
                <img
                  src={heroImage}
                  alt="Professionell aufbereitetes Fahrzeug im hellen Studio"
                  width={1600}
                  height={1000}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-card via-card/55 via-35% to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-card/40 via-transparent to-transparent" />
              </div>

              <div className="absolute right-4 top-5 max-w-[180px] rounded-lg border border-border bg-card px-5 py-4 shadow-elevated sm:right-9 sm:top-8">
                <p className="font-display text-lg font-bold italic leading-tight">Ein Foto.<br />Viele Möglichkeiten.</p>
                <span className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 border-b border-r border-border bg-card" />
              </div>

              <div className="absolute right-4 top-32 w-[190px] rounded-lg border border-border bg-card/95 p-4 shadow-elevated backdrop-blur sm:right-9 sm:top-36">
                <div className="space-y-3.5">
                  {OUTPUTS.map((output) => (
                    <div key={output.label} className="flex items-center gap-3 text-xs font-medium">
                      <output.icon className="h-4 w-4 text-primary" />
                      <span>{output.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-3 left-3 right-3 grid grid-cols-4 gap-2 sm:bottom-5 sm:left-16 sm:right-6">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="aspect-[4/3] overflow-hidden rounded-md border-2 border-card bg-card shadow-card">
                    <img src={heroImage} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative -mt-px bg-card px-4 pb-10 sm:px-6">
          <div className="mx-auto grid max-w-7xl grid-cols-2 overflow-hidden rounded-lg border border-border bg-card shadow-card md:grid-cols-4">
            {[
              ['Wenige Min.', 'bis zum Ergebnis'],
              ['18+', 'Perspektiven'],
              ['Professionelle', 'Ergebnisse'],
              ['WLTP-konform', 'für relevante Portale'],
            ].map(([value, label], index) => (
              <div key={value} className={`px-4 py-6 text-center ${index % 2 !== 0 ? 'border-l border-border' : ''} ${index > 1 ? 'border-t border-border md:border-t-0' : ''} md:border-l md:first:border-l-0`}>
                <p className="text-xl font-bold sm:text-2xl">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="produkte" className="py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">So einfach funktioniert autohaus.ai</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <article key={step.num} className="flex min-h-[390px] flex-col rounded-lg border border-border bg-card p-5 shadow-card">
                  <span className="text-3xl font-bold text-muted-foreground/30">{step.num}</span>
                  <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">{step.text}</p>
                  <div className="mt-auto"><StepVisual kind={step.kind} /></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="referenzen" className="pb-16 sm:pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:px-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquareQuote className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <blockquote className="font-display text-lg font-semibold leading-7 sm:text-xl">„Mit autohaus.ai sparen wir pro Fahrzeug wertvolle Zeit und präsentieren unseren Bestand durchgehend professionell.“</blockquote>
                <p className="mt-2 text-xs text-muted-foreground">Beispiel für eine Kundenstimme · wird nach Lieferung deiner Referenzen ersetzt</p>
              </div>
              <Button asChild variant="ghost" className="justify-start text-primary sm:justify-center">
                <Link to="/referenzen">Referenzen ansehen <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="leistungen" className="border-y border-border bg-secondary/60 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold text-primary">Eine Plattform</p>
                <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Alles für deine digitale Fahrzeugpräsentation.</h2>
              </div>
              <Button asChild variant="outline"><Link to="/pricing">Pakete vergleichen <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRODUCTS.map((product) => (
                <article key={product.title} className="rounded-lg border border-border bg-card p-6 shadow-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground"><product.icon className="h-5 w-5" /></div>
                  <h3 className="mt-6 font-semibold">{product.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{product.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="unternehmen" className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 rounded-lg bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-bold">Bereit für modernes Fahrzeugmarketing?</h2>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/75">Starte mit deinen eigenen Fahrzeugfotos und erlebe den vollständigen Ablauf direkt.</p>
            </div>
            <Button asChild size="lg" variant="secondary"><Link to={destination}>Jetzt starten <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}