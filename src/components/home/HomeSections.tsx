import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Check, Images, LayoutTemplate, Palette, Share2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ImagePlaceholder from './ImagePlaceholder';
import type { AiDisclosureContext } from '@/lib/ai-disclosure';
import originalDealerAsset from '@/assets/home/original-dealer-2.webp.asset.json';
import remasterShowroomAsset from '@/assets/home/remaster-suv-showroom.jpg.asset.json';
import marketingBannerAsset from '@/assets/home/marketing-banner-neon.png.asset.json';
import resultImage1Asset from '@/assets/home/results/web-1.jpeg.asset.json';
import resultImage2Asset from '@/assets/home/results/web-2.jpeg.asset.json';
import resultImage3Asset from '@/assets/home/results/web-3.jpeg.asset.json';
import resultImage4Asset from '@/assets/home/results/web-4.jpeg.asset.json';
import resultImage5Asset from '@/assets/home/results/web-5.jpeg.asset.json';
import resultImage6Asset from '@/assets/home/results/web-6.jpeg.asset.json';
import resultImage7Asset from '@/assets/home/results/web-7.jpeg.asset.json';
import resultImage8Asset from '@/assets/home/results/web-8.jpeg.asset.json';
import resultImage9Asset from '@/assets/home/results/web-9.jpeg.asset.json';
import resultImage10Asset from '@/assets/home/results/web-10.jpeg.asset.json';
import resultImage11Asset from '@/assets/home/results/web-11.jpeg.asset.json';
import resultImage12Asset from '@/assets/home/results/web-12.jpeg.asset.json';

const BENEFITS = [
  { title: 'Smartphone-Foto', text: 'Direkt auf dem Hof starten.' },
  { title: '12 Perspektiven', text: 'Dein Fahrzeug aus verschiedenen Blickwinkeln.' },
  { title: 'Dein Look', text: 'Hintergrund, Branding, Kennzeichen und Atmosphäre gestalten.' },
  { title: 'Marketing inklusive', text: 'Bilder, Videos, Posts und Werbemittel erstellen.' },
];

type ProcessStep = {
  number: string;
  title: string;
  text: string;
  label: string;
  icon: typeof Camera;
  image?: string;
  alt?: string;
  objectPosition?: string;
  aiContext?: AiDisclosureContext;
  ratio?: string;
};

const PROCESS_STEPS: ProcessStep[] = [
  {
    number: '01',
    title: 'Fotografieren',
    text: 'Originalaufnahme direkt auf dem Hof.',
    label: 'Originalaufnahme vom Hof',
    icon: Camera,
    image: originalDealerAsset.url,
    alt: 'Schlammiger SUV auf nassem Händlerhof – Originalaufnahme vor der Aufbereitung',
  },
  {
    number: '02',
    title: 'Gestalten',
    text: 'Szene, Autohaus-Look und Fahrzeugdarstellung aufbereiten.',
    label: 'Aufbereitetes Fahrzeug im Autohaus-Look',
    icon: Palette,
    image: remasterShowroomAsset.url,
    alt: 'Derselbe SUV sauber freigestellt im hellen Showroom – mit KI aufbereitet',
    objectPosition: 'center',
    aiContext: 'landing',
  },
  {
    number: '03',
    title: 'Marketing erstellen',
    text: 'Posts, Banner, Videos und Verkaufsseiten daraus erstellen.',
    label: 'Marketingformate aus demselben Fahrzeug',
    icon: LayoutTemplate,
    image: marketingBannerAsset.url,
    alt: 'Werbebanner mit SUV vor Neonkulisse, Aktionspreis und Anfrage-Button – mit KI erstellt',
    objectPosition: 'center',
    ratio: '1200/628',
  },
];

const RESULT_TILE_COUNT = 12;

const RESULT_IMAGES = [
  resultImage1Asset.url,
  resultImage2Asset.url,
  resultImage3Asset.url,
  resultImage4Asset.url,
  resultImage5Asset.url,
  resultImage7Asset.url,
  resultImage6Asset.url,
  resultImage8Asset.url,
  resultImage9Asset.url,
  resultImage10Asset.url,
  resultImage11Asset.url,
  resultImage12Asset.url,
];

const RESULT_TABS = [
  { title: 'Fahrzeugbilder', label: 'Große Fahrzeugansicht · Ergebnisse folgen', icon: Images, ratio: '16/9' },
  { title: 'Social Media', label: 'Social-Media-Beispiel · Ergebnis folgt', icon: Share2, ratio: '4/3' },
  { title: 'Banner', label: 'Werbebanner · Ergebnis folgt', icon: LayoutTemplate, ratio: '16/9' },
  { title: 'Video', label: 'Fahrzeugvideo · Beispiel folgt', icon: Video, ratio: '16/9' },
  { title: 'Verkaufsseite', label: 'Vorschau der Verkaufsseite · Beispiel folgt', icon: LayoutTemplate, ratio: '16/9' },
];

const LOOKS = ['Showroom', 'Outdoor', 'Branding', 'Kennzeichen'];

