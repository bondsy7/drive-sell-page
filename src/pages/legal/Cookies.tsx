import LegalLayout, { LegalSection } from '@/components/legal/LegalLayout';
import { openConsentSettings } from '@/lib/consent';

interface Entry {
  name: string;
  category: 'Notwendig' | 'Analyse' | 'Marketing' | 'Authentifizierung';
  purpose: string;
  note: string;
}

const ENTRIES: Entry[] = [
  {
    name: 'Auth-Session (lokale Speicherung)',
    category: 'Notwendig',
    purpose: 'Hält die Anmeldung aufrecht und schützt vor ungültigen Sitzungen.',
    note: 'Ohne diese Speicherung ist eine Anmeldung technisch nicht möglich. Keine Einwilligung erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).',
  },
  {
    name: 'Consent-Einstellung (auto3_consent_v1)',
    category: 'Notwendig',
    purpose: 'Speichert deine Auswahl zu Analyse und Marketing sowie die Version der Einwilligung.',
    note: 'Wird lokal im Browser gespeichert, damit wir dich nicht erneut fragen müssen.',
  },
  {
    name: 'Google Analytics 4',
    category: 'Analyse',
    purpose: 'Reichweitenmessung und Verbesserung des Angebots.',
    note: 'Wird ausschließlich nach Einwilligung in die Kategorie „Analyse“ geladen. Cookie-Namen und Speicherdauern hängen von der Google-Konfiguration ab und können im Browser eingesehen werden.',
  },
  {
    name: 'Google Ads / Conversion-Messung',
    category: 'Marketing',
    purpose: 'Messung von Werbeerfolg, ggf. Remarketing.',
    note: 'Wird ausschließlich nach Einwilligung in die Kategorie „Marketing“ geladen. Speicherdauern variieren je nach Google-Konfiguration.',
  },
  {
    name: 'Google OAuth (Anmeldung mit Google)',
    category: 'Authentifizierung',
    purpose: 'Von dir bewusst ausgelöste Anmeldung über dein Google-Konto.',
    note: 'Kein automatisches Tracking. Der Vorgang startet erst, wenn du die Anmeldung mit Google auswählst.',
  },
];

export default function Cookies() {
  return (
    <LegalLayout
      title="Cookies und lokale Speicherung"
      metaTitle="Cookies und Einwilligungen – AUTO3"
      metaDescription="Übersicht über technisch notwendige Speicherung, Analyse- und Marketing-Technologien in AUTO3 sowie Verwaltung der Einwilligung."
      canonicalPath="/cookies"
      intro={
        <p>
          AUTO3 setzt Analyse- und Marketing-Technologien ausschließlich nach deiner Einwilligung
          ein. Vor einer Einwilligung wird kein Google-Dienst geladen und es wird kein Request an
          Google ausgelöst. Technisch notwendige Speicherung (z. B. Anmeldesitzung) ist für den
          Betrieb erforderlich und nicht abwählbar.
        </p>
      }
    >
      <LegalSection title="1. Deine Einwilligung verwalten">
        <p>Du kannst deine Auswahl jederzeit ändern oder widerrufen.</p>
        <button
          type="button"
          onClick={openConsentSettings}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Cookie-Einstellungen öffnen
        </button>
        <p>
          Beim Widerruf werden die Google-Einwilligungssignale auf „denied“ gesetzt, bekannte
          Google-Cookies dieser Domain werden nach Möglichkeit entfernt und die Seite wird neu
          geladen, damit keine weiteren Daten gesendet werden.
        </p>
      </LegalSection>

      <LegalSection title="2. Eingesetzte Technologien">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                <th className="p-3 font-semibold">Technologie</th>
                <th className="p-3 font-semibold">Kategorie</th>
                <th className="p-3 font-semibold">Zweck</th>
                <th className="p-3 font-semibold">Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {ENTRIES.map((e) => (
                <tr key={e.name} className="border-t border-border align-top">
                  <td className="p-3 font-medium text-foreground">{e.name}</td>
                  <td className="p-3">{e.category}</td>
                  <td className="p-3">{e.purpose}</td>
                  <td className="p-3">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. Keine erfundenen Laufzeiten">
        <p>
          Die konkreten Cookie-Namen und Speicherdauern der Google-Dienste hängen von der
          jeweiligen Konto- und Tag-Konfiguration ab und können sich anbieterseitig ändern. Wir
          geben deshalb bewusst keine festen Laufzeiten an. Die tatsächlich gesetzten Cookies kannst
          du jederzeit in den Entwicklerwerkzeugen bzw. den Cookie-Einstellungen deines Browsers
          einsehen und löschen.
        </p>
      </LegalSection>

      <LegalSection title="4. Rechtsgrundlagen">
        <p>
          Technisch notwendige Speicherung: § 25 Abs. 2 Nr. 2 TDDDG sowie Art. 6 Abs. 1 lit. b bzw.
          lit. f DSGVO. Analyse und Marketing: § 25 Abs. 1 TDDDG und Art. 6 Abs. 1 lit. a DSGVO
          (Einwilligung), jederzeit mit Wirkung für die Zukunft widerrufbar.
        </p>
        <p>
          Weitere Informationen findest du in der{' '}
          <a className="underline underline-offset-2" href="/datenschutz">
            Datenschutzerklärung
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
