import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Bookmark, Car, Check, ChevronLeft, ChevronRight, Clock3, Globe, Heart, Image as ImageIcon,
  LayoutTemplate, MessageCircle, MoreHorizontal, PanelsTopLeft, PenLine, Send, Smartphone, Upload, UserRound, Video,
} from 'lucide-react';
import { siFacebook, siGoogle, siInstagram, siTiktok, siX, siYoutube, type SimpleIcon } from 'simple-icons';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution, captureLastTouch } from '@/lib/funnel-attribution';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { cn } from '@/lib/utils';

const TEST_URL = '/fahrzeug-testen?source=werbemittel';

/* ---------- Plattform-Icons (Markenzeichen in Originalfarbe) ---------- */

function BrandIcon({ icon, label }: { icon: SimpleIcon; label: string }) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 24 24" className="h-6 w-6" fill={`#${icon.hex}`}>
      <path d={icon.path} />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg role="img" aria-label="LinkedIn" viewBox="0 0 24 24" className="h-6 w-6">
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path fill="#fff" d="M6.9 9.4h2.6V18H6.9zM8.2 5.3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM11.1 9.4h2.5v1.2c.4-.7 1.3-1.4 2.6-1.4 2.7 0 3.2 1.8 3.2 4.1V18h-2.6v-4.1c0-1 0-2.2-1.4-2.2s-1.6 1.1-1.6 2.2V18h-2.7z" />
    </svg>
  );
}

function IconGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2.5">{children}</div>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </div>
  );
}

/* ---------- Platzhalter (später durch echte Medien ersetzbar) ---------- */

function MediaPlaceholder({ label, ratio, className, kind = 'image' }: { label: string; ratio: string; className?: string; kind?: 'image' | 'video' }) {
  const Icon = kind === 'video' ? Video : ImageIcon;
  return (
    <div className={cn('flex w-full flex-col items-center justify-center gap-1.5 bg-muted text-muted-foreground', className)} style={{ aspectRatio: ratio }}>
      <Icon className="h-5 w-5 opacity-60" aria-hidden />
      <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
    </div>
  );
}

function SocialFrame({ label = 'Social-Media-Motiv', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-card', className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent">ai</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[11px] font-bold">autohaus.ai</p>
          <p className="text-[9px] text-muted-foreground">Gesponsert</p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <MediaPlaceholder label={label} ratio="1 / 1" />
      <div className="flex items-center gap-3 px-3 py-2 text-foreground/70">
        <Heart className="h-4 w-4" aria-hidden /><MessageCircle className="h-4 w-4" aria-hidden /><Send className="h-4 w-4" aria-hidden />
        <Bookmark className="ml-auto h-4 w-4" aria-hidden />
      </div>
    </div>
  );
}

function StoryFrame({ label = 'Fahrzeugclip', className, video = true }: { label?: string; className?: string; video?: boolean }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border-4 border-foreground bg-foreground shadow-card', className)}>
      <MediaPlaceholder label={label} ratio="9 / 16" kind={video ? 'video' : 'image'} className="rounded-xl" />
    </div>
  );
}

function BrowserFrame({ label = 'Fahrzeugseite', className, ratio = '4 / 3' }: { label?: string; className?: string; ratio?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-card', className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 h-3 flex-1 rounded bg-muted" />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-display text-[11px] font-bold">autohaus<span className="text-accent">.ai</span></span>
        <span className="rounded bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">Fahrzeug anfragen</span>
      </div>
      <MediaPlaceholder label={label} ratio={ratio} />
    </div>
  );
}

function BannerFrame({ label, ratio, className }: { label: string; ratio: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-card', className)}>
      <MediaPlaceholder label={label} ratio={ratio} />
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5">
        <span className="text-[10px] font-bold">autohaus<span className="text-accent">.ai</span></span>
        <span className="rounded bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">Jetzt entdecken</span>
      </div>
    </div>
  );
}

/* ---------- Slider-Inhalte ---------- */

type Slide = { key: string; width: string; node: ReactNode };
type Category = { id: string; label: string; description: string; slides: Slide[] };

