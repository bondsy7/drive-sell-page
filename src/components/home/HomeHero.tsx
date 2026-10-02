import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getAiDisclosureLabelAlt,
  getAiDisclosureLabelAsset,
  getAiDisclosureText,
} from '@/lib/ai-disclosure';
import heroShowroomAsset from '@/assets/home/hero-showroom.webp.asset.json';
import originalDealerAsset from '@/assets/home/original-dealer.png.asset.json';
import socialStoryAsset from '@/assets/home/social-story.webp.asset.json';
import headlightsVideoAsset from '@/assets/home/fahrzeugscheinwerfer-loop.mp4.asset.json';
import headlightsWebmAsset from '@/assets/home/fahrzeugscheinwerfer-loop.webm.asset.json';

export default function HomeHero() {
  return (
    <section className="overflow-hidden border-b border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Für Autohäuser & Fahrzeughändler</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-[3.5rem]">
            Ein Foto – dein komplettes <span className="text-primary">Marketing.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
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

        <div className="relative">
          <div className="relative overflow-hidden rounded-lg border border-border bg-secondary shadow-card">
            <img
              src={heroShowroomAsset.url}
              alt="Aufbereitetes Fahrzeugbild im Showroom – mit KI verändert"
              className="aspect-[16/10] w-full object-cover"
            />
            <img
              src={getAiDisclosureLabelAsset('landing')}
              alt={getAiDisclosureLabelAlt('landing')}
              title={getAiDisclosureText('landing')}
              className="pointer-events-none absolute right-3 top-3 h-5 w-auto"
            />
          </div>
          <div className="absolute -top-5 left-2 w-[36%] rotate-[-4deg] rounded-lg bg-card p-1.5 shadow-card sm:left-4 sm:w-[32%]">
            <p className="px-1 pb-1 text-[10px] font-semibold text-muted-foreground">Dein Foto</p>
            <img
              src={originalDealerAsset.url}
              alt="Originalaufnahme eines Fahrzeugs auf dem Händlerhof"
              className="aspect-[4/3] w-full rounded-md object-cover"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 items-start gap-4">
            <div className="relative overflow-hidden rounded-lg border border-border bg-secondary shadow-card">
              <img
                src={socialStoryAsset.url}
                alt="Beispiel einer Social-Media-Story: Fahrzeugangebot mit Preisangabe und Anfrage-Button – mit KI erstellt"
                className="aspect-[9/16] w-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                Beispiel
              </span>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-border bg-secondary shadow-card">
              <video
                aria-label="Fahrzeugvideo mit aufblinkenden Scheinwerfern – mit KI erstellt"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="aspect-[9/16] w-full object-cover"
              >
                <source src={headlightsWebmAsset.url} type="video/webm" />
                <source src={headlightsVideoAsset.url} type="video/mp4" />
              </video>
              <img
                src={getAiDisclosureLabelAsset('landing')}
                alt={getAiDisclosureLabelAlt('landing')}
                title={getAiDisclosureText('landing')}
                className="pointer-events-none absolute right-2 top-2 h-5 w-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
