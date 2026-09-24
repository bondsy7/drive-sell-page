# Paid-Funnel: genaues Ads-Tracking und Lead-Bearbeitung in autohaus.ai

Ziel laut euren Unterlagen: Jeder Werbeklick soll bis zur gewonnenen Lizenz nachvollziehbar sein. Dafür braucht ihr kein externes CRM, die Bearbeitung läuft im Adminbereich.

```text
Anzeige -> Landingpage -> Test gestartet -> Lead -> Kontakt -> Demo -> SQL -> Angebot -> Lizenz gewonnen/verloren
```

## Was heute schon da ist
- Landingpages `/autohaus-fahrzeugbilder` und `/autohaus-marketing`, Testformular `/fahrzeug-testen`, Danke-Seite mit Demo-Wunsch, Admin-Liste `/admin/b2b-leads` mit Filter und CSV.
- Erfasst werden UTM, gclid, msclkid, fbclid und LinkedIn-ID (nur First-Touch). Consent Mode ist vorhanden.
- Lücken: Der Demo-Wunsch wird fälschlich als „Demo gebucht“ gespeichert. Es gibt keine Funnel-Ereignisse, keine Statuszeitpunkte, keinen Verantwortlichen, keinen Lizenz- oder Vertragswert und keine Google-Ads-Rückmeldung.

## 1. Formular leichter machen (2 Schritte)
- **Schritt 1 (Test starten):** geschäftliche E-Mail, Firma, Ziel, Fahrzeugbild. Mit dem Absenden entsteht der Lead.
- **Schritt 2 (Angaben ergänzen):** Name, Rolle, Volumen, Standorte, Website, Telefon, Notiz. Diese Angaben ergänzen denselben Lead und erhöhen den Lead-Score.
- Klare Hinweise: was mit dem Bild passiert und wann wir uns melden.

## 2. Demo richtig trennen
- „Demo gewünscht“ wird nur als Wunsch gespeichert.
- „Demo gebucht“ gilt erst, wenn ein Termin gesetzt ist. Den Termin tragt ihr im Admin ein (Datum und Uhrzeit). Eine Kalender-Selbstbuchung kann später dazukommen.
- Auf `/autohaus-marketing` gibt es einen zweiten Weg für Gruppen: einen kurzen Prozesscheck mit 4 Feldern, ohne Upload.

## 3. Ereignis-Tracking (nur mit Einwilligung)
- Ereignisse: `page_view`, `cta_click`, `form_start`, `vehicle_test_started`, `generate_lead` (nur bei erfolgreichem Absenden), `demo_requested`, `demo_booked`.
- Aus den Statuswechseln im Admin entstehen zusätzlich: `working_lead`, `qualify_lead`, `close_convert_lead`, `close_unconvert_lead`.
- An Google gehen nie E-Mail, Telefon, Firma, VIN oder Notizen. Ohne Einwilligung geht nichts an Google.
- Die Google-Ads-Conversion „Lead“ wird genau einmal pro Lead gezählt.

## 4. Lead-Board im Admin erweitern
- Neue Felder: Verantwortlicher, nächster Schritt mit Datum, Verlustgrund, Angebot/Opportunity, Lizenzmenge, Netto-Vertragswert.
- Neue Status: Neu, Validiert, Kontaktiert, Demo gewünscht, Demo gebucht, Demo stattgefunden, SQL, Angebot, Gewonnen, Verloren. Bei jedem Wechsel wird der Zeitpunkt automatisch gespeichert.
- Filter nach Kampagne, Anliegen, Status und Monat.
- Kennzahlen oben: Leads, SQL, Demos, Angebote, gewonnene Lizenzen, Pipelinewert, jeweils nach Kampagne.
- CSV für den wöchentlichen Offline-Import in Google Ads: gclid/gbraid/wbraid, Conversion-Name, Zeitpunkt, Wert.
- Warnung bei Leads ohne datierten nächsten Schritt.

## 5. Attribution vervollständigen
- Zusätzlich `gbraid` und `wbraid` erfassen und neben dem First-Touch auch den Last-Touch speichern.

## Von euch benötigt (blockiert nur die Live-Messung)
- GA4-Mess-ID (G-…), Google-Ads-ID (AW-…) und das Conversion-Label für „Lead“. Ohne diese Angaben wird alles gebaut und intern gezählt, Google empfängt aber noch nichts.
- Datenschutzerklärung: GA4 und Google Ads mit Zweck und Empfänger ergänzen. Das ist Teil der Umsetzung.

## Technische Details
- Migration `b2b_marketing_leads`: `owner`, `validated_at`, `contacted_at`, `demo_requested_at`, `demo_booked_at`, `demo_held_at`, `sql_at`, `proposal_at`, `won_at`, `lost_at`, `next_step_date`, `next_step`, `lost_reason`, `opportunity_id`, `license_qty`, `net_contract_value`, `gbraid`, `wbraid`, `last_touch jsonb`, `step2_completed_at`.
- Trigger setzt die `*_at`-Zeitstempel beim Statuswechsel.
- Neue Tabelle `marketing_events` (event_name, event_id unique, lead_id, session_id, page, utm, consent_state, metadata jsonb) mit GRANT und RLS: Insert über eine Edge Function, Lesen nur für Admins.
- `src/lib/funnel-tracking.ts` enthält `trackFunnelEvent`. Es nutzt `trackAnalyticsEvent`/`trackGoogleAdsConversion` aus `consent.ts`, arbeitet mit event_id-Dedup und filtert personenbezogene Daten heraus.
- `submit-b2b-lead` wird für Schritt 1 gelockert. Neue Function `update-b2b-lead-step2` (per Lead-Token). `request-b2b-demo` setzt `demo_requested` statt `demo_booked`.
- Admin-Statuswechsel schreiben in `marketing_events`. Für Google gilt diese Stufe über den CSV-Offline-Import, nicht über den Browser.
- Nicht betroffen: Generator, Credits, Stripe, Auth.
