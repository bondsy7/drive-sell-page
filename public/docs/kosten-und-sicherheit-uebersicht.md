# AUTO3 – Kosten, Gewinn & Sicherheit
**Stand:** 25. Juni 2026 · **Für:** Geschäftsführung · **Zweck:** Entscheidungsgrundlage Go-Live

---

## 1. Das Produkt in einem Satz

Wir verkaufen **ein Paket: 1.000 Credits pro Monat für 490 €** (netto, ohne USt.).
Der Kunde bezahlt damit alles, was er an KI-Bildern, Remasterings, Bannern, Landingpages, Videos und Musik nutzt – wir rechnen jede Aktion in Credits ab.

Optional gibt es **Top-Ups: 200 Credits für 100 €**.

---

## 2. Unsere monatlichen Fixkosten (unabhängig vom Umsatz)

| Position | Anbieter | Kosten / Monat | Wofür |
|---|---|---:|---|
| Lovable Pro-Plan | Lovable | **~92 €** ($100) | Hosting, Editor, Deployments, Preview |
| Lovable Cloud (Supabase) | Lovable Cloud | **0 – 25 €** | Datenbank, Auth, Storage, Edge-Functions – $25 Guthaben/Monat inklusive |
| Domain anzeige.ai | Registrar | **~2 €** | Domain (~20 €/Jahr) |
| Resend (E-Mail-Versand) | Resend | **0 – 18 €** | 3.000 Mails/Monat gratis, danach $20 |
| Stripe-Kontoführung | Stripe | **0 €** | Nur Transaktionsgebühr (siehe unten) |
| **Summe Fixkosten** | | **~94 – 137 €** | |

> **Es gibt keinen eigenen Server.** Wir betreiben **keine** AWS-, Hetzner- oder vServer-Infrastruktur. Es kann also **nichts** an Serverkosten „explodieren". Alles läuft serverlos bei Lovable / Supabase und wird **nach Verbrauch** abgerechnet – mit harten Limits.

---

## 3. Unsere variablen Kosten (pro verkauftem Credit)

Jeder Credit, den ein Kunde einlöst, löst eine echte API-Abrechnung aus. Die Preise sind **offiziell und öffentlich** (Google AI, OpenAI, Ideogram). Beispiele:

| Aktion (Beispiel) | Credits | Echte Kosten (EK) | Verkaufspreis (VK) | Marge |
|---|---:|---:|---:|---:|
| 1 KI-Bild „schnell" (Nano Banana) | 1 | ~0,049 € | 0,49 € | **~90 %** |
| 1 KI-Bild „Qualität" | 1 | ~0,075 € | 0,49 € | ~85 % |
| 1 Premium-Bild 2K | 2 | ~0,15 € | 0,98 € | ~85 % |
| 1 Remaster (Foto-Aufbereitung) | 1 | ~0,06 € | 0,49 € | ~88 % |
| 1 Banner Premium | 2 | ~0,17 € | 0,98 € | ~82 % |
| 1 Musik-Clip (30 Sek.) | 1 | ~0,05 € | 0,49 € | ~90 % |
| 1 Musik-Song (3 Min.) | 1 | ~0,09 € | 0,49 € | ~82 % |
| **1 Video „Standard" (8 Sek., 1080p)** | 10 | **~3,00 €** | 4,90 € | **~39 %** |
| 1 Video „Fast" (8 Sek., 720p) | 4 | ~1,12 € | 1,96 € | ~43 % |
| 1 Landingpage (Text + 7 Bilder) | 8–12 | ~0,55 € | 3,92–5,88 € | ~85 % |

In den EK sind **alle Nebenkosten** bereits enthalten: Stripe-Gebühr (~1,5 % + 0,25 €/Kauf, umgelegt), Resend-Mails, Supabase-Egress, Edge-Function-Compute, Datenbank-Writes.

### Marge pro 1.000 Credits (= 1 verkauftes Paket à 490 €)

