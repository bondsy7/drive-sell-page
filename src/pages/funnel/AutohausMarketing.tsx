import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Camera, Check, Clock, Coins, FileText, Images, Megaphone, Palette, Plug, RotateCcw, Send, Sparkles, Users, Video, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import BeforeAfterShowcase from '@/components/funnel/BeforeAfterShowcase';
import ProcessCheckForm from '@/components/funnel/ProcessCheckForm';
import FunnelImageLightbox from '@/components/funnel/FunnelImageLightbox';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';
import after1 from '@/assets/funnel/after1.webp.asset.json';
import after2 from '@/assets/funnel/after2.webp.asset.json';
import after3 from '@/assets/funnel/after3.webp.asset.json';
import socialPost from '@/assets/funnel/social-post-velmora-v2.webp.asset.json';
import story from '@/assets/story-velmora.webp.asset.json';
import fbAd from '@/assets/funnel/facebook-ad-velmora.png.asset.json';
import clipWebm from '@/assets/funnel/fahrzeugscheinwerfer-blinken.webm.asset.json';
import clipMp4 from '@/assets/funnel/fahrzeugscheinwerfer-blinken.mp4.asset.json';
import clipPoster from '@/assets/funnel/fahrzeugscheinwerfer-blinken-poster.jpg.asset.json';

const TEST_URL = '/fahrzeug-testen?source=marketing';
const VEHICLE_PAGE_URL = '/previews/velmora-narys-angebot.html';

const IBR = [
  [Clock, 'Heute oft Tage.', 'Bis ein Fahrzeug professionell online präsentiert wird, vergehen oft Tage. Fotos, Bildaufbereitung und Marketingmaterial benötigen mehrere Beteiligte, Arbeitszeit und Abstimmung.'],
  [Camera, 'Mit der App wenige Minuten.', 'Bereits ab einem schnell aufgenommenen Smartphone-Foto kannst du dein Fahrzeug digital in Szene setzen. In wenigen Minuten entstehen professionelle Fahrzeugbilder und Marketingmaterial. Direkt am Fahrzeug, ohne es dafür bewegen zu müssen.'],
  [Wand2, 'KI übernimmt die Erstellung.', 'KI verarbeitet deine Aufnahmen, setzt das Fahrzeug in die gewünschte Szene und erstellt daraus Inhalte. Vorlagen sorgen für passende Formate und den Auftritt deines Autohauses. So werden viele bisher manuelle Arbeitsschritte in einer App zusammengeführt.'],
] as const;

const OLD_WAY = ['Fototermin', 'Gestaltung', 'Abstimmung', 'Formatvorbereitung'];
const NEW_WAY = [
  [Camera, 'Fotos und Fahrzeugdaten erfassen'],
  [Images, 'Fahrzeugbilder aufbereiten'],
  [Megaphone, 'Marketingmaterial erstellen'],
  [Send, 'Inhalte veröffentlichen oder übergeben'],
] as const;

type ResultKey = 'bilder' | 'motive' | 'videos' | 'seiten';
const RESULTS: { key: ResultKey; icon: typeof Images; label: string; text: string }[] = [
  { key: 'bilder', icon: Images, label: 'Fahrzeugbilder', text: 'Außen- und Innenaufnahmen in einheitlicher, professioneller Szene.' },
  { key: 'motive', icon: Megaphone, label: 'Werbemotive', text: 'Social-Media-Posts, Stories und Google-Display-Banner in passenden Formaten.' },
  { key: 'videos', icon: Video, label: 'Videos', text: 'Kurze Fahrzeugclips für Reels, Stories und Portale.' },
  { key: 'seiten', icon: FileText, label: 'Fahrzeugseiten', text: 'Fahrzeugdarstellung, Angebot und Kontaktmöglichkeit auf einer Seite.' },
];

const VALUE = [
  [Clock, 'Arbeitszeit', 'Weniger manuelle Gestaltung, Formatvorbereitung und Abstimmung für Fahrzeugbilder und Marketingmaterial.'],
  [Coins, 'Erstellungskosten', 'Weniger externe Leistungen für Inhalte, die mit der App selbst erstellt werden können.'],
  [Sparkles, 'Wartezeit', 'Fahrzeugbilder und Marketingmaterial sind früher einsatzbereit, weil die Erstellung direkt am Fahrzeug beginnen kann.'],
] as const;

