import LegalLayout, { LegalList, LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL } from '@/lib/legal-config';

export default function Avv() {
  return (
    <LegalLayout
      title="Auftragsverarbeitungsvertrag (Art. 28 DSGVO)"
      metaTitle="AVV – Auftragsverarbeitung AUTO3 | Breadcrumb Marketing GmbH"
      metaDescription="Rahmenvertrag zur Auftragsverarbeitung nach Art. 28 DSGVO zwischen AUTO3-Geschäftskunden als Verantwortlichem und der Breadcrumb Marketing GmbH als Auftragsverarbeiter."
      canonicalPath="/avv"
      toc
      intro={
        <p>
          Dieser Rahmenvertrag gilt zwischen dem jeweiligen AUTO3-Geschäftskunden
          („Verantwortlicher“) und der {LEGAL.company}, {LEGAL.street}, {LEGAL.city}
          („Auftragsverarbeiter“). Er wird mit Abschluss des AUTO3-Nutzungsvertrags elektronisch
          einbezogen, soweit personenbezogene Daten im Auftrag verarbeitet werden. Anlage 1:
          Unterauftragsverarbeiter. Anlage 2: technische und organisatorische Maßnahmen (TOMs).
        </p>
      }
    >
      <LegalSection title="1. Gegenstand, Umfang und Dauer">
        <p>
          Gegenstand ist die Verarbeitung personenbezogener Daten durch den Auftragsverarbeiter im
          Rahmen der Bereitstellung und des Betriebs der SaaS-Plattform AUTO3. Die Dauer entspricht
          der Laufzeit des Nutzungsvertrags; die Pflichten dieses Vertrags gelten bis zur
          Rückgabe/Löschung der Daten fort.
        </p>
      </LegalSection>

      <LegalSection title="2. Art und Zweck der Verarbeitung">
        <p>
          Speicherung, Organisation, Anpassung, Auslesen, Verwendung, Übermittlung an eingesetzte
          Dienste und Löschung personenbezogener Daten zum Zweck der Bereitstellung der
          Plattformfunktionen: Fahrzeug- und Bildverarbeitung inklusive KI-gestützter Erzeugung,
          Dokumentenanalyse, Angebots- und Landingpage-Erstellung, Vertriebs- und CRM-Funktionen,
          Kommunikations- und Veröffentlichungsfunktionen sowie zugehörige Verwaltung und Support.
        </p>
      </LegalSection>

      <LegalSection title="3. Kategorien personenbezogener Daten">
        <LegalList
          items={[
            'Konto- und Kontaktdaten der Nutzerinnen und Nutzer des Verantwortlichen',
            'CRM- und Lead-Daten (Interessenten, Ansprechpartner, Vorgangsdaten)',
            'Kommunikations- und E-Mail-Inhalte einschließlich Metadaten',
            'Fahrzeugdaten, Fahrzeugidentifikationsnummern und Kennzeichen',
            'Bild-, Video- und Audiodateien',
            'PDF- und sonstige Dokumente',
            'Nutzereingaben und Prompt-Inhalte',
            'Nutzungs-, Protokoll- und technische Daten',
            'Metadaten der Veröffentlichung in sozialen Netzwerken, soweit vom Verantwortlichen veranlasst',
          ]}
        />
        <p>
          Besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO sind nicht Gegenstand
          dieses Vertrags und dürfen ohne gesonderte Vereinbarung nicht eingestellt werden.
        </p>
      </LegalSection>

      <LegalSection title="4. Kategorien betroffener Personen">
        <LegalList
          items={[
            'Beschäftigte und Nutzerinnen/Nutzer des Verantwortlichen',
            'Interessenten, Kundinnen/Kunden und Ansprechpartner des Verantwortlichen',
            'Personen, die auf hochgeladenen Medien beiläufig erkennbar sind',
            'sonstige Personen, deren Daten der Verantwortliche rechtmäßig bereitstellt',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Weisungsbindung">
        <p>
          Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte
          Weisung des Verantwortlichen, einschließlich Weisungen zu Übermittlungen in Drittländer,
          sofern er nicht durch Unionsrecht oder mitgliedstaatliches Recht zur Verarbeitung
          verpflichtet ist. In diesem Fall teilt er dies vor der Verarbeitung mit, sofern das Recht
          eine solche Mitteilung nicht verbietet. Die Nutzung der Plattformfunktionen durch den
          Verantwortlichen gilt als Weisung. Der Auftragsverarbeiter informiert den Verantwortlichen
          unverzüglich, wenn eine Weisung nach seiner Auffassung gegen Datenschutzrecht verstößt.
        </p>
      </LegalSection>

      <LegalSection title="6. Vertraulichkeit">
        <p>
          Der Auftragsverarbeiter setzt zur Verarbeitung nur Personen ein, die zur Vertraulichkeit
          verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht
          unterliegen, und stellt eine Verarbeitung nach dem Need-to-know-Prinzip sicher.
        </p>
      </LegalSection>

      <LegalSection title="7. Sicherheit der Verarbeitung (Art. 32 DSGVO)">
        <p>
          Der Auftragsverarbeiter trifft geeignete technische und organisatorische Maßnahmen. Diese
          sind in{' '}
          <a className="underline underline-offset-2" href="/toms">
            Anlage 2 (TOMs)
          </a>{' '}
          beschrieben und können dem Stand der Technik entsprechend fortentwickelt werden, solange
          das Schutzniveau nicht unterschritten wird.
        </p>
      </LegalSection>

      <LegalSection title="8. Unterauftragsverarbeiter">
        <p>
          Der Verantwortliche erteilt eine allgemeine Genehmigung zum Einsatz von
          Unterauftragsverarbeitern. Die eingesetzten Unternehmen sind in{' '}
          <a className="underline underline-offset-2" href="/unterauftragsverarbeiter">
            Anlage 1
          </a>{' '}
          aufgeführt. Wesentliche neue oder ersetzte Unterauftragsverarbeiter teilt der
          Auftragsverarbeiter dem Verantwortlichen, soweit eine Kontaktmöglichkeit besteht, vor
          deren Einsatz in Textform oder über einen vertraglich vereinbarten Benachrichtigungskanal
          mit angemessener Vorlaufzeit mit; die öffentliche Anlage 1 dient zusätzlich als jeweils
          aktuelle Übersicht, ersetzt diese Mitteilung aber nicht.
          Der Verantwortliche kann aus datenschutzrechtlichen Gründen
          innerhalb einer angemessenen Frist Einspruch erheben; kann keine Einigung erzielt werden,
          steht dem Verantwortlichen ein Sonderkündigungsrecht zu. Der Auftragsverarbeiter erlegt
          Unterauftragsverarbeitern gleichwertige Pflichten auf und bleibt dem Verantwortlichen
          gegenüber gemäß Art. 28 Abs. 4 DSGVO verantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="9. Unterstützung bei Betroffenenrechten">
        <p>
          Der Auftragsverarbeiter unterstützt den Verantwortlichen mit geeigneten technischen und
          organisatorischen Maßnahmen bei der Erfüllung von Anträgen betroffener Personen
          (Art. 12–23 DSGVO). Wendet sich eine betroffene Person direkt an den Auftragsverarbeiter,
          leitet er die Anfrage unverzüglich weiter.
        </p>
      </LegalSection>

      <LegalSection title="10. Unterstützung nach Art. 32–36 DSGVO">
        <p>
          Der Auftragsverarbeiter unterstützt den Verantwortlichen unter Berücksichtigung der Art
          der Verarbeitung und der ihm zur Verfügung stehenden Informationen bei der Einhaltung der
          Pflichten zu Sicherheit, Meldung von Verletzungen, Datenschutz-Folgenabschätzung und
          vorheriger Konsultation.
        </p>
      </LegalSection>

      <LegalSection title="11. Meldung von Verletzungen des Schutzes personenbezogener Daten">
        <p>
          Der Auftragsverarbeiter meldet dem Verantwortlichen jede ihm bekannt gewordene Verletzung
          des Schutzes personenbezogener Daten unverzüglich nach Bekanntwerden und stellt die ihm
          vorliegenden Informationen nach Art. 33 Abs. 3 DSGVO bereit, insbesondere Art der
          Verletzung, betroffene Datenkategorien, wahrscheinliche Folgen und ergriffene Maßnahmen.
        </p>
      </LegalSection>

      <LegalSection title="12. Rückgabe und Löschung">
        <p>
          Nach Beendigung der Verarbeitung löscht der Auftragsverarbeiter die personenbezogenen
          Daten oder gibt sie nach Wahl des Verantwortlichen zurück, sofern keine gesetzliche
          Aufbewahrungspflicht besteht. Sicherungskopien werden im Rahmen der regulären
          Sicherungszyklen gelöscht. Bei externen Dienstleistern richtet sich die Löschung
          zusätzlich nach deren Löschmechanismen; Einschränkungen sind in Anlage 2 benannt.
        </p>
      </LegalSection>

      <LegalSection title="13. Nachweise und Kontrollen">
        <p>
          Der Auftragsverarbeiter stellt dem Verantwortlichen alle erforderlichen Informationen zum
          Nachweis der Einhaltung dieses Vertrags zur Verfügung und ermöglicht Überprüfungen.
          Routinemäßige Überprüfungen erfolgen nach angemessener Vorankündigung (in der Regel 14
          Tage), während der üblichen Geschäftszeiten und ohne unverhältnismäßige Betriebsstörung;
          vorrangig durch Bereitstellung von Dokumentation, Selbstauskünften oder Nachweisen
          eingesetzter Dienstleister. Nach einem Sicherheitsvorfall oder auf begründetes Verlangen
          einer Aufsichtsbehörde bestehen weitergehende und kurzfristige Prüfrechte.
        </p>
      </LegalSection>

      <LegalSection title="14. Drittlandübermittlungen">
        <p>
          Eine Verarbeitung in Drittländern erfolgt insbesondere im Zusammenhang mit KI-Diensten,
          Zahlungsabwicklung und Veröffentlichungsfunktionen. Sie wird auf
          Angemessenheitsbeschlüsse, Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO oder
          andere geeignete Garantien gestützt. Der Verantwortliche weist diese Übermittlungen durch
          die Nutzung der entsprechenden Funktionen an. Der Vertragsstand einzelner Anbieter ist in
          Anlage 1 gekennzeichnet, soweit er noch zu verifizieren ist.
        </p>
      </LegalSection>

      <LegalSection title="15. Pflichten des Verantwortlichen">
        <p>
          Der Verantwortliche ist für die Zulässigkeit der Verarbeitung und die Rechtsgrundlage
          verantwortlich, insbesondere für Informationspflichten, Einwilligungen und die
          Rechtmäßigkeit der eingestellten Inhalte. Er erteilt Weisungen grundsätzlich in Textform
          oder durch Nutzung der Plattformfunktionen und benennt einen Ansprechpartner.
        </p>
      </LegalSection>

      <LegalSection title="16. Kontakt">
        <p>
          Operative Anfragen zu diesem Vertrag und zum Datenschutz richten Sie an{' '}
          <a className="underline underline-offset-2" href={`mailto:${LEGAL.email}`}>
            {LEGAL.email}
          </a>
          . Ein Datenschutzbeauftragter ist derzeit nicht benannt bzw. nicht veröffentlicht.
        </p>
      </LegalSection>

      <LegalSection title="17. Vorrang">
        <p>
          Bei Widersprüchen zwischen diesem Vertrag und dem Nutzungsvertrag bzw. den AGB gehen die
          Regelungen dieses Vertrags für die Auftragsverarbeitung vor.
        </p>
        <p className="text-xs">
          Compliance-orientierte Fassung, Stand {LEGAL.versionDate}; abschließende rechtliche Prüfung
          und Verifikation der Anbieterverträge stehen aus.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
