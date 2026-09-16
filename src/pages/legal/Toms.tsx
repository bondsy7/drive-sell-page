import LegalLayout, { LegalList, LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL } from '@/lib/legal-config';

export default function Toms() {
  return (
    <LegalLayout
      title="Technische und organisatorische Maßnahmen (TOMs)"
      metaTitle="TOMs – Sicherheitsmaßnahmen AUTO3"
      metaDescription="Anlage 2 zum Auftragsverarbeitungsvertrag: technische und organisatorische Maßnahmen nach Art. 32 DSGVO für die Plattform AUTO3."
      canonicalPath="/toms"
      toc
      intro={
        <p>
          Anlage 2 zum{' '}
          <a className="underline underline-offset-2" href="/avv">
            Auftragsverarbeitungsvertrag
          </a>
          . Beschrieben sind die derzeit umgesetzten bzw. verbindlich zugesagten Maßnahmen nach
          Art. 32 DSGVO für AUTO3 der {LEGAL.company}. Maßnahmen, die noch offen sind, sind
          ausdrücklich als offen gekennzeichnet.
        </p>
      }
    >
      <LegalSection title="1. Vertraulichkeit und Zugangskontrolle">
        <LegalList
          items={[
            'Nutzung nur über authentifizierte Konten; Registrierung mit E-Mail-Verifizierung.',
            'Rollentrennung zwischen regulären Nutzerkonten und administrativen Rollen; Administratorrechte werden in einer separaten Rollentabelle geführt und serverseitig geprüft.',
            'Berechtigungsvergabe nach dem Prinzip der geringsten Rechte und nach Need-to-know.',
            'Serverseitige Ablage von Schlüsseln und Zugangsdaten; keine privilegierten Schlüssel im Browser.',
            'Vertraulichkeitsverpflichtung der eingesetzten Personen.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Übertragungssicherheit">
        <LegalList
          items={[
            'Transportverschlüsselung per HTTPS/TLS für Anwendung, Schnittstellen und serverseitige Funktionen.',
            'Aufrufe externer Dienste erfolgen ausschließlich über verschlüsselte Verbindungen.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Speicher- und Datenbankkontrolle">
        <LegalList
          items={[
            'Betrieb von Datenbank, Authentifizierung, Datei-Speicher und serverseitigen Funktionen auf einer verwalteten Supabase-/PostgreSQL-Infrastruktur.',
            'Row Level Security (RLS) auf den fachlichen Tabellen; Zugriff grundsätzlich auf eigene Datensätze beschränkt.',
            'Service-Role-Schlüssel ausschließlich serverseitig in geschützten Funktionen.',
            'Zugriffsrichtlinien auf Speicher-Buckets; private Buckets für Originalaufnahmen, Dokumente und interne Uploads mit zeitlich begrenzten, signierten Links.',
          ]}
        />
        <p>
          Hinweis zur Transparenz: Nicht alle Speicherbereiche sind privat. Originalaufnahmen
          („originals“), Vertriebsdokumente, Audiodateien und interne Test-Uploads liegen in
          privaten Bereichen und werden nur über signierte, zeitlich begrenzte Links ausgeliefert.
          Demgegenüber sind die Bereiche „vehicle-images“ (aufbereitete und generierte
          Fahrzeugbilder der Galerie), „banners“, „logos“, „manufacturer-logos“ und „sample-pdfs“
          aktuell öffentlich abrufbar – über nicht ohne Weiteres erratbare Adressen. Dies ist für
          Veröffentlichung und Export (Social-Media-Beiträge, ausgelieferte Landingpages,
          Bannerdateien) technisch erforderlich und Teil der Weisung. Eine spätere Trennung in
          private Arbeitsstände und ausdrücklich veröffentlichte Medien ist als Verbesserung
          vorgesehen.
        </p>
      </LegalSection>

      <LegalSection title="4. Trennung und Mandantenlogik">
        <LegalList
          items={[
            'Logische Mandantentrennung über die Nutzerkennung (user_id) in Tabellen und Richtlinien.',
            'Besitzprüfungen über Pfadpräfixe in Speicherbereichen, soweit umgesetzt.',
            'Trennung von Produktiv- und Verwaltungssichten (Administrationsbereich mit eigener Rollenprüfung).',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Integrität und Eingabekontrolle">
        <LegalList
          items={[
            'Validierung von Eingaben in serverseitigen Funktionen (Typ-, Format-, Größen- und Dateitypprüfungen), soweit umgesetzt.',
            'Authentifizierte serverseitige Funktionen für schutzbedürftige Vorgänge; Prüfung des Zugangstokens vor der Verarbeitung.',
            'Missbrauchsbremsen an öffentlichen Formularendpunkten.',
            'Protokollierung von Aufträgen, Credit-Buchungen und Statusänderungen.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Verfügbarkeit und Wiederherstellung">
        <p>
          Betrieb auf verwalteter Anbieterinfrastruktur mit den Sicherungs- und
          Wiederherstellungsmechanismen des jeweils gebuchten Anbieterplans. Konkrete
          Wiederherstellungszeiten oder Wiederherstellungspunkte (RTO/RPO) sind nicht vereinbart und
          werden nicht zugesichert.
        </p>
      </LegalSection>

      <LegalSection title="7. Protokollierung und Überwachung">
        <LegalList
          items={[
            'Protokolle der serverseitigen Funktionen und Fehlerprotokolle der Verarbeitungsaufträge.',
            'Administrative Auswertungen zu Jobs, Kosten, E-Mail-Versand und Speichernutzung.',
          ]}
        />
        <p>
          Ein manipulationssicheres zentrales Sicherheitsmonitoring (SIEM) mit unveränderlicher
          Protokollhaltung ist derzeit nicht im Einsatz.
        </p>
      </LegalSection>

      <LegalSection title="8. Umgang mit Sicherheitsvorfällen">
        <LegalList
          items={[
            'Interne Meldung, Bewertung und Eindämmung erkannter Vorfälle.',
            'Information betroffener Kunden unverzüglich nach Bekanntwerden mit den verfügbaren Angaben nach Art. 33 Abs. 3 DSGVO.',
            'Dokumentation von Vorfällen und ergriffenen Maßnahmen.',
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Entwicklung und Änderungsmanagement">
        <LegalList
          items={[
            'Versionsverwaltung des Quellcodes; Geheimnisse werden nicht im Code abgelegt, sondern als serverseitige Secrets verwaltet.',
            'Typ- und Build-Prüfungen sowie automatisierte Tests in dem Umfang, in dem sie im Projekt eingerichtet sind.',
            'Änderungen werden vor Übernahme geprüft; sicherheitsrelevante Abhängigkeiten werden regelmäßig aktualisiert.',
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Datenminimierung und Zweckbindung">
        <LegalList
          items={[
            'Erhebung nur der für die Funktion erforderlichen Daten.',
            'Keine Verwendung von Kundeninhalten zu eigenen Trainings- oder Werbezwecken ohne gesonderte Vereinbarung.',
            'Keine Speicherung von IP-Adressen für die Dokumentation von Einwilligungen oder Vertragsannahmen.',
          ]}
        />
      </LegalSection>

      <LegalSection title="11. Löschkonzept und bekannte Einschränkungen">
        <LegalList
          items={[
            'Löschung von Konten, Projekten und Medien auf Anforderung; Bereinigungsroutine für verwaiste Speicherobjekte.',
            'Google Gemini Files: temporär gespeicherte Dateien laufen anbieterseitig automatisch ab.',
            'OpenAI Files: hochgeladene Dateien bestehen fort, bis sie gelöscht werden oder eine konfigurierte Ablauffrist greift. Eine automatische Löschung ist derzeit NICHT implementiert, weil Datei-IDs für die Wiederverwendung von Referenzen benötigt werden. Ein Lösch-/Ablaufprozess ist als offener Punkt mit hoher Priorität dokumentiert.',
          ]}
        />
      </LegalSection>

      <LegalSection title="12. Überprüfung und Fortschreibung">
        <p>
          Die Maßnahmen werden anlassbezogen sowie risikoorientiert überprüft und an den Stand der
          Technik angepasst. Das Schutzniveau wird dabei nicht unterschritten. Stand:{' '}
          {LEGAL.versionDate}.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
