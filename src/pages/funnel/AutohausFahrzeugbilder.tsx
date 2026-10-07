import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Armchair, ArrowDown, ArrowRight, Camera, Car, CarFront, Check, CheckCircle2, CircleX, Crop, Download, Gem, Home, ImageIcon, Images, Layers3, Maximize2, Store, Timer, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import SmartphoneRevealDemo from '@/components/funnel/SmartphoneRevealDemo';
import FunnelImageLightbox from '@/components/funnel/FunnelImageLightbox';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';
import showroomAsset from '@/assets/funnel/fb-02-showroom-detail.webp.asset.json';
import detailExplorerAsset from '@/assets/funnel/fahrzeugbilder-detail-explorer.jpg.asset.json';
import studioAsset from '@/assets/funnel/fb-03-studio.webp.asset.json';
import outdoorAsset from '@/assets/funnel/fb-04-outdoor.webp.asset.json';
import kennzeichenAsset from '@/assets/funnel/fb-05-kennzeichen.webp.asset.json';
import logoShowroomAsset from '@/assets/funnel/fb-06-logo-showroom.webp.asset.json';
import eigenerShowroomAsset from '@/assets/funnel/fb-07-eigener-showroom.webp';
import perspFrontAsset from '@/assets/funnel/fb-08-front.webp.asset.json';
import perspSideAsset from '@/assets/funnel/fb-08-side.webp.asset.json';
import perspRearAsset from '@/assets/funnel/fb-08-rear.webp.asset.json';
import perspWheelAsset from '@/assets/funnel/fb-08-wheel.webp.asset.json';
import perspLightAsset from '@/assets/funnel/fb-08-light.webp.asset.json';
import perspCockpitAsset from '@/assets/funnel/fb-08-cockpit.webp.asset.json';
import perspRearSeatsAsset from '@/assets/funnel/fb-08-rearseats.webp.asset.json';

const TEST_URL = '/fahrzeug-testen?source=fahrzeugbilder';

const BENEFITS = [
  { icon: Gem, title: 'Hochwertige Bilder', text: 'Showroom-Look aus Smartphone-Fotos' },
  { icon: Zap, title: 'In wenigen Minuten', text: 'Schneller, einfacher Ablauf' },
  { icon: Camera, title: 'Ohne Fototermin', text: 'Direkt auf dem Hof' },
  { icon: Layers3, title: 'Einheitlicher Look', text: 'Für deinen gesamten Bestand' },
];

// Positionen in Prozent des sichtbaren Showroom-Bildes (x von links, y von oben).
// noteSide gibt fest vor, wo die Textnotiz erscheint; sonst wählt die Seite die breitere Bildseite.
type Hotspot = { title: string; text: string; x: number; y: number; noteSide?: 'left' | 'right' };

const HOTSPOTS: Hotspot[] = [
  { title: 'Licht & Reflexionen', text: 'Stimmige Reflexionen betonen die Linien und Oberflächen des Fahrzeugs.', x: 42, y: 40 },
  { title: 'Bodenkontakt & Schatten', text: 'Ein natürlicher Schatten verbindet das Fahrzeug mit dem Boden und unterstützt einen realistischen Gesamteindruck.', x: 58, y: 82, noteSide: 'right' },
  { title: 'Fahrzeugdetails', text: 'Klare Konturen und gut erkennbare Details rücken die Merkmale deines Fahrzeugs in den Mittelpunkt.', x: 44, y: 55 },
  { title: 'Showroom', text: 'Ein ruhiger Showroom-Hintergrund sorgt für eine hochwertige und einheitliche Fahrzeugpräsentation.', x: 13, y: 22 },
  { title: 'Logo im Showroom', text: 'Integriere dein Autohaus-Logo in den Showroom und gib deinen Fahrzeugbildern einen eigenen Markenauftritt.', x: 86, y: 20 },
  { title: 'Richtige Fahrzeugdimensionen', text: 'Dein Original-Fahrzeug wird harmonisch und mit korrekten Proportionen in den gewünschten Showroom eingefügt – kein statisch dahintergelegtes Hintergrundbild wie bei einfachen Foto-Apps.', x: 60, y: 38, noteSide: 'right' },
];

