import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Bookmark, Car, Check, Clock3, Globe, Heart, Image as ImageIcon,
  LayoutTemplate, MessageCircle, MoreHorizontal, PenLine, Send, Smartphone, Upload, UserRound, Video, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution, captureLastTouch } from '@/lib/funnel-attribution';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelAlt, getAiDisclosureLabelVector, getAiDisclosureText } from '@/lib/ai-disclosure';
import { cn } from '@/lib/utils';
import logoInstagram from '@/assets/funnel/logo-instagram.png.asset.json';
import logoFacebook from '@/assets/funnel/logo-facebook.png.asset.json';
import logoLinkedin from '@/assets/funnel/logo-linkedin.png.asset.json';
import logoX from '@/assets/funnel/logo-x.png.asset.json';
import logoGoogle from '@/assets/funnel/logo-google.png.asset.json';
import logoTiktok from '@/assets/funnel/logo-tiktok.png.asset.json';
import logoYoutube from '@/assets/funnel/logo-youtube.png.asset.json';
import logoWebsite from '@/assets/funnel/logo-website.png.asset.json';
import socialPostVelmora from '@/assets/funnel/social-post-velmora-v2.webp.asset.json';
import facebookAdVelmora from '@/assets/funnel/facebook-ad-velmora.png.asset.json';
import storyVelmora from '@/assets/story-velmora.webp.asset.json';
import clipHeadlights from '@/assets/funnel/fahrzeugscheinwerfer-blinken.mp4.asset.json';
import clipHeadlightsPoster from '@/assets/funnel/fahrzeugscheinwerfer-blinken-poster.jpg.asset.json';
import clipHeadlightsWebm from '@/assets/funnel/fahrzeugscheinwerfer-blinken.webm.asset.json';
import headerMockup from '@/assets/funnel/header-mockup-content-2.png.asset.json';

const TEST_URL = '/fahrzeug-testen?source=werbemittel';

/* ---------- Plattform-Icons (Markenzeichen in Originalfarbe) ---------- */


function BrandImage({ src, label }: { src: string; label: string }) {
  return (
    <img
      src={src}
      alt={label}
      className="h-[60px] w-[60px] rounded-[12px] origin-center transition-transform duration-300 ease-out will-change-transform hover:scale-125"
      loading="lazy"
    />
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

function SocialFrame({ label = 'Social-Media-Motiv', className, imageSrc }: { label?: string; className?: string; imageSrc?: string }) {
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
      {imageSrc ? (
        <img src={imageSrc} alt={label} className="aspect-square w-full object-cover" loading="lazy" />
      ) : (
        <MediaPlaceholder label={label} ratio="1 / 1" />
      )}
      <div className="flex items-center gap-3 px-3 py-2 text-foreground/70">
        <Heart className="h-4 w-4" aria-hidden /><MessageCircle className="h-4 w-4" aria-hidden /><Send className="h-4 w-4" aria-hidden />
        <Bookmark className="ml-auto h-4 w-4" aria-hidden />
      </div>
    </div>
  );
}

function FacebookAdFrame({
  label = 'Facebook-Anzeige',
  className,
  imageSrc,
}: {
  label?: string;
  className?: string;
  imageSrc: string;
}) {
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
      <div className="w-full bg-white" style={{ aspectRatio: '16 / 9' }}>
        <img src={imageSrc} alt={label} className="h-full w-full object-contain" loading="lazy" />
      </div>
      <div className="flex items-center gap-3 px-3 py-2 text-foreground/70">
        <Heart className="h-4 w-4" aria-hidden /><MessageCircle className="h-4 w-4" aria-hidden /><Send className="h-4 w-4" aria-hidden />
        <Bookmark className="ml-auto h-4 w-4" aria-hidden />
      </div>
    </div>
  );
}

function AiMark() {
  return (
    <img
      src={getAiDisclosureLabelVector('landing')}
      alt={getAiDisclosureLabelAlt('landing')}
      title={getAiDisclosureText('landing')}
      className={AI_DISCLOSURE_OVERLAY_CLASS}
    />
  );
}

