import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getAiDisclosureLabelAlt,
  getAiDisclosureLabelAsset,
  getAiDisclosureText,
} from '@/lib/ai-disclosure';
import headerGraphicAsset from '@/assets/home/before_after_header.png.asset.json';

// Add the separately supplied video URL here when it arrives. Until then the
// white video frame remains part of the header graphic.
const headerVideoSrc = '';

export default function HomeHero() {
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

      </div>
      <div className="relative w-full">
        <img
          src={headerGraphicAsset.url}
          alt="Vom Fahrzeugfoto auf dem Händlerhof zum professionellen Showroom-Bild und Social-Media-Auftritt"
          className="block h-auto w-full"
        />
        <video
          src={headerVideoSrc || undefined}
          aria-label="Fahrzeugvideo im Header"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className={`absolute left-[78.15%] top-[51.5%] h-[41.8%] w-[12.8%] rounded-[8%/5%] object-cover ${headerVideoSrc ? '' : 'hidden'}`}
        />
        <img
          src={getAiDisclosureLabelAsset('landing')}
          alt={getAiDisclosureLabelAlt('landing')}
          title={getAiDisclosureText('landing')}
          className="pointer-events-none absolute right-2 top-2 h-4 w-auto sm:right-4 sm:top-4 sm:h-5"
        />
      </div>
    </section>
  );
}
