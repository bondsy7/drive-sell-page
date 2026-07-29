import React from "react";
import { Link } from "react-router-dom";
import { Sparkles, ShieldCheck, FileText, ArrowLeft } from "lucide-react";
import { AI_DISCLOSURE_LABEL_DE, AI_DISCLOSURE_LONG_DE } from "@/lib/ai-disclosure";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const KiTransparenz: React.FC = () => {
  React.useEffect(() => {
    document.title = "KI-Transparenz – Kennzeichnung KI-generierter Inhalte | AUTO3";
    const desc =
      "So kennzeichnet AUTO3 KI-generierte Fahrzeugbilder, Videos und Audios gemäß EU AI Act Art. 50 – Verfahren, Modelle und Hinweise.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  return (
    <main className="min-h-screen bg-background px-5 py-12">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>

        <header className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> {AI_DISCLOSURE_LABEL_DE}
          </span>
          <h1 className="font-display text-3xl font-bold text-foreground">KI-Transparenz</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{AI_DISCLOSURE_LONG_DE}</p>
        </header>

        <Section title="Warum diese Seite?">
          <p>
            Seit dem 2. August 2026 gelten die Transparenzpflichten aus Artikel 50 der Verordnung (EU) 2024/1689
            (EU AI Act). Inhalte, die mit KI erzeugt oder verändert wurden und reale Fahrzeuge, Orte oder Personen
            realistisch abbilden, müssen klar und deutlich als künstlich erzeugt oder verändert erkennbar sein.
          </p>
        </Section>

        <Section title="Was wir kennzeichnen">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Aufbereitete Fahrzeugfotos (Remastering, Szenenwechsel, Freisteller)</li>
            <li>Generierte Banner, Anzeigenmotive und Landingpage-Bilder</li>
            <li>360°-Ansichten aus generierten Einzelbildern</li>
            <li>Schadensvisualisierungen („Nachher“-Bilder) – zusätzlich als unverbindlich gekennzeichnet</li>
            <li>KI-generierte Videos und Musik</li>
          </ul>
        </Section>

        <Section title="Wie wir kennzeichnen">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sichtbares Label „{AI_DISCLOSURE_LABEL_DE}“ direkt auf Bild, Banner und Viewer</li>
            <li>Hinweiszeile im Footer jeder Angebots- und Landingpage sowie im PDF-Export</li>
            <li>Automatischer Hinweis inkl. #KIgeneriert in Captions beim Veröffentlichen in sozialen Netzwerken</li>
            <li>Erweiterte Alt-Texte für Screenreader</li>
          </ul>
        </Section>

        <Section title="Eingesetzte KI-Systeme">
          <p>
            Für Bild-, Video- und Audioerzeugung setzen wir Modelle von Google (Gemini, Veo) und OpenAI ein.
            Von den Anbietern gesetzte unsichtbare Wasserzeichen und Metadaten (z. B. SynthID, Content Credentials)
            werden von uns nicht entfernt.
          </p>
        </Section>

        <Section title="Noch offen">
          <p className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Die zusätzliche maschinenlesbare Markierung mit eigenem C2PA-Manifest (Content Credentials) ist in
              Vorbereitung und noch nicht aktiv.
            </span>
          </p>
        </Section>

        <Section title="Kontakt">
          <p className="flex gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Fragen zur KI-Kennzeichnung beantworten wir schriftlich – bitte per E-Mail an uns wenden.</span>
          </p>
        </Section>
      </div>
    </main>
  );
};

export default KiTransparenz;
