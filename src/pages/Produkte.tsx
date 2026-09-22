import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CirclePlay,
  FileText,
  Images,
  Instagram,
  LayoutTemplate,
  Share2,
  Sparkles,
  Video,
} from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import heroImage from '@/assets/autohaus-ai-hero.jpg';

interface ProductModule {
  id: string;
  icon: typeof Images;
  title: string;
  subtitle: string;
  features: string[];
  visual: 'single' | 'social' | 'banner' | 'landing' | 'video' | 'assistant';
  creditHint: string;
}

const MODULES: ProductModule[] = [
  {
    id: 'fahrzeugbilder',
    icon: Images,
    title: 'Fahrzeugbilder',
    subtitle: 'Professionelle Bilder aus jedem Foto – Außen- und Innenansichten im einheitlichen Showroom.',
    features: [
      'KI-optimiert (Licht, Farben, Perspektiven)',
      'Hintergründe entfernen oder austauschen',
      'Perfekt für alle Portale',
      'Bis zu 18+ Perspektiven pro Fahrzeug',
    ],
    visual: 'single',
    creditHint: '16 Credits pro kompletter Fahrzeugserie',
  },
  {
    id: 'social-media',
    icon: Share2,
    title: 'Social Media',
    subtitle: 'Fertige Posts für Instagram, Facebook & Co. – automatisch aus deinen Fahrzeugdaten.',
    features: [
      'Verkaufsstarke Vorlagen',
      'Automatisch mit Fahrzeugdaten',
      'In deiner CI',
      'Alle gängigen Formate wählbar',
    ],
    visual: 'social',
    creditHint: '5 Credits pro Post',
  },
  {
    id: 'banner',
    icon: LayoutTemplate,
    title: 'Banner',
    subtitle: 'Professionelle Banner für Web und Portale – verschiedene Formate, automatisch gestaltet.',
    features: [
      'Verschiedene Formate',
      'Automatisch gestaltet',
      'Mit deiner CI',
      'Für Website, Google und Portale',
    ],
    visual: 'banner',
    creditHint: '5 Credits pro Banner',
  },
  {
    id: 'landingpages',
    icon: FileText,
    title: 'Landingpages',
    subtitle: 'Verkaufsstarke Fahrzeugseiten – automatisch aus deinen Daten, mobil-optimiert.',
    features: [
      'Automatisch aus deinen Daten',
      'Mobil-optimiert',
      'Mit Anfrageformular',
      'Inklusive Fahrzeugdaten und Pflichtangaben',
    ],
    visual: 'landing',
    creditHint: '19 Credits pro Landingpage',
  },
  {
    id: 'video',
    icon: Video,
    title: 'Video',
    subtitle: 'Dynamische Fahrzeugvideos – automatisch aus Fotos, ideal für Social Media und deine Website.',
    features: [
      'Automatisch aus Fotos',
      'Mit Texten, Musik und Branding',
      'Formate 16:9 oder 9:16',
      'Ideal für Social Media und Website',
    ],
    visual: 'video',
    creditHint: '17 Credits pro Video',
  },
  {
    id: 'ki-verkaufsassistent',
    icon: Sparkles,
    title: 'KI-Verkaufsassistent',
    subtitle: 'Automatische Texte & Highlights – individuell pro Fahrzeug, spart Zeit im Verkauf.',
    features: [
      'Automatische Texte & Highlights',
      'Individuell pro Fahrzeug',
      'Mehr qualifizierte Anfragen',
      'Spart Zeit im Verkauf',
    ],
    visual: 'assistant',
    creditHint: 'Im Paket enthalten',
  },
];

