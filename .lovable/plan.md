# Rechtssicheres B2B-Launch-Paket für AUTO3

Ziel: AUTO3 klar als reines Unternehmer-Angebot (B2B) aufstellen, alle Rechtsseiten bereitstellen, Consent-Management mit Google Consent Mode V2 vorbereiten und Preis-/Checkout-Texte rechtskonform formulieren – ohne bestehende Produktfunktionen, Integrationen oder Zahlungs-IDs anzufassen.

## 1. B2B-Only im Registrierungsweg

- Registrierung (`/auth`) erhält ein Pflichtfeld **Firmenname** (wird beim Anlegen des Profils in `company_name` gespeichert).
- Eine Pflicht-Checkbox: Bestätigung, als Unternehmer i. S. d. § 14 BGB zu handeln, mindestens 18 Jahre alt zu sein, und die AGB zu akzeptieren.
- Getrennt davon (ohne Zustimmungszwang) ein Hinweislink auf die Datenschutzerklärung.
- Öffentliche Seiten werden auf Formulierungen geprüft, die Privatkunden ansprechen, und auf Händler-/Unternehmeransprache umgestellt.

## 2. Rechtsseiten und Routen

Neu: `/impressum`, `/agb`, `/avv`, `/toms`, `/unterauftragsverarbeiter`. Die bestehende Platzhalter-Datenschutzseite wird durch eine vollständige Seite unter `/datenschutz` ersetzt. `/ki-transparenz` bleibt unverändert bestehen.

Alle Seiten: einheitliches lesbares Layout, mobil optimiert, Titel/Beschreibung/Canonical gesetzt, **indexierbar** (kein noindex). Inhalte werden als vollständige, aber klar als vom Betreiber zu prüfende Entwürfe eingesetzt; firmenspezifische Angaben (Firmierung, Anschrift, Registernummer, USt-ID, Vertretungsberechtigte, Kontakt, ggf. Datenschutzbeauftragter) bleiben als deutlich markierte Lücken, die Sie ausfüllen.

## 3. Einheitlicher Rechts-Footer

Eine wiederverwendbare Fußzeile mit Links zu Impressum, Datenschutz, AGB, AVV, TOMs, Unterauftragsverarbeiter, KI-Transparenz sowie einer funktionierenden Schaltfläche „Cookie-Einstellungen“. Eingebunden auf Startseite, Funnel-Seiten, Preise, Rechtsseiten und im eingeloggten Bereich.

## 4. Einwilligungsverwaltung (Consent Mode V2)

