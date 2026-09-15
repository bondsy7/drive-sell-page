# AUTO3 – Rechtliche Go-Live-Checkliste

Stand: 15.09.2026 · AUTO3 ist ein Produkt der Breadcrumb Marketing GmbH.

Diese Liste unterscheidet zwischen dem, was im Code umgesetzt ist, und dem, was nur
außerhalb des Codes (Verträge, Konten, Konfiguration, anwaltliche Prüfung) erledigt
werden kann. Die im Produkt veröffentlichten Texte sind compliance-orientierte
Entwürfe – sie sind keine Garantie für Rechtskonformität.

## DONE IN CODE

- [x] Rechtsseiten öffentlich erreichbar, responsiv, indexierbar, mit Titel/Beschreibung/Canonical:
      `/impressum`, `/datenschutz`, `/agb`, `/avv`, `/toms`, `/unterauftragsverarbeiter`; `/ki-transparenz` unverändert.
- [x] Alter Datenschutz-Platzhalter entfernt und vollständig ersetzt.
- [x] Impressum nach § 5 DDG mit Firmen-, Kontakt-, Register- und USt-Daten; ohne TMG-/ODR-Altboilerplate.
- [x] Wiederverwendbarer `SiteFooter` (Impressum, Datenschutz, AGB, AVV, TOMs, Unterauftragsverarbeiter,
      KI-Transparenz, Cookie-Einstellungen) auf Landing, Pricing, Auth, Funnel-Seiten und Rechtsseiten.
- [x] Consent-Layer mit Basic Google Consent Mode V2: Kategorien Notwendig/Analyse/Marketing,
      keine Vorauswahl optionaler Kategorien, gleichwertige Buttons „Alle akzeptieren“/„Nur notwendige“,
      Einstellungen-Dialog, jederzeit über den Footer widerrufbar.
- [x] Consent-Default `denied` für `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`,
      gesetzt vor dem App-Start (`src/main.tsx`).
- [x] Vor Einwilligung wird kein Google-Script geladen und es werden keine Pings gesendet.
- [x] Speicherung von Auswahl, Version (`auto3-consent-2026-09-15`), Zeitstempel und zufälliger Consent-ID lokal.
- [x] Optionale Konfigurations-Hooks `VITE_GA_MEASUREMENT_ID` / `VITE_GOOGLE_ADS_ID`; ohne Wert passiert nichts.
      Es sind derzeit bewusst KEINE Google-IDs im Projekt hinterlegt.
- [x] Öffentliche Zielgruppenansprache B2B-only; „Privatpersonen“ entfernt.

## OPTIONALE HÄRTUNG (bewusst offen)

- [ ] Serverseitiges Einwilligungsprotokoll oder externes CMP als belastbarer Nachweis
      (aktuell nur lokale Speicherung; ohne IP-Adresse).
- [ ] OpenAI-Files-Lösch-/Ablaufprozess. Datei-IDs werden für die Wiederverwendung von Referenzen
      benötigt; eine pauschale Ablauffrist würde diese Wiederverwendung brechen. HOHE PRIORITÄT.
- [ ] Prüfung, welche öffentlich abrufbaren Medien ohne Veröffentlichungszweck auf signierte
      Links umgestellt werden können (Social Publishing benötigt öffentliche HTTPS-URLs und bleibt unverändert).
- [ ] Registrierung: serverseitig dokumentierte AGB-Annahme und Onboarding-Gate für OAuth-Neukonten
      (Tabelle `legal_acceptances` ist bereits additiv angelegt, UI-Anbindung steht aus).
- [ ] Preis-/Checkout-Texte ausdrücklich als Netto zzgl. USt. inkl. Laufzeit-/Kündigungshinweis.
- [ ] Stripe: Mapping des aktuellen Basis-Produkts im Webhook ergänzen und Preis-Allowlist im Checkout.

## MUST VERIFY EXTERNALLY

- [ ] **Lovable**: Auftragsverarbeitungsvertrag ist laut aktuellen Lovable-Bedingungen in den
      Business-/Enterprise-Plänen enthalten – Plan dieses Accounts prüfen, DPA abschließen und aufbewahren.
- [ ] **Supabase**: DPA abschließen; exakte Produktionsregion prüfen und ggf. eine EU-Region (z. B. Frankfurt) wählen.
      Die aktuelle Region wurde nicht verifiziert und wird in den Texten nicht behauptet.
- [ ] **Google Gemini/Veo/Lyria**: Nutzung als Paid Service mit aktivem Cloud Billing für den EWR-Client sicherstellen
      und den einschlägigen Google-DPA/Datenschutz-Zusatz abschließen.
- [ ] **OpenAI**: DPA abschließen; Datennutzungseinstellungen prüfen (API-Inhalte standardmäßig nicht für Training),
      Standard-Abuse-Monitoring kann Inhalte bis zu 30 Tage speichern; Modified Abuse Monitoring / Zero Data Retention
      auf Eignung prüfen; Files-Retention konfigurieren.
- [ ] **Stripe**: DPA und vertragsschließende Stripe-Einheit prüfen.
- [ ] **Google Analytics 4 / Google Ads**: echte Measurement-ID und Ads-ID, Conversion-Labels; GA4-Aufbewahrung
      auf ≤ 14 Monate setzen; Google-Signale/Werbepersonalisierung nur bei Bedarf; Validierung mit Tag Assistant,
      dass vor Einwilligung keine Requests erfolgen.
- [ ] **OutVin**: Vertrag, Datenschutzhinweise und Rolle (Auftragsverarbeiter oder eigenständig Verantwortlicher)
      klären, bevor personenbezogene VIN-Daten produktiv verarbeitet werden. OFFEN.
- [ ] **Meta (Instagram/Facebook) und X**: App-Berechtigungen, Plattformbedingungen und Nutzungsrechte prüfen.
- [ ] **Produktions-Cookie-/Netzwerk-Scan** der Live-Domain vor Schaltung bezahlter Kampagnen.
- [ ] **Lizenzen** für Schriften, Herstellerlogos, DEKRA-Logo, Szenen-/Beispielbilder und hochgeladene Markenassets.
- [ ] **Verzeichnis von Verarbeitungstätigkeiten (VVT)**, internes Vorfalls- und Löschkonzept, Schulung der Beteiligten.
- [ ] **Abschließende anwaltliche Prüfung** aller Texte vor produktivem Einsatz.