function ModuleVisual({ kind }: { kind: ProductModule['visual'] }) {
  if (kind === 'single') {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-secondary shadow-card">
        <img src={heroImage} alt="Muster: professionell aufbereitetes Fahrzeugbild" className="aspect-[16/10] w-full object-cover" />
      </div>
    );
  }

  if (kind === 'social') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[Instagram, Share2].map((Icon, index) => (
          <div key={index} className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold">Muster-Post</span>
            </div>
            <img src={heroImage} alt="" className="aspect-square w-full object-cover" />
            <p className="px-3 py-2 text-[10px] leading-4 text-muted-foreground">Bereit für dein nächstes Fahrzeug-Posting.</p>
          </div>
        ))}
      </div>
    );
  }

  if (kind === 'banner') {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-lg border border-border shadow-card">
          <img src={heroImage} alt="" className="aspect-[3/1] w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-between bg-gradient-to-r from-foreground/80 via-foreground/40 to-transparent px-5">
            <p className="font-display text-sm font-bold text-card sm:text-lg">Stil. Leistung. Zuverlässigkeit.</p>
            <span className="rounded-md bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground sm:text-xs">Jetzt entdecken</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((item) => (
            <div key={item} className="relative overflow-hidden rounded-md border border-border shadow-card">
              <img src={heroImage} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/70 to-transparent p-2">
                <p className="text-[10px] font-bold text-card">Muster-Banner {item + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === 'landing') {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <img src={heroImage} alt="Muster: Fahrzeug-Landingpage" className="aspect-[16/9] w-full object-cover" />
        <div className="space-y-2 p-4">
          <p className="font-display text-sm font-bold">Der neue Mercedes-Benz GLC</p>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-8 rounded bg-secondary" />
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-primary">Muster-Fahrzeugseite</span>
            <span className="rounded-md bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground">Jetzt anfragen</span>
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className="relative overflow-hidden rounded-lg border border-border shadow-card">
        <img src={heroImage} alt="Muster: Fahrzeugvideo" className="aspect-[16/10] w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-elevated">
            <CirclePlay className="h-7 w-7 text-primary" />
          </span>
        </div>
        <span className="absolute bottom-3 right-3 rounded bg-foreground/80 px-2 py-0.5 text-[10px] font-bold text-card">0:28</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="text-xs font-bold">KI-Verkaufsassistent</p>
      </div>
      <div className="mt-4 space-y-3">
        <div className="rounded-md bg-secondary p-3">
          <p className="text-[10px] font-semibold text-muted-foreground">Was macht dieses Fahrzeug besonders?</p>
        </div>
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-[11px] leading-4">Dieser BMW X5 überzeugt durch seine sportliche Optik, modernste Ausstattung und viele Extras …</p>
        </div>
      </div>
    </div>
  );
}

export default function Produkte() {
  const { user } = useAuth();
  const destination = user ? '/generator' : '/auth?plan=free';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main>
        <section className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 sm:py-20">
            <p className="text-xs font-bold uppercase text-primary">Eine Plattform. Alle Werbemittel.</p>
            <h1 className="mx-auto mt-5 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">
              Leistungsstarke Tools für modernes Fahrzeugmarketing.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              autohaus.ai unterstützt dich bei jedem Schritt – von der Aufnahme bis zur finalen Vermarktung. Ob Social Media, Banner, Landingpages, Videos oder Verkaufstexte – alles aus einer Hand.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6">
            {MODULES.map((module) => (
              <article
                key={module.id}
                id={module.id}
                className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-card sm:p-7"
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <module.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold">{module.title}</h2>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{module.subtitle}</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1.2fr] sm:items-start">
                  <ul className="space-y-2.5">
                    {module.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm leading-5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <ModuleVisual kind={module.visual} />
                </div>
                <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                  {module.creditHint}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-secondary/60 px-4 py-12 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-start gap-4 rounded-lg border border-border bg-card p-6 shadow-card sm:items-center sm:p-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <p className="text-sm leading-6 text-muted-foreground sm:text-base">
              <span className="font-semibold text-foreground">Alle Module sind nahtlos miteinander verbunden</span> – für einen effizienten, durchgängigen Vermarktungsprozess.
            </p>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-7 rounded-lg bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-bold">Bereit für modernes Fahrzeugmarketing?</h2>
              <p className="mt-3 text-sm leading-6 text-primary-foreground/75">Starte mit deinen eigenen Fahrzeugfotos und erlebe alle Module direkt im Portal.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary"><Link to={destination}>Jetzt starten <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/pricing">Preise ansehen</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
