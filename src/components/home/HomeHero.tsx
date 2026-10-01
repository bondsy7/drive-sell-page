import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImagePlaceholder from './ImagePlaceholder';

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
          <ImagePlaceholder label="Aufbereitetes Fahrzeugbild (Showroom)" ratio="16/10" className="bg-secondary" />
          <div className="absolute -top-4 left-3 w-[28%] rotate-[-4deg] rounded-xl bg-card p-1.5 shadow-card sm:left-6">
            <p className="px-1 pb-1 text-[10px] font-semibold text-muted-foreground">Dein Foto</p>
            <ImagePlaceholder label="Originalfoto Hof" ratio="3/4" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <ImagePlaceholder label="Social-Media-Beispiel" ratio="4/3" className="bg-card shadow-card" />
            <ImagePlaceholder label="Video-Beispiel" ratio="4/3" className="bg-card shadow-card" />
          </div>
        </div>
      </div>
    </section>
  );
}
