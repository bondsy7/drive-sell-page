import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Check, CirclePlay, Clock3, Image, Images, Layers3, RotateCcw, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import FunnelLayout from '@/components/funnel/FunnelLayout';
import BeforeAfterShowcase from '@/components/funnel/BeforeAfterShowcase';
import { usePageMeta } from '@/hooks/usePageMeta';
import { captureAttribution } from '@/lib/funnel-attribution';
import after2Asset from '@/assets/funnel/after2.webp.asset.json';
import after3Asset from '@/assets/funnel/after3.webp.asset.json';
import after4Asset from '@/assets/funnel/after4.webp.asset.json';

const TEST_URL = '/fahrzeug-testen?source=fahrzeugbilder';
const STEPS = [
  { icon: Camera, title: 'Fahrzeug fotografieren', text: 'Aufnahmen mit dem Smartphone direkt auf dem Hof – ohne Studio und Spezialausrüstung.', image: null },
  { icon: Sparkles, title: 'Automatisch verarbeiten', text: 'autohaus.ai erzeugt eine konsistente Bildsprache und bereitet die Aufnahmen professionell auf.', image: after3Asset.url },
  { icon: Images, title: 'Bilder sofort vermarkten', text: 'Fertige Motive für Website, Marktplätze und Social Media aus einem einheitlichen Ablauf.', image: after2Asset.url },
];
const FEATURES = [
  { icon: Images, title: 'Perspektiven', text: 'Definierte Außen- und Innenansichten für eine vollständige Fahrzeugpräsentation.', image: after4Asset.url },
  { icon: Layers3, title: 'Hintergrund & Showroom', text: 'Einheitliche Umgebungen und eine konsistente Bildsprache über den gesamten Bestand.', image: after2Asset.url },
  { icon: ShieldCheck, title: 'Kennzeichen & CI', text: 'Kennzeichen neutralisieren und Markenauftritt passend zum Autohaus konfigurieren.', image: after3Asset.url },
  { icon: RotateCcw, title: '360° & weitere Formate', text: 'Auf Basis derselben Aufnahmen zusätzliche Assets für digitale Kanäle erzeugen.', image: after4Asset.url },
];
const FAQ = [
  ['Brauche ich eine professionelle Kamera?', 'Nein. Aufnahmen mit einem aktuellen Smartphone genügen. Wichtig sind vollständige Perspektiven und ein frei stehendes Fahrzeug.'],
  ['Kann unser eigenes Corporate Design verwendet werden?', 'Ja. Hintergrund, Kennzeichen-Handling sowie Hersteller- und Autohauslogo lassen sich passend zu Ihrem Auftritt konfigurieren.'],
  ['Eignet sich die Lösung auch für mehrere Standorte?', 'Ja. Der identische Ablauf sorgt für eine konsistente Bildsprache über alle Betriebe hinweg.'],
  ['Was passiert mit dem Testfoto?', 'Das Bild wird ausschließlich zur Bearbeitung Ihrer Testanfrage verwendet und nicht öffentlich zugänglich gespeichert.'],
  ['Wie lange dauert die Bearbeitung?', 'Wir prüfen Ihr Fahrzeug und Einsatzziel und melden uns anschließend mit dem passenden nächsten Schritt.'],
];