- Kategorien: Notwendig (immer aktiv), Analyse, Marketing – optionale Kategorien sind **nicht** vorausgewählt.
- Banner mit gleichwertigen Schaltflächen „Alle akzeptieren“ und „Nur notwendige“ plus „Einstellungen“ für die granulare Auswahl.
- Vor Einwilligung wird kein Analyse-/Marketing-Tag geladen und nichts übertragen.
- Standardzustand wird als „denied“ gesetzt und bei Zustimmung aktualisiert für: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`.
- Speicherung von Auswahl, Version und Zeitstempel lokal im Browser; jederzeit über den Footer änderbar oder widerrufbar. Keine Server-Protokollierung.
- Es sind aktuell **keine** Google-Analytics-/Ads-Kennungen im Projekt vorhanden. Wir bauen nur die Infrastruktur und dokumentieren, was zum späteren Anschluss fehlt.

## 5. Preise und Checkout

- Alle Preisangaben klar als Nettopreise für Unternehmer: „zzgl. gesetzlicher USt.“, Abrechnungszeitraum, automatische Verlängerung, Kündigung zum Ende der Laufzeit, enthaltene Credits, Gültigkeit der Credits.
- Vor dem Checkout-Button sichtbare Links zu AGB und Datenschutz.
- **Nicht** geändert werden Stripe-Preis-/Produkt-IDs, Secrets oder Abrechnungslogik.

### Erkannter Konflikt (nur melden, nicht ändern)
`src/lib/stripe-plans.ts` kennt heute ausschließlich das Paket „basis“ mit einer aktuellen Produkt-ID, während die Webhook-Zuordnung in `supabase/functions/stripe-webhook/index.ts` nur sechs alte Produkt-IDs auf „starter/pro/enterprise“ abbildet. Ein Kauf des heutigen Pakets würde dort als unbekanntes Produkt enden und die Credits womöglich nicht zuteilen. Das ist eine Abrechnungsfrage, kein Rechtstext – ich empfehle eine separate, gezielte Korrektur nach Abgleich mit den echten Stripe-Daten, nicht im Rahmen dieses Pakets.

## 6. Datenschutz- und Sicherheitsbefund

Ich erhebe im Rahmen dieses Pakets den Ist-Zustand und beschreibe ihn in Datenschutzerklärung, AVV und TOMs:

- Öffentlich lesbare Ablagen für Fahrzeugbilder, Banner und Logos. Öffentliche Adressen sind für Social-Media-Veröffentlichung und Export technisch nötig – daran wird nichts geändert. Beschrieben wird stattdessen, welche Daten öffentlich abrufbar sind, plus Hinweis auf schwer erratbare Pfade.
- Dateiuploads zu OpenAI und Google (Gemini) ohne durchgängig geregelte Löschung – wird als Auftragsverarbeitung benannt; eine technische Aufräumroutine wird nur als Empfehlung notiert, nicht jetzt gebaut.
- VIN-Abfragen bei externem Anbieter, Social-Media-Zugangsdaten, CRM- und E-Mail-Daten (Versanddienstleister), Zahlungsabwicklung – alle in Datenschutzerklärung und Unterauftragsverarbeiter-Liste aufgeführt.

Nur risikoarme Verbesserungen: keine Änderung an Speicher-Sichtbarkeiten oder Veröffentlichungswegen in diesem Schritt.

## 7. Technische Details

Neue Dateien (voraussichtlich):
- `src/pages/legal/{Impressum,Datenschutz,Agb,Avv,Toms,Unterauftragsverarbeiter}.tsx`
- `src/components/legal/LegalLayout.tsx`, `src/components/legal/SiteFooter.tsx`
- `src/components/consent/{ConsentBanner,ConsentSettingsDialog}.tsx`, `src/lib/consent.ts` (Speicherung, Version, `gtag`-Consent-Default/Update)

Geänderte Dateien:
- `src/App.tsx` (neue Routen, Consent-Banner global), `src/main.tsx` (Consent-Default vor allen Tags)
- `src/pages/Auth.tsx` (Firmenname, Unternehmer-/AGB-Checkbox)
- `src/pages/Pricing.tsx`, ggf. Checkout-Hinweistexte
- `src/pages/Landing.tsx`, `src/components/funnel/FunnelLayout.tsx` (gemeinsame Fußzeile)
- Entfernen/Ersetzen von `src/pages/funnel/DatenschutzPlatzhalter.tsx`
- `roadmap.md` (offene externe Punkte)

Keine Datenbankänderung nötig (`profiles.company_name` existiert bereits). Keine Änderungen an Pipeline, Remastering, Spin360, Admin oder Edge Functions.

## 8. Risiken und Annahmen

- Firmenspezifische Pflichtangaben (Anschrift, Register, USt-ID, Verantwortliche) liegen mir nicht vor – sie bleiben als markierte Lücken stehen.
- Die Rechtstexte sind sorgfältige Entwürfe und ersetzen keine anwaltliche Prüfung.
- Ein bestehendes Konto ohne Firmenname bleibt funktionsfähig; die neue Pflicht gilt für Neuregistrierungen.

## 9. In einem Bauschritt umsetzbar

Punkte 1–6 (Rechtsseiten, Footer, Consent-Infrastruktur, B2B-Registrierung, Preistexte, Metadaten) sind in einem Durchgang machbar. Nicht enthalten: Stripe-Zuordnungskorrektur, Speicher-Umstellungen, Löschroutinen für KI-Dateiuploads.

## 10. Was Code nicht leisten kann (extern zu klären)

Auftragsverarbeitungsverträge und Einstellungen bei: Lovable, Datenbank-/Hosting-Anbieter inkl. Speicherregion, Google Gemini (kostenpflichtige Nutzung, damit Eingaben nicht zum Training verwendet werden), OpenAI (Datennutzungseinstellungen), Stripe, Resend, VIN-Anbieter OutVin, Social-Plattformen. Ferner: echte Google-Analytics-/Ads-Kennungen samt Konfiguration, ein realer Cookie-Scan der Live-Seite, sowie Lizenznachweise für Schriften, Bilder und Hersteller-Logos.
