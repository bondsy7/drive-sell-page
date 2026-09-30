import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronRight, X, ShieldCheck, Clock3, Briefcase, Palette, LayoutGrid, RefreshCw,
  FileText, MessageSquare, PenTool, Send, Car, Image as ImageIcon, Tag, Play, Heart, MoreHorizontal, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution, captureLastTouch } from '@/lib/funnel-attribution';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import carImage from '@/assets/funnel/standtage-showroom-local.webp';

const TEST_URL = '/fahrzeug-testen?source=werbemittel';

const CLASSIC_LINE = [
  'Fahrzeug auswählen', 'Bilder suchen', 'Angebot definieren', 'Briefing schreiben', 'Grafik erstellen',
  'Rückfragen', 'Korrekturen', 'Formate anpassen', 'Freigeben', 'Veröffentlichen',
];

const PROBLEMS = [
  { icon: FileText, title: 'Jedes Motiv wird zum Auftrag.', text: 'Briefing schreiben, Material schicken, Rückfragen beantworten, Korrekturen prüfen.' },
  { icon: Clock3, title: 'Kreativarbeit blockiert Arbeitszeit.', text: 'Social Posts, Banner und Formate entstehen neben dem eigentlichen Tagesgeschäft.' },
  { icon: Car, title: 'Ohne Ressourcen passiert oft gar nichts.', text: 'Das Fahrzeug ist online, bekommt aber keine zusätzliche Vermarktung.' },
];

const CLASSIC_WAY = [
  'Fahrzeug auswählen', 'Bilder zusammensuchen', 'Angebot definieren', 'Agentur/Grafik briefen',
  'Entwurf abwarten', 'Änderungen abstimmen', 'Formate exportieren', 'Veröffentlichen',
];

const AI_WAY: [string, string][] = [
  ['Fahrzeug auswählen', 'Aus Ihrem Bestand, mit vorhandenen Bildern und Daten.'],
  ['Werbemittel auswählen', 'Social Media, Portal, Website, Ads oder Video.'],
  ['Fertige Varianten nutzen', 'Im gleichen Auftritt, passend zum jeweiligen Kanal.'],
];

const DROP_CHIPS = ['Briefing', 'Layoutarbeit', 'Größenanpassung', 'Warteschleife', 'manuelle Exporte'];

const BENEFITS = [
  { icon: Briefcase, title: 'Standardaufgaben ohne Agentur-Warteschleife', text: 'Neue Fahrzeugaktionen müssen nicht jedes Mal extern beauftragt werden.' },
  { icon: PenTool, title: 'Keine zusätzliche Grafikarbeit im Tagesgeschäft', text: 'Wiederkehrende Werbemittel entstehen direkt aus dem Fahrzeugbestand.' },
  { icon: Palette, title: 'Immer im eigenen Corporate Design', text: 'Farben, Logos und Gestaltung bleiben einheitlich.' },
  { icon: LayoutGrid, title: 'Für jeden Kanal passend', text: 'Ein Fahrzeug kann gleichzeitig für Website, Social Media, Portale und Ads vorbereitet werden.' },
];

const FRIDAY_PROBLEM = ['Neues Fahrzeug.', 'Neuer Aktionspreis.', 'Social Media fehlt.', 'Website-Banner fehlt.', 'Agentur nicht erreichbar.'];
const FRIDAY_SOLUTION = ['Fahrzeug auswählen.', 'Aktion eingeben.', 'Formate wählen.', 'Fertige Motive verwenden.'];

const TEST_STEPS = [
  { title: 'Fahrzeug auswählen oder Bild hochladen', text: 'Ein Fahrzeugbild aus Ihrem Bestand genügt für den Test.' },
  { title: 'Gewünschte Marketingformate wählen', text: 'Zum Beispiel Social Media, Banner oder Portalwerbung.' },
  { title: 'Beispiel-Marketing-Set erhalten', text: 'Sie sehen Ihr Fahrzeug in mehreren Formaten und entscheiden dann.' },
];