const STEPS = [
  { icon: Camera, title: 'Am Fahrzeug fotografieren', text: 'Mit dem Smartphone direkt auf dem Hof.' },
  { icon: ImageIcon, title: 'Verkaufsbilder erstellen', text: 'In wenigen Minuten mit autohaus.ai.' },
  { icon: Download, title: 'Herunterladen & nutzen', text: 'Für deine Fahrzeugvermarktung.' },
];

const COMPARE = [
  { before: 'Fotoplatz und Fototermin organisieren', after: 'Direkt am Fahrzeug fotografieren' },
  { before: 'Bilder manuell bearbeiten', after: 'Verkaufsbilder mit der App erstellen' },
  { before: 'Unterschiedliche Hintergründe im Bestand', after: 'Einen gewählten Look einheitlich nutzen' },
];

const SCENES = [
  { label: 'Helles Studio', image: studioAsset.url },
  { label: 'Moderner Showroom', image: showroomAsset.url },
  { label: 'Outdoor-Szene', image: outdoorAsset.url },
];

// Perspektiven: Jede Ansicht beruht auf einer tatsächlich aufgenommenen Aufnahme.
type Perspective = { label: string; text: string; image: string; alt?: string };
const PERSPECTIVE_GROUPS: { title: string; hint: string; icon: typeof Car; items: Perspective[] }[] = [
  {
    title: 'Außenansichten',
    hint: 'Winkel, die dein Fahrzeug vollständig zeigen.',
    icon: CarFront,
    items: [
      { label: 'Dreiviertel Front', text: 'Die Verkaufsansicht für Anzeige und Website.', image: perspFrontAsset.url },
      { label: 'Seite', text: 'Linienführung und Proportionen im Profil.', image: perspSideAsset.url },
      { label: 'Dreiviertel Heck', text: 'Heck und Seitenpartie in einer Aufnahme.', image: perspRearAsset.url },
    ],
  },
  {
    title: 'Details',
    hint: 'Aufnahmen, die Ausstattung und Zustand betonen.',
    icon: Gem,
    items: [
      { label: 'Felge', text: 'Rad und Reifen als eigene Detailaufnahme.', image: perspWheelAsset.url },
      { label: 'Scheinwerfer', text: 'Lichtsignatur und Frontdetails nah betrachtet.', image: perspLightAsset.url },
    ],
  },
  {
    title: 'Innenraum',
    hint: 'Bilder, die den Innenraum wirklich zeigen.',
    icon: Armchair,
    items: [
      { label: 'Cockpit', text: 'Lenkrad, Displays und Mittelkonsole.', image: perspCockpitAsset.url, alt: 'Ford Explorer Cockpit mit Lenkrad, zentralem Display und hellem Innenraum – mit KI erstellt' },
      { label: 'Rücksitzbank', text: 'Fond und Platzangebot aus eigener Aufnahme.', image: perspRearSeatsAsset.url },
    ],
  },
];

const MORE = [
  { icon: Car, title: 'Außen- & Innenansichten', text: 'Erstelle professionelle Außen- und Innenraumaufnahmen.' },
  { icon: Home, title: 'Eigener Showroom-Look', text: 'Nutze deinen individuellen Look für einen einheitlichen Markenauftritt.' },
  { icon: Crop, title: 'Weitere Bildformate', text: 'Passende Formate für Website, Fahrzeuganzeigen und Social Media.' },
];

