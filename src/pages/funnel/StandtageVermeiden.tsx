import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, Car, CheckCircle2, Clock, Layers, Rabbit, Rocket, Turtle, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution, captureLastTouch } from '@/lib/funnel-attribution';
import { trackFunnelEvent } from '@/lib/funnel-tracking';
import { AI_DISCLOSURE_OVERLAY_CLASS, getAiDisclosureLabelAlt, getAiDisclosureLabelVector, getAiDisclosureText } from '@/lib/ai-disclosure';
import heroAsset from '@/assets/funnel/standtage/st-01-hero.webp.asset.json';
import ankunftAsset from '@/assets/funnel/standtage/st-02-ankunft.webp.asset.json';
import aufbereitungAsset from '@/assets/funnel/standtage/st-03-aufbereitung.webp.asset.json';
import rangierenAsset from '@/assets/funnel/standtage/st-04-rangieren.webp.asset.json';
import fototerminAsset from '@/assets/funnel/standtage/st-05-fototermin.webp.asset.json';
import bilderstellungAsset from '@/assets/funnel/standtage/st-06-bilderstellung.webp.asset.json';
import inseratAsset from '@/assets/funnel/standtage/st-07-inserat.webp.asset.json';
import ctaCarAsset from '@/assets/funnel/standtage/st-08-cta-fahrzeug.webp.asset.json';

const TEST_URL = '/fahrzeug-testen?source=standtage';

const CLASSIC = [
  { title: 'Ankunft', text: 'Fahrzeug trifft auf dem Hof ein.', img: ankunftAsset.url, alt: 'Unaufbereitetes Fahrzeug auf dem Hof', staff: false },
  { title: 'Aufbereitung', text: 'Reinigung und Aufbereitung.', img: aufbereitungAsset.url, alt: 'Mitarbeiter reinigt ein Fahrzeug', staff: true },
  { title: 'Fotoplatz & Rangieren', text: 'Fahrzeug zum Fotoplatz bringen und rangieren.', img: rangierenAsset.url, alt: 'Fahrzeug wird zum Fotoplatz gebracht', staff: true },
  { title: 'Fototermin & Bearbeitung', text: 'Fotos aufnehmen und bearbeiten.', img: fototerminAsset.url, alt: 'Fotograf und Bildbearbeitung am Rechner', staff: true },
  { title: 'Inserat', text: 'Fahrzeug online präsentieren.', img: inseratAsset.url, alt: 'Fahrzeuginserat mit Bildern', staff: false },
];

const AI_FLOW = [
  { title: 'Ankunft & Smartphone-Fotos', text: 'Direkt bei der Ankunft Fotos mit dem Smartphone aufnehmen.', img: heroAsset.url, alt: 'Mitarbeiter fotografiert das Fahrzeug mit dem Smartphone', pos: '40% 50%' },
  { title: 'Verkaufsbilder erstellen', text: 'autohaus.ai erstellt aus deinen Aufnahmen professionelle Verkaufsbilder.', img: bilderstellungAsset.url, alt: 'Verkaufsbilder werden in autohaus.ai erstellt', pos: '50% 50%' },
  { title: 'Inserat veröffentlichen', text: 'Bilder herunterladen und für dein Inserat nutzen.', img: inseratAsset.url, alt: 'Inserat mit den erstellten Verkaufsbildern', pos: '50% 50%' },
];

const BENEFITS = [
  { icon: Rocket, title: 'Direkt online', text: 'Vermarktung schon vor der Aufbereitung.' },
  { icon: Clock, title: 'Kein zusätzlicher Personalaufwand', text: 'Kein separater Fototermin und kein Rangieren zum Fotoplatz.' },
  { icon: Layers, title: 'Einheitlicher Auftritt', text: 'Ein passender Bildlook für deinen Bestand.' },
];

