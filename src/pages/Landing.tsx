import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Camera,
  Check,
  FileText,
  Images,
  MessageSquareQuote,
  MonitorSmartphone,
  Play,
  Share2,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import heroImage from '@/assets/autohaus-ai-hero.jpg';

const STEPS = [
  { num: '01', icon: Camera, title: 'Fahrzeug fotografieren', text: 'Ein einfaches Foto genügt. Direkt vom Hof, ohne Studio und ohne Spezialausrüstung.' },
  { num: '02', icon: WandSparkles, title: 'KI optimiert das Motiv', text: 'autohaus.ai remastert das Fahrzeug originalgetreu und setzt es in deinen gewählten Showroom.' },
  { num: '03', icon: Share2, title: 'Inhalte automatisch erstellen', text: 'Bilder, Banner, Videos und Verkaufsseiten entstehen aus denselben Fahrzeugdaten.' },
  { num: '04', icon: BarChart3, title: 'Schneller vermarkten', text: 'Freigeben, herunterladen und auf deinen Kanälen veröffentlichen – konsistent in deiner Marke.' },
];

const PRODUCTS = [
  { icon: Images, title: 'Fahrzeugbilder', text: 'Professionelle Außen- und Innenansichten im einheitlichen Showroom.' },
  { icon: Share2, title: 'Social Media', text: 'Passende Posts und Banner in den relevanten Formaten.' },
  { icon: Video, title: 'Video & 360°', text: 'Bewegte Präsentationen und interaktive Rundumansichten.' },
  { icon: FileText, title: 'Verkaufsseiten', text: 'Fahrzeugdaten und Medien auf einer klaren Angebotsseite.' },
];

export default function Landing() {
  const { user } = useAuth();
  const destination = user ? '/generator' : '/auth?plan=free';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-border bg-white">
          <div className="mx-auto grid min-h-[680px] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:py-20">
            <div className="relative z-10 max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> KI-Fahrzeugmarketing für den Handel
              </div>
              <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Aus einem Foto wird dein gesamtes Fahrzeugmarketing.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
                Professionelle Fahrzeugbilder, Social-Media-Inhalte, Videos und Verkaufsseiten – schnell, einheitlich und passend zu deinem Autohaus.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 px-6 shadow-glow">
                  <Link to={destination}>Kostenlos testen <ArrowRight className="h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 px-6 bg-white">
                  <a href="#produkte"><Play className="h-4 w-4 fill-current" /> Produkte ansehen</a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {['10 Credits zum Start', 'Keine Kreditkarte nötig', 'Ausschließlich für Unternehmen'].map((item) => (
                  <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" />{item}</span>
                ))}
              </div>
            </div>

            <div className="relative lg:-mr-28">
              <div className="absolute -inset-10 -z-10 rounded-full bg-primary/5 blur-3xl" />
              <img
                src={heroImage}
                alt="Schwarzes Fahrzeug im hellen virtuellen Showroom"
                width={1600}
                height={1000}
                className="aspect-[8/5] w-full rounded-lg border border-border object-cover shadow-elevated"
              />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-md border border-white/70 bg-white/90 px-4 py-3 shadow-card backdrop-blur">
                <div><p className="text-xs text-muted-foreground">KI-Remastering</p><p className="text-sm font-semibold">Showroom-Aufnahme fertig</p></div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Bereit</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-slate-50/70 py-7">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 text-center sm:px-6 md:grid-cols-4">
            {[['6', 'Fahrzeugklassen'], ['16+', 'Perspektiven'], ['360°', 'Fahrzeugansicht'], ['1', 'zentrale Plattform']].map(([value, label]) => (
              <div key={label}><p className="text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
            ))}
          </div>
        </section>

        <section id="produkte" className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">So funktioniert autohaus.ai</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Vom Fahrzeug zur fertigen Kampagne.</h2>
              <p className="mt-4 text-muted-foreground">Ein klarer Prozess ohne Medienbruch – entwickelt für den täglichen Einsatz im Fahrzeughandel.</p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <article key={step.num} className="group bg-card p-7 transition-colors hover:bg-primary/[0.025]">
                  <div className="flex items-center justify-between"><step.icon className="h-5 w-5 text-primary" /><span className="text-xs font-bold text-primary/50">{step.num}</span></div>
                  <h3 className="mt-10 font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-slate-50/70 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-2xl"><p className="text-sm font-semibold text-primary">Eine Plattform</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Alles für deine digitale Fahrzeugpräsentation.</h2></div>
              <Button asChild variant="outline"><Link to="/pricing">Pakete vergleichen <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PRODUCTS.map((product) => (
                <article key={product.title} className="rounded-lg border border-border bg-white p-6 shadow-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white"><product.icon className="h-5 w-5" /></div>
                  <h3 className="mt-6 font-semibold">{product.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{product.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="referenzen" className="py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
            <div className="overflow-hidden rounded-lg border border-border bg-slate-50 p-3 shadow-card">
              <img src={heroImage} alt="Professionelle Fahrzeugdarstellung mit autohaus.ai" loading="lazy" width={1600} height={1000} className="aspect-[4/3] w-full rounded-md object-cover" />
            </div>
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"><MessageSquareQuote className="h-5 w-5" /></div>
              <blockquote className="mt-6 font-display text-2xl font-semibold leading-snug sm:text-3xl">„Ein einheitlicher Auftritt für jedes Fahrzeug – ohne zusätzliches Fotostudio und ohne komplizierte Agenturprozesse.“</blockquote>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">autohaus.ai verbindet Fahrzeugdaten, Bildbearbeitung und Vermarktung in einem nachvollziehbaren Arbeitsablauf.</p>
              <div className="mt-7 flex items-center gap-3 text-sm font-semibold"><MonitorSmartphone className="h-4 w-4 text-primary" /> Für Autohäuser, Händler und Fahrzeuggruppen</div>
            </div>
          </div>
        </section>

        <section id="unternehmen" className="px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-lg bg-primary px-6 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-2xl"><h2 className="font-display text-3xl font-bold tracking-tight">Bereit für modernes Fahrzeugmarketing?</h2><p className="mt-3 text-sm leading-6 text-white/75">Starte mit 10 Credits und erlebe den vollständigen Ablauf direkt mit deinem Fahrzeug.</p></div>
            <Button asChild size="lg" className="mt-7 bg-white text-primary hover:bg-white/90 lg:mt-0"><Link to={destination}>Jetzt kostenlos testen <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}