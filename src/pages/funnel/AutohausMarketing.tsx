import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import dealerOriginal from '@/assets/funnel/dealer-original.webp.asset.json';
import dealerRemastered from '@/assets/funnel/branding-2.jpg.asset.json';
import { ArrowRight, Building2, Calendar, Camera, Check, ChevronLeft, ChevronRight, Clock, FileText, ImageIcon, Images, Megaphone, MessagesSquare, Palette, PenTool, Users, Video, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import ProcessCheckForm from '@/components/funnel/ProcessCheckForm';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';

const TEST_URL = '/fahrzeug-testen?source=marketing';

/**
 * Austauschbare Medien. `src` später einzeln setzen (Bild-URL oder für Videos { webm, mp4 }).
 * Solange `src` leer ist, wird ein Platzhalter ohne Bildquelle/Player gezeigt.
 */
type Media = { label: string; ratio: string; kind: 'image' | 'video' | 'page'; src?: string; webm?: string; mp4?: string };
const MEDIA = {
  heroBefore: { label: 'Deine Aufnahme', ratio: '4 / 3', kind: 'image', src: dealerOriginal.url },
  heroAfter: { label: 'Dein Fahrzeugbild', ratio: '4 / 3', kind: 'image', src: dealerRemastered.url },
  bildAussen: { label: 'Fahrzeugbild außen', ratio: '4 / 3', kind: 'image' },
  bildInnen: { label: 'Fahrzeugbild innen', ratio: '4 / 3', kind: 'image' },
  motivSocial: { label: 'Social-Media-Motiv (1:1)', ratio: '1 / 1', kind: 'image' },
  motivDisplay: { label: 'Google-Display-Banner (300×600)', ratio: '300 / 600', kind: 'image' },
  clip: { label: 'Fahrzeugclip', ratio: '9 / 16', kind: 'video' },
  seite: { label: 'Fahrzeugseite', ratio: '16 / 10', kind: 'page' },
} satisfies Record<string, Media>;

function MediaSlot({ m, className = '' }: { m: Media; className?: string }) {
  const style = { aspectRatio: m.ratio };
  if (m.kind === 'video' && (m.webm || m.mp4)) {
    return <video className={`w-full rounded-lg border border-border object-contain ${className}`} style={style} muted loop autoPlay playsInline>{m.webm && <source src={m.webm} type="video/webm" />}{m.mp4 && <source src={m.mp4} type="video/mp4" />}</video>;
  }
  if (m.src) return <img src={m.src} alt={m.label} className={`w-full rounded-lg border border-border bg-secondary object-contain ${className}`} style={style} loading="lazy" />;
  const Icon = m.kind === 'video' ? Video : m.kind === 'page' ? FileText : ImageIcon;
  return (
    <div className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/50 p-3 text-center text-muted-foreground ${className}`} style={style} role="img" aria-label={`Platzhalter: ${m.label}`}>
      <Icon className="h-6 w-6" aria-hidden="true" />
      <span className="text-xs font-semibold">{m.label}</span>
    </div>
  );
}

const IBR = [
  [Clock, 'Heute oft Tage.', 'Fototermine, Bildbearbeitung und Gestaltung brauchen Zeit und Abstimmung.'],
  [Camera, 'Mit der App wenige Minuten.', 'Direkt am Fahrzeug Bilder und Marketing erstellen. Bereits ab einem Smartphone-Foto.'],
  [Wand2, 'KI übernimmt die Erstellung.', 'KI bereitet deine Aufnahmen auf. Vorlagen gestalten passende Inhalte.'],
] as const;

const FLOWS = [
  { icon: Images, title: 'Fahrzeugbilder', you: 'Fotografieren, hochladen, Szene wählen', app: 'Digitale Bildaufbereitung', get: 'Professionelle Fahrzeugbilder' },
  { icon: Megaphone, title: 'Werbemotive', you: 'Bild und Format wählen, Angebot ergänzen', app: 'Gestaltung mit passenden Vorlagen', get: 'Fertige Motive und Banner' },
];

const RESULTS: { label: string; icon: typeof Images; media: Media[]; need: string; use: string }[] = [
  { label: 'Fahrzeugbilder', icon: Images, media: [MEDIA.bildAussen, MEDIA.bildInnen], need: 'Smartphone-Aufnahmen und die gewünschte Szene.', use: 'Fahrzeugpräsentation auf deiner Website und in Inseraten.' },
  { label: 'Werbemotive', icon: Megaphone, media: [MEDIA.motivSocial, MEDIA.motivDisplay], need: 'Fahrzeugbild, Format und Angebotsangaben.', use: 'Social Media und Google Display.' },
  { label: 'Videos', icon: Video, media: [MEDIA.clip], need: 'Fahrzeugbilder und die Auswahl der Videofunktion.', use: 'Social Media und deine Website.' },
  { label: 'Fahrzeugseiten', icon: FileText, media: [MEDIA.seite], need: 'Fahrzeugbilder sowie Fahrzeug- und Angebotsdaten.', use: 'Eine eigene Fahrzeugseite mit Angebot und Kontaktmöglichkeit.' },
];

const SAVED: [typeof Calendar, string, string][] = [
  [Calendar, 'Separate Fototermine', 'Fahrzeuge für Aufnahmen umstellen und Termine koordinieren.'],
  [PenTool, 'Manuelle Gestaltung', 'Bilder bearbeiten, Banner gestalten und Formate anpassen.'],
  [MessagesSquare, 'Externe Abstimmung', 'Die gezeigten Inhalte direkt selbst erstellen.'],
];

const STEPS = [
  ['Smartphone und Fahrzeug', 'Ein Mitarbeiter, ein Smartphone und ein Fahrzeug aus deinem Bestand.'],
  ['Aufnahmen in der App', 'Fotos hochladen, Szene wählen und bei Werbemotiven Angebotsangaben ergänzen.'],
  ['Erste Ergebnisse verwenden', 'Fahrzeugbilder und Marketingmaterial für deine Kanäle nutzen.'],
];

const FAQ: [string, string][] = [
  ['Was benötige ich für den ersten Test?', 'Ein Smartphone und ein Fahrzeug aus deinem Bestand. Du lädst Aufnahmen hoch und siehst das Ergebnis an deinem eigenen Fahrzeug.'],
  ['Wer erstellt die Inhalte im Autohaus?', 'Ein Mitarbeiter direkt am Fahrzeug, etwa bei Annahme, Aufbereitung oder im Verkauf. Bildbearbeitungskenntnisse sind nicht nötig.'],
  ['Kann ich vorhandene Fotos verwenden?', 'Ja. Wie gut das Ergebnis wird, hängt von Perspektive und Qualität des Fotos ab.'],
  ['Wie schnell entstehen fertige Inhalte?', 'Inhalte können in wenigen Minuten entstehen. Die Dauer hängt von Funktion und Umfang ab – Videos oder mehrere Ansichten brauchen länger als ein einzelnes Bild.'],
  ['Wie veröffentliche ich die Ergebnisse?', 'Alle Inhalte kannst du herunterladen und selbst verwenden. Über unterstützte Funktionen lassen sich Inhalte zusätzlich direkt veröffentlichen oder an eure Systeme übergeben.'],
  ['Was kostet die Nutzung?', 'Die aktuellen Pakete und Preise findest du auf unserer Preisseite. Abgerechnet wird über Credits je nach genutzter Funktion.'],
];

function ResultCarousel() {
  const [i, setI] = useState(0);
  const touch = useRef<number | null>(null);
  const r = RESULTS[i];
  const go = (d: number) => setI((v) => (v + d + RESULTS.length) % RESULTS.length);
  return (
    <div>
      <div role="tablist" aria-label="Ergebnisse" className="mt-7 flex flex-wrap gap-2">
        {RESULTS.map((x, idx) => (
          <button key={x.label} role="tab" aria-selected={i === idx} onClick={() => setI(idx)} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${i === idx ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card hover:border-accent'}`}>
            <x.icon className="h-4 w-4" aria-hidden="true" />{x.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        aria-label={r.label}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touch.current = null; }}
        className="mt-6 rounded-lg border border-border bg-card p-5 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:p-8"
      >
        <div className="flex flex-wrap items-start justify-center gap-5">
          {r.media.map((m) => {
            const w = m.ratio === '300 / 600' || m.ratio === '9 / 16' ? 'w-36 sm:w-44' : m.ratio === '1 / 1' ? 'w-56 sm:w-72' : m.ratio === '16 / 10' ? 'w-full max-w-2xl' : 'w-full sm:w-[calc(50%-10px)] max-w-md';
            return <div key={m.label} className={w}><MediaSlot m={m} /></div>;
          })}
        </div>
        <dl className="mx-auto mt-6 grid max-w-3xl gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-bold">Dafür nötig</dt><dd className="mt-1 text-muted-foreground">{r.need}</dd></div>
          <div><dt className="font-bold">Einsetzbar</dt><dd className="mt-1 text-muted-foreground">{r.use}</dd></div>
        </dl>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Vorheriges Ergebnis"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex gap-2" aria-label={`Ergebnis ${i + 1} von ${RESULTS.length}`}>
            {RESULTS.map((x, idx) => <button key={x.label} onClick={() => setI(idx)} aria-label={x.label} className={`h-2.5 rounded-full transition-all ${i === idx ? 'w-6 bg-accent' : 'w-2.5 bg-border'}`} />)}
          </div>
          <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Nächstes Ergebnis"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function AutohausMarketing() {
  usePageMeta({ title: 'Fahrzeuge schneller vermarkten | autohaus.ai', description: 'Smartphone-Fotos aufnehmen, in der App aufbereiten und Fahrzeugbilder sowie Marketingmaterial in wenigen Minuten erstellen.', canonicalPath: '/autohaus-marketing' });
  useEffect(() => { captureAttribution('lp_marketing'); }, []);
  const [showGroup, setShowGroup] = useState(false);
  const [heroLarge, setHeroLarge] = useState<'before' | 'after'>('after');
  const heroLeft = heroLarge === 'before' ? MEDIA.heroAfter : MEDIA.heroBefore;
  const heroRight = heroLarge === 'before' ? MEDIA.heroBefore : MEDIA.heroAfter;
  const heroKey = (m: Media) => (m === MEDIA.heroBefore ? 'before' : 'after');

  return (
    <FunnelLayout ctaHref={TEST_URL} ctaLabel="Mit Fahrzeug testen" anchors={[{ href: '#ablauf', label: 'Ablauf' }, { href: '#ergebnisse', label: 'Ergebnisse' }, { href: '#start', label: 'Einstieg' }, { href: '#faq', label: 'FAQ' }]}>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:py-16">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl">Fahrzeuge schneller vermarkten. Mit weniger Aufwand im Autohaus.</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Smartphone-Fotos aufnehmen. In der App aufbereiten. Fahrzeugbilder und Marketingmaterial in wenigen Minuten erstellen.</p>
            <Button asChild size="lg" className="mt-7"><Link to={TEST_URL} data-cta="marketing_hero_test">Mit eigenem Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link></Button>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">{['Zeit sparen', 'Erstellungskosten reduzieren', 'Mitarbeiter entlasten'].map((x) => <span key={x} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" />{x}</span>)}</div>
          </div>
          <div className="grid grid-cols-[.8fr_1.2fr] items-center gap-4">
            <figure>
              <button type="button" onClick={() => setHeroLarge(heroKey(heroLeft))} aria-label={`${heroLeft.label} groß anzeigen`} className="block w-full cursor-pointer text-left transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg">
                <MediaSlot m={heroLeft} />
              </button>
              <figcaption className="mt-2 text-xs font-semibold text-muted-foreground">{heroLeft.label}</figcaption>
            </figure>
            <figure>
              <button type="button" onClick={() => setHeroLarge(heroKey(heroRight))} aria-label={`${heroRight.label} groß anzeigen`} className="block w-full cursor-pointer text-left transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg">
                <MediaSlot m={heroRight} className="shadow-elevated" />
              </button>
              <figcaption className={`mt-2 text-xs font-semibold ${heroRight === MEDIA.heroAfter ? 'text-accent' : 'text-muted-foreground'}`}>{heroRight.label}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Zwei Zeitlinien: früher vs. jetzt */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Vom Ankommen bis online. Früher und heute.</h2>
        <p className="mt-2 text-muted-foreground">Der bisherige Ablauf neben dem Ablauf mit autohaus.ai.</p>
        <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Früher</p>
            <ol className="mt-4 space-y-4 pl-6">
              {['Fahrzeug kommt an und wird erfasst.', 'Fahrzeug muss aufbereitet werden.', 'Fahrzeug muss fotografiert werden.', 'Fahrzeug muss online eingerichtet werden.', 'Marketing muss erstellt werden.'].map((step, i) => (
                <li key={step} className="relative">
                  <span aria-hidden="true" className="absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-border bg-card text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                  <span className="block text-sm font-semibold leading-6 text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-accent">Jetzt, mit autohaus.ai</p>
            <ol className="mt-4 space-y-4 pl-6">
              {['Fahrzeug kommt an und wird ohne Aufbereitung direkt mit dem Smartphone fotografiert.', 'Bilder und Marketingmaterial werden automatisiert erstellt.', 'Fahrzeug und Marketing sind direkt online.'].map((step, i) => (
                <li key={step} className="relative">
                  <span aria-hidden="true" className={`absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 text-[9px] font-bold ${i === 2 ? 'border-accent bg-accent text-accent-foreground' : 'border-accent/40 bg-card text-accent'}`}>{i + 1}</span>
                  <span className={`block text-sm font-semibold leading-6 ${i === 2 ? 'text-accent' : 'text-foreground'}`}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>


      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">{IBR.map(([Icon, t, x]) => <article key={t} className="rounded-lg border border-border bg-card p-6 shadow-card"><Icon className="h-6 w-6 text-accent" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-bold">{t}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{x}</p></article>)}</div>
      </section>

      <section id="ablauf" className="funnel-section-tint scroll-mt-20 border-y border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Wenige Handgriffe. Fertige Inhalte.</h2>
          <p className="mt-2 text-muted-foreground">Das machst du. Das übernimmt die App.</p>
          <div className="mt-7 space-y-4">
            {FLOWS.map((f) => (
              <div key={f.title} className="rounded-lg border border-border bg-card p-5">
                <p className="flex items-center gap-2 font-bold"><f.icon className="h-5 w-5 text-accent" aria-hidden="true" />{f.title}</p>
                <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[['Du machst', f.you], ['autohaus.ai übernimmt', f.app], ['Du bekommst', f.get]].map(([k, v], i) => (
                    <li key={k} className={`rounded-md p-4 ${i === 2 ? 'bg-accent/10' : 'bg-secondary/60'}`}>
                      <span className={`block text-xs font-bold uppercase tracking-wide ${i === 2 ? 'text-accent' : 'text-muted-foreground'}`}>{k}</span>
                      <span className="mt-1 block text-sm font-semibold">{v}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Aufnahmen wiederverwenden. Weitere Inhalte direkt erstellen.</p>
        </div>
      </section>

      <section id="ergebnisse" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Ein Fahrzeug. Alles für deine Vermarktung.</h2>
        <ResultCarousel />
        <p className="mt-8 flex items-center gap-3 font-display text-xl font-bold"><Palette className="h-6 w-6 shrink-0 text-accent" aria-hidden="true" />Dein Logo. Deine Farben. Dein Auftritt.</p>
      </section>

      <section className="border-y border-border bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Diese Arbeit sparst du dir.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">{SAVED.map(([Icon, t, x]) => <article key={t} className="rounded-lg border border-border bg-background p-6"><Icon className="h-6 w-6 text-accent" aria-hidden="true" /><h3 className="mt-4 font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{x}</p></article>)}</div>
          <p className="mt-6 font-display text-xl font-bold text-accent">Mehr Kapazität für den Verkauf.</p>
        </div>
      </section>

      <section id="start" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">So startest du in deinem Autohaus.</h2>
        <ol className="mt-7 grid gap-4 md:grid-cols-3">{STEPS.map(([t, x], i) => <li key={t} className="rounded-lg border border-border bg-card p-6 shadow-card"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 font-bold text-accent">{i + 1}</span><h3 className="mt-4 font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{x}</p></li>)}</ol>
        <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4 text-accent" aria-hidden="true" />Ein Mitarbeiter kann die Inhalte direkt am Fahrzeug erstellen.</p>
        <Accordion type="multiple" className="mt-6 rounded-lg border border-border bg-card px-5">
          <AccordionItem value="standorte">
            <AccordionTrigger className="text-left text-sm font-semibold">Einsatz an mehreren Standorten</AccordionTrigger>
            <AccordionContent className="text-sm leading-6 text-muted-foreground">Gemeinsame Vorlagen und Gestaltungsvorgaben unterstützen einen einheitlichen Auftritt über mehrere Betriebe. Der Ablauf bleibt in jedem Betrieb gleich. Wie das für eure Gruppe eingerichtet wird, klären wir gemeinsam.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="anbindungen" className="border-b-0">
            <AccordionTrigger className="text-left text-sm font-semibold">Veröffentlichung und Anbindungen</AccordionTrigger>
            <AccordionContent className="text-sm leading-6 text-muted-foreground">
              <p><b className="text-foreground">Standard:</b> Download von Bildern, Motiven und Videos sowie Fahrzeugseiten zum Teilen und Einbetten. Über unterstützte Funktionen können Inhalte direkt veröffentlicht werden.</p>
              <p className="mt-2"><b className="text-foreground">Individuell einzurichten:</b> API, WordPress oder FTP/SFTP – je nach Setup. Welche Anbindung zu euren Systemen passt, klären wir gemeinsam.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-border bg-card py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[.7fr_1.3fr]">
          <h2 className="font-display text-3xl font-bold">Fragen zum Einstieg und Einsatz.</h2>
          <Accordion type="single" collapsible defaultValue="f0">{FAQ.map(([q, a], i) => <AccordionItem key={q} value={`f${i}`}><AccordionTrigger className="text-left text-sm font-semibold">{q}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-muted-foreground">{a}{i === FAQ.length - 1 && <> <Link to="/pricing" className="font-semibold text-accent hover:underline">Zu den Preisen</Link></>}</AccordionContent></AccordionItem>)}</Accordion>
        </div>
      </section>

      <section id="einstieg" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="rounded-lg border border-accent/30 bg-card p-8 text-center shadow-card sm:p-10">
          <h2 className="font-display text-3xl font-bold">Teste es mit einem Fahrzeug aus deinem Bestand.</h2>
          <p className="mt-3 text-muted-foreground">Erlebe die Ergebnisse an deinen eigenen Aufnahmen.</p>
          <Button asChild size="lg" className="mt-6"><Link to={TEST_URL} data-cta="marketing_abschluss_test">Mit Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
        <div id="prozess-check" className="mt-6 scroll-mt-20 rounded-lg border border-border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" /><div><h3 className="font-bold">Für deinen Betrieb oder eine Händlergruppe</h3><p className="mt-1 text-sm text-muted-foreground">Abläufe und Anbindungen gemeinsam besprechen.</p></div></div>
            {!showGroup && <Button variant="outline" data-cta="prozess_check" onClick={() => setShowGroup(true)}>Einsatz besprechen</Button>}
          </div>
          {showGroup && <div className="mt-5"><ProcessCheckForm submitLabel="Einsatz besprechen" /></div>}
        </div>
      </section>
    </FunnelLayout>
  );
}
