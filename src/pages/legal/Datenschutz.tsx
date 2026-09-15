import LegalLayout, { LegalList, LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL, LEGAL_VERSIONS } from '@/lib/legal-config';
import { openConsentSettings } from '@/lib/consent';

export default function Datenschutz() {
  return (
    <LegalLayout
      title="Datenschutzerklärung"
      metaTitle="Datenschutzerklärung – AUTO3"
      metaDescription="Wie AUTO3 (Breadcrumb Marketing GmbH) personenbezogene Daten verarbeitet: Konten, Zahlungen, KI-Verarbeitung, Einwilligungen, Rechte der Betroffenen."
      canonicalPath="/datenschutz"
      intro={
        <p>
          Diese Erklärung informiert über die Verarbeitung personenbezogener Daten bei der Nutzung
          von AUTO3 sowie der zugehörigen Webseiten und Funnel-Seiten. Version:{' '}
          {LEGAL_VERSIONS.privacy}.
        </p>
      }
    >
      <LegalSection title="1. Verantwortlicher">
        <p>
          {LEGAL.company}, {LEGAL.street}, {LEGAL.city}, {LEGAL.country}
          <br />
          Geschäftsführer: {LEGAL.managingDirector}
          <br />
          Telefon: {LEGAL.phone} · E-Mail:{' '}
          <a className="underline underline-offset-2" href={`mailto:${LEGAL.email}`}>
            {LEGAL.email}
          </a>
        </p>
        <p>
          Ein Datenschutzbeauftragter ist derzeit nicht benannt bzw. noch nicht veröffentlicht.
          Anfragen zum Datenschutz richten Sie bitte an die oben genannte Adresse.
        </p>
      </LegalSection>

      <LegalSection title="2. Allgemeine Rechtsgrundlagen">
        <LegalList
          items={[
            'Art. 6 Abs. 1 lit. b DSGVO – Erfüllung des Nutzungs- bzw. SaaS-Vertrags und vorvertragliche Maßnahmen.',
            'Art. 6 Abs. 1 lit. c DSGVO – Erfüllung rechtlicher Pflichten, insbesondere handels- und steuerrechtlicher Aufbewahrung.',
            'Art. 6 Abs. 1 lit. f DSGVO – berechtigte Interessen an Sicherheit, Missbrauchsabwehr, Betrieb und Weiterentwicklung.',
            'Art. 6 Abs. 1 lit. a DSGVO – Einwilligung, insbesondere für optionale Analyse- und Marketingdienste.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Zielgruppe und Mindestalter">
        <p>
          AUTO3 ist ein reines B2B-Angebot für Unternehmer i. S. d. § 14 BGB, juristische Personen
          des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen. Nutzerinnen und Nutzer
          müssen mindestens 18 Jahre alt sein. Verbraucherverträge werden nicht geschlossen.
        </p>
      </LegalSection>

      <LegalSection title="4. Hosting und technische Protokolle">
        <p>
          Beim Aufruf der Anwendung verarbeitet die Hosting- und Backend-Infrastruktur technisch
          erforderliche Verbindungsdaten (u. a. IP-Adresse, Zeitpunkt, angefragte Ressource,
          Statuscode, Browsertyp). Diese Daten sind für Auslieferung, Stabilität und Abwehr von
          Angriffen erforderlich (Art. 6 Abs. 1 lit. b und lit. f DSGVO). Als Infrastruktur setzen
          wir Lovable (Bereitstellung/Hosting der Anwendung) sowie Supabase (Datenbank,
          Authentifizierung, Datei-Speicher, serverseitige Funktionen) ein. Einzelheiten und der
          Stand der jeweiligen Verträge sind in der{' '}
          <a className="underline underline-offset-2" href="/unterauftragsverarbeiter">
            Übersicht der Unterauftragsverarbeiter
          </a>{' '}
          dargestellt.
        </p>
      </LegalSection>

      <LegalSection title="5. Konto und Authentifizierung">
        <p>
          Für die Nutzung ist ein Konto erforderlich. Verarbeitet werden insbesondere Name,
          Firmenname, geschäftliche E-Mail-Adresse, Rolle, Kontoeinstellungen sowie die
          dokumentierte Zustimmung zu den AGB (Dokument, Version, Zeitstempel, Bestätigung der
          Unternehmereigenschaft und des Mindestalters). Die Authentifizierung erfolgt über unseren
          Authentifizierungsdienst; Zugangsdaten werden mit den Sicherheitsmechanismen dieses
          Anbieters geschützt. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, für die Dokumentation
          der Vertragsannahme zusätzlich Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="6. Anmeldung mit Google">
        <p>
          Optional kann die Anmeldung über ein Google-Konto erfolgen. Dabei werden von Google die
          zur Identifikation erforderlichen Daten (insbesondere Kennung, Name, E-Mail-Adresse,
          Profilbild-URL) an uns übermittelt. Die Nutzung dieses Anmeldewegs ist freiwillig; die
          Verarbeitung erfolgt zur Durchführung des Vertrags bzw. auf Grundlage Ihrer Auswahl
          (Art. 6 Abs. 1 lit. b DSGVO). Auch bei Anmeldung über Google ist die Bestätigung der
          B2B-Eigenschaft und der AGB erforderlich.
        </p>
      </LegalSection>

      <LegalSection title="7. Abonnements und Zahlungen (Stripe)">
        <p>
          Zahlungen und Abonnements wickeln wir über Stripe ab. Dabei werden Vertrags-, Zahlungs-
          und Abrechnungsdaten verarbeitet (u. a. Name, E-Mail-Adresse, Rechnungsangaben,
          Zahlungsstatus, Abonnementlaufzeit). Zahlungsdaten wie vollständige Kartendaten werden
          von Stripe erhoben und nicht von uns gespeichert. Stripe verarbeitet Zahlungsdaten
          teilweise in eigener Verantwortlichkeit, insbesondere zur Betrugsprävention und zur
          Erfüllung finanzregulatorischer Pflichten. Rechtsgrundlagen: Art. 6 Abs. 1 lit. b und
          lit. c DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="8. Nutzer- und Projektdaten, Uploads">
        <p>
          Im Rahmen der Nutzung verarbeiten wir die von Ihnen eingestellten Inhalte: Fahrzeugdaten,
          Fahrzeugidentifikationsnummern, Kennzeichen, Bilder, Videos, Audio, PDF-Dokumente,
          Texteingaben (Prompts), Projekt- und Gestaltungseinstellungen sowie Nutzungs- und
          Protokolldaten zu Aufträgen und Credits. Soweit diese Inhalte personenbezogene Daten
          Dritter enthalten (z. B. zufällig abgebildete Personen, Ansprechpartner Ihrer Kundschaft),
          verarbeiten wir sie weisungsgebunden für Sie als Auftragsverarbeiter (siehe{' '}
          <a className="underline underline-offset-2" href="/avv">
            AVV
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="9. KI-gestützte Verarbeitung">
        <p>
          Zur Bildaufbereitung, 360°-Ansichten, Video- und Audioerzeugung, Text- und
          Dokumentenanalyse setzen wir KI-Dienste von Google (u. a. Gemini, Veo, Lyria) und OpenAI
          ein. Dazu werden die jeweils erforderlichen Inhalte (Bilder, Dokumente, Texteingaben) an
          die Schnittstellen dieser Anbieter übertragen und dort verarbeitet. Eine Verarbeitung
          außerhalb der EU bzw. des EWR kann dabei stattfinden. Rechtsgrundlage: Art. 6 Abs. 1
          lit. b DSGVO bzw. für die Verarbeitung im Kundenauftrag der Auftragsverarbeitungsvertrag.
        </p>
        <p>
          Nach den geltenden Geschäftsbedingungen der OpenAI-API werden Eingaben und Ausgaben von
          Geschäftskunden standardmäßig nicht zum Training der Modelle verwendet. Eine
          Null-Speicherung („Zero Retention“) sichern wir nicht zu; eine zeitlich begrenzte
          Speicherung, etwa zur Missbrauchskontrolle, kann anbieterseitig erfolgen.
        </p>
      </LegalSection>

      <LegalSection title="10. Dateiuploads zu externen KI-Diensten">
        <p>
          Für eine zuverlässige und wiederverwendbare Verarbeitung laden wir Referenzdateien über
          die Datei-Schnittstellen der Anbieter hoch (Google Gemini Files, OpenAI Files). Bei Google
          Gemini Files läuft die temporäre Speicherung anbieterseitig automatisch ab. Bei OpenAI
          Files können hochgeladene Dateien bestehen bleiben, bis sie gelöscht werden oder eine
          konfigurierte Ablauffrist greift. Eine automatische Löschung durch uns ist derzeit nicht
          implementiert; die Einrichtung eines Lösch- bzw. Ablaufprozesses ist ein offener
          technischer Punkt, der in der Sicherheitsdokumentation geführt wird.
        </p>
      </LegalSection>

      <LegalSection title="11. Fahrzeugidentifikationsnummern und externe Fahrzeugdaten">
        <p>
          Zur Ermittlung von Fahrzeugdaten können Fahrzeugidentifikationsnummern (VIN) an einen
          externen Datenanbieter (OutVin) übermittelt werden. VIN können in Einzelfällen einen
          Personenbezug aufweisen. Die vertragliche Rolle dieses Anbieters sowie ein
          Auftragsverarbeitungsvertrag sind vor einer produktiven Verarbeitung personenbezogener
          VIN-Daten zu verifizieren; wir weisen diesen Punkt in der{' '}
          <a className="underline underline-offset-2" href="/unterauftragsverarbeiter">
            Anbieterübersicht
          </a>{' '}
          ausdrücklich als offen aus.
        </p>
      </LegalSection>

      <LegalSection title="12. CRM, Leads, Probefahrten und Vertriebsdaten">
        <p>
          AUTO3 enthält Funktionen für Lead-Erfassung, CRM-Pipeline, Probefahrt-Buchungen,
          Angebote und Inzahlungnahme-Bewertungen. Dabei verarbeiten wir die von Ihnen oder Ihren
          Interessenten eingegebenen Kontakt-, Fahrzeug- und Vorgangsdaten. Diese Verarbeitung
          erfolgt in Ihrem Auftrag; Sie bleiben für die Rechtsgrundlage der Erhebung bei Ihren
          Interessenten verantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="13. Verkaufsassistent, E-Mail-Verarbeitung und Wissensbasis">
        <p>
          Der KI-Verkaufsassistent verarbeitet Konversationsinhalte, Aufgaben, Notizen und die von
          Ihnen bereitgestellte Wissensbasis (z. B. hochgeladene Dokumente). Für den Versand
          operativer E-Mails setzen wir einen E-Mail-Versanddienstleister ein (Resend). Inhalte von
          E-Mails, Empfängeradressen und Versandprotokolle werden dabei verarbeitet.
        </p>
      </LegalSection>

      <LegalSection title="14. Veröffentlichung in sozialen Netzwerken">
        <p>
          Auf Ihre Veranlassung können Inhalte an Instagram und Facebook (Meta) sowie X übertragen
          und dort veröffentlicht werden. Dafür werden die Medieninhalte, Bildunterschriften und
          die von Ihnen hinterlegten Zugangsdaten bzw. Tokens verarbeitet. Technisch ist für die
          Veröffentlichung eine öffentlich abrufbare Medien-URL erforderlich; die betreffenden
          Dateien sind daher in diesen Fällen über eine nicht ohne Weiteres erratbare Adresse
          öffentlich abrufbar. Die Plattformen verarbeiten die veröffentlichten Inhalte in eigener
          Verantwortlichkeit nach ihren eigenen Bedingungen.
        </p>
      </LegalSection>

      <LegalSection title="15. Google Analytics 4">
        <p>
          Eine Webanalyse mit Google Analytics 4 wird ausschließlich nach Ihrer Einwilligung
          (Art. 6 Abs. 1 lit. a DSGVO) und nur dann eingesetzt, wenn eine entsprechende Mess-ID
          konfiguriert ist. Derzeit ist keine Mess-ID hinterlegt; ohne Einwilligung und ohne
          Konfiguration werden keine Analyse-Skripte geladen und keine Daten übertragen. Wird die
          Analyse später aktiviert, werden die Aufbewahrungsfristen für Nutzer- und Ereignisdaten
          im Konto auf höchstens 14 Monate eingestellt.
        </p>
      </LegalSection>

      <LegalSection title="16. Google Ads, Conversion-Messung und Remarketing">
        <p>
          Marketing-Dienste von Google (Conversion-Messung, Remarketing) werden ebenfalls nur nach
          Einwilligung und nur bei konfigurierter Kennung geladen. Erweiterte Conversions werden
          nur eingesetzt, sofern sie später ausdrücklich aktiviert und hier ergänzt werden. Ohne
          Einwilligung erfolgt keine Übertragung an Google.
        </p>
      </LegalSection>

      <LegalSection title="17. Einwilligungsverwaltung und Consent Mode V2">
        <p>
          Wir betreiben eine eigene Einwilligungsverwaltung mit den Kategorien „Notwendig“,
          „Analyse“ und „Marketing“. Optionale Kategorien sind nicht vorausgewählt. Vor einer
          Einwilligung werden keine Google-Skripte geladen und es erfolgen keine – auch keine
          cookielosen – Übertragungen („Basic Consent Mode“). Die Einwilligungssignale
          analytics_storage, ad_storage, ad_user_data und ad_personalization stehen standardmäßig
          auf „denied“ und werden erst bei Zustimmung aktualisiert. Ihre Auswahl wird zusammen mit
          Version, Zeitpunkt und einer zufälligen Kennung lokal in Ihrem Browser gespeichert; ein
          serverseitiges Einwilligungsprotokoll führen wir derzeit nicht. Sie können Ihre
          Entscheidung jederzeit ändern oder widerrufen:{' '}
          <button
            type="button"
            onClick={openConsentSettings}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Cookie-Einstellungen öffnen
          </button>
          . Der Widerruf wirkt für die Zukunft.
        </p>
      </LegalSection>

      <LegalSection title="18. Technisch notwendige Speicherung im Browser">
        <p>
          Für Anmeldung, Sitzungsverwaltung, Sicherheitsfunktionen und zwischengespeicherte
          Anwendungsdaten nutzen wir technisch erforderliche Speichermechanismen (u. a. Local
          Storage, Session Storage, Cookies des Authentifizierungsdienstes). Diese sind für den
          ausdrücklich gewünschten Dienst erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und nicht von einer
          Einwilligung abhängig.
        </p>
      </LegalSection>

      <LegalSection title="19. Formulare und Kontaktaufnahme">
        <p>
          Über unsere Funnel- und Kontaktformulare (z. B. „Fahrzeug testen“) verarbeiten wir die
          angegebenen Unternehmens- und Kontaktdaten, Angaben zum Einsatzzweck, ein optional
          hochgeladenes Fahrzeugbild sowie technische Herkunftsangaben (Kampagnen- und
          Referrer-Parameter), soweit vorhanden. Die Verarbeitung dient der Bearbeitung Ihrer
          Anfrage und der Vorbereitung eines Vertrags (Art. 6 Abs. 1 lit. b DSGVO) sowie unserem
          berechtigten Interesse an einer passgenauen Ansprache im B2B-Umfeld (Art. 6 Abs. 1 lit. f
          DSGVO).
        </p>
      </LegalSection>

      <LegalSection title="20. Operative E-Mails">
        <p>
          Wir versenden vertragsbezogene und betriebsnotwendige E-Mails (z. B. Bestätigungen,
          Statusmeldungen, Rechnungs- und Sicherheitsinformationen). Eine automatisierte
          Newsletter- oder Marketing-Automation betreiben wir in AUTO3 derzeit nicht.
        </p>
      </LegalSection>

      <LegalSection title="21. Empfänger">
        <p>
          Empfänger sind Dienstleister und Partner, die wir für Betrieb und Leistungserbringung
          einsetzen: Hosting- und Backend-Infrastruktur, KI-Dienste, Zahlungsdienstleister,
          E-Mail-Versand, sowie auf Ihre Veranlassung soziale Netzwerke. Eine vollständige, laufend
          gepflegte Übersicht finden Sie unter{' '}
          <a className="underline underline-offset-2" href="/unterauftragsverarbeiter">
            Unterauftragsverarbeiter
          </a>
          . Darüber hinaus geben wir Daten weiter, wenn wir rechtlich dazu verpflichtet sind.
        </p>
      </LegalSection>

      <LegalSection title="22. Internationale Datenübermittlung">
        <p>
          Insbesondere bei KI-Diensten, Zahlungsabwicklung und sozialen Netzwerken kann eine
          Verarbeitung in Drittländern, namentlich den USA, stattfinden. Wir können daher nicht
          zusichern, dass sämtliche Daten ausschließlich in der EU verbleiben. Die Übermittlung
          wird auf Angemessenheitsbeschlüsse, Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c
          DSGVO oder andere zulässige Garantien gestützt. Der jeweils aktuelle Vertragsstand ist
          anbieterbezogen zu verifizieren.
        </p>
      </LegalSection>

      <LegalSection title="23. Speicherdauer und Löschung">
        <p>
          Konto- und Vertragsdaten speichern wir für die Dauer des Vertragsverhältnisses und
          anschließend, soweit handels- und steuerrechtliche Aufbewahrungsfristen bestehen (in der
          Regel 6 bzw. 10 Jahre). Projekt-, Medien- und CRM-Daten speichern wir, solange sie für
          Konto und Projekte benötigt werden oder bis Sie eine Löschung veranlassen; Kopien in
          Sicherungen können vorübergehend fortbestehen. Feste Fristen für einzelne Mediendateien
          sagen wir nicht zu.
        </p>
      </LegalSection>

      <LegalSection title="24. Sicherheit">
        <p>
          Wir treffen technische und organisatorische Maßnahmen nach Art. 32 DSGVO. Diese sind
          unter{' '}
          <a className="underline underline-offset-2" href="/toms">
            TOMs
          </a>{' '}
          beschrieben.
        </p>
      </LegalSection>

      <LegalSection title="25. Ihre Rechte">
        <LegalList
          items={[
            'Auskunft (Art. 15 DSGVO)',
            'Berichtigung (Art. 16 DSGVO)',
            'Löschung (Art. 17 DSGVO)',
            'Einschränkung der Verarbeitung (Art. 18 DSGVO)',
            'Datenübertragbarkeit (Art. 20 DSGVO)',
            'Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)',
          ]}
        />
        <p>
          Zur Ausübung genügt eine Nachricht an{' '}
          <a className="underline underline-offset-2" href={`mailto:${LEGAL.email}`}>
            {LEGAL.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="26. Widerspruchsrecht nach Art. 21 DSGVO">
        <p>
          Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben,
          jederzeit gegen die Verarbeitung Sie betreffender personenbezogener Daten Widerspruch
          einzulegen, die auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO erfolgt. Werden Daten für
          Direktwerbung verarbeitet, können Sie jederzeit ohne Angabe von Gründen widersprechen.
        </p>
      </LegalSection>

      <LegalSection title="27. Beschwerderecht">
        <p>
          Sie können sich bei einer Datenschutzaufsichtsbehörde beschweren. Für uns zuständig ist:{' '}
          {LEGAL.authority.name}, {LEGAL.authority.address}.
        </p>
      </LegalSection>

      <LegalSection title="28. Keine automatisierte Entscheidung im Einzelfall">
        <p>
          Eine ausschließlich automatisierte Entscheidungsfindung mit rechtlicher Wirkung oder
          ähnlich erheblicher Beeinträchtigung im Sinne des Art. 22 DSGVO findet nicht statt.
          KI-Funktionen erzeugen Vorschläge und Inhalte, die von Ihnen geprüft und freigegeben
          werden.
        </p>
      </LegalSection>

      <LegalSection title="29. Transparenz bei KI-Inhalten">
        <p>
          KI-erzeugte oder KI-veränderte Inhalte werden gekennzeichnet. Einzelheiten finden Sie
          unter{' '}
          <a className="underline underline-offset-2" href="/ki-transparenz">
            KI-Transparenz
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="30. Änderungen und Version">
        <p>
          Wir passen diese Erklärung an, wenn sich Funktionen, Dienstleister oder die Rechtslage
          ändern. Es gilt die jeweils hier veröffentlichte Fassung. Aktuelle Version:{' '}
          {LEGAL_VERSIONS.privacy}, Stand {LEGAL.versionDate}.
        </p>
        <p className="text-xs">
          Hinweis: Diese Erklärung ist eine sorgfältig erstellte, compliance-orientierte Fassung.
          Eine abschließende rechtliche Prüfung sowie die Verifikation der Verträge mit allen
          Anbietern stehen aus.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