const CATEGORIES: Category[] = [
  {
    id: 'social', label: 'Social Media', description: 'Posts und Stories für dein Fahrzeugangebot.',
    slides: [
      { key: 'post', width: 'w-[260px] sm:w-[300px]', node: <SocialFrame label="Feed-Post (1:1)" /> },
      { key: 'story', width: 'w-[180px] sm:w-[210px]', node: <StoryFrame label="Story (9:16)" video={false} /> },
      { key: 'post2', width: 'w-[260px] sm:w-[300px]', node: <SocialFrame label="Feed-Post (1:1)" /> },
    ],
  },
  {
    id: 'banner', label: 'Display-Banner', description: 'Dein Fahrzeugangebot in passenden Formaten für Display-Werbung.',
    slides: [
      { key: 'wide', width: 'w-[300px] sm:w-[440px]', node: <BannerFrame label="Breites Banner" ratio="728 / 180" /> },
      { key: 'square', width: 'w-[220px] sm:w-[260px]', node: <BannerFrame label="Quadratisches Motiv" ratio="1 / 1" /> },
      { key: 'tall', width: 'w-[100px] sm:w-[120px]', node: <BannerFrame label="Hohes Banner" ratio="160 / 600" /> },
    ],
  },
  {
    id: 'video', label: 'Videos', description: 'Kurze Fahrzeugclips für deine Videokanäle.',
    slides: [
      { key: 'vertical', width: 'w-[180px] sm:w-[210px]', node: <StoryFrame label="Fahrzeugclip (9:16)" /> },
      { key: 'landscape', width: 'w-[300px] sm:w-[440px]', node: <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card"><MediaPlaceholder label="Video (16:9)" ratio="16 / 9" kind="video" /></div> },
    ],
  },
  {
    id: 'pages', label: 'Fahrzeugseiten', description: 'Eine eigene Fahrzeugseite mit Angebotsinformationen und Kontaktmöglichkeit.',
    slides: [
      { key: 'desktop', width: 'w-[300px] sm:w-[460px]', node: <BrowserFrame label="Desktop-Vorschau" ratio="16 / 9" /> },
      { key: 'mobile', width: 'w-[180px] sm:w-[200px]', node: <StoryFrame label="Smartphone-Vorschau" video={false} /> },
    ],
  },
];

function FormatSlider() {
  const [cat, setCat] = useState(0);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slides = CATEGORIES[cat].slides;

  useEffect(() => { setActive(0); trackRef.current?.scrollTo({ left: 0 }); }, [cat]);

  const goTo = (i: number) => {
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    const track = trackRef.current;
    const el = track?.children[idx] as HTMLElement | undefined;
    if (track && el) track.scrollTo({ left: el.offsetLeft - track.offsetLeft - 16, behavior: 'smooth' });
    setActive(idx);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    let best = 0; let dist = Infinity;
    Array.from(track.children).forEach((c, i) => {
      const d = Math.abs((c as HTMLElement).offsetLeft - track.offsetLeft - 16 - track.scrollLeft);
      if (d < dist) { dist = d; best = i; }
    });
    setActive(best);
  };

  return (
    <div>
      <div role="tablist" aria-label="Formate" className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c, i) => (
          <button key={c.id} role="tab" aria-selected={cat === i} onClick={() => setCat(i)}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              cat === i ? 'bg-accent text-accent-foreground' : 'bg-card text-foreground hover:bg-muted')}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative mt-8">
        <button aria-label="Vorheriges Beispiel" onClick={() => goTo(active - 1)} disabled={active === 0}
          className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-card disabled:opacity-40 sm:flex">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div ref={trackRef} onScroll={onScroll} tabIndex={0} aria-roledescription="Slider" aria-label={CATEGORIES[cat].label}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); goTo(active + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(active - 1); } }}
          className="flex snap-x snap-mandatory items-center gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-16 [&::-webkit-scrollbar]:hidden">
          {slides.map((s, i) => (
            <div key={`${CATEGORIES[cat].id}-${s.key}`} className={cn('shrink-0 snap-start', s.width)} aria-label={`Beispiel ${i + 1} von ${slides.length}`}>{s.node}</div>
          ))}
          <div className="w-4 shrink-0 sm:w-12" aria-hidden />
        </div>
        <button aria-label="Nächstes Beispiel" onClick={() => goTo(active + 1)} disabled={active === slides.length - 1}
          className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card shadow-card disabled:opacity-40 sm:flex">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex justify-center gap-2">
        {slides.map((s, i) => (
          <button key={s.key} aria-label={`Beispiel ${i + 1} anzeigen`} aria-current={active === i} onClick={() => goTo(i)}
            className={cn('h-2.5 rounded-full transition-all', active === i ? 'w-6 bg-accent' : 'w-2.5 bg-muted-foreground/30')} />
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground" aria-live="polite">{CATEGORIES[cat].description}</p>
    </div>
  );
}

/* ---------- Inhalte ---------- */

const SPEED = [
  { icon: Clock3, label: 'In wenigen Minuten' },
  { icon: Smartphone, label: 'Direkt am Fahrzeug' },
  { icon: UserRound, label: 'Ohne zusätzliche Mitarbeiter' },
];

const STEPS = [
  { icon: Car, title: 'Fahrzeug auswählen', text: 'Dein fertiges Fahrzeugbild als Grundlage nutzen.' },
  { icon: LayoutTemplate, title: 'Werbemittel wählen', text: 'Motiv, Clip oder Fahrzeugseite auswählen.' },
  { icon: PenLine, title: 'Angebot ergänzen', text: 'Preis, Fahrzeugdaten und Botschaft hinzufügen.' },
  { icon: Upload, title: 'Veröffentlichen', text: 'Posten, veröffentlichen oder herunterladen.' },
];

const NOT_NEEDED = [
  ['Keine Agentur nötig', 'Deine Fahrzeugwerbung selbst erstellen.'],
  ['Keine Creator nötig', 'Motive und Clips direkt in der App erstellen.'],
  ['Keine langen Abstimmungen', 'Keine Briefings und Korrekturschleifen mit Dritten.'],
  ['Keine manuelle Formatgestaltung', 'Passende Vorlagen für deine Kanäle verwenden.'],
];

const FAQ: [string, string][] = [
  ['Welche Werbemittel kann ich mit autohaus.ai erstellen?', 'Du kannst Social-Media-Motive, Display-Banner, kurze Fahrzeugvideos und eigene Fahrzeugseiten erstellen. Deine Fahrzeugbilder bilden die visuelle Grundlage. Dazu ergänzt du die passenden Angebotsinformationen.'],
  ['Wie schnell entsteht fertiges Marketingmaterial?', 'Aus deinen fertigen Fahrzeugbildern entstehen in wenigen Minuten Motive, Banner oder kurze Clips. Auch Fahrzeugseiten lassen sich in wenigen Schritten erstellen. Die genaue Dauer hängt von der gewählten Funktion und dem Umfang ab.'],
  ['Kann ich die Inhalte direkt am Fahrzeug erstellen?', 'Ja. Du kannst direkt nach der Bildaufbereitung auf dem Smartphone mit deinem Fahrzeugmarketing weitermachen. Wähle das gewünschte Werbemittel, ergänze dein Angebot und erstelle das Ergebnis.'],
  ['Welche Bilder und Fahrzeugdaten brauche ich?', 'Nutze deine Fahrzeugbilder und ergänze die Informationen, die im jeweiligen Werbemittel erscheinen sollen, beispielsweise Modell, Preis und Angebotsbotschaft. Für eine Fahrzeugseite benötigst du zusätzlich die passenden Fahrzeug- und Kontaktdaten.'],
  ['Kann ich Logo und Farben meines Autohauses verwenden?', 'Du kannst dein Fahrzeugmarketing mit deinem Logo und deinen Autohausfarben gestalten. So erhalten Motive, Banner und Fahrzeugseiten einen zusammenhängenden Auftritt, der zu deinem Autohaus passt.'],
  ['Wie veröffentliche ich meine Inhalte?', 'Je nach Funktion und verbundenem Kanal kannst du Inhalte direkt veröffentlichen oder herunterladen und anschließend auf deinem gewünschten Kanal verwenden. Fahrzeugseiten werden als eigene Angebotsseiten veröffentlicht.'],
  ['Brauche ich eine Agentur oder einen Creator?', 'Für die Erstellung der gezeigten Fahrzeugmotive, Banner und Clips brauchst du keine externe Agentur und keinen zusätzlichen Creator. Du erstellst das Material selbst mit den Funktionen und Vorlagen von autohaus.ai.'],
  ['Was enthält eine Fahrzeugseite?', 'Eine Fahrzeugseite präsentiert dein Angebot mit Fahrzeugbildern, den bereitgestellten Fahrzeuginformationen und einer Kontaktmöglichkeit. Du kannst den Link nutzen, um Interessenten gezielt zu deinem Fahrzeugangebot zu führen.'],
];

export default function AutohausWerbemittel() {
  usePageMeta({
    title: 'Fahrzeugmarketing in wenigen Minuten – Social Media, Banner, Videos | autohaus.ai',
    description: 'Aus deinem Fahrzeugbild entstehen Social-Media-Motive, Display-Banner, kurze Videos und Fahrzeugseiten. In wenigen Minuten, direkt am Fahrzeug, passend zu deinem Autohaus.',
    canonicalPath: '/autohaus-werbemittel',
  });

  useEffect(() => { captureAttribution('lp_werbemittel'); captureLastTouch(); }, []);

  useEffect(() => {
    const sent = new Set<number>();
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = (window.scrollY / max) * 100;
      for (const t of [50, 90]) {
        if (pct >= t && !sent.has(t)) {
          sent.add(t);
          trackFunnelEvent('scroll_depth', { step: `scroll_${t}`, percent: t });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <FunnelLayout
      ctaHref={TEST_URL}
      ctaLabel="Kostenlos testen"
      anchors={[{ href: '#so-funktionierts', label: "So funktioniert's" }, { href: '#formate', label: 'Formate' }, { href: '#fragen', label: 'Fragen' }]}
    >
      {/* 1 · Header */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:py-16">
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl">Aus deinem Fahrzeugbild wird dein nächstes Marketing.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Social-Media-Motive, kurze Videos und Fahrzeugseiten. In wenigen Minuten. Passend zu deinem Autohaus.</p>
            <Button asChild size="lg" className="mt-7 w-full bg-accent text-accent-foreground shadow-glow hover:bg-accent/90 sm:w-auto">
              <Link to={TEST_URL} data-cta="werbemittel_test">Marketing erstellen lassen{"\n"} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 items-start gap-8 sm:grid-cols-3 sm:gap-4">
            <div className="flex flex-col items-center gap-4">
              <SocialFrame className="w-full max-w-[260px]" />
              <IconGroup label="Social Media">
                <BrandIcon icon={siInstagram} label="Instagram" /><BrandIcon icon={siFacebook} label="Facebook" /><LinkedInIcon /><BrandIcon icon={siX} label="X" />
              </IconGroup>
              <IconGroup label="Display-Banner"><BrandIcon icon={siGoogle} label="Google" /></IconGroup>
            </div>
            <div className="flex flex-col items-center gap-4">
              <StoryFrame className="w-full max-w-[180px]" />
              <IconGroup label="Video"><BrandIcon icon={siTiktok} label="TikTok" /><BrandIcon icon={siYoutube} label="YouTube" /></IconGroup>
            </div>
            <div className="flex flex-col items-center gap-4">
              <BrowserFrame className="w-full max-w-[260px]" />
              <IconGroup label="Fahrzeugseite"><PanelsTopLeft className="h-6 w-6 text-foreground" aria-label="Website" /></IconGroup>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · Geschwindigkeit */}
      <section className="border-b border-border bg-card py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">In wenigen Minuten. Direkt am Fahrzeug.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Aus deinem fertigen Fahrzeugbild entstehen Motive, Clips und Fahrzeugseiten. Direkt auf dem Smartphone.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-border">
            {SPEED.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center justify-center gap-3 py-2">
                <Icon className="h-8 w-8 text-accent" strokeWidth={1.5} aria-hidden />
                <span className="text-sm font-bold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 · Format-Slider */}
      <section id="formate" className="scroll-mt-20 bg-secondary/40 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Ein Fahrzeug. Dein Marketing für mehrere Kanäle.</h2>
          <div className="mt-6"><FormatSlider /></div>
        </div>
      </section>

      {/* 4 · Ablauf */}
      <section id="so-funktionierts" className="scroll-mt-20 bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">In vier Schritten zum fertigen Fahrzeugmarketing.</h2>
          <p className="mt-3 text-center text-sm text-muted-foreground">Direkt nach der Bildaufbereitung. Direkt am Fahrzeug.</p>
          <ol className="relative mt-10 grid gap-8 md:grid-cols-4 md:gap-4">
            <span className="absolute left-[12.5%] right-[12.5%] top-4 hidden h-0.5 bg-accent/60 md:block" aria-hidden />
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="relative flex items-start gap-4 md:flex-col md:items-center md:text-center">
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                <div className="md:flex md:flex-col md:items-center">
                  <Icon className="h-7 w-7 text-foreground md:mt-4" strokeWidth={1.5} aria-hidden />
                  <h3 className="mt-2 font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5 · Was entfällt */}
      <section className="bg-accent/10 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Mehr Fahrzeugmarketing. Weniger Vorbereitung.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {NOT_NEEDED.map(([title, text]) => (
              <article key={title} className="flex gap-3 rounded-xl border border-border bg-card p-5 shadow-card">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · Branding */}
      <section className="bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-2xl font-bold sm:text-3xl">Nicht irgendeine Werbung. Deine Werbung.</h2>
          <p className="mt-2 text-center font-display text-lg font-bold text-accent">Dein Logo. Deine Farben. Dein Angebot.</p>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-6 text-muted-foreground">Dein Logo, deine Farben und deine Angebotsbotschaft geben den Auftritt vor. So passt dein Fahrzeugmarketing zu deinem Autohaus.</p>
          <div className="mt-10 grid items-start gap-6 md:grid-cols-[.8fr_1.1fr_1.1fr]">
            <figure><figcaption className="mb-2 text-xs font-semibold text-muted-foreground">Social Media</figcaption><SocialFrame /></figure>
            <figure><figcaption className="mb-2 text-xs font-semibold text-muted-foreground">Display-Banner</figcaption><BannerFrame label="Display-Banner" ratio="4 / 3" /></figure>
            <figure><figcaption className="mb-2 text-xs font-semibold text-muted-foreground">Fahrzeugseite</figcaption><BrowserFrame /></figure>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Beispieldesign mit autohaus.ai. Für dein Autohaus individuell anpassbar.</p>
        </div>
      </section>

      {/* 7 · FAQ */}
      <section id="fragen" className="scroll-mt-20 border-t border-border bg-secondary/40 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">FAQ</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Fragen zum Fahrzeugmarketing</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQ.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`} className="rounded-lg border border-border bg-card px-5 shadow-card last:border-b">
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{q}</AccordionTrigger>
                <AccordionContent forceMount data-faq-answer className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 8 · Abschluss-CTA */}
      <section className="bg-accent px-4 py-14 text-center text-accent-foreground sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Nimm ein Fahrzeug aus deinem Bestand.</h2>
        <p className="mt-1 font-display text-xl sm:text-2xl">Mach dein nächstes Marketing daraus.</p>
        <p className="mt-3 text-sm opacity-90">In wenigen Minuten. Direkt am Fahrzeug.</p>
        <Button asChild size="lg" variant="secondary" className="mt-6">
          <Link to={TEST_URL} data-cta="werbemittel_test">Kostenlos testen <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </section>
    </FunnelLayout>
  );
}