const HEADLIGHT_CLIP = {
  webm: clipHeadlightsWebm.url,
  mp4: clipHeadlights.url,
  poster: clipHeadlightsPoster.url,
};

function StoryFrame({
  label = 'Fahrzeugclip',
  className,
  video = true,
  clip,
  imageSrc,
  pageSrc,
}: {
  label?: string;
  className?: string;
  video?: boolean;
  clip?: { webm: string; mp4: string; poster: string };
  imageSrc?: string;
  pageSrc?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border-4 border-foreground bg-foreground shadow-card', className)}>
      {pageSrc ? (
        <ScaledPagePreview src={pageSrc} viewportWidth={390} className="w-full rounded-xl" style={{ aspectRatio: '9 / 16' }} />
      ) : clip ? (
        <>
          <video
            poster={clip.poster}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            aria-label={label}
            className="aspect-[9 / 16] w-full rounded-xl object-cover"
          >
            <source src={clip.webm} type="video/webm" />
            <source src={clip.mp4} type="video/mp4" />
          </video>
          <AiMark />
        </>
      ) : imageSrc ? (
        <img
          src={imageSrc}
          alt={label}
          className="aspect-[9 / 16] w-full rounded-xl object-cover"
          loading="lazy"
        />
      ) : (
        <MediaPlaceholder label={label} ratio="9 / 16" kind={video ? 'video' : 'image'} className="rounded-xl" />
      )}
    </div>
  );
}

const VEHICLE_PAGE_URL = '/previews/velmora-nerys-angebot.html';
const VEHICLE_PAGE_PREVIEW_EVENT = 'open-vehicle-page-preview';

function ScaledPagePreview({ src, className, viewportWidth = 1280, style }: { src: string; className?: string; viewportWidth?: number; style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  const [height, setHeight] = useState(960);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const nextScale = el.clientWidth / viewportWidth;
      if (nextScale <= 0) return;
      setScale(nextScale);
      setHeight(el.clientHeight / nextScale);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewportWidth]);
  return (
    <div ref={containerRef} className={cn('relative overflow-hidden bg-white', className)} style={style}>
      <iframe
        src={src}
        title="Fahrzeugseite Vorschau"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
        style={{ width: viewportWidth, height, transform: `scale(${scale})` }}
      />
    </div>
  );
}

function BrowserFrame({
  label = 'Fahrzeugseite',
  className,
  ratio = '4 / 3',
  previewSrc,
  onOpen,
}: {
  label?: string;
  className?: string;
  ratio?: string;
  previewSrc?: string;
  onOpen?: () => void;
}) {
  const openAction = onOpen ?? (previewSrc ? () => window.dispatchEvent(new CustomEvent(VEHICLE_PAGE_PREVIEW_EVENT)) : undefined);
  const clickable = typeof openAction === 'function';
  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-card', clickable && 'cursor-pointer transition hover:shadow-glow focus-visible:outline-2 focus-visible:outline-accent', className)}
      onClick={openAction}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAction?.(); } } : undefined}
      title={clickable ? 'Fahrzeugseite vergrößern' : undefined}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 h-3 flex-1 rounded bg-muted" />
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-display text-[11px] font-bold">autohaus<span className="text-accent">.ai</span></span>
        <span className="rounded bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">Fahrzeug anfragen</span>
      </div>
      {previewSrc ? (
        <div className="w-full" style={{ aspectRatio: ratio }}>
          <ScaledPagePreview src={previewSrc} className="h-full w-full" />
        </div>
      ) : (
        <MediaPlaceholder label={label} ratio={ratio} />
      )}
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
type Category = { id: string; label: string; description: string; icons: { src: string; label: string }[]; slides: Slide[] };

