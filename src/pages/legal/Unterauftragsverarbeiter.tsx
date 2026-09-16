import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL } from '@/lib/legal-config';

interface Row {
  provider: string;
  purpose: string;
  regions: string;
  status: string;
}

const PROCESSORS: Row[] = [
  {
    provider: 'Lovable Labs',
    purpose: 'Bereitstellung, Build, Deployment und Hosting der Web-Anwendung',
    regions: 'EU/USA möglich',
    status: 'Konkrete Rolle je nach genutztem Plan/Deployment und AVV/DPA vertraglich zu verifizieren',
  },
  {
    provider: 'Supabase, Inc.',
    purpose: 'Datenbank, Authentifizierung, Datei-Speicher, serverseitige Funktionen',
    regions: 'Abhängig von der gewählten Projektregion – zu verifizieren',
    status: 'AVV/DPA und Region vertraglich zu verifizieren',
  },
  {
    provider: 'Google Ireland Limited (Gemini, Veo, Lyria über die Google-KI-Schnittstellen)',
    purpose: 'KI-gestützte Bild-, Video-, Audio- und Textverarbeitung, temporäre Dateiablage',
    regions: 'Global, Drittlandverarbeitung möglich',
    status: 'Kostenpflichtige Nutzung und DPA vertraglich zu verifizieren',
  },
  {
    provider: 'OpenAI Ireland Ltd. (OpenAI API, für Kunden im EWR)',
    purpose: 'KI-gestützte Bild-, Text- und Dokumentenverarbeitung, Files-API',
    regions: 'Global, Drittlandverarbeitung möglich',
    status: 'DPA und Datennutzungseinstellungen vertraglich zu verifizieren',
  },
  {
    provider: 'Resend (Rechtsträger vertraglich zu verifizieren)',
    purpose: 'Versand operativer und vertriebsbezogener E-Mails',
    regions: 'EU/USA möglich',
    status: 'AVV/DPA vertraglich zu verifizieren',
  },
];

const RECIPIENTS: Row[] = [
  {
    provider: 'Stripe Payments Europe, Limited (SPEL) / Stripe-Konzern',
    purpose: 'Zahlungsabwicklung, Abonnementverwaltung, Rechnungsstellung',
    regions: 'EU/USA',
    status: 'Rolle je Leistung unterschiedlich; teilweise eigenständig verantwortlich (Zahlungsverkehr, Betrugsprävention); DPA zu verifizieren',
  },
  {
    provider: 'Google Ireland Limited (Google Analytics / Google Ads)',
    purpose: 'Reichweitenmessung und Werbemessung – nur bei konfigurierter Kennung und nach entsprechender Einwilligung',
    regions: 'EU/USA',
    status: 'Rollenverteilung je Dienst unterschiedlich (teilweise gemeinsame bzw. eigene Verantwortlichkeit); Verträge vor Aktivierung zu klären',
  },
  {
    provider: 'Meta Platforms Ireland Limited (Instagram, Facebook)',
    purpose: 'Veröffentlichung von Inhalten auf Veranlassung des Kunden',
    regions: 'EU/USA',
    status: 'Für die veröffentlichten Inhalte je Dienst eigene bzw. eigenständige Verantwortlichkeit',
  },
  {
    provider: 'X Internet Unlimited Company',
    purpose: 'Veröffentlichung von Inhalten auf Veranlassung des Kunden',
    regions: 'EU/USA',
    status: 'Für die veröffentlichten Inhalte je Dienst eigene bzw. eigenständige Verantwortlichkeit',
  },
  {
    provider: 'SIA „Social Minds“ (Betreiber von OutVin)',
    purpose: 'Abruf von Fahrzeugdaten anhand der Fahrzeugidentifikationsnummer',
    regions: 'EU, Drittlandverarbeitung nicht ausgeschlossen',
    status: 'Betreiber laut OutVin-Nutzungsbedingungen; Rolle und DPA vertraglich zu prüfen',
  },
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-muted/50 text-foreground">
          <tr>
            <th className="p-3 font-semibold">Anbieter / Dienst</th>
            <th className="p-3 font-semibold">Zweck</th>
            <th className="p-3 font-semibold">Mögliche Regionen</th>
            <th className="p-3 font-semibold">Status / Garantien</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.provider} className="border-t border-border align-top">
              <td className="p-3 font-medium text-foreground">{r.provider}</td>
              <td className="p-3">{r.purpose}</td>
              <td className="p-3">{r.regions}</td>
              <td className="p-3">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Unterauftragsverarbeiter() {
  return (
    <LegalLayout
      title="Unterauftragsverarbeiter und weitere Empfänger"
      metaTitle="Unterauftragsverarbeiter – AUTO3"
      metaDescription="Anlage 1 zum Auftragsverarbeitungsvertrag: eingesetzte Unterauftragsverarbeiter, weitere Empfänger und offene Punkte für AUTO3."
      canonicalPath="/unterauftragsverarbeiter"
      toc
      intro={
        <p>
          Anlage 1 zum{' '}
          <a className="underline underline-offset-2" href="/avv">
            Auftragsverarbeitungsvertrag
          </a>
          . Die Übersicht beruht auf der tatsächlich eingesetzten Infrastruktur von AUTO3. Wo der
          Vertrags- oder Kontostand nicht technisch überprüfbar ist, ist dies ausdrücklich als „zu
          verifizieren“ ausgewiesen.
        </p>
      }
    >
      <LegalSection title="1. Unterauftragsverarbeiter (Art. 28 DSGVO)">
        <Table rows={PROCESSORS} />
      </LegalSection>

      <LegalSection title="2. Weitere Empfänger / eigenständig Verantwortliche oder rollenabhängig">
        <p>
          Die folgenden Dienste sind nicht pauschal als Auftragsverarbeiter einzuordnen. Ihre Rolle
          hängt vom jeweiligen Verarbeitungsvorgang ab.
        </p>
        <Table rows={RECIPIENTS} />
      </LegalSection>

      <LegalSection title="3. OutVin (Fahrzeugdaten / VIN) – Rolle zu verifizieren">
        <p>
          Für die Ermittlung von Fahrzeugdaten kann eine Fahrzeugidentifikationsnummer an OutVin
          übermittelt werden. Betreiber ist nach den OutVin-Nutzungsbedingungen SIA „Social Minds“.
          Die datenschutzrechtliche Rolle und ein etwaiger Auftragsverarbeitungsvertrag sind
          vertraglich zu prüfen. Bis zur Klärung sollten keine VIN-Daten mit Personenbezug produktiv
          über diesen Weg verarbeitet werden.
        </p>
      </LegalSection>

      <LegalSection title="4. Änderungen">
        <p>
          Wesentliche neue oder ersetzte Unterauftragsverarbeiter teilen wir unseren
          Geschäftskunden, soweit eine Kontaktmöglichkeit besteht, vor deren Einsatz in Textform
          oder über einen vertraglich vereinbarten Benachrichtigungskanal mit angemessener
          Vorlaufzeit mit. Diese Seite dient zusätzlich als jeweils aktuelle Übersicht, ersetzt die
          Mitteilung aber nicht. Kunden können aus datenschutzrechtlichen Gründen
          innerhalb einer angemessenen Frist Einspruch erheben. Eine automatisierte
          E-Mail-Benachrichtigung ist derzeit nicht eingerichtet.
        </p>
        <p className="text-xs">
          Stand: {LEGAL.versionDate} · {LEGAL.company}
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