const TRUST = [
  'Angebot ausschließlich für Unternehmer i. S. d. § 14 BGB',
  'Das hochgeladene Bild wird nur für die Testanfrage verwendet und nicht veröffentlicht',
  'Rückmeldung in der Regel innerhalb eines Werktags',
  'KI-generierte Medien werden gekennzeichnet',
  'Ein Produkt der Breadcrumb Marketing GmbH, Hanau',
];

const FAQ: [string, string][] = [
  ['Brauche ich eine Agentur dann gar nicht mehr?', 'Für Kampagnen und Markenentwicklung kann eine Agentur weiterhin sinnvoll sein. autohaus.ai übernimmt vor allem wiederkehrende, fahrzeugbezogene Standardwerbemittel, die sonst jedes Mal einzeln beauftragt werden müssten.'],
  ['Welche Formate können erstellt werden?', 'Social-Media-Posts und Stories, Verkaufsbanner, Motive für Fahrzeugportale und Website sowie Anzeigenmotive und Videos. Welche Formate in Ihrem Paket enthalten sind, klären wir im Test.'],
  ['Kann mein Corporate Design verwendet werden?', 'Ja. Logo, Farben und Gestaltung werden einmal hinterlegt. Neue Motive entstehen danach im gleichen Auftritt.'],
  ['Kann ich Preis oder Aktion später ändern?', 'Ja. Statt ein altes Banner umbauen zu lassen, erstellen Sie mit den neuen Angaben einfach ein neues Motiv.'],
  ['Kann ich das für mehrere Standorte nutzen?', 'Ja. autohaus.ai ist für einzelne Autohäuser und Händlergruppen gedacht. Wie Sie mehrere Standorte abbilden, besprechen wir im weiteren schriftlichen Austausch.'],
];

/* ---------- Mockups (reines HTML/CSS, neutrale Labels, keine Plattformlogos) ---------- */

function Frame({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="h-full overflow-hidden rounded-lg border border-border bg-card shadow-card">{children}</div>
      <figcaption className="mt-1.5 text-[11px] font-semibold text-muted-foreground">{label}</figcaption>
    </figure>
  );
}

const Car16 = ({ className = '' }: { className?: string }) => (
  <img src={carImage} alt="" aria-hidden="true" className={`w-full object-cover ${className}`} loading="lazy" />
);

function FeedMock() {
  return (
    <Frame label="Social Feed · 1:1">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="h-5 w-5 rounded-full bg-accent" />
        <span className="text-[10px] font-bold">ihr.autohaus</span>
        <MoreHorizontal className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="relative">
        <Car16 className="aspect-square" />
        <span className="absolute left-2 top-2 rounded bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase text-accent-foreground">Neu im Bestand</span>
        <span className="absolute bottom-2 right-2 rounded bg-card px-2 py-1 text-[10px] font-bold shadow-card">Ihr Aktionspreis</span>
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2 text-muted-foreground"><Heart className="h-3.5 w-3.5" /><MessageSquare className="h-3.5 w-3.5" /><Send className="h-3.5 w-3.5" /></div>
    </Frame>
  );
}

function StoryMock() {
  return (
    <Frame label="Story · 9:16">
      <div className="relative aspect-[9/16] bg-foreground">
        <Car16 className="absolute inset-0 h-full opacity-90" />
        <div className="absolute inset-x-2 top-2 h-0.5 rounded bg-background/60" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 to-transparent p-2.5 pt-10 text-background">
          <p className="font-display text-sm font-bold leading-tight">Jetzt Probefahrt sichern</p>
          <p className="mt-1 text-[9px] opacity-80">Nur solange verfügbar</p>
          <span className="mt-2 block rounded-full bg-accent py-1 text-center text-[9px] font-bold text-accent-foreground">Mehr erfahren</span>
        </div>
      </div>
    </Frame>
  );
}