export function HomeBenefits() {
  return (
    <section className="bg-card px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 border-y border-border md:grid-cols-4">
        {BENEFITS.map((benefit, index) => (
          <div key={benefit.title} className={cn('px-4 py-7 sm:px-6 sm:py-9', index % 2 === 1 && 'border-l border-border', index > 1 && 'border-t border-border md:border-t-0', index > 0 && 'md:border-l')}>
            <p className="font-display text-lg font-bold text-primary sm:text-xl">{benefit.title}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">{benefit.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeProcess() {
  const [active, setActive] = useState(0);
  const step = PROCESS_STEPS[active];

  return (
    <section id="so-funktionierts" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase text-primary">Drei klare Schritte</p>
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Vom Foto bis zum fertigen Marketing.</h2>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {PROCESS_STEPS.map((item, index) => (
            <Button
              key={item.number}
              variant="ghost"
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              className={cn('group h-auto min-h-28 justify-start whitespace-normal rounded-lg border p-5 text-left', active === index ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-foreground hover:bg-secondary')}
            >
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold', active === index ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>{item.number}</span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold">{item.title}</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{item.text}</span>
              </span>
            </Button>
          ))}
        </div>

        <div className="mt-5 grid overflow-hidden rounded-lg border border-border bg-secondary/60 lg:grid-cols-[1fr_18rem]">
          <div className="p-4 sm:p-6 lg:p-8">
            <ImagePlaceholder
              label={step.label}
              ratio={step.ratio ?? '16/9'}
              className="w-full bg-card"
              src={step.image}
              alt={step.alt}
              objectPosition={step.objectPosition ?? 'center 62%'}
              aiContext={step.aiContext}
            />
          </div>
          <div className="flex flex-col justify-end border-t border-border p-6 lg:border-l lg:border-t-0 lg:p-8">
            <step.icon className="size-7 text-primary" />
            <p className="mt-6 text-xs font-bold uppercase text-primary">Schritt {step.number}</p>
            <h3 className="mt-2 font-display text-2xl font-bold">{step.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeResults() {
  const [active, setActive] = useState(0);
  const result = RESULT_TABS[active];

  return (
    <section id="ergebnisse" className="scroll-mt-20 border-y border-border bg-secondary/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase text-primary">Ein Foto, viele Ergebnisse</p>
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Das steckt in deinem Fahrzeugfoto.</h2>
        </div>
        <div className="mt-9 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Ergebnisarten">
          {RESULT_TABS.map((item, index) => (
            <Button key={item.title} variant={active === index ? 'default' : 'outline'} onClick={() => setActive(index)} role="tab" aria-selected={active === index} className="shrink-0">
              <item.icon className="size-4" /> {item.title}
            </Button>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
          {active === 0 ? (
            <div>
              <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">12 Perspektiven · Ergebnisse</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                {Array.from({ length: RESULT_TILE_COUNT }, (_, index) => (
                  <ImagePlaceholder
                    key={index}
                    label={`Perspektive ${index + 1}`}
                    ratio="16/9"
                    className="bg-secondary/70"
                    src={RESULT_IMAGES[index]}
                    alt={RESULT_IMAGES[index] ? `Fahrzeugansicht ${index + 1} im Showroom – mit KI erstellt` : undefined}
                    aiContext={RESULT_IMAGES[index] ? 'landing' : undefined}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ImagePlaceholder label={result.label} ratio={result.ratio} className="w-full" />
          )}
        </div>
      </div>
    </section>
  );
}

export function HomeQuality() {
  const [activeLook, setActiveLook] = useState(LOOKS[0]);

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="relative pb-10 pr-0 sm:pr-20">
          <ImagePlaceholder label={`${activeLook} · großes Fahrzeugbild`} ratio="4/3" className="w-full bg-secondary" />
          <div className="absolute bottom-0 right-0 hidden w-52 rounded-lg border border-border bg-card p-3 shadow-elevated sm:block">
            <ImagePlaceholder label="Fahrzeugdetail" ratio="1/1" />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-primary">Bis ins Detail</p>
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl">Dein Fahrzeug. Bis ins Detail. In deinem Look.</h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">Realitätsnahe Proportionen, ausgearbeitete Fahrzeugdetails und passende Lichtverhältnisse verbinden das Fahrzeug mit deinem individuellen Auftritt.</p>
          <ul className="mt-7 space-y-3">
            {['Fahrzeug und Perspektive bleiben im Mittelpunkt', 'Einheitlicher Auftritt über den gesamten Bestand', 'Szenen und Branding passend zum Autohaus'].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Check className="size-3" /></span>{item}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-2">
            {LOOKS.map((look) => <Button key={look} variant={activeLook === look ? 'default' : 'outline'} size="sm" onClick={() => setActiveLook(look)}>{look}</Button>)}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeClosingCta({ destination }: { destination: string }) {
  return (
    <section className="border-t border-border bg-secondary/60 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-glow lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3 p-5 sm:p-8">
          <ImagePlaceholder label="Dein Originalfoto" ratio="4/3" className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/75" />
          <ImagePlaceholder label="Dein Ergebnis" ratio="4/3" className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/75" />
        </div>
        <div className="flex flex-col justify-center border-t border-primary-foreground/20 p-7 sm:p-10 lg:border-l lg:border-t-0">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Was wird aus deinem Fahrzeug?</h2>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/80 sm:text-base">Teste autohaus.ai mit einem Fahrzeug aus deinem Bestand und sieh den Unterschied.</p>
          <Button asChild size="lg" variant="secondary" className="mt-7 w-fit">
            <Link to={destination}>Mit meinem Fahrzeug testen <ArrowRight className="size-4" /></Link>
          </Button>
          <p className="mt-3 text-xs text-primary-foreground/70">Im nächsten Schritt lädst du ein Fahrzeugfoto hoch und gibst deine geschäftliche E-Mail-Adresse an.</p>
        </div>
      </div>
    </section>
  );
}