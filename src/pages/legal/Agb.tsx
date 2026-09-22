import LegalLayout, { LegalList, LegalSection } from '@/components/legal/LegalLayout';
import { LEGAL, LEGAL_VERSIONS } from '@/lib/legal-config';

export default function Agb() {
  return (
    <LegalLayout
      title="Allgemeine Geschäftsbedingungen (AUTO3)"
      metaTitle="AGB – AUTO3 | Breadcrumb Marketing GmbH"
      metaDescription="Allgemeine Geschäftsbedingungen für die Nutzung der SaaS-Plattform AUTO3 durch Unternehmer – Leistungen, Credits, Laufzeit, Haftung."
      canonicalPath="/agb"
      toc
      intro={
        <p>
          Diese Bedingungen gelten für die Nutzung der SaaS-Plattform AUTO3 der {LEGAL.company}.
          Sie sind eigenständig und ersetzen für AUTO3 etwaige Agenturbedingungen der{' '}
          {LEGAL.company}. Version: {LEGAL_VERSIONS.agb}.
        </p>
      }
    >
      <LegalSection title="§ 1 Anbieter, Geltungsbereich, Zielgruppe">
        <p>
          Anbieter ist die {LEGAL.company}, {LEGAL.street}, {LEGAL.city} („Anbieter“). AUTO3 ist ein
          Produkt des Anbieters. Diese AGB gelten für alle Verträge über die Nutzung von AUTO3.
        </p>
        <p>
          Das Angebot richtet sich ausschließlich an Unternehmer i. S. d. § 14 BGB, juristische
          Personen des öffentlichen Rechts und öffentlich-rechtliche Sondervermögen. Mit der
          Registrierung bestätigt der Kunde, in Ausübung einer gewerblichen oder selbständigen
          beruflichen Tätigkeit zu handeln und mindestens 18 Jahre alt zu sein. Verträge mit
          Verbrauchern werden nicht geschlossen; Verbraucherwiderrufsrechte bestehen daher nicht.
        </p>
        <p>
          Abweichende Bedingungen des Kunden werden nicht Vertragsbestandteil, auch wenn ihnen nicht
          ausdrücklich widersprochen wird.
        </p>
      </LegalSection>

      <LegalSection title="§ 2 Leistungsgegenstand">
        <p>
          AUTO3 ist eine webbasierte Software zur Erstellung und Verwaltung von Fahrzeug-Marketing:
          unter anderem Bildaufbereitung und -erzeugung, 360°-Ansichten, Banner, Videos, Musik,
          Angebots- und Landingpages, Dokumentenanalyse, Fahrzeugdaten, Vertriebs- und
          CRM-Funktionen sowie Veröffentlichungs- und Exportwege.
        </p>
        <p>
          Der Leistungsumfang ergibt sich aus der jeweils aktuellen Produktbeschreibung und dem
          gebuchten Paket. Leistungen setzen teilweise Schnittstellen und Dienste Dritter voraus
          (z. B. KI-Anbieter, Zahlungsdienst, soziale Netzwerke, Fahrzeugdatenanbieter). Änderungen,
          Einschränkungen oder Ausfälle solcher Drittdienste können den Funktionsumfang
          beeinflussen.
        </p>
      </LegalSection>

      <LegalSection title="§ 3 Registrierung und Zugangssicherheit">
        <p>
          Die Nutzung setzt ein Konto mit wahrheitsgemäßen Angaben, insbesondere Firmenname, Name
          und geschäftlicher E-Mail-Adresse, voraus. Der Kunde hält Zugangsdaten geheim, schützt sie
          vor Zugriff Dritter und informiert den Anbieter unverzüglich bei Verdacht auf Missbrauch.
          Handlungen über das Konto des Kunden werden dem Kunden zugerechnet, soweit er sie zu
          vertreten hat.
        </p>
      </LegalSection>

      <LegalSection title="§ 4 Vertragsschluss und elektronische Annahme">
        <p>
          Der Vertrag kommt mit Freischaltung des Kontos bzw. mit Bestätigung der Bestellung
          zustande. Der Kunde akzeptiert die jeweils gültige, versionierte Fassung dieser AGB
          elektronisch. Dokumentiert werden Dokument, Version und Zeitpunkt der Annahme sowie die
          Bestätigung der Unternehmereigenschaft.
        </p>
      </LegalSection>

      <LegalSection title="§ 5 Preise, Umsatzsteuer, Zahlung">
        <p>
          Alle Preise verstehen sich netto in Euro zuzüglich der jeweils gesetzlichen
          Umsatzsteuer. Die Abrechnung erfolgt über den Zahlungsdienstleister Stripe. Der Kunde
          stellt ein gültiges Zahlungsmittel bereit. Bei Zahlungsverzug gelten die gesetzlichen
          Regelungen.
        </p>
      </LegalSection>

      <LegalSection title="§ 6 Credits">
        <p>
          Bestimmte Funktionen werden über Credits abgerechnet. Credits sind kein gesetzliches
          Zahlungsmittel, keine E-Geld-Forderung und kein Guthaben mit Auszahlungsanspruch. Eine
          Auszahlung, Rückzahlung in Geld oder Übertragung an Dritte ist ausgeschlossen.
        </p>
        <p>
          Während eines aktiven Kundenkontos gutgeschriebene Credits bleiben nutzbar, soweit der
          Tarif oder die Bestellseite nicht ausdrücklich eine abweichende Gültigkeit ausweist. Bei
          endgültiger Löschung des Kundenkontos verfallen ungenutzte Credits, soweit dem keine
          zwingenden gesetzlichen oder vertraglichen Ansprüche entgegenstehen.
        </p>
        <p>
          Die Credit-Kosten einer Aktion werden vor deren Auslösung angezeigt. Schlägt eine
          kostenpflichtige Aktion aus einem vom Anbieter zu vertretenden technischen Grund
          eindeutig fehl, werden die dafür verbrauchten Credits auf Anforderung gutgeschrieben. Kein
          Anspruch besteht, wenn ein Ergebnis technisch erzeugt wurde und lediglich inhaltlich nicht
          den Erwartungen entspricht.
        </p>
      </LegalSection>

      <LegalSection title="§ 7 Laufzeit, Verlängerung, Kündigung">
        <p>
          Abonnements haben eine Mindestvertragslaufzeit von zwölf (12) Monaten ab Bereitstellung des
          Zugangs. Die Abrechnung erfolgt monatlich im Voraus. Der Vertrag verlängert sich jeweils um
          weitere zwölf (12) Monate, wenn er nicht mit einer Frist von einem (1) Monat zum Ende der
          jeweiligen Laufzeit gekündigt wird. Die Kündigung ist über die Kontoverwaltung oder in
          Textform möglich. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt
          unberührt. Einmalige Implementierungskosten werden mit der Erstbuchung fällig und sind
          laufzeitunabhängig.
        </p>
      </LegalSection>

      <LegalSection title="§ 8 Pflichten des Kunden und Rechte an Uploads">
        <p>
          Der Kunde stellt sicher, dass er zur Nutzung und Verarbeitung aller von ihm eingestellten
          Inhalte (Bilder, Videos, Dokumente, Logos, Texte, Fahrzeug- und Personendaten) berechtigt
          ist und dass die Nutzung keine Rechte Dritter und keine gesetzlichen Vorgaben verletzt.
          Besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO dürfen nicht hochgeladen
          werden, sofern dies nicht gesondert vereinbart ist.
        </p>
      </LegalSection>

      <LegalSection title="§ 9 Nutzungsrechte an Kundeninhalten">
        <p>
          Der Kunde räumt dem Anbieter ein einfaches, räumlich unbeschränktes, auf die Vertragsdauer
          beschränktes Recht ein, die eingestellten Inhalte ausschließlich zu dem Zweck zu nutzen,
          zu vervielfältigen, zu bearbeiten und an eingesetzte Dienstleister zu übermitteln, soweit
          dies zur Erbringung der vertraglichen Leistungen erforderlich ist. Eine darüber
          hinausgehende Nutzung, insbesondere zu eigenen Werbezwecken, erfolgt nur mit gesonderter
          Zustimmung.
        </p>
      </LegalSection>

      <LegalSection title="§ 10 KI-Funktionen, Prüfpflicht des Kunden">
        <p>
          KI-Systeme erzeugen Ergebnisse auf Wahrscheinlichkeitsbasis. Der Anbieter schuldet keine
          inhaltliche Richtigkeit, Vollständigkeit, Originalität oder Einzigartigkeit generierter
          Inhalte. Ergebnisse können fehlerhaft, unvollständig oder für den konkreten Zweck
          ungeeignet sein sowie anderen Ergebnissen ähneln. Der Kunde prüft alle Ergebnisse vor
          Veröffentlichung oder Verwendung eigenverantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="§ 11 Rechte an generierten Ergebnissen">
        <p>
          Der Anbieter überträgt dem Kunden die ihm an den erzeugten Ergebnissen zustehenden
          Nutzungsrechte im Rahmen des vertraglich Möglichen zur geschäftlichen Nutzung. Rechte
          Dritter, insbesondere Marken-, Design-, Persönlichkeits- und Urheberrechte sowie die
          Bedingungen der eingesetzten KI-Anbieter, bleiben unberührt. Eine Exklusivität, ein
          urheberrechtlicher Schutz oder eine Eintragungsfähigkeit als Marke wird nicht zugesichert.
        </p>
      </LegalSection>

      <LegalSection title="§ 12 Kennzeichnung von KI-Inhalten">
        <p>
          AUTO3 stellt für KI-erzeugte und KI-veränderte Inhalte sichtbare Kennzeichnungen sowie,
          soweit technisch verfügbar und gesetzlich erforderlich, maschinenlesbare Kennzeichnungen
          bereit.
        </p>
        <p>
          Der Anbieter kann nicht zusichern, dass jedes Ausgabeformat dauerhaft maschinenlesbar
          markiert bleibt; Metadaten und Wasserzeichen können insbesondere bei Konvertierung,
          Weiterverarbeitung oder beim Upload auf Drittplattformen verloren gehen.
        </p>
        <p>
          Der Kunde darf gesetzlich erforderliche Kennzeichnungen, Wasserzeichen oder Metadaten
          nicht gezielt entfernen oder umgehen und hat die ihn treffenden kontextspezifischen
          Transparenzpflichten eigenständig zu prüfen und einzuhalten.
        </p>
      </LegalSection>

      <LegalSection title="§ 13 Fahrzeugdaten und VIN-Abfragen">
        <p>
          Über externe Dienste ermittelte Fahrzeugdaten – etwa aus VIN-Abfragen – werden ohne Gewähr
          für Richtigkeit, Aktualität und Vollständigkeit bereitgestellt. Maßgeblich sind die
          Fahrzeugpapiere und die eigene Prüfung des Kunden.
        </p>
      </LegalSection>

      <LegalSection title="§ 14 Pflichtangaben im Fahrzeugmarketing">
        <p>
          Der Kunde ist allein dafür verantwortlich, dass veröffentlichte Inhalte den geltenden
          Vorgaben entsprechen, insbesondere zu Pflichtangaben nach Pkw-EnVKV/WLTP,
          Verbrauchs-, Emissions- und Effizienzangaben, Preisangaben, Finanzierungs- und
          Leasingangaben nach PAngV sowie Kennzeichnungs- und Werbevorgaben. Angaben, Berechnungen
          und Vorlagen in AUTO3 sind Hilfsmittel und vor Veröffentlichung zu prüfen.
        </p>
      </LegalSection>

      <LegalSection title="§ 15 Veröffentlichung in sozialen Netzwerken">
        <p>
          Nutzt der Kunde Veröffentlichungsfunktionen, gelten zusätzlich die Bedingungen der
          jeweiligen Plattform. Der Kunde verantwortet Inhalte und Zugangsdaten. Technisch kann eine
          Veröffentlichung eine öffentlich abrufbare Medien-URL erfordern; dies ist dem Kunden
          bekannt und von seiner Weisung umfasst.
        </p>
      </LegalSection>

      <LegalSection title="§ 16 Datenschutz und Auftragsverarbeitung">
        <p>
          Soweit der Anbieter personenbezogene Daten im Auftrag des Kunden verarbeitet, gilt der{' '}
          <a className="underline underline-offset-2" href="/avv">
            Auftragsverarbeitungsvertrag
          </a>{' '}
          nebst{' '}
          <a className="underline underline-offset-2" href="/toms">
            TOMs
          </a>
          , der mit Vertragsschluss elektronisch einbezogen wird. Bei Widersprüchen zu diesen AGB
          geht der AVV für die Auftragsverarbeitung vor.
        </p>
      </LegalSection>

      <LegalSection title="§ 17 Verfügbarkeit, Wartung, Änderungen">
        <p>
          Der Anbieter bemüht sich um eine hohe Verfügbarkeit, schuldet jedoch ohne gesonderte
          Vereinbarung keine bestimmte Verfügbarkeitsquote (kein SLA). Wartungsarbeiten werden nach
          Möglichkeit angekündigt. Der Anbieter darf Funktionen weiterentwickeln, ändern oder
          ersetzen, soweit der vertragliche Kernnutzen erhalten bleibt und dies für den Kunden
          zumutbar ist.
        </p>
      </LegalSection>

      <LegalSection title="§ 18 Drittanbieter-Schnittstellen">
        <p>
          Der Anbieter hat keinen Einfluss auf Verfügbarkeit, Preisgestaltung, Nutzungsbedingungen
          und Ergebnisse der eingesetzten Drittdienste. Entfällt ein Drittdienst, darf der Anbieter
          ihn durch einen gleichwertigen Dienst ersetzen.
        </p>
      </LegalSection>

      <LegalSection title="§ 19 Support">
        <p>
          Support erfolgt schriftlich in deutscher Sprache per E-Mail bzw. über die im Produkt
          bereitgestellten Kanäle zu üblichen Geschäftszeiten. Reaktionszeiten werden nur bei
          gesonderter Vereinbarung zugesichert.
        </p>
      </LegalSection>

      <LegalSection title="§ 20 Rechte des Anbieters an AUTO3">
        <p>
          Sämtliche Rechte an der Software, an Oberflächen, Vorlagen, Prompt-Systemen, Datenbanken
          und Marken verbleiben beim Anbieter bzw. seinen Lizenzgebern. Der Kunde erhält ein
          einfaches, nicht übertragbares, auf die Vertragsdauer beschränktes Nutzungsrecht.
          Reverse Engineering, Weiterverkauf oder Bereitstellung an Dritte außerhalb des
          vereinbarten Umfangs sind unzulässig.
        </p>
      </LegalSection>

      <LegalSection title="§ 21 Vertraulichkeit">
        <p>
          Die Parteien behandeln vertrauliche Informationen der jeweils anderen Partei vertraulich
          und nutzen sie nur zu Vertragszwecken. Die Pflicht gilt über das Vertragsende hinaus fort,
          soweit ein berechtigtes Geheimhaltungsinteresse besteht.
        </p>
      </LegalSection>

      <LegalSection title="§ 22 Gewährleistung">
        <p>
          Es gelten die gesetzlichen Regelungen des Mietrechts für die Überlassung von Software zur
          Nutzung über das Internet. Die verschuldensunabhängige Haftung nach § 536a Abs. 1 Alt. 1
          BGB für Mängel, die bereits bei Vertragsschluss vorhanden waren, ist ausgeschlossen.
          Unerhebliche Beeinträchtigungen der Tauglichkeit bleiben außer Betracht.
        </p>
      </LegalSection>

      <LegalSection title="§ 23 Haftung">
        <p>Der Anbieter haftet unbeschränkt</p>
        <LegalList
          items={[
            'bei Vorsatz und grober Fahrlässigkeit,',
            'für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit,',
            'nach zwingenden gesetzlichen Vorschriften, insbesondere dem Produkthaftungsgesetz, sowie im Umfang übernommener Garantien.',
          ]}
        />
        <p>
          Bei einfacher Fahrlässigkeit haftet der Anbieter nur für die Verletzung wesentlicher
          Vertragspflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt
          erst ermöglicht und auf deren Einhaltung der Kunde regelmäßig vertrauen darf. In diesem
          Fall ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Eine
          weitergehende Haftung besteht nicht.
        </p>
        <p>
          Der Kunde bleibt für regelmäßige, dem Risiko angemessene Sicherung seiner Daten
          verantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="§ 24 Sperrung von Zugängen">
        <p>
          Der Anbieter kann Zugänge vorübergehend sperren, wenn ein begründeter Verdacht auf einen
          erheblichen Verstoß gegen diese AGB, auf rechtswidrige Nutzung oder auf eine Gefährdung
          der Systemsicherheit besteht oder ein erheblicher Zahlungsverzug vorliegt. Die Sperrung
          hat verhältnismäßig zu erfolgen; der Kunde wird informiert und erhält, soweit möglich und
          zumutbar, Gelegenheit zur Abhilfe.
        </p>
      </LegalSection>

      <LegalSection title="§ 25 Änderungen der Preise und dieser AGB">
        <p>
          Änderungen dieser AGB oder der Preise werden dem Kunden mindestens sechs Wochen vor
          Wirksamwerden in Textform mitgeteilt. Der Kunde kann der Änderung bis zum Wirksamwerden
          widersprechen; in diesem Fall kann jede Partei den Vertrag zum Zeitpunkt des
          Wirksamwerdens kündigen. Einseitige Änderungen, die den Kern der Leistung zulasten des
          Kunden verschieben, sind ausgeschlossen. Laufende, bereits bezahlte Zeiträume bleiben
          unberührt.
        </p>
      </LegalSection>

      <LegalSection title="§ 26 Höhere Gewalt">
        <p>
          Ereignisse höherer Gewalt, die die Leistungserbringung erheblich erschweren oder unmöglich
          machen – etwa Naturereignisse, Krieg, Streik, behördliche Maßnahmen, großflächige Netz-
          oder Stromausfälle oder Ausfälle wesentlicher Drittdienste – befreien die betroffene
          Partei für die Dauer der Störung von ihren Leistungspflichten.
        </p>
      </LegalSection>

      <LegalSection title="§ 27 Abtretung">
        <p>
          Der Kunde darf Rechte aus diesem Vertrag nur mit vorheriger Zustimmung des Anbieters
          abtreten; § 354a HGB bleibt unberührt. Der Anbieter darf den Vertrag im Rahmen einer
          Unternehmens- oder Betriebsübertragung auf einen Rechtsnachfolger übertragen.
        </p>
      </LegalSection>

      <LegalSection title="§ 28 Anwendbares Recht und Gerichtsstand">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
          Ausschließlicher Gerichtsstand für alle Streitigkeiten ist Hanau, soweit der Kunde
          Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
          Sondervermögen ist und kein ausschließlicher gesetzlicher Gerichtsstand besteht.
        </p>
      </LegalSection>

      <LegalSection title="§ 29 Schlussbestimmungen">
        <p>
          Sollten einzelne Bestimmungen unwirksam oder undurchführbar sein oder werden, bleibt die
          Wirksamkeit der übrigen Bestimmungen unberührt. An die Stelle der unwirksamen Bestimmung
          treten die gesetzlichen Vorschriften. Änderungen und Ergänzungen bedürfen der Textform.
        </p>
        <p className="text-xs">
          Stand: {LEGAL.versionDate} · Version {LEGAL_VERSIONS.agb}. Compliance-orientierte Fassung;
          eine abschließende anwaltliche Prüfung steht aus.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
