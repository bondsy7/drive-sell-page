import { Sparkles, ShieldCheck, FileText } from "lucide-react";
import LegalLayout, { LegalSection } from "@/components/legal/LegalLayout";
import { AI_DISCLOSURE_LABEL_DE, AI_DISCLOSURE_LONG_DE } from "@/lib/ai-disclosure";
import { LEGAL_DOCUMENT_DATES, LEGAL_VERSIONS } from "@/lib/legal-config";

const KiTransparenz: React.FC = () => {
  return (
    <LegalLayout
      title="KI-Transparenz"
      metaTitle="KI-Transparenz – Kennzeichnung KI-generierter Inhalte | autohaus.ai"
      metaDescription="So kennzeichnet autohaus.ai KI-generierte Fahrzeugbilder, Videos und Audios gemäß EU AI Act Art. 50 – Verfahren, Modelle und Hinweise."
      canonicalPath="/ki-transparenz"
      versionDate={LEGAL_DOCUMENT_DATES.aiTransparency}
      toc
      intro={
        <div className="space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {AI_DISCLOSURE_LABEL_DE}
          </span>
          <p>{AI_DISCLOSURE_LONG_DE}</p>
          <p className="text-xs">Version: {LEGAL_VERSIONS.aiTransparency}</p>
        </div>
      }
    >

        <LegalSection title="Warum diese Seite?">
          <p>
            Artikel 50 der Verordnung (EU) 2024/1689 (EU AI Act) regelt Transparenzpflichten für
            KI-Systeme und gilt grundsätzlich seit dem 2. August 2026. Die Pflichten sind dabei
            getrennt ausgestaltet: Art. 50 Abs. 2 richtet sich an Anbieter generativer Systeme und
            verlangt eine maschinenlesbare Markierung synthetischer Ausgaben; Art. 50 Abs. 4
            betrifft Betreiber und die Offenlegung bestimmter Deepfake-Inhalte. Nicht jedes
            KI-bearbeitete Fahrzeugbild löst damit automatisch dieselbe Kennzeichnungspflicht aus.
          </p>
          <p>
            Für Systeme, die vor dem 2. August 2026 in Verkehr gebracht wurden, sieht die aktuelle
            Übergangsregelung für Art. 50 Abs. 2 eine Frist bis zum 2. Dezember 2026 vor. Unabhängig
            davon setzt autohaus.ai zusätzliche sichtbare Transparenzlabels ein.
          </p>
        </LegalSection>

        <LegalSection title="Was wir kennzeichnen">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Aufbereitete Fahrzeugfotos (Remastering, Szenenwechsel, Freisteller)</li>
            <li>Generierte Banner, Anzeigenmotive und Landingpage-Bilder</li>
            <li>360°-Ansichten aus generierten Einzelbildern</li>
            <li>Schadensvisualisierungen („Nachher“-Bilder) – zusätzlich als unverbindlich gekennzeichnet</li>
            <li>KI-generierte Videos und Musik</li>
          </ul>
        </LegalSection>

        <LegalSection title="Wie wir kennzeichnen">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Sichtbares Label „{AI_DISCLOSURE_LABEL_DE}“ direkt auf Bild, Banner und Viewer</li>
            <li>Hinweiszeile im Footer jeder Angebots- und Landingpage sowie im PDF-Export</li>
            <li>Automatischer Hinweis inkl. #KIgeneriert in Captions beim Veröffentlichen in sozialen Netzwerken</li>
            <li>Erweiterte Alt-Texte für Screenreader</li>
          </ul>
        </LegalSection>

        <LegalSection title="Eingesetzte KI-Systeme">
          <p>
            Für Bild-, Video- und Audioerzeugung setzen wir Modelle von Google (Gemini, Veo) und OpenAI ein.
            Von den Anbietern gesetzte unsichtbare Wasserzeichen und Metadaten (z. B. SynthID, Content Credentials)
            werden von uns nicht entfernt.
          </p>
        </LegalSection>

        <LegalSection title="Prüfpflicht der Nutzerinnen und Nutzer">
          <p>
            KI-Ergebnisse sind probabilistisch und können fehlerhaft sein. Inhalte – insbesondere Fahrzeug-,
            Preis-, Finanzierungs- sowie WLTP-/Pkw-EnVKV-relevante Angaben – müssen vor der Veröffentlichung
            auf Richtigkeit und Vollständigkeit geprüft werden. Die Verantwortung für veröffentlichte Inhalte
            liegt beim jeweiligen Unternehmen.
          </p>
        </LegalSection>

        <LegalSection title="Maschinenlesbare Kennzeichnung">
          <p>
            Soweit gesetzlich erforderlich und technisch möglich, kennzeichnen wir KI-generierte und erheblich
            KI-bearbeitete Inhalte zusätzlich maschinenlesbar – etwa über von den Modellanbietern gesetzte
            Wasserzeichen und Metadaten. Wir können jedoch nicht zusichern, dass jedes Ausgabeformat dauerhaft
            maschinenlesbar markiert bleibt: Metadaten können bei Weiterverarbeitung, Konvertierung oder beim
            Upload auf Drittplattformen verloren gehen. Die sichtbare Kennzeichnung bleibt daher maßgeblich.
          </p>
        </LegalSection>

        <LegalSection title="Noch offen">
          <p className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Die zusätzliche maschinenlesbare Markierung mit eigenem C2PA-Manifest (Content Credentials) ist in
              Vorbereitung und noch nicht aktiv.
            </span>
          </p>
        </LegalSection>

        <LegalSection title="Kontakt">
          <p className="flex gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Fragen zur KI-Kennzeichnung beantworten wir schriftlich – bitte per E-Mail an uns wenden.</span>
          </p>
        </LegalSection>
    </LegalLayout>
  );
};

export default KiTransparenz;
