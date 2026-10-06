import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Check, ChevronLeft, ChevronRight, Images, LayoutTemplate, Palette, Share2, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import ImagePlaceholder from './ImagePlaceholder';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelAlt, getAiDisclosureLabelVector, getAiDisclosureText, type AiDisclosureContext } from '@/lib/ai-disclosure';
import originalDealerAsset from '@/assets/home/original-dealer-explorer.webp.asset.json';
import remasterShowroomAsset from '@/assets/home/remaster-explorer-showroom.jpg.asset.json';
import marketingBannerAsset from '@/assets/home/marketing-banner-neon.png.asset.json';
import resultVideoWebmAsset from '@/assets/home/ergebnis-video.webm.asset.json';
import resultVideoMp4Asset from '@/assets/home/ergebnis-video.mp4.asset.json';
import verkaufsseiteAsset from '@/assets/home/verkaufsseite-ford.png.asset.json';
import bannerMockupAsset from '@/assets/home/mobilede-mockup-banner-ford.png.asset.json';
import dealerCapturingAsset from '@/assets/home/dealer-capturing.webp.asset.json';
import resultImage1Asset from '@/assets/home/results/web-1.jpeg.asset.json';
import outdoorLookAsset from '@/assets/home/looks/outdoor-look-ford.jpg.asset.json';
import brandingLookAsset from '@/assets/home/looks/branding-look-ford.jpg.asset.json';
import kennzeichenExplorerHintenAsset from '@/assets/home/looks/kennzeichen-explorer-hinten.jpg.asset.json';
import fahrzeugdetailAsset from '@/assets/home/looks/fahrzeugdetail.jpeg.asset.json';
import kennzeichenDetailAsset from '@/assets/home/looks/kennzeichen-detail.webp.asset.json';
import outdoorCollageDetailAsset from '@/assets/home/looks/outdoor-collage-detail.jpg.asset.json';
import resultImage2Asset from '@/assets/home/results/web-2.jpeg.asset.json';
import resultImage3Asset from '@/assets/home/results/web-3.jpeg.asset.json';
import resultImage4Asset from '@/assets/home/results/web-4.jpeg.asset.json';
import resultImage5Asset from '@/assets/home/results/web-5.jpeg.asset.json';
import resultImage6Asset from '@/assets/home/results/web-6.jpeg.asset.json';
import resultImage7Asset from '@/assets/home/results/web-7.jpeg.asset.json';
import resultImage8Asset from '@/assets/home/results/web-8.jpeg.asset.json';
import resultImage9Asset from '@/assets/home/results/web-9.jpeg.asset.json';
import resultImage10Asset from '@/assets/home/results/web-10.jpeg.asset.json';
import fordFrontShowroomAsset from '@/assets/home/results/ford-front-showroom.jpg.asset.json';
import resultImage12Asset from '@/assets/home/results/web-12.jpeg.asset.json';
import bannerStoryAsset from '@/assets/home/social/banner-story.png.asset.json';
import bannerPostAsset from '@/assets/home/social/banner-post.png.asset.json';
import bannerHeroAsset from '@/assets/home/social/banner-hero.png.asset.json';
import bannerSkyscraperAsset from '@/assets/home/social/banner-skyscraper.png.asset.json';

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
    text: 'Originalaufnahme direkt auf dem Hof.\nSchnell und einfach mit dem Smartphone.',
    label: 'Originalaufnahme vom Hof',
    icon: Camera,
    image: originalDealerAsset.url,
    alt: 'Schlammiger SUV auf nassem Händlerhof – Originalaufnahme vor der Aufbereitung',
  },
  {
    number: '02',
    title: 'Aufbereiten\n',
    text: 'Szene, Autohaus-Look und Fahrzeug werden automatisch aufbereitet.',
    label: 'Aufbereitetes Fahrzeug im Autohaus-Look',
    icon: Palette,
    image: remasterShowroomAsset.url,
    alt: 'Derselbe hellblaue Ford Explorer sauber im hellen Showroom – mit KI aufbereitet',
    objectPosition: 'center',
    aiContext: 'landing',
  },
  {
    number: '03',
    title: 'Marketing erstellen',
    text: 'Posts, Banner, Videos und Verkaufsseiten daraus erstellen und direkt Posten.',
    label: 'Marketingformate aus demselben Fahrzeug',
    icon: LayoutTemplate,
    image: marketingBannerAsset.url,
    alt: 'Werbebanner mit hellblauem Ford Explorer, Aufpreis „ab 40.900 €“ und Anfrage-Button – mit KI erstellt',
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
  fordFrontShowroomAsset.url,
  resultImage9Asset.url,
  resultImage8Asset.url,
  resultImage12Asset.url,
  resultImage10Asset.url,
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
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Vom Foto bis zum fertigen Marketing. In Minuten statt Tagen.</h2>
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

/** Social-Media-Werbemittel in ihren echten Seitenverhältnissen. */
const SOCIAL_FORMATS = {
  story: {
    src: bannerStoryAsset.url,
    alt: 'Instagram Story im Hochformat 1080 × 1920 – Ford-Explorer-Anzeige mit Preis und Anfragebutton',
  },
  post: {
    src: bannerPostAsset.url,
    alt: 'Instagram Beitrag im Quadrat 1080 × 1080 – Ford-Explorer-Anzeige mit Preis und Anfragebutton',
  },
  fbAd: {
    src: bannerHeroAsset.url,
    alt: 'Werbeanzeige im Breitformat 1920 × 1080 – Ford-Explorer-Anzeige mit Preis und Anfragebutton',
  },
  skyscraper: {
    src: bannerSkyscraperAsset.url,
    alt: 'Schmales Anzeigen-Hochformat 160 × 600 – Ford-Explorer-Anzeige mit Preis und Anfragebutton',
  },
};

const SOCIAL_ORDER = [SOCIAL_FORMATS.story, SOCIAL_FORMATS.post, SOCIAL_FORMATS.fbAd, SOCIAL_FORMATS.skyscraper];

const SOCIAL_ITEMS = SOCIAL_ORDER.map((format) => ({ src: format.src, alt: format.alt }));

/** Stellt die Formate unbeschnitten in ihrem jeweiligen Verhältnis dar; der Kasten dahinter bleibt gleich groß. */
function SocialFormatCollage({ onOpen }: { onOpen: (index: number) => void }) {
  const zoomClass = 'cursor-zoom-in transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="grid aspect-[4/3] w-full">
      <div className="flex h-full snap-x snap-mandatory items-center gap-3 overflow-x-auto sm:hidden">
        {SOCIAL_ORDER.map((format, index) => (
          <button key={format.alt} type="button" onClick={() => onOpen(index)} aria-label={`${format.alt} – vergrößern`} className={cn('h-[86%] shrink-0 snap-start', zoomClass)}>
            <img
              src={format.src}
              alt={format.alt}
              loading="lazy"
              className="h-full w-auto max-w-none rounded-lg border border-border"
            />
          </button>
        ))}
      </div>
      <div className="hidden h-full items-center gap-3 sm:flex">
        <button type="button" onClick={() => onOpen(0)} aria-label={`${SOCIAL_FORMATS.story.alt} – vergrößern`} className={cn('w-[37%] shrink-0', zoomClass)}>
          <img
            src={SOCIAL_FORMATS.story.src}
            alt={SOCIAL_FORMATS.story.alt}
            loading="lazy"
            className="w-full rounded-lg border border-border"
            style={{ aspectRatio: '9 / 16' }}
          />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <button type="button" onClick={() => onOpen(2)} aria-label={`${SOCIAL_FORMATS.fbAd.alt} – vergrößern`} className={cn('w-full', zoomClass)}>
            <img
              src={SOCIAL_FORMATS.fbAd.src}
              alt={SOCIAL_FORMATS.fbAd.alt}
              loading="lazy"
              className="w-full rounded-lg border border-border"
              style={{ aspectRatio: '1920 / 1080' }}
            />
          </button>
          <button type="button" onClick={() => onOpen(1)} aria-label={`${SOCIAL_FORMATS.post.alt} – vergrößern`} className={cn('w-full', zoomClass)}>
            <img
              src={SOCIAL_FORMATS.post.src}
              alt={SOCIAL_FORMATS.post.alt}
              loading="lazy"
              className="w-full rounded-lg border border-border"
              style={{ aspectRatio: '1 / 1' }}
            />
          </button>
        </div>
        <button type="button" onClick={() => onOpen(3)} aria-label={`${SOCIAL_FORMATS.skyscraper.alt} – vergrößern`} className={cn('w-[17.5%] shrink-0', zoomClass)}>
          <img
            src={SOCIAL_FORMATS.skyscraper.src}
            alt={SOCIAL_FORMATS.skyscraper.alt}
            loading="lazy"
            className="w-full rounded-lg border border-border"
            style={{ aspectRatio: '160 / 600' }}
          />
        </button>
      </div>
    </div>
  );
}