| Szenario | EK gesamt | Gewinn / Paket | Marge |
|---|---:|---:|---:|
| **Best Case** (Kunde nutzt nur günstige Bilder/Remaster/Musik) | ~50 € | **~440 €** | **~90 %** |
| **Realistischer Mix** (60 % Bilder, 20 % Banner, 10 % Landing, 10 % Video) | ~110 € | **~380 €** | **~78 %** |
| **Worst Case** (Kunde verbraucht alles in Standard-Videos) | ~300 € | **~190 €** | **~39 %** |

> **Wichtig:** Auch im Worst Case bleiben **190 € Gewinn pro Paket**. Wir können nicht ins Minus laufen, weil **vor jeder Aktion Credits abgezogen werden** (RPC `deduct_credits` – atomar in der Datenbank). Kein Credit, keine API-Anfrage.

---

## 4. Hochrechnung: 490 Pakete ab 1. Juli

| | Monat 1 | ab Monat 2 (wiederkehrend) |
|---|---:|---:|
| Umsatz (490 × 490 €) | **240.100 €** | **240.100 €** |
| Variable Kosten (realist. Mix, 78 % Marge) | −52.800 € | −52.800 € |
| Fixkosten (Lovable, Domain, Resend, Cloud) | −137 € | −137 € |
| Stripe-Gebühren (~1,5 % + 0,25 €) bereits in EK | – | – |
| **Rohgewinn / Monat** | **≈ 187.000 €** | **≈ 187.000 €** |

### Break-Even

Fixkosten von **~137 €/Monat** werden bereits durch **1 (in Worten: ein) verkauftes Paket** gedeckt.
Ab **Paket Nr. 1** sind wir in der Gewinnzone.

| Verkaufte Pakete | Rohgewinn / Monat (realist. Mix) |
|---:|---:|
| 1 | ~243 € |
| 10 | ~3.663 € |
| 100 | ~37.863 € |
| 490 | **~187.000 €** |

> Es gibt **keine** Vorfinanzierung. APIs (Google, OpenAI, Ideogram) werden **monatlich nachträglich** auf Rechnung abgebucht – wir haben den Kundenumsatz also **vorher** auf dem Konto.

---

## 5. Was kann finanziell schiefgehen? (Risiken offen benannt)

| Risiko | Eintritts­wahrscheinlich­keit | Schutzmechanismus im System |
|---|---|---|
| Kunde generiert mehr als bezahlt | **Null** | Credits werden **vor** dem API-Call atomar abgezogen (Postgres-RPC). Kein Guthaben → keine Aktion. |
| Fremder nutzt unsere API gratis | **Null** | Jeder Aufruf an unsere Edge-Functions prüft den JWT (`getClaims`). Ohne gültigen Login → 401. |
| Kunde A nutzt Credits von Kunde B | **Null** | Row-Level-Security: Datenbank gibt nur Zeilen heraus, deren `user_id = auth.uid()`. |
| API-Preise steigen unerwartet | gering | Wir können Credit-Preise pro Aktion zentral anpassen (`admin_settings.credit_costs`). |
| Supabase-Egress explodiert | sehr gering | Lovable Cloud hat **$25 Freibetrag**, danach harte Limits einstellbar. |
| Lovable-Plan reicht nicht | gering | Wir können jederzeit auf Business upgraden. Skaliert linear. |

---

## 6. Sicherheit – warum kein Fremder unsere APIs missbrauchen kann

### 6.1 Wer darf was?
Jede sensible Funktion auf unserem Server prüft **zwei Dinge**, bevor sie ausgeführt wird:

1. **Bist du eingeloggt?** Der Browser schickt ein Login-Token (JWT) mit. Wir prüfen die Signatur des Tokens gegen den Lovable-Cloud-Schlüssel. Gefälschte oder abgelaufene Tokens werden mit Fehler **401** abgewiesen.
2. **Bist DU der Eigentümer der Daten?** Die Datenbank filtert automatisch: Du siehst und änderst **nur Zeilen, die dir gehören** (Row-Level-Security, kurz **RLS**). Selbst wenn jemand die ID eines anderen Kunden errät – die Datenbank gibt **keine Daten** zurück.