const OPS = [
  [Users, 'Mitarbeiter', 'Direkt am Fahrzeug arbeiten und die Anwendung zunächst mit einem eigenen Fahrzeug kennenlernen. Bildbearbeitungskenntnisse sind nicht nötig.'],
  [Building2, 'Mehrere Standorte', 'Gemeinsame Vorlagen und Gestaltungsvorgaben für einen einheitlichen Auftritt verwenden. Der Ablauf bleibt in jedem Betrieb gleich.'],
  [Plug, 'Bestehende Systeme', 'Inhalte herunterladen, über unterstützte Funktionen veröffentlichen oder über verfügbare Anbindungen übergeben.'],
] as const;

const FAQ = [
  ['Was benötigen wir für den ersten Test?', 'Ein Fahrzeug aus deinem Bestand und ein Smartphone. Du lädst ein Foto hoch und siehst das Ergebnis an deinem eigenen Fahrzeug.'],
  ['Wer nutzt die App im Autohaus?', 'Meist die Mitarbeiter, die ohnehin am Fahrzeug sind – etwa bei Annahme, Aufbereitung oder im Verkauf. Spezielle Bildbearbeitungskenntnisse sind nicht erforderlich.'],
  ['Können vorhandene Fahrzeugfotos verwendet werden?', 'Ja, vorhandene Aufnahmen können hochgeladen werden. Wie gut das Ergebnis wird, hängt von Perspektive und Qualität des Fotos ab.'],
  ['Wie schnell entstehen fertige Inhalte?', 'Das hängt von Funktion und Umfang ab. Einzelne Fahrzeugbilder entstehen in wenigen Minuten, umfangreichere Inhalte wie Videos oder mehrere Ansichten brauchen entsprechend länger.'],
  ['Können wir unser Logo und unsere Farben verwenden?', 'Ja. Logo und Farben deines Autohauses werden im Händlerprofil hinterlegt und in Vorlagen für Werbemotive und Fahrzeugseiten verwendet.'],
  ['Können mehrere Standorte mit gemeinsamen Vorlagen arbeiten?', 'Gemeinsame Vorlagen und Gestaltungsvorgaben unterstützen einen einheitlichen Auftritt über mehrere Betriebe. Wie das für eure Gruppe eingerichtet wird, klären wir im Gespräch.'],
  ['Wie gelangen die Inhalte auf unsere Kanäle und in bestehende Systeme?', 'Inhalte lassen sich herunterladen oder über unterstützte Funktionen veröffentlichen. Anbindungen per API, WordPress oder FTP/SFTP sind je nach Setup möglich und werden individuell eingerichtet.'],
  ['Was kostet die Nutzung?', 'Die aktuellen Pakete und Preise findest du auf unserer Preisseite. Abgerechnet wird über Credits je nach genutzter Funktion.'],
];

