# AUTO3 – Rechtliche Umsetzung (Stand 16.09.2026)

AUTO3 ist ein Produkt der Breadcrumb Marketing GmbH, Corniceliusstraße 8, 63450 Hanau.
Geschäftsführer: Leonhard Paul · Amtsgericht Hanau HRB 91223 · USt-IdNr. DE 237 914 287.

Alle Texte sind Standard-Informations- und Vertragsentwürfe. Sie ersetzen keine
anwaltliche Prüfung und enthalten bewusst keine technisch nicht belegbaren Zusagen.

## Versionen

| Gegenstand | Version |
| --- | --- |
| AGB / B2B-Bestätigung | `2026-09-16` (`LEGAL_VERSIONS.agb`) |
| Datenschutzerklärung | `2026-09-16` (`LEGAL_VERSIONS.privacy`) |
| Consent | `2026-09-16` (`LEGAL_VERSIONS.consent`) |
| Standdatum aller Seiten | 16.09.2026 (`LEGAL.versionDate`) |

Quelle: `src/lib/legal-config.ts`.

## Öffentliche Routen (ohne Login)

`/impressum`, `/datenschutz`, `/agb`, `/avv`, `/toms`, `/unterauftragsverarbeiter`,
`/ki-transparenz`. Gemeinsames Layout: `src/components/legal/LegalLayout.tsx`
(inkl. `usePageMeta` mit Title/Description/Canonical).

## B2B-only

- Angebot ausschließlich für Unternehmer i. S. d. § 14 BGB, juristische Personen des
  öffentlichen Rechts und öffentlich-rechtliche Sondervermögen; Mindestalter 18 Jahre.
- Registrierung (`src/pages/Auth.tsx`): Pflichtfelder Name, **Firma**, E-Mail, Passwort
  sowie nicht vorausgewählte Pflicht-Checkbox mit AGB-Link. Datenschutz ist ausdrücklich
  **keine** Einwilligung, sondern ein Hinweistext mit Link.
- Google-OAuth ist im Registrierungsmodus gesperrt, solange die Checkbox nicht gesetzt ist.
- Bestehende Accounts werden über `src/components/legal/LegalOnboardingGate.tsx` vor
  geschützten Bereichen einmalig zur Bestätigung geführt.
- Nachweis: Tabelle `legal_acceptances` (user_id, document, version, company_name,
  confirms_business_and_age, accepted_at). RLS: eigene Datensätze; Admin-Lesezugriff.
  Es wird bewusst **keine IP-Adresse** gespeichert.

## Consent / Google Consent Mode V2 (Basic)

- `src/lib/consent.ts`, `src/components/consent/ConsentManager.tsx`.
- Kategorien: Notwendig (immer aktiv), Analyse, Marketing – optionale Kategorien sind
  nicht vorausgewählt. Erste Ebene: „Alle akzeptieren“, „Nur notwendige“, „Einstellungen“.
- Consent-Defaults (`denied`) werden gesetzt, bevor ein Tag geladen werden darf.
  Ohne Einwilligung wird **kein** Google-Script geladen und kein Ping gesendet.
- States: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`.
- Widerruf: Update auf `denied`, Entfernen lokaler Kampagnendaten und sauberer Reload.
- IDs kommen ausschließlich aus Umgebungsvariablen: `VITE_GA4_MEASUREMENT_ID`
  (alternativ `VITE_GA_MEASUREMENT_ID`) und `VITE_GOOGLE_ADS_ID`. Ohne gesetzte Werte
  wird bewusst nichts geladen. Enhanced Conversions sind nicht implementiert.
- Protokoll: append-only Tabelle `consent_records` (consent_id, version, analytics,
  marketing, user_id falls angemeldet, user_agent gekürzt, created_at). Keine IP.
  RLS: Insert für alle, Lesen nur eigene Datensätze bzw. Admin. Kein Update/Delete.
- Attribution (`src/lib/funnel-attribution.ts`) wird erst bei Marketing-Einwilligung
  dauerhaft gespeichert.

## Footer

`src/components/legal/SiteFooter.tsx` verlinkt alle Rechtsseiten sowie
„Cookie-Einstellungen“ (öffnet den CMP-Dialog). Auch auf Login und Pricing eingebunden.

## Pricing / Checkout

- `/pricing`: „490 € netto/Monat zzgl. gesetzlicher USt.“ (1.000 Credits/Monat),
  Top-up „200 Credits – 100 € netto zzgl. gesetzlicher USt.“, Hinweis auf monatliche
  automatische Verlängerung und Kündigung zum Ende der laufenden Periode,
  Links zu AGB/Datenschutz/AVV. Kein irreführender Jahrespreis.
- `create-checkout`: serverseitige Allowlist, Abo nur mit
  `price_1Tl8cuP3eWRHEALNPuSwqIZe`, sonst 400 vor jedem Stripe-Aufruf.
- `stripe-webhook`: `PRODUCT_TO_PLAN` nur noch `prod_Ukduqj0YRUxMYt → basis`,
  `PLAN_CREDITS.basis = 1000`. Alte starter/pro/enterprise-Mappings entfernt.

## Zu prüfende Datenbankdaten

`subscription_plans` kann noch alte Slugs (starter/pro/enterprise) enthalten. Der Code
wurde **nicht** genutzt, um Produktionsdaten blind zu ändern. Vor Go-Live prüfen, dass
nur der Slug `basis` aktiv ist.

## Nicht verifizierbar

Vertragsstände (DPA/AVV, Regionen, Billing-Modus) externer Anbieter sind aus dem Code
nicht überprüfbar und in der Go-Live-Checkliste als offene externe Punkte geführt.