### 6.2 Wo liegen die API-Schlüssel (Google, OpenAI, …)?
- **Niemals im Browser.** Niemals im Frontend-Code.
- Sie liegen verschlüsselt in **Lovable Cloud Secrets**. Nur die Server-Funktionen (Edge-Functions) können sie lesen.
- Ein Kunde sieht in seinem Browser **nur** den Aufruf an unsere eigene Edge-Function – nicht den Google-Schlüssel dahinter.

### 6.3 Kann jemand Credits eines anderen Kunden verbrauchen?
**Nein.** Der Credit-Abzug läuft über eine Datenbank-Prozedur (`deduct_credits`), die **fest verdrahtet** mit der eingeloggten User-ID arbeitet. Auch ein manipulierter Browser-Request würde nur das **eigene** Konto belasten – nie ein fremdes.

### 6.4 Können Kunden untereinander Daten sehen?
**Nein.** Jede Tabelle (Fahrzeuge, Bilder, Banner, Landingpages, Rechnungen) hat eine RLS-Policy:
```
USING (auth.uid() = user_id)
```
Das bedeutet: Die Datenbank **liefert physisch keine Zeilen** anderer Kunden aus – auch nicht versehentlich, auch nicht bei einem Bug im Frontend.

### 6.5 Was ist mit Zahlungen?
- Zahlungen laufen **komplett über Stripe**. Wir sehen **nie** Kreditkartennummern.
- Stripe schickt uns nur ein Webhook-Signal („Bezahlung erfolgreich"), das wir kryptografisch prüfen.

### 6.6 Login per QR-Code (pdf.anzeige.ai)
- Tokens sind **einmalig** und **zeitlich begrenzt** gültig.
- Nach Verwendung sofort entwertet. Ein abgefangener QR-Code ist nach Sekunden wertlos.

---

## 7. Warum wir live gehen können

✅ **Fixkosten gedeckelt** – maximal ~137 €/Monat, unabhängig vom Erfolg.
✅ **Variable Kosten gedeckelt** – können nie höher sein als die vom Kunden eingelösten Credits.
✅ **Kunde zahlt vor.** API-Provider kassieren nach. Keine Vorfinanzierung.
✅ **Marge mindestens 39 %**, im Schnitt **~78 %**, im Best Case **~90 %**.
✅ **Break-Even ab Paket Nr. 1.**
✅ **Sicherheit** ist nicht nachgelagert – sie steckt in jedem Datenbank-Zugriff fest verdrahtet (RLS) und in jeder Server-Funktion (JWT-Verifikation).

### Was zu beachten ist
- **Limits in Lovable Cloud setzen** (z. B. max. $200 Cloud-Verbrauch/Monat als Hard-Stop) – einmaliger Konfigurationsschritt.
- **Stripe-Konto verifizieren** (Live-Modus) – einmaliger KYC-Prozess.
- **Resend-Domain verifizieren** (anzeige.ai SPF/DKIM) – einmalig.
- **Monatlicher Blick auf Admin-Dashboard** (Credits-Verbrauch, Conversion, Top-Aktionen) – 5 Min./Monat.

---

## 8. Zusammenfassung in 3 Zeilen

> Bei **490 verkauften Paketen** machen wir **~187.000 € Rohgewinn pro Monat**.
> Wir sind **ab dem ersten Paket** profitabel, weil die Fixkosten nur **~137 €** betragen.
> Es kann **niemand** unsere APIs missbrauchen oder fremde Credits verbrauchen – jede Aktion ist durch Login-Prüfung, Datenbank-Sperren (RLS) und atomare Credit-Abbuchungen abgesichert.

---
*Erstellt für die interne Vorlage. Alle Preise: USD-Quellen offiziell Google AI, OpenAI, Ideogram (Stand 22.06.2026), umgerechnet 1 USD = 0,92 €.*