const FAQ = [
  ['Brauche ich eine professionelle Kamera für hochwertige Fahrzeugbilder?', 'Nein. Du kannst dein Fahrzeug mit dem Smartphone direkt auf dem Hof fotografieren. Achte auf scharfe Aufnahmen, ausreichend Licht und darauf, dass das Fahrzeug vollständig sichtbar ist. Gute Ausgangsfotos bilden die Grundlage für hochwertige Ergebnisse.'],
  ['Was macht den professionellen Look der Fahrzeugbilder aus?', 'Ein stimmiger Hintergrund, passende Lichtreflexionen und ein natürlicher Bodenkontakt sorgen für einen überzeugenden Gesamteindruck. Klare Konturen und gut erkennbare Fahrzeugdetails rücken das Fahrzeug in den Mittelpunkt. Im interaktiven Detailbild auf dieser Seite kannst du diese Merkmale genauer ansehen.'],
  ['Wie schnell sind meine Fahrzeugbilder fertig?', 'Aus deinen Smartphone-Fotos entstehen in wenigen Minuten professionelle Verkaufsbilder. Du kannst direkt am Fahrzeug starten und brauchst dafür weder einen separaten Fototermin noch zusätzliches Personal für ein Fotoshooting. Die fertigen Bilder kannst du anschließend herunterladen und für deine Vermarktung nutzen.'],
  ['Wie viele Fotos brauche ich von einem Fahrzeug?', 'Ein Foto reicht für den Einstieg und die Erstellung eines Verkaufsbildes. Für eine vollständige Galerie fotografierst du das Fahrzeug aus mehreren Perspektiven und ergänzt Innenraum- sowie Detailaufnahmen. Jede gewünschte Ansicht sollte durch eine entsprechende Aufnahme abgedeckt sein.'],
  ['Kann ich dasselbe Fahrzeug in verschiedenen Szenen zeigen?', 'Ja. Du kannst dein Fahrzeug in unterschiedlichen Umgebungen präsentieren, etwa in einem hellen Studio, einem modernen Showroom oder einer passenden Outdoor-Szene. So wählst du den Look, der zu deinem Autohaus und zum jeweiligen Einsatz passt.'],
  ['Kann ich mein Autohaus-Logo im Showroom integrieren?', 'Ja. Dein Logo kann als Teil des Showroom-Hintergrunds eingebunden werden. Damit erhalten deine Fahrzeugbilder einen eigenen Markenauftritt und lassen sich über deinen Bestand hinweg einheitlich gestalten. Das Showroom-Logo wird unabhängig von der Kennzeichendarstellung behandelt.'],
  ['Wie werden Kennzeichen auf den Fahrzeugbildern dargestellt?', 'Du kannst Fahrzeuge mit Kennzeichen, ohne Kennzeichen oder mit einer gewünschten Kennzeichendarstellung zeigen. So lässt sich der Kennzeichenbereich passend zu deinem Auftritt gestalten.'],
  ['Bleiben Fahrzeugdetails und Ausstattung korrekt dargestellt?', 'Ja, autohaus.ai gibt Fahrzeugdetails und Ausstattung grundsätzlich originalgetreu wieder, etwa Felgen, Scheinwerfer und die Karosserieform. In sehr wenigen Fällen können einzelne Details abweichen, beispielsweise bei neuartigen Fahrzeugmodellen. Im Mittelpunkt steht eine hochwertige Präsentation, die den individuellen Charakter deines Fahrzeugs erhält.'],
];