const CATEGORIES: Category[] = [
  {
    id: 'social', label: 'Social Media', description: 'Posts und Stories für dein Fahrzeugangebot.',
    icons: [
      { src: logoInstagram.url, label: 'Instagram' },
      { src: logoFacebook.url, label: 'Facebook' },
      { src: logoLinkedin.url, label: 'LinkedIn' },
      { src: logoX.url, label: 'X' },
    ],
    slides: [
      { key: 'post2', width: 'w-[260px] sm:w-[300px]', node: <SocialFrame label="Feed-Post (1:1)" imageSrc={socialPostVelmora.url} /> },
      { key: 'story', width: 'w-[180px] sm:w-[210px]', node: <StoryFrame label="Story (9:16)" video={false} imageSrc={storyVelmora.url} /> },
      { key: 'post', width: 'w-[300px] sm:w-[460px]', node: <FacebookAdFrame label="Facebook-Anzeige (16:9)" imageSrc={facebookAdVelmora.url} /> },
    ],
  },
  {
    id: 'banner', label: 'Display-Banner', description: 'Dein Fahrzeugangebot in passenden Formaten für Display-Werbung.',
    icons: [{ src: logoGoogle.url, label: 'Google' }],
    slides: [
      { key: 'wide', width: 'w-[300px] sm:w-[440px]', node: <BannerFrame label="Breites Banner" ratio="728 / 180" /> },
      { key: 'square', width: 'w-[220px] sm:w-[260px]', node: <BannerFrame label="Quadratisches Motiv" ratio="1 / 1" /> },
      { key: 'tall', width: 'w-[100px] sm:w-[120px]', node: <BannerFrame label="Hohes Banner" ratio="160 / 600" /> },
    ],
  },
  {
    id: 'video', label: 'Videos', description: 'Kurze Fahrzeugclips für deine Videokanäle.',
    icons: [{ src: logoTiktok.url, label: 'TikTok' }, { src: logoYoutube.url, label: 'YouTube' }],
    slides: [
      { key: 'vertical', width: 'w-[180px] sm:w-[210px]', node: <StoryFrame label="Fahrzeugclip (9:16)" clip={HEADLIGHT_CLIP} /> },
      { key: 'landscape', width: 'w-[300px] sm:w-[440px]', node: <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card"><MediaPlaceholder label="Video (16:9)" ratio="16 / 9" kind="video" /></div> },
    ],
  },
  {
    id: 'pages', label: 'Fahrzeugseiten', description: 'Eine eigene Fahrzeugseite mit Angebotsinformationen und Kontaktmöglichkeit.',
    icons: [{ src: logoWebsite.url, label: 'Website' }],
    slides: [
      { key: 'desktop', width: 'w-[300px] sm:w-[460px]', node: <BrowserFrame label="Desktop-Vorschau" ratio="16 / 9" previewSrc={VEHICLE_PAGE_URL} /> },
      { key: 'mobile', width: 'w-[180px] sm:w-[200px]', node: <StoryFrame label="Smartphone-Vorschau" video={false} pageSrc={VEHICLE_PAGE_URL} /> },
    ],
  },
];

function FormatShowcase() {
  const [cat, setCat] = useState(0);
  const category = CATEGORIES[cat];

  return (
    <div>
      <div role="tablist" aria-label="Formate" className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((c, i) => (
          <button key={c.id} role="tab" id={`format-tab-${c.id}`} aria-selected={cat === i} aria-controls={`format-panel-${c.id}`}
            onClick={() => setCat(i)}
            className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              cat === i ? 'bg-accent text-accent-foreground' : 'bg-card text-foreground hover:bg-muted')}>
            <span className="flex items-center gap-1.5" aria-hidden>
              {c.icons.map((ic) => (
                <img key={ic.label} src={ic.src} alt="" className="h-[18px] w-[18px] rounded-[4px] origin-center transition-transform duration-300 ease-out will-change-transform hover:scale-125" loading="lazy" />
              ))}
            </span>
            {c.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`format-panel-${category.id}`} aria-labelledby={`format-tab-${category.id}`}
        className="mt-8 flex flex-wrap items-start justify-center gap-6">
        {category.slides.map((s) => (
          <div key={`${category.id}-${s.key}`} className={cn('shrink-0', s.width)}>{s.node}</div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">{category.description}</p>
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

  const [pagePreviewOpen, setPagePreviewOpen] = useState(false);

  useEffect(() => {
    const open = () => setPagePreviewOpen(true);
    window.addEventListener(VEHICLE_PAGE_PREVIEW_EVENT, open);
    return () => window.removeEventListener(VEHICLE_PAGE_PREVIEW_EVENT, open);
  }, []);

  useEffect(() => {
    if (!pagePreviewOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPagePreviewOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [pagePreviewOpen]);


  return (
    <FunnelLayout
      ctaHref={TEST_URL}
      ctaLabel="Kostenlos testen"
      anchors={[{ href: '#so-funktionierts', label: "So funktioniert's" }, { href: '#formate', label: 'Formate' }, { href: '#fragen', label: 'Fragen' }]}
    >
      {/* 1 · Header */}
      <section className="relative overflow-hidden border-b border-border bg-card">
        <img src={headerMockup.url} alt="" aria-hidden className="absolute inset-0 hidden h-full w-full object-cover object-center md:block" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 via-45% to-background/45" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="max-w-xl md:pr-52 lg:pr-0">
            <h1 className="font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl">Aus deinem Fahrzeugbild wird dein nächstes Marketing.</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Social-Media-Motive, kurze Videos und Fahrzeugseiten. In wenigen Minuten. Passend zu deinem Autohaus.</p>
            <Button asChild size="lg" className="mt-7 w-full bg-accent text-accent-foreground shadow-glow hover:bg-accent/90 sm:w-auto">
              <Link to={TEST_URL} data-cta="werbemittel_test">Marketing erstellen lassen{"\n"} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <BrandImage src={logoInstagram.url} label="Instagram" />
              <BrandImage src={logoFacebook.url} label="Facebook" />
              <BrandImage src={logoLinkedin.url} label="LinkedIn" />
              <BrandImage src={logoX.url} label="X" />
              <BrandImage src={logoGoogle.url} label="Google" />
              <BrandImage src={logoTiktok.url} label="TikTok" />
              <BrandImage src={logoYoutube.url} label="YouTube" />
              <BrandImage src={logoWebsite.url} label="Website" />
            </div>
          </div>
        </div>
      </section>

      {/* 2 · Geschwindigkeit */}
      <section className="border-b border-border bg-card py-12">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">In wenigen Minuten. Direkt am Fahrzeug.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Aus deinem fertigen Fahrzeugbild entstehen Banner, Clips und Fahrzeugseiten. Direkt auf dem Smartphone.</p>
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
          <div className="mt-6"><FormatShowcase /></div>
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
            <figure><figcaption className="mb-2 text-xs font-semibold text-muted-foreground">Social Media</figcaption><SocialFrame imageSrc={socialPostVelmora.url} /></figure>
            <figure><figcaption className="mb-2 text-xs font-semibold text-muted-foreground">Display-Banner</figcaption><BannerFrame label="Display-Banner" ratio="4 / 3" /></figure>
            <figure><figcaption className="mb-2 text-xs font-semibold text-muted-foreground">Fahrzeugseite</figcaption><BrowserFrame previewSrc={VEHICLE_PAGE_URL} /></figure>
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

      {/* Fahrzeugseite-Vorschau (Vollbild) */}
      {pagePreviewOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Fahrzeugseite Vorschau"
          onClick={() => setPagePreviewOpen(false)}
        >
          <div
            className="flex h-full max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate text-sm font-semibold">Fahrzeugseite – Vorschau</span>
                <span className="hidden rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">Beispiel: Velmora Nerys</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setPagePreviewOpen(false)}>
                <X className="h-4 w-4" aria-hidden /> Schließen
              </Button>
            </div>
            <iframe src={VEHICLE_PAGE_URL} title="Fahrzeugseite – vollständige Vorschau" className="w-full flex-1 border-0 bg-white" />
          </div>
        </div>
      )}
    </FunnelLayout>
  );
}