const FAQ = [
  ['Was kann ich mit autohaus.ai für meine Fahrzeugvermarktung erstellen?', 'Mit autohaus.ai erstellst du aus deinen Fahrzeugfotos professionelle Verkaufsbilder und weitere Marketinginhalte, etwa Social-Media-Beiträge, Werbebanner und Videos. So nutzt du deine Aufnahmen für unterschiedliche Kanäle, ohne jedes Format von Grund auf gestalten zu müssen.'],
  ['Wie schnell entstehen aus meinen Fotos fertige Marketinginhalte?', 'Aus einfachen Smartphone-Fotos entstehen in wenigen Minuten fertige Motive und Banner für deine Social-Media-Kanäle und Google-Display-Anzeigen. Social-Media-Inhalte kannst du direkt über die angebundenen Kanäle posten. So wird aus tagelanger Marketingvorbereitung in wenigen Schritten fertiges Kampagnenmaterial.'],
  ['Reicht ein Smartphone-Foto für den Einstieg?', 'Ja. Schon ein Smartphone-Foto kann die Grundlage für ein Verkaufsbild und weitere Marketinginhalte sein. Für eine vollständige Fahrzeuggalerie mit mehreren Ansichten brauchst du zusätzliche Aufnahmen aus den jeweiligen Perspektiven. Fotografiere möglichst scharf und bei ausreichendem Licht.'],
  ['Brauche ich eine Fotobox oder einen professionellen Fotografen?', 'Nein. Du kannst deine Aufnahmen mit dem Smartphone direkt am Fahrzeug machen. autohaus.ai erstellt daraus Verkaufsbilder im gewünschten Look. Du brauchst dafür weder eine Fotobox noch einen separaten Fototermin.'],
  ['Muss ich das Fahrzeug vorher aufbereiten oder vom Hof bewegen?', 'Du kannst das Fahrzeug dort fotografieren, wo es steht, ohne erst auf die Aufbereitung zu warten. Wichtig ist, dass es auf den Aufnahmen gut sichtbar und möglichst vollständig zu erkennen ist. Die tatsächliche Fahrzeugaufbereitung für Besichtigung und Übergabe kann parallel zur Vermarktung erfolgen.'],
  ['Kann ich die Ergebnisse für Fahrzeugbörsen, meine Website und Social Media nutzen?', 'Ja. Du kannst die erstellten Inhalte herunterladen und passend zum jeweiligen Kanal einsetzen: Verkaufsbilder für Fahrzeuganzeigen und deine Website, Beiträge für Social Media oder Banner für deine Werbung. Social-Media-Inhalte kannst du außerdem direkt über die angebundenen Kanäle veröffentlichen. Beachte dabei die jeweiligen Formatvorgaben der Plattform.'],
  ['Wie hilft mir autohaus.ai, Fahrzeuge früher zu vermarkten?', 'Du kannst direkt nach der Fahrzeugankunft mit der Erstellung deiner Verkaufsbilder und Marketinginhalte beginnen. Die Vermarktung muss dadurch nicht auf einen freien Fotoplatz, einen Fotografen oder die abgeschlossene Aufbereitung warten. Das verkürzt die Zeit bis zur ersten Anzeige und kann unnötige Standtage reduzieren.'],
  ['Wie kann ich autohaus.ai mit einem eigenen Fahrzeug testen?', 'Klicke auf „Mit eigenem Fahrzeug testen“ und folge dem Testablauf. Nutze dafür eine Smartphone-Aufnahme aus deinem eigenen Fahrzeugbestand. So siehst du an einem konkreten Beispiel, was aus deinem Foto entstehen kann.'],
];

function AiMark() {
  return (
    <img
      src={getAiDisclosureLabelVector('landing')}
      alt={getAiDisclosureLabelAlt('landing')}
      title={getAiDisclosureText('landing')}
      className={AI_DISCLOSURE_OVERLAY_CLASS}
    />
  );
}

function WaitConnector() {
  return (
    <div className="flex shrink-0 flex-row items-center justify-center gap-2 py-1 text-destructive/80 lg:flex-col lg:gap-1 lg:px-1 lg:py-0" aria-hidden="true">
      <Clock className="h-5 w-5" />
      <span className="text-[11px] font-medium">Warten</span>
      <ArrowRight className="hidden h-4 w-4 lg:block" />
      <ArrowDown className="h-4 w-4 lg:hidden" />
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-accent" aria-hidden="true">
      <ArrowRight className="hidden h-8 w-8 lg:block" strokeWidth={2.25} />
      <ArrowDown className="h-7 w-7 lg:hidden" strokeWidth={2.25} />
    </div>
  );
}

