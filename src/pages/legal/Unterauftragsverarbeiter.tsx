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
    provider: 'Lovable',
    purpose: 'Bereitstellung, Build und Hosting der Web-Anwendung',
    regions: 'EU/USA möglich',
    status: 'AVV/DPA je nach Plan – vertraglich zu verifizieren',
  },
  {
    provider: 'Supabase',
    purpose: 'Datenbank, Authentifizierung, Datei-Speicher, serverseitige Funktionen',
    regions: 'Abhängig von der gewählten Projektregion – zu verifizieren',
    status: 'AVV/DPA und Region vertraglich zu verifizieren',
  },
  {
    provider: 'Google (Gemini, Veo, Lyria über die Google-KI-Schnittstellen)',
    purpose: 'KI-gestützte Bild-, Video-, Audio- und Textverarbeitung, temporäre Dateiablage',
    regions: 'Global, Drittlandverarbeitung möglich',
    status: 'Kostenpflichtige Nutzung und DPA vertraglich zu verifizieren',
  },
  {
    provider: 'OpenAI',
    purpose: 'KI-gestützte Bild-, Text- und Dokumentenverarbeitung, Files-API',
    regions: 'Global, Drittlandverarbeitung möglich',
    status: 'DPA und Datennutzungseinstellungen vertraglich zu verifizieren',
  },
  {
    provider: 'Resend',
    purpose: 'Versand operativer und vertriebsbezogener E-Mails',
    regions: 'EU/USA möglich',
    status: 'AVV/DPA vertraglich zu verifizieren',
  },
];

const RECIPIENTS: Row[] = [
  {
    provider: 'Stripe',
    purpose: 'Zahlungsabwicklung, Abonnementverwaltung, Rechnungsstellung',
    regions: 'EU/USA',
    status: 'Teilweise eigenständig verantwortlich (Zahlungsverkehr, Betrugsprävention); DPA zu verifizieren',
  },
  {
    provider: 'Google Analytics / Google Ads',
    purpose: 'Reichweitenmessung und Werbemessung – nur nach Einwilligung und nur bei konfigurierter Kennung',
    regions: 'EU/USA',
    status: 'Derzeit keine Kennung hinterlegt; Rolle und Verträge vor Aktivierung zu klären',
  },
  {
    provider: 'Meta (Instagram, Facebook)',
    purpose: 'Veröffentlichung von Inhalten auf Veranlassung des Kunden',
    regions: 'EU/USA',
    status: 'Eigenständig verantwortlich für die veröffentlichten Inhalte',
  },
  {
    provider: 'X',
    purpose: 'Veröffentlichung von Inhalten auf Veranlassung des Kunden',
    regions: 'EU/USA',
    status: 'Eigenständig verantwortlich für die veröffentlichten Inhalte',
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

      <LegalSection title="3. OutVin (Fahrzeugdaten / VIN) – OFFEN">
        <p>
          Für die Ermittlung von Fahrzeugdaten kann eine Fahrzeugidentifikationsnummer an OutVin
          übermittelt werden. Rolle, Nutzungsbedingungen und ein etwaiger
          Auftragsverarbeitungsvertrag sind noch zu verifizieren. Bis zur Klärung sollten keine
          VIN-Daten mit Personenbezug produktiv über diesen Weg verarbeitet werden. Dieser Punkt ist
          ausdrücklich OFFEN.
        </p>
      </LegalSection>

      <LegalSection title="4. Änderungen">
        <p>
          Über die Hinzuziehung wesentlicher neuer oder den Austausch bestehender
          Unterauftragsverarbeiter informieren wir unsere Geschäftskunden vorab in Textform oder
          durch Aktualisierung dieser Seite. Kunden können aus datenschutzrechtlichen Gründen
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
