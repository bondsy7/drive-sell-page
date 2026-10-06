import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AI_DISCLOSURE_OVERLAY_CLASS,
  getAiDisclosureLabelAlt,
  getAiDisclosureLabelVector,
  getAiDisclosureText,
} from '@/lib/ai-disclosure';
import headerGraphicAsset from '@/assets/home/before_after_header_explorer.png.asset.json';
import mockupAsset from '@/assets/home/mockup-gesamt.png.asset.json';

const SLIDE_COUNT = 2;
const AUTOPLAY_MS = 5000;

export default function HomeHero() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const touchX = useRef<number | null>(null);
  const go = (dir: 1 | -1) => {
    setIndex((i) => (i + dir + SLIDE_COUNT) % SLIDE_COUNT);
    setTick((t) => t + 1);
  };
  // Endlosschleife: alle 5 s weiter; manuelles Blättern startet den Takt neu.
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % SLIDE_COUNT), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [index, paused, tick]);


  return (
    <section className="overflow-hidden border-b border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Für Autohäuser & Fahrzeughändler</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-[3.5rem]">
            Ein Foto – dein komplettes <span className="text-primary">Marketing.</span>
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Starte mit einem Smartphone-Foto. Erstelle daraus Fahrzeugbilder, Videos, Posts, Banner und Verkaufsseiten in deinem Autohaus-Look.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg" className="h-12 px-6 shadow-glow">
              <Link to="/fahrzeug-testen?source=startseite">Mit meinem Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 px-4">
              <a href="#ergebnisse">Ergebnisse ansehen <ArrowRight className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>

        <div
          className="relative mt-10 w-full sm:mt-14"
          role="region"
          aria-roledescription="Karussell"
          aria-label="Headerbilder"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          <div className="overflow-hidden">
            <div
              className="flex items-start transition-transform duration-700 ease-out"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              <figure className="w-full shrink-0" aria-hidden={index !== 0}>
                <div className="relative">
                  <img
                    src={headerGraphicAsset.url}
                    alt="Vom Fahrzeugfoto auf dem Händlerhof zum professionellen Showroom-Bild und Social-Media-Auftritt – Für schnelles Social Media Marketing"
                    className="block h-auto w-full"
                  />
                  <video
                    ref={videoRef}
                    aria-label="Fahrzeugvideo mit aufblinkenden Scheinwerfern – mit KI erstellt"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onCanPlay={(e) => { e.currentTarget.muted = true; e.currentTarget.play().catch(() => {}); }}
                    className="absolute left-[78.15%] top-[51.5%] h-[41.8%] w-[12.8%] rounded-[8%/5%] object-cover"
                  >
                    <source src={headlightsWebmAsset.url} type="video/webm" />
                    <source src={headlightsMp4Asset.url} type="video/mp4" />
                  </video>
              <img
                src={getAiDisclosureLabelVector('landing')}
                alt={getAiDisclosureLabelAlt('landing')}
                title={getAiDisclosureText('landing')}
                className={cn(AI_DISCLOSURE_OVERLAY_CLASS, 'sm:right-4 sm:top-4')}
              />
                </div>
                <figcaption className="mt-3 text-sm text-muted-foreground">
                  Für schnelles Social Media Marketing
                </figcaption>
              </figure>

              <figure className="w-full shrink-0" aria-hidden={index !== 1}>
                <div className="relative" style={{ aspectRatio: '1672 / 941' }}>
                  <img
                    src={mockupAsset.url}
                    alt="Geräte-Mockup mit Landingpage, Bannern, Social-Media-Content und Video – komplettes Marketingpaket"
                    className="block h-full w-full object-cover"
                  />
              <img
                src={getAiDisclosureLabelVector('landing')}
                alt={getAiDisclosureLabelAlt('landing')}
                title={getAiDisclosureText('landing')}
                className={cn(AI_DISCLOSURE_OVERLAY_CLASS, 'sm:right-4 sm:top-4')}
              />
                </div>
                <figcaption className="mt-3 text-sm text-muted-foreground">
                  Oder als komplettes Marketingpaket mit Landingpage, Banner, Social Media Content und Video
                </figcaption>
              </figure>
            </div>
          </div>

          <button
            type="button"
            aria-label="Vorheriges Headerbild"
            onClick={() => go(-1)}
            className="absolute left-2 top-[45%] -translate-y-1/2 rounded-full bg-card/85 p-2 text-foreground shadow-md backdrop-blur transition hover:bg-card sm:left-4 sm:p-3"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Nächstes Headerbild"
            onClick={() => go(1)}
            className="absolute right-2 top-[45%] -translate-y-1/2 rounded-full bg-card/85 p-2 text-foreground shadow-md backdrop-blur transition hover:bg-card sm:right-4 sm:p-3"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="mt-4 flex justify-center gap-2">
            {[0, 1].map((i) => (
              <button
                key={i}
                type="button"
                aria-label={`Headerbild ${i + 1} anzeigen`}
                aria-current={index === i}
                onClick={() => { setIndex(i); setTick((t) => t + 1); }}
                className={cn('h-2 rounded-full transition-all', index === i ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/40')}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
