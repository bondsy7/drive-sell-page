# Preismodell von autohaus.ai in AUTO3 übernehmen

## Teil A – Was bleibt an Gewinn übrig?

Grundlage: interne Einkaufskosten je Aktion (Bildmodell ca. 0,05 € inkl. Infrastruktur, Video 8 Sek. Standard ca. 2,96 €, Landingpage ca. 0,33 €), Speicher/Transfer sowie Fixkosten von ca. 94 € pro Monat insgesamt (nicht pro Kunde).

### All-Incl-Marketing (monatlich, netto)

| Paket | Preis/Monat | Inkl. Credits | Kosten bildlastig | Kosten mit 10 % Video | Kosten videolastig (30 %) | Gewinn (realistisch) | Marge |
|---|---|---|---|---|---|---|---|
| Basic | 399 € | 600 | ca. 33 € | ca. 47 € | ca. 71 € | ca. 352 € | 88 % |
| Advanced | 499 € | 1.000 | ca. 58 € | ca. 80 € | ca. 120 € | ca. 419 € | 84 % |
| Premium | 899 € | 2.000 | ca. 118 € | ca. 160 € | ca. 240 € | ca. 739 € | 82 % |
| Ultra | 1.598 € | 4.000 | ca. 236 € | ca. 320 € | ca. 480 € | ca. 1.278 € | 80 % |

Zusätzlich: 990 € einmalige Einrichtung sind fast vollständig Deckungsbeitrag (nur interne Arbeitszeit).
Wichtig: Weil jede Nachgenerierung Credits verbraucht, ist das Kontingent die Kostenbremse – anders als bei „unbegrenzt“ ist kein Ausreißer möglich.

### Fotoservice (pro Fahrzeug, 16 Perspektiven)

| Staffel | Preis/Fahrzeug | Kosten/Fahrzeug | Gewinn | Marge |
|---|---|---|---|---|
| 1 | 9,99 € | ca. 1,20 € | 8,79 € | 88 % |
| 25 | 7,99 € | ca. 1,20 € | 6,79 € | 85 % |
| 50 | 6,99 € | ca. 1,20 € | 5,79 € | 83 % |
| 100 | 5,99 € | ca. 1,20 € | 4,79 € | 80 % |
| 200 | 5,49 € | ca. 1,20 € | 4,29 € | 78 % |

Monatsbeispiel 100 Fahrzeuge: 599 € Umsatz, ca. 120 € Kosten inkl. Speicher, ca. 479 € Gewinn.

### Zusatzleistungen

| Leistung | Preis | Kosten | Marge | Bewertung |
|---|---|---|---|---|
| Instagram-/Facebook-Post | 2,50 € | ca. 0,10 € | 96 % | sehr gut |
| Google-Banner | 2,50 € | ca. 0,10 € | 96 % | sehr gut |
| Landingpage | 9,50 € / 14,90 € | ca. 0,35 € | 96 % | sehr gut |
| Video 8 Sek. | 8,50 € | ca. 2,96 € | 65 % | okay |
| Video-Paket „ab 6,90 €, 1× Wiederholung“ | 6,90 € | bis 5,92 € | **14 %** | **kritisch** |
| Whitelabel-Automarkt | 299 €/Monat | wenige Euro | >95 % | gut, Supportaufwand einplanen |
| Flipping-Plugin | 199 €/Monat | wenige Euro | >95 % | gut |

**Einzige echte Problemstelle:** das Video-Einstiegsangebot mit inkludierter Wiederholung. Empfehlung: entweder das schnelle Videomodell als Standard nutzen (Kosten ca. 0,40 €), oder die kostenlose Wiederholung auf technische Fehler begrenzen, oder Einstiegspreis auf 8,50 € vereinheitlichen.

**Fazit A:** Das Modell trägt sich sehr gut. Bereits ein Basic-Kunde deckt alle laufenden Grundkosten. Gesamtmarge liegt bei 78–88 %, nur die Videokonditionen müssen nachgeschärft werden.

## Teil B – Passt das zur bestehenden SaaS?

Ja, das Modell passt zur vorhandenen Credit-Mechanik. Heute gibt es allerdings nur ein einziges Paket (490 € / 1.000 Credits) plus ein Nachkaufpaket. Nötig sind daher folgende Schritte:

1. **Pakete anlegen:** Basic, Advanced, Premium, Ultra mit 600 / 1.000 / 2.000 / 4.000 Credits und den Preisen 399 / 499 / 899 / 1.598 € netto. Das alte Paket „Basis“ wird inaktiv gesetzt, bestehende Verträge laufen unverändert weiter.
2. **Fotoservice-Staffeln:** als eigene Paketreihe mit Credit-Kontingent (Fahrzeuge × 16 Perspektiven), Preise 9,99 / 199 / 349 / 599 / 1.098 € monatlich.
3. **Einmalige Einrichtungsgebühr 990 €** wird bei der ersten Buchung als zusätzliche Position mit abgerechnet.
4. **Preisliste vereinheitlichen:** Credit-Verbrauch je Aktion so einstellen, dass die Website-Preise exakt aufgehen (Fahrzeug = 16, Post/Banner = 5, Video = 17, Landingpage = 19).
5. **Preisseite umbauen** mit dem Umschalter „Fotoservice / All-Incl-Marketing“, Tabellenlayout wie auf autohaus.ai, Empfehlungs-Badge, sowie den Karten für Marketing-Set, Landingpage-Paket, Whitelabel-Automarkt, Flipping-Plugin und Video-Paket.
6. **Zwei Aktionen pro Paket:** „Verbindlich buchen“ führt in die Bezahlung, „Unverbindlich anfragen“ nutzt die bereits vorhandene Anfragestrecke inklusive Lead-Erfassung im Adminbereich.
7. **Rechtliches:** alle Preise netto zzgl. USt., Hinweis auf Laufzeit, automatische Verlängerung und Kündigung zum Periodenende, Verlinkung von AGB, Datenschutz und AVV direkt an den Buttons. Falls Jahreslaufzeit gewollt ist, muss das zusätzlich in den AGB ergänzt werden.

## Technische Details

- `subscription_plans`: neue Zeilen je Paket (`monthly_credits`, `price_monthly_cents`, `sort_order`, `features`), altes `basis` auf `active=false`.
- Stripe: je Paket ein Produkt + monatlicher Preis, zusätzlich ein Einmalpreis „Implementierung“. Neue IDs in `src/lib/stripe-plans.ts`, in der Allowlist von `supabase/functions/create-checkout/index.ts` sowie in `PRODUCT_TO_PLAN` und `PLAN_CREDITS` im Stripe-Webhook ergänzen. Bestehende IDs bleiben unverändert gültig.
- `create-checkout`: Einrichtungsgebühr über eine zusätzliche Rechnungsposition bei Erstbuchung; Authentifizierung und Allowlist bleiben wie bisher.
- `admin_settings.credit_costs`: Werte je Aktion auf die neue Preis-Logik anpassen (eine Migration, alle Tiers konsistent).
- `src/pages/Pricing.tsx`: Umschalter, Tabellenansicht, Zusatzpaket-Karten, Anfragebuttons auf bestehende Lead-Funktion.
- Keine Änderung an Generierungs-Pipelines, Auth oder Storage.

## Offene Entscheidungen

1. Video-Konditionen (Modellwahl oder Preis) – Empfehlung: schnelles Videomodell als Standard.
2. Laufzeit: monatlich kündbar oder 12 Monate Mindestlaufzeit.
3. Whitelabel-Automarkt und Flipping-Plugin zunächst nur als Anfrage, ohne Selbstbuchung.