function ResultView({ k, onZoom }: { k: ResultKey; onZoom: (src: string, alt: string) => void }) {
  const Zoom = ({ src, alt, className = '' }: { src: string; alt: string; className?: string }) => (
    <button type="button" onClick={() => onZoom(src, alt)} className={`overflow-hidden rounded-lg border border-border bg-card shadow-card transition hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`} aria-label={`${alt} vergrößern`}>
      <img src={src} alt={alt} className="h-full w-full object-contain" loading="lazy" />
    </button>
  );
  if (k === 'bilder') return <div className="grid gap-4 sm:grid-cols-3">{[after1, after2, after3].map((a, i) => <Zoom key={a.asset_id} src={a.url} alt={`Fahrzeugbild Beispiel ${i + 1}`} className="aspect-[4/3]" />)}</div>;
  if (k === 'motive') return <div className="flex flex-wrap items-start justify-center gap-4"><Zoom src={socialPost.url} alt="Social-Media-Post" className="w-56" /><Zoom src={story.url} alt="Story-Motiv" className="w-36" /><Zoom src={fbAd.url} alt="Anzeige im Querformat" className="w-80" /></div>;
  if (k === 'videos') return <div className="flex justify-center"><video className="w-56 rounded-lg border border-border shadow-card" autoPlay muted loop playsInline controls poster={clipPoster.url}><source src={clipWebm.url} type="video/webm" /><source src={clipMp4.url} type="video/mp4" /></video></div>;
  if (k === 'seiten') return <div className="flex flex-col items-center gap-3"><div className="relative h-[420px] w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-card"><iframe src={VEHICLE_PAGE_URL} title="Beispiel Fahrzeugseite" className="h-full w-full" loading="lazy" /></div><a href={VEHICLE_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent hover:underline">Fahrzeugseite vollständig öffnen</a></div>;
}

export default function AutohausMarketing() {
  usePageMeta({ title: 'Fahrzeuge schneller vermarkten | autohaus.ai', description: 'Aus Smartphone-Aufnahmen entstehen professionelle Fahrzeugbilder, Werbemotive, Videos und Fahrzeugseiten. Direkt am Fahrzeug, in wenigen Minuten.', canonicalPath: '/autohaus-marketing' });
  useEffect(() => { captureAttribution('lp_marketing'); }, []);
  const [res, setRes] = useState<ResultKey>('bilder');
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const active = RESULTS.find((r) => r.key === res)!;

  return (
    <FunnelLayout ctaHref={TEST_URL} ctaLabel="Mit Fahrzeug testen" anchors={[{ href: '#ablauf', label: 'Ablauf' }, { href: '#ergebnisse', label: 'Ergebnisse' }, { href: '#einsatz', label: 'Einsatz' }, { href: '#faq', label: 'FAQ' }]}>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:py-16">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.05] sm:text-5xl">Fahrzeuge schneller vermarkten. Mit weniger Aufwand im Autohaus.</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground">Mit autohaus.ai entstehen aus einfachen Smartphone-Aufnahmen professionelle Fahrzeugbilder und Marketingmaterial. Direkt am Fahrzeug und in wenigen Minuten.</p>
            <p className="mt-3 text-sm text-muted-foreground">Fahrzeugbilder · Werbemotive · kurze Videos · Fahrzeugseiten</p>
            <Button asChild size="lg" className="mt-7"><a href="#einstieg" data-cta="marketing_kennenlernen">Mit eigenem Fahrzeug kennenlernen <ArrowRight className="h-4 w-4" /></a></Button>
            <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">{['Zeit sparen', 'Erstellungskosten reduzieren', 'Mitarbeiter entlasten'].map((x) => <span key={x} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-accent" />{x}</span>)}</div>
          </div>
          <BeforeAfterShowcase />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">{IBR.map(([Icon, t, x]) => <article key={t} className="rounded-lg border border-border bg-card p-6 shadow-card"><Icon className="h-6 w-6 text-accent" aria-hidden="true" /><h2 className="mt-4 font-display text-xl font-bold">{t}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{x}</p></article>)}</div>
      </section>

      <section id="ablauf" className="funnel-section-tint scroll-mt-20 border-y border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Einmal erfassen. Mehrfach verwenden.</h2>
          <div className="mt-7 grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
            <div className="rounded-lg border border-border bg-card p-6"><p className="text-sm font-bold">Bisher</p><ul className="mt-4 space-y-3 text-sm text-muted-foreground">{OLD_WAY.map((x) => <li key={x} className="flex items-center gap-3"><X className="h-4 w-4 text-destructive" aria-hidden="true" />{x}</li>)}</ul></div>
            <div className="rounded-lg border border-accent/30 bg-card p-6"><p className="text-sm font-bold text-accent">Mit autohaus.ai</p><ol className="mt-4 grid gap-4 sm:grid-cols-2">{NEW_WAY.map(([Icon, t], i) => <li key={t} className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><Icon className="h-4 w-4" aria-hidden="true" /></span><span className="text-sm"><span className="block text-xs font-bold text-accent">0{i + 1}</span>{t}</span></li>)}</ol></div>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">Deine Aufnahmen und hinterlegten Fahrzeugangaben bilden die Grundlage für mehrere Inhalte.</p>
        </div>
      </section>

      <section id="ergebnisse" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Ein Fahrzeug. Alles für deine Vermarktung.</h2>
        <div role="tablist" aria-label="Ergebnisse" className="mt-7 flex flex-wrap gap-2">{RESULTS.map((r) => <button key={r.key} role="tab" aria-selected={res === r.key} onClick={() => setRes(r.key)} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${res === r.key ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-card hover:border-accent'}`}><r.icon className="h-4 w-4" aria-hidden="true" />{r.label}</button>)}</div>
        <p className="mt-4 text-sm text-muted-foreground">{active.text}</p>
        <div role="tabpanel" className="mt-6"><ResultView k={res} onZoom={(src, alt) => setZoom({ src, alt })} /></div>
        <div className="mt-10 flex flex-col gap-3 rounded-lg border border-border bg-secondary/45 p-6 sm:flex-row sm:items-center"><Palette className="h-7 w-7 shrink-0 text-accent" aria-hidden="true" /><div><h3 className="font-display text-xl font-bold">Dein Logo. Deine Farben. Ein einheitlicher Auftritt.</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Inhalte entstehen mit dem Markenauftritt deines Autohauses. Gemeinsame Gestaltungsvorgaben sorgen dafür, dass jedes Fahrzeug einheitlich präsentiert wird.</p></div></div>
      </section>

      <section className="border-y border-border bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">Weniger Vorbereitung. Mehr Kapazität im Autohaus.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-3">{VALUE.map(([Icon, t, x]) => <article key={t} className="rounded-lg border border-border bg-background p-6"><Icon className="h-6 w-6 text-accent" aria-hidden="true" /><h3 className="mt-4 font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{x}</p></article>)}</div>
        </div>
      </section>

      <section id="einsatz" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Ein einfacher Einstieg. Ein gemeinsamer Ablauf.</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-3">{OPS.map(([Icon, t, x]) => <article key={t} className="rounded-lg border border-border bg-card p-6 shadow-card"><Icon className="h-6 w-6 text-accent" aria-hidden="true" /><h3 className="mt-4 font-bold">{t}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{x}</p></article>)}</div>
        <Button variant="outline" className="mt-6" aria-expanded={showIntegrations} onClick={() => setShowIntegrations((v) => !v)}>{showIntegrations ? 'Anbindungen ausblenden' : 'Anbindungen ansehen'}</Button>
        {showIntegrations && <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5"><p className="font-bold">Standardfunktionen</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-accent" />Download von Bildern, Motiven und Videos</li><li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-accent" />Fahrzeugseiten zum Teilen und Einbetten</li></ul></div>
          <div className="rounded-lg border border-border bg-card p-5"><p className="font-bold">Individuell einzurichten</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li><b className="text-foreground">API</b> – programmatischer Zugriff</li><li><b className="text-foreground">WordPress</b> – Einbindung in Websites</li><li><b className="text-foreground">FTP / SFTP</b> – automatisierte Übergabe</li></ul><p className="mt-3 text-xs text-muted-foreground">Welche Anbindung zu euren Systemen passt, klären wir gemeinsam.</p></div>
        </div>}
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-border bg-card py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[.7fr_1.3fr]">
          <h2 className="font-display text-3xl font-bold">Fragen zum Einstieg und Einsatz</h2>
          <Accordion type="single" collapsible defaultValue="f0">{FAQ.map(([q, a], i) => <AccordionItem key={q} value={`f${i}`}><AccordionTrigger className="text-left text-sm font-semibold">{q}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-muted-foreground">{a}{i === 7 && <> <Link to="/pricing" className="font-semibold text-accent hover:underline">Zu den Preisen</Link></>}</AccordionContent></AccordionItem>)}</Accordion>
        </div>
      </section>

      <section id="einstieg" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Prüfen wir, wie autohaus.ai in deinen Betrieb passt.</h2>
        <div className="mt-7 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
          <div className="flex flex-col rounded-lg border border-accent/30 bg-card p-6 shadow-card"><Camera className="h-6 w-6 text-accent" aria-hidden="true" /><h3 className="mt-4 font-display text-xl font-bold">Ein eigenes Fahrzeug kennenlernen</h3><p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">Erlebe Ergebnisse und Bedienung anhand eines Fahrzeugs aus deinem Bestand.</p><Button asChild size="lg" className="mt-6"><Link to={TEST_URL}>Mit Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link></Button></div>
          <div id="prozess-check" className="scroll-mt-20 rounded-lg border border-border bg-card p-6 shadow-card"><Building2 className="h-6 w-6 text-accent" aria-hidden="true" /><h3 className="mt-4 font-display text-xl font-bold">Einsatz im Betrieb oder in einer Händlergruppe besprechen</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Besprechen wir gemeinsam eure Abläufe, Standorte und benötigten Anbindungen.</p><div className="mt-5"><ProcessCheckForm submitLabel="Einsatz im Betrieb besprechen" /></div></div>
        </div>
      </section>

      <FunnelImageLightbox open={!!zoom} onOpenChange={(o) => !o && setZoom(null)} src={zoom?.src ?? ''} alt={zoom?.alt ?? ''} title={zoom?.alt ?? ''} />
    </FunnelLayout>
  );
}
