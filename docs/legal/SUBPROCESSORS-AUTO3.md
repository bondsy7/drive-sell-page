# Unterauftragsverarbeiter und weitere Empfänger – AUTO3

Stand: 16.09.2026 · Verantwortlich/Auftragsverarbeiter: Breadcrumb Marketing GmbH.
Grundlage ist die im Repository tatsächlich eingesetzte Infrastruktur. Der konkrete
Vertragspartner (Gesellschaft, Region) ergibt sich aus dem produktiven Account und ist
dort maßgeblich; er ist aus dem Code nicht belastbar feststellbar.

## 1. Unterauftragsverarbeiter (Art. 28 DSGVO)

| Anbieter | Zweck | Datenkategorien | Region / Mechanismus |
| --- | --- | --- | --- |
| Lovable | Bereitstellung, Build und Hosting der Web-Anwendung | Nutzungs-/Verbindungsdaten, ausgelieferte Inhalte | EU/USA möglich; DPA und Plan accountseitig zu prüfen |
| Supabase | Datenbank, Authentifizierung, Datei-Speicher, serverseitige Funktionen | Account-, Projekt-, Fahrzeug-, Medien-, Log- und CRM-Daten | Projektregion accountseitig zu prüfen; DPA/SCC zu verifizieren |
| Google (Gemini, Veo, Lyria, Gemini File API) | KI-gestützte Bild-, Video-, Audio- und Textverarbeitung, temporäre Dateiablage | Hochgeladene Fotos/PDFs, Prompts, Fahrzeugtexte | Global; Drittlandtransfer möglich, SCC/DPF-Status accountseitig zu prüfen |
| OpenAI (inkl. Files API) | KI-gestützte Bild-, Text- und Dokumentenverarbeitung | Hochgeladene Fotos/PDFs, Prompts, Fahrzeugtexte | Global; Drittlandtransfer möglich, DPA und Datennutzungseinstellungen zu prüfen |
| Resend | Versand operativer und vertriebsbezogener E-Mails | E-Mail-Adresse, Name, Nachrichteninhalt | EU/USA möglich; DPA zu prüfen |

## 2. Weitere Empfänger / rollenabhängig

| Anbieter | Zweck | Datenkategorien | Rolle / Hinweis |
| --- | --- | --- | --- |
| Stripe | Zahlungsabwicklung, Abonnements, Rechnungen | Name, E-Mail, Zahlungs- und Vertragsdaten | Teilweise eigenständig verantwortlich (Zahlungsverkehr, Betrugsprävention); DPA zu prüfen |
| Google Analytics 4 / Google Ads | Reichweiten- und Werbemessung – **nur nach Einwilligung** und nur bei gesetzter Kennung | Nutzungsdaten, Online-Kennungen | Derzeit keine Kennung hinterlegt; Rolle (gemeinsame Verantwortlichkeit bei Ads) vor Aktivierung klären |
| Meta (Instagram, Facebook) | Veröffentlichung von Inhalten auf Veranlassung des Kunden | Veröffentlichte Medien und Texte | Eigenständige Plattform/Empfänger, kein klassischer Unterauftragsverarbeiter |
| X | Veröffentlichung von Inhalten auf Veranlassung des Kunden | Veröffentlichte Medien und Texte | Eigenständige Plattform/Empfänger |
| OutVin (VIN-/Fahrzeugdatenabfrage, `lookup-vin`) | Ermittlung technischer Fahrzeugdaten zu einer FIN | FIN und daraus abgeleitete Fahrzeugdaten | **Weiterer Empfänger / Fachdienst.** Rolle, Vertrag und Region sind nicht verifizierbar und vor produktivem Einsatz zu klären |

## 3. Änderungsverfahren

Wesentliche neue oder ausgetauschte Unterauftragsverarbeiter werden Geschäftskunden
vorab in Textform oder durch Aktualisierung dieser Übersicht mitgeteilt. Kunden können
aus datenschutzrechtlichen Gründen innerhalb angemessener Frist widersprechen. Eine
automatisierte E-Mail-Benachrichtigung ist derzeit nicht eingerichtet.