const RESULT_IMAGE_ITEMS = RESULT_IMAGES.filter((src): src is string => Boolean(src)).map((src, index) => ({
  src,
  alt: `Fahrzeugansicht ${index + 1} im Showroom – mit KI erstellt`,
}));

const VERKAUFSSEITE_ITEM = {
  src: verkaufsseiteAsset.url,
  alt: 'Beispiel einer automatisch erstellten Verkaufsseite mit Fahrzeugbild, Finanzierungsangebot und Anfrageformular – mit KI erstellt',
};

const BANNER_MOCKUP_ITEM = {
  src: bannerMockupAsset.url,
  alt: 'Werbebanner-Beispiel auf einer Fahrzeugsuchseite – mit KI erstellt',
};

interface LightboxItem {
  src: string;
  alt: string;
}

interface LightboxState {
  items: LightboxItem[];
  index: number;
}

export function HomeResults() {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const result = RESULT_TABS[active];

  const openLightbox = (items: LightboxItem[], index: number) => setLightbox({ items, index });
  const stepLightbox = (direction: 1 | -1) =>
    setLightbox((current) =>
      current === null
        ? current
        : { ...current, index: (current.index + direction + current.items.length) % current.items.length },
    );

  useEffect(() => {
    if (lightbox === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        stepLightbox(-1);
      } else if (event.key === 'ArrowRight') {
        stepLightbox(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox === null]);

  return (
    <section id="ergebnisse" className="scroll-mt-20 border-y border-border bg-secondary/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-5xl">
          <p className="text-xs font-bold uppercase text-primary">EIN FOTO, VIELE ERGEBNISSE – DIREKT VOM HOF.</p>
          <h2 className="mt-4 font-display text-3xl font-bold sm:text-4xl lg:text-5xl">Das alles entsteht ab einem einzigen Foto.</h2>
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
                  <button
                    key={index}
                    type="button"
                    onClick={() => RESULT_IMAGES[index] && openLightbox(RESULT_IMAGE_ITEMS, index)}
                    aria-label={RESULT_IMAGES[index] ? `Fahrzeugansicht ${index + 1} vergrößern` : undefined}
                    className={cn('text-left', RESULT_IMAGES[index] && 'cursor-zoom-in transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
                  >
                    <ImagePlaceholder
                      label={`Perspektive ${index + 1}`}
                      ratio="16/9"
                      className="bg-secondary/70"
                      src={RESULT_IMAGES[index]}
                      alt={RESULT_IMAGES[index] ? `Fahrzeugansicht ${index + 1} im Showroom – mit KI erstellt` : undefined}
                      aiContext={RESULT_IMAGES[index] ? 'landing' : undefined}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : active === 1 ? (
            <SocialFormatCollage onOpen={(index) => openLightbox(SOCIAL_ITEMS, index)} />
          ) : active === 2 ? (
            <button
              type="button"
              onClick={() => openLightbox([BANNER_MOCKUP_ITEM], 0)}
              aria-label="Werbebanner-Beispiel vergrößern"
              className="w-full cursor-zoom-in text-left transition-transform duration-200 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ImagePlaceholder
                label={result.label}
                ratio={result.ratio}
                className="w-full"
                src={bannerMockupAsset.url}
                alt={BANNER_MOCKUP_ITEM.alt}
                objectPosition="center"
              />
            </button>
          ) : active === 3 ? (
            <div className="relative w-full overflow-hidden rounded-lg border border-border bg-secondary/70" style={{ aspectRatio: '16/9' }}>
              <video
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Beispiel: KI-erstelltes Fahrzeugvideo"
              >
                <source src={resultVideoWebmAsset.url} type="video/webm" />
                <source src={resultVideoMp4Asset.url} type="video/mp4" />
              </video>
              <img
                src={getAiDisclosureLabelVector('landing')}
                alt={getAiDisclosureLabelAlt('landing')}
                title={getAiDisclosureText('landing')}
                className={AI_DISCLOSURE_OVERLAY_CLASS}
              />
            </div>
          ) : active === 4 ? (
            <button
              type="button"
              onClick={() => openLightbox([VERKAUFSSEITE_ITEM], 0)}
              aria-label="Verkaufsseiten-Beispiel vergrößern"
              className="w-full cursor-zoom-in text-left transition-transform duration-200 hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ImagePlaceholder
                label={result.label}
                ratio={result.ratio}
                className="w-full"
                src={verkaufsseiteAsset.url}
                alt={VERKAUFSSEITE_ITEM.alt}
                aiContext="landing"
              />
            </button>
          ) : (
            <ImagePlaceholder label={result.label} ratio={result.ratio} className="w-full" />
          )}
        </div>
      </div>
      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none sm:max-w-5xl [&>button]:hidden">
          <DialogTitle className="sr-only">
            {lightbox !== null ? `Bild ${lightbox.index + 1} von ${lightbox.items.length}` : 'Bildansicht'}
          </DialogTitle>
          {lightbox !== null ? (
            <div className="relative">
              <img
                src={lightbox.items[lightbox.index].src}
                alt={lightbox.items[lightbox.index].alt}
                className="max-h-[85vh] w-full rounded-lg object-contain"
              />
              <img
                src={getAiDisclosureLabelVector('landing')}
                alt={getAiDisclosureLabelAlt('landing')}
                title={getAiDisclosureText('landing')}
                className={AI_DISCLOSURE_OVERLAY_CLASS}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={() => setLightbox(null)}
                aria-label="Detailansicht schließen"
                className="absolute -right-2 -top-2 z-10 rounded-full shadow-lg sm:-right-3 sm:-top-3"
              >
                <X className="size-5" />
              </Button>
              {lightbox.items.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => stepLightbox(-1)}
                    aria-label="Vorheriges Bild"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full shadow-lg"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => stepLightbox(1)}
                    aria-label="Nächstes Bild"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full shadow-lg"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              ) : null}
              <p className="mt-3 text-center text-sm font-medium text-primary-foreground">
                {lightbox.index + 1} / {lightbox.items.length}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

type LookEntry = {
  src: string;
  alt: string;
  aiContext?: AiDisclosureContext;
  /** Kleines Detailbild im überlagernden Kasten – wechselt mit der Kategorie. */
  detail: { src: string; alt: string; position?: string; zoom?: number };
};

const LOOK_IMAGES: Record<string, LookEntry> = {
  Showroom: {
    src: resultImage1Asset.url,
    alt: 'Hellblauer Ford Explorer in der Frontansicht im hellen Showroom – mit KI erstellt',
    aiContext: 'landing',
    detail: {
      src: fahrzeugdetailAsset.url,
      alt: 'Scheinwerfer-Detail des blauen Ford Explorers – mit KI erstellt',
    },
  },
  Outdoor: {
    src: outdoorLookAsset.url,
    alt: 'Hellblauer Ford Explorer in der Frontansicht vor schneebedeckten Bergen – mit KI erstellt',
    aiContext: 'landing',
    detail: {
      src: outdoorCollageDetailAsset.url,
      alt: 'Vier KI erstellte Outdoor-Szenen als Hintergrundvorlagen – mit KI erstellt',
    },
  },
  Branding: {
    src: brandingLookAsset.url,
    alt: 'Blauer Ford Explorer im Showroom vor einer Wand mit Ford-Logo und der Aufschrift autohaus.ai – mit KI erstellt',
    aiContext: 'landing',
    detail: {
      src: brandingLookAsset.url,
      alt: 'Ausschnitt der Showroom-Wand mit Ford-Logo und der Aufschrift autohaus.ai – mit KI erstellt',
      position: '100% 50%',
    },
  },
  Kennzeichen: {
    src: kennzeichenLookAsset.url,
    alt: 'Silbernes SUV in der Dreiviertelansicht von vorne mit dem Kennzeichen autohaus.ai – mit KI erstellt',
    aiContext: 'landing',
    detail: {
      src: kennzeichenDetailAsset.url,
      alt: 'Detailaufnahme des Kennzeichens mit der Aufschrift autohaus.ai – mit KI erstellt',
    },
  },
};

export function HomeQuality() {
  const [activeLook, setActiveLook] = useState(LOOKS[0]);
  const lookImage = LOOK_IMAGES[activeLook];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div className="relative pb-10 pr-0 sm:pr-20">
          <ImagePlaceholder
            label={`${activeLook} · großes Fahrzeugbild`}
            ratio="4/3"
            className="w-full bg-secondary"
            src={lookImage?.src}
            alt={lookImage?.alt}
            aiContext={lookImage?.aiContext}
          />
          <div className="absolute bottom-0 right-0 hidden w-52 rounded-lg border border-border bg-card p-3 shadow-elevated sm:block">
            <ImagePlaceholder label="Fahrzeugdetail" ratio="1/1" src={lookImage?.detail.src} alt={lookImage?.detail.alt} objectPosition={lookImage?.detail.position} zoom={lookImage?.detail.zoom} aiContext="landing" />
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
        <div className="p-5 sm:p-8">
          <ImagePlaceholder
            label="Dein Originalfoto"
            ratio="3/2"
            className="h-full w-full border-primary-foreground/30"
            src={dealerCapturingAsset.url}
            alt="Händler fotografiert mit dem Smartphone einen hellblauen Ford Explorer vor dem Autohaus"
          />
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