function PortalMock() {
  return (
    <Frame label="Fahrzeugportal · Inserat">
      <div className="flex gap-2 p-2">
        <div className="relative w-2/5 shrink-0 overflow-hidden rounded">
          <Car16 className="aspect-[4/3]" />
          <span className="absolute bottom-1 left-1 rounded bg-accent px-1 text-[8px] font-bold text-accent-foreground">Top-Angebot</span>
        </div>
        <div className="min-w-0 text-[10px] leading-snug">
          <p className="font-bold">Ihr Fahrzeug · Ausstattungslinie</p>
          <p className="text-muted-foreground">Erstzulassung · Kilometer · Kraftstoff</p>
          <p className="mt-1 font-display text-xs font-bold text-accent">Ihr Aktionspreis</p>
        </div>
      </div>
    </Frame>
  );
}

function WebsiteMock() {
  return (
    <Frame label="Website-Banner · 16:9">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" /><Globe className="ml-1 h-2.5 w-2.5 text-muted-foreground" /><span className="h-1.5 w-16 rounded bg-secondary" /></div>
      <div className="relative">
        <Car16 className="aspect-[16/7]" />
        <div className="absolute inset-y-0 left-0 flex w-1/2 flex-col justify-center bg-gradient-to-r from-card via-card/85 to-transparent p-3">
          <p className="font-display text-xs font-bold leading-tight sm:text-sm">Das Wochenend-Angebot</p>
          <span className="mt-1.5 w-fit rounded bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">Jetzt anfragen</span>
        </div>
      </div>
    </Frame>
  );
}

function DisplayMock() {
  return (
    <Frame label="Display-Anzeige · Rechteck">
      <div className="gradient-hero p-2.5 text-primary-foreground">
        <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Anzeige</p>
        <p className="font-display text-xs font-bold leading-tight">Ihr Fahrzeug. Ihr Preis.</p>
      </div>
      <Car16 className="aspect-[2/1]" />
      <div className="flex items-center justify-between p-2 text-[10px]"><span className="font-bold">Ihr Autohaus</span><span className="rounded bg-accent px-1.5 py-0.5 font-bold text-accent-foreground">Ansehen</span></div>
    </Frame>
  );
}

function VideoMock() {
  return (
    <Frame label="Video · Kurzclip">
      <div className="relative">
        <Car16 className="aspect-video" />
        <span className="absolute inset-0 m-auto flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow-card"><Play className="h-4 w-4 fill-accent text-accent" /></span>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-foreground/80 px-1 text-[9px] font-bold text-background">0:15</span>
        <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 text-[9px] font-bold text-accent-foreground">360° Rundgang</span>
      </div>
    </Frame>
  );
}

function CiWorld({ world, name, headline }: { world: string; name: string; headline: string }) {
  return (
    <figure className={`${world} min-w-0 overflow-hidden rounded-lg border border-border shadow-card`}>
      <div className="ci-bg p-3">
        <div className="flex items-center justify-between">
          <span className="ci-main-text font-display text-sm font-bold">{name}</span>
          <span className="ci-main-bg rounded px-2 py-0.5 text-[10px] font-bold">Aktion</span>
        </div>
        <img src={carImage} alt="" aria-hidden="true" className="mt-3 aspect-[16/9] w-full rounded object-cover" loading="lazy" />
        <p className="ci-body-text mt-3 font-display text-base font-bold leading-tight">{headline}</p>
        <span className="ci-main-bg mt-3 block rounded py-1.5 text-center text-xs font-bold">Jetzt anfragen</span>
      </div>
    </figure>
  );
}

