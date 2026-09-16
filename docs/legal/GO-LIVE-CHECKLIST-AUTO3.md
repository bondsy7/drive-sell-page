# Go-Live-Checkliste AUTO3 (Stand 16.09.2026)

## A. Im Code erledigt

- [x] Rechtsseiten öffentlich erreichbar: /impressum, /datenschutz, /agb, /avv, /toms,
      /unterauftragsverarbeiter, /ki-transparenz – gemeinsames Layout, responsive,
      Title/Description/Canonical gesetzt.
- [x] Impressum nach § 5 DDG (kein TMG-Boilerplate, keine OS-Plattform).
- [x] Datenschutzerklärung AUTO3-spezifisch, Stand 16.09.2026, ohne Platzhalter.
- [x] Eigenständige B2B-SaaS-AGB (nicht die Agentur-AGB).
- [x] AVV, TOMs und Unterauftragsverarbeiter-Übersicht als Seiten und Repo-Dokumente.
- [x] B2B-only: Zielgruppe Unternehmer § 14 BGB, Mindestalter 18, Pflichtfeld Firma,
      nicht vorausgewählte Pflicht-Checkbox mit AGB-Link, Datenschutz nur als Hinweis.
- [x] Google-OAuth im Registrierungsmodus bis zur Bestätigung gesperrt; bestehender
      Login unverändert nutzbar.
- [x] Beweissichere Erfassung in `legal_acceptances` (Version `2026-09-16`, Firma,
      Zeitstempel, ohne IP) + Nachhol-Gate für Bestandskonten.
- [x] Consent-Banner mit gleichwertigen Optionen, Detaileinstellungen, Footer-Link
      „Cookie-Einstellungen“, Version `2026-09-16`, erneute Abfrage bei Versionswechsel.
- [x] Google Consent Mode V2 (Basic): Defaults `denied`, kein Google-Request vor
      Einwilligung, Tags nur dynamisch bei gesetzter Umgebungs-ID, Widerruf mit Update
      auf `denied` und sauberem Reload.
- [x] Append-only `consent_records` (ohne IP), RLS: eigene Datensätze bzw. Admin.
- [x] Marketing-Attribution wird erst nach Marketing-Einwilligung persistiert.
- [x] Keine Remote-Google-Fonts (System-Font-Stack).
- [x] Pricing netto zzgl. USt., Verlängerung/Kündigung transparent, Legal-Links am Checkout.
- [x] `create-checkout` mit serverseitiger Price-ID-Allowlist.
- [x] `stripe-webhook` auf `basis` vereinheitlicht (`prod_Ukduqj0YRUxMYt`, 1000 Credits),
      alte starter/pro/enterprise-Mappings entfernt.
- [x] KI-Transparenzseite mit Hinweis auf Grenzen maschinenlesbarer Kennzeichnung.

## B. Extern zu prüfen / zu konfigurieren

- [ ] GA4 Measurement-ID setzen (`VITE_GA4_MEASUREMENT_ID`) und Datenaufbewahrung im
      GA4-Konto auf 14 Monate stellen.
- [ ] Google Ads ID (`VITE_GOOGLE_ADS_ID`) und ggf. Conversion-Label festlegen.
- [ ] Consent Mode mit dem Google Tag Assistant verifizieren.
- [ ] Enhanced Conversions bewusst deaktiviert lassen, bis gesondert geprüft.
- [ ] Google Gemini: kostenpflichtiger Dienst/Billing für den EWR bestätigen.
- [ ] DPA/AVV accountseitig prüfen: OpenAI, Google, Supabase, Lovable, Stripe, Resend.
- [ ] Supabase: konkrete Datenregion des Produktivprojekts feststellen und dokumentieren.
- [ ] OutVin: Vertrag, Datenschutzstatus, Rolle und Region klären, bis dahin keine
      personenbezogenen VIN-Daten produktiv übermitteln.
- [ ] Unterauftragsverarbeiter-Liste nach Vertragsklärung aktualisieren.
- [ ] Rechte/Lizenzen an Herstellerschriften, Herstellerlogos und DEKRA-Asset prüfen.
- [ ] Verzeichnis von Verarbeitungstätigkeiten, Incident-Prozess und DSB-Pflicht intern klären.
- [ ] Cookie-/Tracking-Scan der Produktivdomain nach Go-Live.
- [ ] Anwaltliche Endprüfung aller Texte.
- [ ] `subscription_plans` in der Datenbank prüfen: nur Slug `basis` aktiv, alte
      starter/pro/enterprise-Einträge deaktivieren (nicht blind per Code geändert).
- [ ] Öffentliche Storage-Buckets: Medien, die nicht zur Veröffentlichung bestimmt sind,
      auf private Buckets/Signed URLs umstellen (offener Punkt, um Social Publishing
      nicht zu brechen).
- [ ] OpenAI Files: automatisierten Lösch-/Ablaufprozess einführen (offen).
