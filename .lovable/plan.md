

## Vorschläge für neue Admin-Module

Basierend auf einer gründlichen Analyse aller Tabellen, Edge Functions, und bestehenden Features gibt es folgende sinnvolle Ergänzungen:

---

### 1. Edge Function Logs & Health Monitor
**Warum:** Es gibt 20+ Edge Functions, aber keine Übersicht ob sie funktionieren, wie lange sie brauchen, oder ob sie Fehler werfen.
- Live-Statusübersicht aller Edge Functions (letzter Aufruf, Erfolgsrate)
- Fehler-Log mit Filterung nach Funktion und Zeitraum
- Durchschnittliche Antwortzeiten pro Funktion
- Alert-Badges bei hohen Fehlerquoten

### 2. Storage-Übersicht & Bereinigung
**Warum:** 6 Storage Buckets (vehicle-images, banners, logos, sales-knowledge, etc.) wachsen ständig, aber es gibt keine Einsicht in Speicherverbrauch oder verwaiste Dateien.
- Speicherverbrauch pro Bucket (Anzahl Dateien, Gesamtgröße)
- Verwaiste Dateien erkennen (z.B. Bilder ohne zugehöriges Projekt)
- Massen-Bereinigung alter/ungenutzter Assets
- Top-Nutzer nach Speicherverbrauch

### 3. Pipeline & Job-Monitor
**Warum:** `image_generation_jobs` und `spin360_jobs` laufen im Hintergrund. Wenn etwas hängt oder fehlschlägt, gibt es keine Admin-Sicht darauf.
- Aktive/wartende/fehlgeschlagene Jobs aller Nutzer
- Job-Details mit Status, Fehlermeldung, Dauer
- Möglichkeit hängende Jobs manuell abzubrechen oder neu zu starten
- Statistik: durchschnittliche Verarbeitungszeit, Erfolgsquote

### 4. E-Mail-Outbox & Zustellungs-Monitor
**Warum:** `sales_email_outbox` enthält alle E-Mails mit Status (queued/sending/sent/failed), aber nur der jeweilige Nutzer sieht seine eigenen.
- Globale Übersicht aller E-Mails (Status-Verteilung, Fehlerquote)
- Fehlgeschlagene E-Mails mit Error-Messages
- Resend-Aktion für fehlgeschlagene Mails
- Tägliches Versandvolumen als Chart

### 5. Probefahrten & Terminübersicht
**Warum:** `test_drive_bookings` und `dealer_availability` existieren, aber Admins haben keinen Überblick über Buchungsvolumen und Auslastung.
- Gesamtanzahl Buchungen, Status-Verteilung (pending/confirmed/completed/cancelled)
- Kalenderansicht aller Termine (aggregiert)
- Top-Händler nach Buchungsvolumen
- Durchschnittliche Vorlaufzeit (Buchung → Termin)

### 6. Conversion-Funnel / Nutzungsanalyse
**Warum:** Die Daten sind da (Registrierung → Projekt erstellt → Bilder generiert → Landing Page → Lead erhalten), aber es fehlt eine Funnel-Visualisierung.
- Registrierung → Erstes Projekt → Erste Bildgenerierung → Erster Lead
- Drop-off-Raten pro Schritt
- Durchschnittliche Time-to-Value (Registrierung bis erster Lead)
- Aktive vs. inaktive Nutzer (letzte Aktivität)

### 7. Abo- & Umsatz-Dashboard
**Warum:** `user_subscriptions` + Stripe-Daten existieren, aber das Dashboard zeigt nur "Aktive Abos" als Zahl. Keine MRR, Churn, Plan-Verteilung.
- MRR (Monthly Recurring Revenue) aus `subscription_plans` Preisen
- Plan-Verteilung (Pie Chart: Free vs. Starter vs. Pro vs. Enterprise)
- Churn-Rate (gekündigte Abos / aktive Abos)
- Credit-Kaufhistorie und Zusatzumsatz

---

### Empfohlene Prioritätsreihenfolge

| Prio | Modul | Aufwand | Nutzen |
|------|-------|---------|--------|
| 1 | Pipeline & Job-Monitor | Mittel | Betriebskritisch |
| 2 | E-Mail-Outbox Monitor | Klein | Fehler sofort sehen |
| 3 | Abo- & Umsatz-Dashboard | Mittel | Business-Entscheidungen |
| 4 | Storage-Übersicht | Mittel | Kostenkontrolle |
| 5 | Conversion-Funnel | Mittel | Wachstumsanalyse |
| 6 | Edge Function Health | Klein | Stabilität |
| 7 | Probefahrten-Übersicht | Klein | Nice-to-have |

### Technische Umsetzung

Alle Module nutzen die bestehende Infrastruktur:
- Daten kommen direkt aus Supabase-Tabellen (RLS erlaubt Admins bereits Lesezugriff auf die meisten Tabellen)
- Stripe-Daten über die bestehende `admin-stripe` Edge Function
- Neue Admin-Seiten als lazy-loaded Routes unter `/admin/*`
- Einheitliches Design mit den bestehenden Card/Chart-Komponenten aus `AdminDashboard`