function Lane({ tone, label, sub, children }: { tone: 'classic' | 'ai'; label: string; sub: string; children: ReactNode }) {
  const classic = tone === 'classic';
  return (
    <div className={classic ? 'rounded-xl border border-destructive/20 bg-destructive/[0.04] p-4 sm:p-5' : 'rounded-xl border border-accent/25 bg-accent/[0.06] p-4 sm:p-5'}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <h3 className={classic ? 'w-fit rounded-md bg-destructive/75 px-3 py-1.5 font-display text-base font-bold text-destructive-foreground' : 'w-fit rounded-md bg-accent px-3 py-1.5 font-display text-base font-bold text-accent-foreground'}>{label}</h3>
        <p className={classic ? 'text-sm text-destructive' : 'text-sm text-accent'}>{sub}</p>
      </div>
      {children}
    </div>
  );
}

export default function StandtageVermeiden() {
  usePageMeta({
    title: 'Weniger Standtage. Früher im Verkauf. | autohaus.ai',
    description: 'Starte die Vermarktung direkt nach der Ankunft: Smartphone-Fotos vom Hof, professionelle Verkaufsbilder aus autohaus.ai – ohne Fototermin und ohne Fahrt zum Fotoplatz.',
    canonicalPath: '/standtage-vermeiden',
  });

  useEffect(() => { captureAttribution('lp_standtage'); captureLastTouch(); }, []);

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
      ctaLabel="Kostenlos testen"
      anchors={[{ href: '#ablauf', label: 'Ablauf' }, { href: '#fragen', label: 'Fragen' }]}
    >
      {/* Hero */}
      <section className="overflow-hidden border-b border-border bg-secondary/40">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:gap-10 lg:py-14">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Standtage vermeiden</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.04] text-foreground sm:text-5xl">
              Weniger Standtage.<br />Früher im Verkauf.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              Starte die Vermarktung direkt nach der Ankunft. Mit Smartphone-Fotos vom Hof und professionellen Verkaufsbildern aus autohaus.ai.
            </p>
            <Button asChild size="lg" className="mt-7 w-full shadow-glow sm:w-auto">
              <Link to={TEST_URL}>Mit eigenem Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">Ohne Aufbereitung. Ohne Fotobox. Ohne Personal.</p>
          </div>

          <div className="relative min-w-0 pb-10 sm:pb-12">
            <div className="relative overflow-hidden rounded-xl shadow-elevated">
              <img
                src={heroAsset.url}
                alt="Mitarbeiter fotografiert ein unaufbereitetes Fahrzeug direkt auf dem Hof mit dem Smartphone"
                width={1600}
                height={800}
                className="aspect-[2/1] w-full object-cover"
                loading="eager"
                fetchPriority="high"
              />
              <AiMark />
            </div>
            {/* Native Inseratsvorschau – sitzt unterhalb des Fahrzeugs, verdeckt weder Auto noch Smartphone */}
            <div className="absolute bottom-0 right-2 w-48 rounded-lg border border-border bg-card p-2.5 shadow-elevated sm:right-4 sm:w-60">
              <div className="flex gap-2.5">
                <img src={inseratAsset.url} alt="" className="h-14 w-20 shrink-0 rounded object-cover sm:h-16 sm:w-24" loading="eager" />
                <div className="min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Bereit fürs Inserat
                  </span>
                  <div className="mt-2 h-1.5 w-full rounded bg-muted" />
                  <div className="mt-1.5 h-1.5 w-2/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ablauf */}
      <section id="ablauf" className="scroll-mt-20 bg-background py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">Wo sonst Tage vergehen, startet deine Vermarktung.</h2>
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">Wartezeiten und Personalaufwand entstehen oft schon vor dem ersten Inserat.</p>
          </div>

          <div className="mt-8 space-y-5">
            <Lane tone="classic" label="Der klassische Weg" sub="Mehr Termine. Mehr Beteiligte. Wiederholte Wartezeiten.">
              <ol className="flex flex-col items-stretch gap-2 lg:flex-row lg:gap-1">
                {CLASSIC.map((s, i) => (
                  <li key={s.title} className="contents">
                    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-3 text-center shadow-card">
                      <h4 className="text-sm font-semibold text-foreground">{s.title}</h4>
                      <img src={s.img} alt={s.alt} loading="lazy" className="mt-2 aspect-[4/3] w-full rounded object-cover" />
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{s.text}</p>
                      {s.staff && (
                        <span className="mx-auto mt-2 inline-flex items-center gap-1 rounded border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">
                          <UserRound className="h-3 w-3" aria-hidden="true" /> Personalaufwand
                        </span>
                      )}
                    </div>
                    {i < CLASSIC.length - 1 && <WaitConnector />}
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex items-center gap-3 text-xs font-medium text-destructive" aria-hidden="false">
                <span className="h-3 w-px bg-destructive/60" aria-hidden="true" />
                <span className="h-px flex-1 bg-destructive/40" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5"><Turtle className="h-4 w-4 shrink-0" aria-hidden="true" /> Tagelange Wartezeit bis zum Vermarktungsstart</span>
                <span className="h-px flex-1 bg-destructive/40" aria-hidden="true" />
                <span className="h-3 w-px bg-destructive/60" aria-hidden="true" />
              </div>
            </Lane>

            <Lane tone="ai" label="Mit autohaus.ai" sub="Direkt am Fahrzeug. Ein kurzer Ablauf.">
              <ol className="flex flex-col items-stretch gap-3 lg:flex-row lg:gap-4">
                {AI_FLOW.map((s, i) => (
                  <li key={s.title} className="contents">
                    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 text-center shadow-card">
                      <h4 className="text-sm font-semibold text-foreground sm:text-base">{s.title}</h4>
                      <div className="relative mt-3 overflow-hidden rounded">
                        <img src={s.img} alt={s.alt} loading="lazy" className="aspect-[16/10] w-full object-cover" style={{ objectPosition: s.pos }} />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted-foreground sm:text-sm">{s.text}</p>
                    </div>
                    {i < AI_FLOW.length - 1 && <FlowArrow />}
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-3 rounded-lg border border-accent/20 bg-card/70 px-4 py-3 text-sm text-foreground md:grid-cols-2 md:divide-x md:divide-accent/20">
                <p className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />Aufbereitung und Fototermin müssen den Vermarktungsstart nicht mehr verzögern.</p>
                <p className="flex items-start gap-2 md:pl-4"><Car className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />Die Fahrzeugaufbereitung kann parallel weiterlaufen.</p>
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs font-medium text-accent">
                <span className="h-3 w-px bg-accent/60" aria-hidden="true" />
                <span className="h-px flex-1 bg-accent/40" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5"><Rabbit className="h-4 w-4 shrink-0" aria-hidden="true" /> In wenigen Minuten überall online</span>
                <span className="h-px flex-1 bg-accent/40" aria-hidden="true" />
                <span className="h-3 w-px bg-accent/60" aria-hidden="true" />
              </div>

            </Lane>
          </div>
        </div>
      </section>

      {/* Vorteile */}
      <section className="bg-background pb-12 sm:pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-foreground sm:text-4xl">Weniger warten. Früher sichtbar sein.</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3 md:divide-x md:divide-border">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4 md:px-6">
                <Icon className="h-10 w-10 shrink-0 text-accent" strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Abschluss-CTA */}
      <section className="px-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mx-auto grid max-w-6xl items-center gap-4 overflow-hidden rounded-xl bg-accent px-6 pt-8 text-accent-foreground shadow-elevated md:grid-cols-[1fr_1fr] md:py-0 md:pl-12 md:pt-0">
          <div className="md:py-10">
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl">Was wird aus deinem Fahrzeug?</h2>
            <p className="mt-2 text-base opacity-90 sm:text-lg">Sieh, was aus deinen Smartphone-Fotos wird.</p>
            <Button asChild size="lg" variant="secondary" className="mt-6 w-full sm:w-auto">
              <Link to={TEST_URL}>Mein Fahrzeugfoto testen <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <p className="mt-3 text-xs opacity-85">Persönliche Rückmeldung in der Regel innerhalb eines Werktags.</p>
          </div>
          <div className="relative">
            <img src={ctaCarAsset.url} alt="Fahrzeug als professionelles Verkaufsbild" loading="lazy" className="mx-auto w-full max-w-md object-contain md:max-w-none" />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="fragen" className="scroll-mt-20 bg-background pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl font-bold text-foreground">Noch Fragen?</h2>
          <p className="mt-2 text-center text-base text-muted-foreground">So wird aus deinen Fahrzeugfotos fertiges Marketing.</p>
          <Accordion type="single" collapsible defaultValue="f0" className="mt-6 space-y-3">
            {FAQ.map(([q, a], i) => (
              <AccordionItem key={q} value={`f${i}`} className="rounded-lg border border-border bg-card px-4">
                <AccordionTrigger className="min-h-12 py-4 text-left text-sm font-semibold sm:text-base">{q}</AccordionTrigger>
                <AccordionContent forceMount data-faq-answer className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-8 text-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to={TEST_URL}>Mit eigenem Fahrzeug testen <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </FunnelLayout>
  );
}