export default function AutohausFahrzeugbilder() {
  usePageMeta({ title: 'KI-Fahrzeugbilder für Autohäuser | autohaus.ai', description: 'Aus Smartphone-Fotos werden einheitliche Fahrzeugbilder für Autohäuser und Fahrzeughändler. Jetzt mit einem Fahrzeug aus Ihrem Bestand testen.', canonicalPath: '/autohaus-fahrzeugbilder' });
  useEffect(() => { captureAttribution('lp_fahrzeugbilder'); }, []);

  return (
    <FunnelLayout ctaHref={TEST_URL} ctaLabel="Fahrzeug kostenlos testen" anchors={[{ href: '#prozess', label: 'So funktioniert’s' }, { href: '#ergebnisse', label: 'Ergebnisse' }, { href: '#funktionen', label: 'Funktionen' }, { href: '#faq', label: 'FAQ' }]}>
      <section className="overflow-hidden border-b border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[.85fr_1.15fr] lg:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Für Autohäuser & Fahrzeughändler</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.04] text-foreground sm:text-5xl">Aus einem Smartphone-Foto wird ein professionelles Fahrzeugbild.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">autohaus.ai verwandelt uneinheitliche Bestandsfotos in hochwertige Showroom-Aufnahmen – für Website, Marktplätze und Social Media.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="shadow-glow"><Link to={TEST_URL}>1 Fahrzeug kostenlos testen <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#prozess"><CirclePlay className="h-4 w-4" /> So funktioniert es</a></Button>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {['Kein Fotostudio nötig', 'Keine manuelle Nachbearbeitung', 'Für Händler und Gruppen'].map((item) => <span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-accent" />{item}</span>)}
            </div>
          </div>
          <BeforeAfterShowcase />
        </div>
      </section>

      <section className="border-b border-border bg-secondary/55">
        <div className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4">
          {[['3× schneller online', 'Vom Foto zum fertigen Motiv', Sparkles], ['Einheitlicher Auftritt', 'Eine Bildsprache an jedem Standort', ShieldCheck], ['Weniger Aufwand', 'Automatisierte Bildbearbeitung', Clock3], ['Standortübergreifend', 'Für Händlergruppen und freie Händler', Users]].map(([title, text, Icon], i) => {
            const ItemIcon = Icon as typeof Sparkles;
            return <div key={title as string} className={`flex gap-3 px-3 py-6 ${i % 2 ? 'border-l border-border' : ''} ${i > 1 ? 'border-t border-border lg:border-t-0' : ''} lg:border-l lg:first:border-l-0`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><ItemIcon className="h-4 w-4" /></span><div><p className="text-sm font-bold">{title as string}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{text as string}</p></div></div>;
          })}
        </div>
      </section>

      <section id="prozess" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">So funktioniert es</h2>
        <p className="mt-2 text-sm text-muted-foreground">In nur wenigen Schritten zu professionellen Fahrzeugbildern – ganz ohne Spezialausrüstung.</p>
        <ol className="mt-7 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => <li key={step.title} className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card"><div className="p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-lg font-bold text-accent">{i + 1}</span><h3 className="font-bold">{step.title}</h3></div><p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{step.text}</p></div>{step.image ? <img src={step.image} alt="Professionell aufbereitetes BMW Fahrzeugbild" className="h-40 w-full object-cover" loading="lazy" /> : <div className="flex h-40 items-center justify-center bg-secondary"><step.icon className="h-16 w-16 text-accent/45" /></div>}</li>)}
        </ol>
      </section>

      <section id="ergebnisse" className="funnel-section-tint border-y border-border py-14">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 sm:px-6 lg:grid-cols-2">
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6"><h2 className="font-display text-xl font-bold">Die typischen Herausforderungen im Fahrzeugbild-Alltag</h2><ul className="mt-5 space-y-3 text-sm text-muted-foreground">{['Uneinheitliche Bildqualität je Standort und Mitarbeiter', 'Aufwendige Nachbearbeitung oder externe Dienstleister', 'Unterschiedliche Hintergründe und Perspektiven', 'Zeitverlust, bis Fahrzeuge online sind'].map((x) => <li key={x} className="flex gap-3"><span className="font-bold text-destructive">×</span>{x}</li>)}</ul></div>
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-6"><h2 className="font-display text-xl font-bold">Das ändert sich mit autohaus.ai</h2><ul className="mt-5 space-y-3 text-sm text-muted-foreground">{['Professionelle Fahrzeugbilder im einheitlichen Showroom-Look', 'Automatische Verarbeitung in einem klaren Ablauf', 'Saubere, konsistente Hintergründe und Perspektiven', 'Einheitlicher Auftritt über alle Standorte hinweg'].map((x) => <li key={x} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{x}</li>)}</ul></div>
        </div>
      </section>

      <section id="funktionen" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="font-display text-3xl font-bold">Leistungsstarke Funktionen für professionelle Fahrzeugbilder</h2>
        <p className="mt-2 text-sm text-muted-foreground">Alles, was Sie für die einheitliche Vermarktung Ihres Bestands brauchen.</p>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{FEATURES.map((feature) => <article key={feature.title} className="overflow-hidden rounded-lg border border-border bg-card shadow-card"><img src={feature.image} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /><div className="p-4"><feature.icon className="h-5 w-5 text-accent" /><h3 className="mt-3 font-bold">{feature.title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{feature.text}</p></div></article>)}</div>
      </section>

      <section className="border-y border-border bg-secondary/45 py-14"><div className="mx-auto max-w-6xl px-4 sm:px-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Für professionellen Fahrzeughandel</p><h2 className="mt-2 font-display text-3xl font-bold">Ein konsistenter Auftritt für Ihren gesamten Bestand.</h2><div className="mt-7 grid gap-4 sm:grid-cols-3">{['Einheitliche Ergebnisse statt wechselnder Bildqualität', 'Ein Ablauf für einzelne Händler und mehrere Standorte', 'Direkt einsetzbare Bilder für Ihre Verkaufskanäle'].map((text, i) => <div key={text} className="rounded-lg border border-border bg-card p-5 shadow-card"><span className="text-4xl font-bold text-accent/20">0{i + 1}</span><p className="mt-3 text-sm font-semibold leading-6">{text}</p></div>)}</div></div></section>

      <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Häufige Fragen</p><h2 className="mt-2 font-display text-3xl font-bold">Noch Fragen?</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Hier finden Sie Antworten rund um den Fahrzeugtest und den Einsatz im Autohaus.</p></div><Accordion type="single" collapsible>{FAQ.map(([q, a], i) => <AccordionItem key={q} value={`faq-${i}`}><AccordionTrigger className="text-left text-sm font-semibold">{q}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion></section>

      <section className="px-4 pb-14 sm:px-6"><div className="gradient-hero mx-auto flex max-w-6xl flex-col justify-between gap-6 rounded-lg px-6 py-8 text-primary-foreground sm:px-8 lg:flex-row lg:items-center"><div><h2 className="font-display text-2xl font-bold">Testen Sie autohaus.ai mit einem Fahrzeug aus Ihrem Bestand.</h2><p className="mt-2 text-sm text-primary-foreground/80">Ein Fahrzeugfoto, wenige Angaben – und Sie erhalten eine Einschätzung für Ihren Einsatz.</p></div><Button asChild size="lg" variant="secondary" className="shrink-0"><Link to={TEST_URL}>1 Fahrzeug kostenlos testen <ArrowRight className="h-4 w-4" /></Link></Button></div></section>
    </FunnelLayout>
  );
}
