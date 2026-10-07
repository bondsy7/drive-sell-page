import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Scissors, Images, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution, captureLastTouch } from '@/lib/funnel-attribution';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import logoInstagram from '@/assets/funnel/logo-instagram.png.asset.json';
import logoFacebook from '@/assets/funnel/logo-facebook.png.asset.json';
import logoTiktok from '@/assets/funnel/logo-tiktok.png.asset.json';
import logoYoutube from '@/assets/funnel/logo-youtube.png.asset.json';
import logoWebsite from '@/assets/funnel/logo-website.png.asset.json';
import video169Webm from '@/assets/funnel/lights-text.webm.asset.json';
import video169Mp4 from '@/assets/funnel/lights-text.mp4.asset.json';
import video916Webm from '@/assets/funnel/lights-fog.webm.asset.json';
import video916Mp4 from '@/assets/funnel/lights-fog.mp4.asset.json';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelAlt, getAiDisclosureLabelVector, getAiDisclosureText } from '@/lib/ai-disclosure';
import ablaufBild from '@/assets/ablauf-frontansicht.jpg.asset.json';
import videoEditScreen from '@/assets/video-edit-screen.png.asset.json';
import abschlussBild from '@/assets/funnel/abschluss-fahrzeugbild.jpg.asset.json';

const TEST_URL = '/fahrzeug-testen?source=videos';

/** Neutraler, beschrifteter Platzhalter. Später durch <video controls> bzw. <img> ersetzen. */
function MediaPlaceholder({ label, ratio, className = '' }: { label: string; ratio: '16/9' | '9/16' | '4/3'; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`Platzhalter: ${label}`}
      style={{ aspectRatio: ratio }}
      className={`flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 p-3 text-center text-xs font-medium text-muted-foreground ${className}`}
    >
      {label}
    </div>
  );
}