export default function AutohausWerbemittel() {
  usePageMeta({
    title: 'Werbemittel für jedes Fahrzeug – Marketing-Set aus Ihrem Bestand | autohaus.ai',
    description: 'Social Post, Verkaufsbanner, Portalwerbung, Website-Motiv oder Video: autohaus.ai erstellt passende Werbemittel direkt aus Ihren Fahrzeugbildern und Daten – im eigenen Corporate Design.',
    canonicalPath: '/autohaus-werbemittel',
  });

  useEffect(() => { captureAttribution('lp_werbemittel'); captureLastTouch(); }, []);

  useEffect(() => {
    const sent = new Set<number>();
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = (window.scrollY / max) * 100;
      for (const t of [50, 90]) {
        if (pct >= t && !sent.has(t)) {
          sent.add(t);
          trackFunnelEvent('scroll_depth', { step: `scroll_${t}`, percent: t });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <FunnelLayout
      ctaHref={TEST_URL}
      ctaLabel="Marketing-Set testen"
      anchors={[{ href: '#so-funktionierts', label: "So funktioniert's" }, { href: '#formate', label: 'Formate' }, { href: '#fragen', label: 'Fragen' }]}
    >
      {/* 1 · Hero */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[.95fr_1.05fr] lg:py-16">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Für Autohäuser &amp; Fahrzeughändler</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.04] text-foreground sm:text-5xl">Für jedes Fahrzeug neue Werbung. Aber wer soll sie machen?</h1>
            <p className="mt-3 font-display text-lg font-bold text-accent sm:text-xl">Aus einem Fahrzeug wird Ihr komplettes Marketing-Set.</p>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Social Media Post, Verkaufsbanner, Portalwerbung, Website-Motiv oder Video: Statt jedes Format einzeln bei Agentur oder Grafik anzufragen, erstellt autohaus.ai die passenden Werbemittel direkt aus Ihren Fahrzeugbildern und Daten.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full shadow-glow sm:w-auto">
                <Link to={TEST_URL} data-cta="werbemittel_test">Marketing-Set für ein Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href="#so-funktionierts">So funktioniert es <ChevronRight className="h-4 w-4" /></a>
              </Button>
            </div>
            <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-accent" />Für Social Media · Portale · Website · Ads · Video</p>
          </div>

          {/* Hero-Visual: ein Fahrzeug, sechs Formate */}
          <div className="min-w-0">
            <div className="grid grid-cols-6 gap-2 sm:gap-3">
              <div className="col-span-4"><WebsiteMock /></div>
              <div className="col-span-2 row-span-2"><StoryMock /></div>
              <div className="col-span-2"><FeedMock /></div>
              <div className="col-span-2"><VideoMock /></div>
              <div className="col-span-3"><PortalMock /></div>
              <div className="col-span-3"><DisplayMock /></div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · Problem */}
      <section className="border-b border-border bg-secondary/45 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-3xl font-display text-3xl font-bold leading-tight sm:text-4xl">Ein Fahrzeug. Zehn Formate. Zehnmal Arbeit.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Das Fahrzeug ist da, Preis und Bilder sind vorhanden. Trotzdem beginnt die kreative Arbeit für jeden Kanal von vorn.</p>
          <ol className="mt-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {CLASSIC_LINE.map((s, i) => (
              <li key={s} className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold shadow-card">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">{i + 1}</span>{s}
                </span>
                {i < CLASSIC_LINE.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
              </li>
            ))}
          </ol>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10"><Icon className="h-5 w-5 text-destructive" /></span>
                <h3 className="mt-4 font-display text-lg font-bold leading-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · Zwischenaussage */}
      <section className="border-b border-border bg-card py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="font-display text-3xl font-bold leading-tight sm:text-5xl">Das Problem ist nicht die Idee. <span className="text-accent">Das Problem ist die Umsetzung.</span></p>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Fahrzeug, Preis und Ausstattung stehen fest. Trotzdem muss für jeden Kanal wieder ein neues Werbemittel gebaut werden.</p>
        </div>
      </section>

      {/* 5 · Prozessvergleich */}
      <section id="so-funktionierts" className="funnel-section-tint scroll-mt-20 border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">So funktioniert's</p>
          <div className="relative mt-4 grid gap-5 lg:grid-cols-2 lg:gap-12">
            <div className="rounded-lg border border-destructive/25 bg-card p-6 shadow-card">
              <h3 className="flex items-center gap-3 font-display text-xl font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10"><X className="h-4 w-4 text-destructive" /></span>Der klassische Weg
              </h3>
              <ol className="mt-5 space-y-2.5">
                {CLASSIC_WAY.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-right text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <X className="h-4 w-4 shrink-0 text-destructive" />{s}
                  </li>
                ))}
              </ol>
            </div>
            <span className="absolute left-1/2 top-1/2 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow lg:flex" aria-hidden="true"><ArrowRight className="h-5 w-5" /></span>
            <div className="rounded-lg border-2 border-accent/50 bg-card p-6 shadow-elevated">
              <h3 className="flex items-center gap-3 font-display text-xl font-bold">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15"><Check className="h-4 w-4 text-accent" /></span>Mit autohaus.ai
              </h3>
              <ol className="mt-5 space-y-5">
                {AI_WAY.map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-display text-base font-bold text-accent-foreground">{i + 1}</span>
                    <div><p className="font-display text-base font-bold">{t}</p><p className="mt-0.5 text-sm text-muted-foreground">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fällt weg:</span>
            {DROP_CHIPS.map((c) => (
              <span key={c} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground line-through"><X className="h-3 w-3 text-destructive" />{c}</span>
            ))}
          </div>
          <p className="mt-6 font-display text-2xl font-bold text-accent">Vom Fahrzeug zum Werbemittel.</p>
        </div>
      </section>

      {/* 6 · Marketing-Wall */}
      <section id="formate" className="scroll-mt-20 border-b border-border bg-secondary/45 py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Ein Fahrzeug. Eine Kampagne. Alle Formate.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Jeder Kanal bekommt das Format, das dort funktioniert – im gleichen Auftritt.</p>
          <div className="mt-8 grid items-center gap-6 lg:grid-cols-[.8fr_2.2fr]">
            <div className="rounded-lg border-2 border-accent/50 bg-card p-3 shadow-elevated">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent"><ImageIcon className="h-4 w-4" />Ausgangspunkt</p>
              <img src={carImage} alt="Fahrzeug aus dem Bestand als Ausgangsbild" className="mt-2 aspect-[4/3] w-full rounded object-cover" loading="lazy" />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Tag className="h-3.5 w-3.5" />Bilder, Daten und Aktion</p>
            </div>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
              {[FeedMock, StoryMock, PortalMock, WebsiteMock, DisplayMock, VideoMock].map((M, i) => (
                <div key={i} className="w-[62%] shrink-0 snap-start sm:w-auto"><M /></div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Beispielhafte Darstellung. Die tatsächlichen Formate richten sich nach Ihrem Paket und Ihrem Corporate Design.</p>
        </div>
      </section>

      {/* 7 · Nutzen */}
      <section className="border-b border-border bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-3xl font-display text-3xl font-bold leading-tight">Marketing, wenn Sie es brauchen. Nicht wenn jemand Zeit dafür hat.</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/10"><Icon className="h-5 w-5 text-accent" /></span>
                <h3 className="mt-4 font-display text-base font-bold leading-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-4 rounded-lg border border-accent/30 bg-accent/5 p-5 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground"><RefreshCw className="h-5 w-5" /></span>
            <div>
              <h3 className="font-display text-base font-bold">Aktionen schneller aktualisieren</h3>
              <p className="mt-1 text-sm text-muted-foreground">Preis geändert? Leasingrate angepasst? Neues Motiv erstellen statt altes Banner umbauen lassen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8 · Praxissituation */}
      <section className="funnel-section-tint border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Typischer Freitagnachmittag</p>
          <h2 className="mt-2 font-display text-3xl font-bold leading-tight">14:30 Uhr. Das Angebot soll am Wochenende raus.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-destructive/25 bg-card p-6 shadow-card">
              <p className="text-xs font-bold uppercase tracking-wider text-destructive">Ohne autohaus.ai</p>
              <ul className="mt-4 space-y-2.5">{FRIDAY_PROBLEM.map((t) => <li key={t} className="flex items-center gap-2.5 text-sm"><X className="h-4 w-4 shrink-0 text-destructive" />{t}</li>)}</ul>
            </div>
            <div className="rounded-lg border-2 border-accent/50 bg-card p-6 shadow-elevated">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">Mit autohaus.ai</p>
              <ol className="mt-4 space-y-2.5">{FRIDAY_SOLUTION.map((t, i) => <li key={t} className="flex items-center gap-2.5 text-sm"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{i + 1}</span>{t}</li>)}</ol>
            </div>
          </div>
        </div>
      </section>

      {/* 9 · Corporate Design */}
      <section className="border-b border-border bg-card py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold leading-tight">Nicht irgendeine Werbung. Ihre Werbung.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Logo, Farben und Gestaltung werden einmal definiert. Danach entstehen neue Motive im gleichen Auftritt.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <CiWorld world="ci-world-blue" name="Autohaus Muster" headline="Sachlich. Klar. Verlässlich." />
            <CiWorld world="ci-world-black" name="Muster Premium" headline="Exklusiv im Bestand." />
            <CiWorld world="ci-world-red" name="Muster Mobile" headline="Jetzt zuschlagen!" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Drei beispielhafte Autohaus-Auftritte, keine echten Marken.</p>
        </div>
      </section>

      {/* 10 · Test & Vertrauen */}
      <section className="funnel-section-tint border-b border-border py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-3xl font-bold">So testen Sie autohaus.ai</h2>
          <ol className="mt-7 grid gap-4 md:grid-cols-3">
            {TEST_STEPS.map((s, i) => (
              <li key={s.title} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-base font-bold text-accent-foreground">{i + 1}</span>
                <p className="mt-4 font-display text-base font-bold leading-tight">{s.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-6 grid gap-2 rounded-lg border border-border bg-card p-5 shadow-card sm:grid-cols-2 lg:grid-cols-3">
            {TRUST.map((t) => <li key={t} className="flex gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{t}</li>)}
          </ul>
        </div>
      </section>

      {/* 11 · FAQ */}
      <section id="fragen" className="scroll-mt-20 border-b border-border bg-secondary/45 py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Häufige Fragen</p>
            <h2 className="mt-2 font-display text-3xl font-bold">Noch Fragen?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Kurze Antworten rund um Werbemittel aus Ihrem Bestand.</p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {FAQ.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`} className="rounded-lg border border-border bg-card px-5 shadow-card last:border-b">
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">{q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 12 · Abschluss-CTA */}
      <section className="px-4 py-14 sm:px-6">
        <div className="gradient-hero mx-auto max-w-6xl rounded-lg px-6 py-10 text-primary-foreground sm:px-10 sm:py-14">
          <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Nehmen Sie ein Fahrzeug aus Ihrem Bestand.</h2>
          <p className="mt-2 font-display text-xl font-bold text-primary-foreground/90">Wir machen daraus Ihr Marketing-Set.</p>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-primary-foreground/80">Sehen Sie selbst, wie Ihr Fahrzeug als Social Post, Banner, Portalwerbung und Verkaufsanzeige aussehen kann.</p>
          <Button asChild size="lg" variant="secondary" className="mt-6 w-full sm:w-auto">
            <Link to={TEST_URL} data-cta="werbemittel_test">Marketing-Set kostenlos testen <ArrowRight className="h-4 w-4" /></Link>
          </Button>
          <p className="mt-3 text-xs text-primary-foreground/70">Ein Fahrzeug · mehrere Formate · Ihr Corporate Design</p>
        </div>
      </section>
    </FunnelLayout>
  );
}