export default function AutohausFahrzeugbilder() {
  usePageMeta({ title: 'Professionelle Fahrzeugbilder direkt auf dem Hof | autohaus.ai', description: 'Aus Smartphone-Fotos werden in wenigen Minuten hochwertige Verkaufsbilder – ohne Fototermin, mit einheitlichem Look für deinen Bestand.', canonicalPath: '/autohaus-fahrzeugbilder' });
  useEffect(() => { captureAttribution('lp_fahrzeugbilder'); }, []);

  const [scene, setScene] = useState<number | null>(null);
  const [perspective, setPerspective] = useState<Perspective | null>(null);

  return (
    <FunnelLayout ctaHref={TEST_URL} ctaLabel="Kostenlos testen" anchors={[{ href: '#bildqualitaet', label: 'Bildqualität' }, { href: '#perspektiven', label: 'Perspektiven' }, { href: '#ablauf', label: 'Ablauf' }, { href: '#szenen', label: 'Szenen' }, { href: '#fragen', label: 'Fragen' }]}>
      {/* Einstieg */}
      <section className="overflow-hidden bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Fahrzeugbilder für dein Autohaus</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.06] text-foreground sm:text-5xl">Aus einem Smartphone-Foto wird ein professionelles Fahrzeugbild.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">Erstelle aus einfachen Smartphone-Fotos hochwertige Verkaufsbilder. Ohne Fototermin und ohne zusätzliches Personal für ein Fotoshooting.</p>
            <Button asChild size="lg" className="mt-7 shadow-glow"><Link to={TEST_URL}>Mit eigenem Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link></Button>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {['Keine spezielle Ausrüstung', 'Direkt am Fahrzeug', 'Einheitlicher Look für deinen Bestand'].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{item}</span>)}
            </div>
          </div>
          <SmartphoneRevealDemo />
        </div>
      </section>

      {/* Vorteilsleiste */}
      <section className="border-y border-border bg-secondary/55">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-y-5 px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <div key={b.title} className={`flex items-center gap-3 px-2 ${i > 0 ? 'lg:border-l lg:border-border lg:pl-6' : ''}`}>
              <b.icon className="h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
              <div><p className="text-sm font-bold">{b.title}</p><p className="text-xs leading-5 text-muted-foreground">{b.text}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Detailbild */}
      <section id="bildqualitaet" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Qualität steckt im Detail.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Fahre über die Punkte und entdecke die Details.</p>
        <div className="relative mt-6 overflow-hidden rounded-lg border border-border bg-secondary shadow-card">
          <img src={detailExplorerAsset.url} alt="Hellblauer Ford Explorer in der Frontansicht im hellen Showroom – mit KI erstellt" width={1200} height={900} className="block h-auto w-full" loading="lazy" />
          {HOTSPOTS.map((h, i) => {
            // Notizseite: vorgegeben (noteSide) oder automatisch zur breiteren Bildseite.
            const toRight = h.noteSide ? h.noteSide === 'right' : h.x <= 55;
            // Seitlich mittig neben dem Punkt, sonst darüber bzw. darunter.
            const centerV = h.noteSide !== undefined && h.y > 15 && h.y < 90;
            const below = h.y < 22;
            return (
              <div key={h.title} className="group absolute h-0 w-0" style={{ left: `${h.x}%`, top: `${h.y}%` }}>
                <button
                  type="button"
                  aria-label={`Detail ${i + 1}: ${h.title}`}
                  aria-describedby={`hotspot-note-${i}`}
                  className="peer flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-accent text-xs font-bold text-primary-foreground shadow-elevated transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:hover:scale-110 sm:h-9 sm:w-9"
                >{i + 1}</button>
                <div id={`hotspot-note-${i}`} role="tooltip"
                  className={`pointer-events-none absolute z-10 w-52 rounded-lg border border-border bg-card p-3 text-left opacity-0 shadow-elevated transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 lg:w-64 ${toRight ? 'left-[26px]' : 'right-[26px]'} ${centerV ? 'top-0 -translate-y-1/2' : below ? 'top-[26px]' : 'bottom-[26px]'}`}>
                  <p className="text-sm font-bold">{h.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{h.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Perspektiven */}
      <section id="perspektiven" className="border-t border-border bg-secondary/40 py-14 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Vielfältige Perspektiven ab drei Fahrzeugfotos</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Ab drei Fahrzeugfotos entsteht eine echte Galerie: weitere Außenwinkel, gezielte Detailaufnahmen und Innenraumbilder. Jede Ansicht beruht auf einer Aufnahme, die du tatsächlich gemacht hast.</p>
          <div className="mt-8 space-y-9">
            {PERSPECTIVE_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><g.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <div><h3 className="text-sm font-bold">{g.title}</h3><p className="text-xs leading-5 text-muted-foreground">{g.hint}</p></div>
                </div>
                <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${g.items.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
                  {g.items.map((p) => (
                    <figure key={p.label}>
                      <button type="button" onClick={() => setPerspective(p)} aria-label={`${p.label} vollständig ansehen`} className="group relative block w-full overflow-hidden rounded-lg border border-border bg-card shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <img src={p.image} alt={p.alt ?? `${p.label} – ${g.title}`} width={1024} height={768} className="block aspect-[4/3] w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.02]" loading="lazy" />
                        <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-card/90 text-foreground shadow-card"><Maximize2 className="h-4 w-4" aria-hidden="true" /></span>
                      </button>
                      <figcaption className="mt-2 text-sm font-semibold">{p.label}</figcaption>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{p.text}</p>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 rounded-md bg-accent/10 px-4 py-3 text-center text-sm text-accent"><Images className="h-4 w-4 shrink-0" aria-hidden="true" /><span><strong>Zwei Fotos genügen für den Start.</strong> Jede weitere Aufnahme bringt eine echte Ansicht in deine Galerie.</span></p>
          <FunnelImageLightbox open={perspective !== null} onOpenChange={(o) => !o && setPerspective(null)} src={perspective?.image ?? ''} alt={perspective ? `${perspective.label} – vollständige Ansicht` : ''} title={perspective?.label ?? ''} />
        </div>
      </section>

      {/* Ablauf + Vergleich */}
      <section id="ablauf" className="border-t border-border bg-secondary/40 py-14 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Dein Fahrzeugbild – aufbereitet und online in drei Schritten.</h2>
          <ol className="mt-7 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            {STEPS.map((s, i) => (
              <li key={s.title} className="contents">
                <div className="flex flex-1 items-center gap-4 rounded-lg border border-border bg-card p-5 shadow-card">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><s.icon className="h-6 w-6" aria-hidden="true" /></span>
                  <div><h3 className="text-sm font-bold">{s.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{s.text}</p></div>
                </div>
                {i < STEPS.length - 1 && <span className="flex justify-center text-accent" aria-hidden="true"><ArrowRight className="hidden h-5 w-5 md:block" /><ArrowDown className="h-5 w-5 md:hidden" /></span>}
              </li>
            ))}
          </ol>

          <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <div className="hidden grid-cols-2 md:grid">
              <p className="flex items-center gap-2 border-r border-border bg-destructive/10 px-5 py-3 text-sm font-bold text-destructive"><CircleX className="h-4 w-4 shrink-0" aria-hidden="true" />Bisher häufig nötig</p>
              <p className="flex items-center gap-2 bg-accent/10 px-5 py-3 text-sm font-bold text-accent"><CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />Mit autohaus.ai</p>
            </div>
            {COMPARE.map((c) => (
              <div key={c.before} className="grid border-t border-border md:grid-cols-2 md:first-of-type:border-t-0">
                <p className="flex items-start gap-3 bg-destructive/5 px-5 py-3.5 text-sm text-muted-foreground md:border-r md:border-border">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={3} aria-hidden="true" />
                  <span className="line-through decoration-destructive/50"><span className="sr-only md:hidden">Bisher: </span>{c.before}</span>
                </p>
                <p className="flex items-start gap-3 bg-accent/5 px-5 py-3.5 text-sm font-medium text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />
                  <span><span className="sr-only">Mit autohaus.ai: </span>{c.after}</span>
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 flex items-center justify-center gap-2.5 rounded-md bg-accent/10 px-4 py-3.5 text-center text-sm font-semibold text-accent"><Timer className="h-5 w-5 shrink-0" aria-hidden="true" /><span>Dein perfektes Fahrzeugbild. Fertig zur Vermarktung direkt am Fahrzeug.</span></p>

          {/* Kennzeichen-/Logo-Blöcke ausgeblendet – wird bereits im Hauptbild behandelt */}
          {false && (<div className="mt-6 grid gap-4 md:grid-cols-2">
            {[{ img: kennzeichenAsset.url, title: 'Kennzeichen nach Wunsch', text: 'Mit, ohne oder mit deiner gewünschten Kennzeichendarstellung.', alt: 'Fahrzeugfront mit individuellem Kennzeichen „AUTOHAUS“' },
              { img: logoShowroomAsset.url, title: 'Dein Logo im Showroom', text: 'Dein Autohaus-Logo als Teil des Showrooms.', alt: 'Showroom-Wand mit Autohaus-Logo' }].map((c) => (
              <article key={c.title} className="grid grid-cols-[45%_1fr] overflow-hidden rounded-lg border border-border bg-card shadow-card">
                <img src={c.img} alt={c.alt} className="h-full min-h-32 w-full object-cover" loading="lazy" />
                <div className="p-4 sm:p-5"><h3 className="text-sm font-bold">{c.title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{c.text}</p></div>
              </article>
            ))}
          </div>)}
        </div>
      </section>

      {/* Szenen */}
      <section id="szenen" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Ein Fahrzeug. Verschiedene Szenen.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Wähle deinen Look und nutze ihn einheitlich für deinen Bestand – oder zeige dein Fahrzeug in deinem eigenen Showroom.</p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SCENES.map((s, i) => (
            <figure key={s.label}>
              <button type="button" onClick={() => setScene(i)} className="group relative block w-full overflow-hidden rounded-lg border border-border bg-secondary shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${s.label} vollständig ansehen`}>
                <img src={s.image} alt={`Silberner SUV – ${s.label}`} width={1536} height={1024} className="block h-auto w-full transition-transform duration-300 motion-safe:group-hover:scale-[1.02]" loading="lazy" />
                <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-card/90 text-foreground shadow-card"><Maximize2 className="h-4 w-4" aria-hidden="true" /></span>
              </button>
              <figcaption className="mt-2 text-sm font-semibold">{s.label}</figcaption>
            </figure>
          ))}
          <article className="flex flex-col">
            <div className="overflow-hidden rounded-lg border border-accent/40 bg-secondary shadow-card">
              <img src={eigenerShowroomAsset} alt="Silberner SUV im Showroom eines Autohauses mit Glasfassade und Übergabebereich" width={1264} height={848} className="block h-auto w-full" loading="lazy" />
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold"><Store className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />Eigener Showroom</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Du nutzt lieber deinen eigenen Showroom? Dann bleibt er dein Hintergrund: Wir setzen dein Fahrzeug in deinen bestehenden Räumlichkeiten professionell in Szene.</p>
          </article>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 rounded-md bg-accent/10 px-4 py-3 text-center text-sm text-accent"><Layers3 className="h-4 w-4 shrink-0" aria-hidden="true" /><span><strong>Dein gewählter Look.</strong> Für deinen gesamten Fahrzeugbestand.</span></p>
        <FunnelImageLightbox open={scene !== null} onOpenChange={(o) => !o && setScene(null)} src={scene !== null ? SCENES[scene].image : ''} alt={scene !== null ? `Silberner SUV – ${SCENES[scene].label}` : ''} title={scene !== null ? SCENES[scene].label : ''} />
      </section>

      {/* Mehr Möglichkeiten */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Mehr Möglichkeiten für deine Fahrzeugbilder.</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {MORE.map((m) => (
            <article key={m.title} className="flex gap-4 rounded-lg border border-border bg-card p-5 shadow-card">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><m.icon className="h-6 w-6" aria-hidden="true" /></span>
              <div><h3 className="text-sm font-bold">{m.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{m.text}</p></div>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="fragen" className="scroll-mt-20 border-t border-border bg-secondary/45 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Noch Fragen?</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Noch Fragen?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Alles Wichtige zu deinen Aufnahmen, der Bildqualität und deinem individuellen Look.</p>
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

      {/* Abschluss */}
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 rounded-lg bg-accent px-6 py-8 text-primary-foreground sm:px-8 lg:flex-row lg:items-center">
          <div><h2 className="font-display text-2xl font-bold">Teste die Bildqualität an deinem eigenen Fahrzeug.</h2><p className="mt-2 text-sm text-primary-foreground/85">Ein Smartphone-Foto genügt für den Einstieg.</p></div>
          <Button asChild size="lg" variant="secondary" className="shrink-0"><Link to={TEST_URL}>Fahrzeug kostenlos testen <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>
    </FunnelLayout>
  );
}