/** Stummes Loop-Video mit KI-Kennzeichnung (WebM zuerst, MP4 als Fallback). */
function VideoSlot({ ratio, ariaLabel, className = '' }: { ratio: '16/9' | '9/16'; ariaLabel: string; className?: string }) {
  const webm = ratio === '16/9' ? video169Webm.url : video916Webm.url;
  const mp4 = ratio === '16/9' ? video169Mp4.url : video916Mp4.url;
  return (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-secondary/70 ${className}`} style={{ aspectRatio: ratio }}>
      <video className="h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" aria-label={ariaLabel}>
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      <img
        src={getAiDisclosureLabelVector('landing')}
        alt={getAiDisclosureLabelAlt('landing')}
        title={getAiDisclosureText('landing')}
        className={AI_DISCLOSURE_OVERLAY_CLASS}
      />
    </div>
  );
}

/** 16:9-Video, das nur per Play-Button startet – kein Autoplay, kein Loop. */
function VideoClickToPlay({ ariaLabel, className = '' }: { ariaLabel: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`relative overflow-hidden rounded-lg border border-border bg-secondary/70 ${className}`} style={{ aspectRatio: '16/9' }}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        controls={playing}
        muted
        playsInline
        preload="metadata"
        aria-label={ariaLabel}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      >
        <source src={video169Webm.url} type="video/webm" />
        <source src={video169Mp4.url} type="video/mp4" />
      </video>
      {!playing && (
        <button
          type="button"
          aria-label="Video abspielen"
          onClick={() => { videoRef.current?.play(); }}
          className="absolute inset-0 flex items-center justify-center bg-secondary/40 transition-colors hover:bg-secondary/20"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow">
            <Play className="ml-1 h-7 w-7" aria-hidden="true" />
          </span>
        </button>
      )}
      <img
        src={getAiDisclosureLabelVector('landing')}
        alt={getAiDisclosureLabelAlt('landing')}
        title={getAiDisclosureText('landing')}
        className={AI_DISCLOSURE_OVERLAY_CLASS}
      />
    </div>
  );
}

function Icons({ items }: { items: { src: string; alt: string }[] }) {
  return (
    <ul className="mt-4 flex items-center justify-center gap-4" aria-label="Einsatzmöglichkeiten">
      {items.map((i) => (
        <li key={i.alt}><img src={i.src} alt={i.alt} title={i.alt} className="h-8 w-8 object-contain" loading="lazy" /></li>
      ))}
    </ul>
  );
}

const steps = [
  { t: 'Bild auswählen', d: 'Nutze dein Fahrzeugbild aus der App.', ph: 'Platzhalter Fahrzeugbild', img: ablaufBild.url, imgAlt: 'Fahrzeugbild eines silbernen SUV im Showroom' },
  { t: 'Video gestalten', d: 'Wähle Format und Videostil.', ph: 'Platzhalter Screenshot der Funktion', img: videoEditScreen.url, imgAlt: 'Screenshot der Videofunktion: Fahrzeugbild auswählen, Format 16:9 oder 9:16 wählen, optionaler Video-Prompt' },
  { t: 'Clip verwenden', d: 'Herunterladen und für dein Marketing nutzen.', ph: 'Platzhalter Videovorschau', video: true },
];

const benefits = [
  { icon: Camera, t: 'Kein zusätzlicher Videodreh.', d: 'Erstelle kurze Clips aus deinen Fahrzeugbildern.' },
  { icon: Scissors, t: 'Keine eigene Schnittarbeit.', d: 'Die App übernimmt die Erstellung des Clips.' },
  { icon: Images, t: 'Vorhandene Bilder weiterverwenden.', d: 'Nutze deine Aufnahmen auch für dein Videomarketing.' },
];

const faq: [string, string][] = [
  ['Welche Bilder benötige ich für ein Fahrzeugvideo?', 'Du kannst die Fahrzeugbilder verwenden, die du in autohaus.ai erstellt hast. Damit kannst du aus deinen vorhandenen Bildern zusätzlich kurze Clips für dein Marketing erstellen.'],
  ['Wie schnell entsteht ein fertiger Clip?', 'Die Erstellung dauert wenige Minuten. Wie lange es genau dauert, hängt von der gewählten Funktion und der Verarbeitung ab. Ein zusätzlicher Videodreh oder eine manuelle Schnittbearbeitung sind dafür nicht erforderlich.'],
  ['Welche Videoformate kann ich erstellen?', 'Du kannst Videos im Hochformat 9:16 und im Querformat 16:9 erstellen. Hochformat eignet sich beispielsweise für Reels, Stories und Shorts. Querformat kannst du beispielsweise auf deiner Website oder auf YouTube einsetzen.'],
  ['Wie kann ich die Videos herunterladen und veröffentlichen?', 'Du kannst die fertigen Videos herunterladen und anschließend auf deinen gewünschten Kanälen veröffentlichen, beispielsweise auf Social Media oder deiner Website.'],
];

export default function AutohausVideos() {
  usePageMeta({ title: 'Fahrzeugvideos für Autohäuser | autohaus.ai', description: 'Aus Fahrzeugbildern werden kurze Videos in 9:16 und 16:9 für dein Marketing – ohne zusätzlichen Videodreh.', canonicalPath: '/autohaus-videos' });
  useEffect(() => { captureAttribution('lp_videos'); captureLastTouch(); }, []);
  useEffect(() => {
    const sent = new Set<number>();
    const onScroll = () => { const max = document.documentElement.scrollHeight - window.innerHeight; if (max <= 0) return; const percent = window.scrollY / max * 100; for (const t of [50, 90]) if (percent >= t && !sent.has(t)) { sent.add(t); trackFunnelEvent('scroll_depth', { step: `scroll_${t}`, percent: t }); } };
    window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <FunnelLayout ctaHref={TEST_URL} ctaLabel="Jetzt testen" anchors={[{ href: '#formate', label: 'Formate' }, { href: '#ablauf', label: 'Ablauf' }, { href: '#fragen', label: 'Fragen' }]}>
      {/* 1. Header */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.4fr] lg:py-16">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Fahrzeugvideos</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">Aus Bildern werden Videos für dein Marketing.<br />In einem Schritt.</h1>
          <p className="mt-4 text-base text-muted-foreground">Kurze Clips in 9:16 und 16:9. In wenigen Minuten erstellt, ohne zusätzlichen Videodreh.</p>
          <Button asChild size="lg" className="mt-6 shadow-glow"><Link to={TEST_URL} data-cta="videos_hero">Mit eigenem Fahrzeug testen</Link></Button>
          <p className="mt-3 text-sm text-muted-foreground">Fahrzeugbild auswählen. Video erstellen. Fertig.</p>
        </div>
        <div className="flex items-end gap-4">
          <figure className="min-w-0 flex-[3]">
            <VideoSlot ratio="16/9" ariaLabel="Beispiel: KI-erstelltes Fahrzeugvideo im Querformat" />
            <figcaption className="mt-2 text-xs text-muted-foreground">16:9 · Querformat</figcaption>
          </figure>
          <figure className="min-w-0 flex-1">
            <VideoSlot ratio="9/16" ariaLabel="Beispiel: KI-erstelltes Fahrzeugvideo im Hochformat" />
            <figcaption className="mt-2 text-xs text-muted-foreground">9:16 · Hochformat</figcaption>
          </figure>
        </div>
      </section>

      {/* 2. Hinweis */}
      <div className="border-y border-border bg-accent/10">
        <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-3 text-center text-sm text-foreground/80 sm:px-6">
          <Camera className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          Direkt am Fahrzeug: Bilder aufnehmen und als Video weiterverwenden.
        </p>
      </div>

      {/* 3. Formate */}
      <section id="formate" className="scroll-mt-20 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold">Zwei Formate. Mehr Möglichkeiten.</h2>
          <div className="mt-10 grid gap-12 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border">
            <div className="flex flex-col items-center md:px-8">
              <div className="flex w-full items-end justify-center md:h-[440px]">
                <VideoSlot ratio="9/16" ariaLabel="Beispiel: KI-erstelltes Fahrzeugvideo im Hochformat" className="w-[220px] md:w-auto md:h-full" />
              </div>
              <p className="mt-5 font-semibold">9:16 · Hochformat</p>
              <p className="mt-1 text-sm text-muted-foreground">Für Reels, Stories und Shorts.</p>
              <Icons items={[{ src: logoInstagram.url, alt: 'Instagram' }, { src: logoFacebook.url, alt: 'Facebook' }, { src: logoTiktok.url, alt: 'TikTok' }, { src: logoYoutube.url, alt: 'YouTube' }]} />
            </div>
            <div className="flex flex-col items-center md:px-8">
              <div className="flex w-full items-center justify-center md:h-[440px]">
                <VideoSlot ratio="16/9" ariaLabel="Beispiel: KI-erstelltes Fahrzeugvideo im Querformat" className="w-full" />
              </div>
              <p className="mt-5 font-semibold">16:9 · Querformat</p>
              <p className="mt-1 text-sm text-muted-foreground">Für deine Website und YouTube.</p>
              <Icons items={[{ src: logoWebsite.url, alt: 'Website' }, { src: logoYoutube.url, alt: 'YouTube' }]} />
            </div>
          </div>
        </div>
      </section>

      {/* 4. Ablauf */}
      <section id="ablauf" className="scroll-mt-20 border-t border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Vom Fahrzeugbild zum fertigen Clip.</h2>
          <ol className="mt-8 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((s, i) => (
              <li key={s.t} className="relative">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                  <div>
                    <h3 className="font-semibold">{s.t}</h3>
                    <p className="text-sm text-muted-foreground">{s.d}</p>
                  </div>
                </div>
                {i < steps.length - 1 && <span aria-hidden="true" className="absolute left-[calc(100%-1rem)] top-4 hidden h-px w-8 bg-accent/50 md:block" />}
                {'video' in s && s.video ? (
                  <div className="mt-4">
                    <VideoClickToPlay ariaLabel="Beispiel: KI-erstelltes Fahrzeugvideo im Querformat" />
                  </div>
                ) : 'img' in s && s.img ? (
                  <figure className="relative mt-4 overflow-hidden rounded-lg border border-border bg-secondary/70" style={{ aspectRatio: '16/9' }}>
                    <img src={s.img} alt={s.imgAlt} className="h-full w-full object-cover" loading="lazy" />
                    <img
                      src={getAiDisclosureLabelVector('landing')}
                      alt={getAiDisclosureLabelAlt('landing')}
                      title={getAiDisclosureText('landing')}
                      className={AI_DISCLOSURE_OVERLAY_CLASS}
                    />
                  </figure>
                ) : (
                  <MediaPlaceholder ratio="16/9" label={s.ph} className="mt-4" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Nutzen */}
      <section className="bg-accent/10 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Nicht jedes Fahrzeug braucht einen Drehtag.</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3 md:divide-x md:divide-border">
            {benefits.map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4 md:px-6 md:first:pl-0">
                <Icon className="h-8 w-8 shrink-0 text-accent" aria-hidden="true" />
                <div><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
              </div>
            ))}
          </div>
          <p className="mt-10 border-t border-border pt-6 text-center text-sm">Ergänze deine Fahrzeugbilder um bewegte Inhalte. Direkt in <strong>autohaus.ai</strong>.</p>
        </div>
      </section>

      {/* 6. FAQ */}
      <section id="fragen" className="scroll-mt-20 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Fragen zu deinen Fahrzeugvideos.</h2>
          <Accordion type="single" collapsible className="mt-6 space-y-2">
            {faq.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`} className="rounded-lg border border-border bg-card px-5 last:border-b">
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 7. Abschluss-CTA */}
      <section className="gradient-hero text-primary-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold">Bring dein nächstes Fahrzeug in Bewegung.</h2>
            <p className="mt-3 text-sm opacity-90">Teste die Videofunktion mit einem Fahrzeug aus deinem Bestand.</p>
            <Button asChild size="lg" variant="secondary" className="mt-6"><Link to={TEST_URL} data-cta="videos_final">Mit eigenem Fahrzeug testen</Link></Button>
          </div>
          <div role="img" aria-label="Fahrzeugbild: Silberner SUV im Showroom von autohaus.ai" style={{ aspectRatio: '16/9' }} className="relative overflow-hidden rounded-lg">
            <img src={abschlussBild.url} alt="Silberner SUV im Showroom von autohaus.ai" className="h-full w-full object-cover" />
            <img
              src={getAiDisclosureLabelVector('landing')}
              alt={getAiDisclosureLabelAlt('landing')}
              title={getAiDisclosureText('landing')}
              className={AI_DISCLOSURE_OVERLAY_CLASS}
            />
          </div>
        </div>
      </section>
    </FunnelLayout>
  );
}
