# Zahlungen & Credit-Absicherung vor dem Start

## Was ich geprüft habe

- Stripe-Konto, Checkout, Credit-Kauf, Webhook
- Alle 58 Backend-Funktionen: welche kostenpflichtige KI aufrufen und welche Credits abziehen
- Preis- und Credit-Einstellungen in der Datenbank

## Befund 1: Stripe läuft nur im Testmodus

Das verbundene Stripe-Konto ist die **Sandbox** ("Breadcrumb GmbH Sandbox"). Es kann damit kein echtes Geld eingezogen werden. Alle hinterlegten Produkt- und Preis-IDs sind Sandbox-IDs.

Der Ablauf selbst ist fertig und korrekt: geführter Checkout, nur freigegebene Preise, Einrichtungsgebühr nur bei Erstbuchung, Credit-Gutschrift bei Abschluss und bei jeder Verlängerung, Statuswechsel bei Kündigung und fehlgeschlagener Zahlung, Credit-Nachkauf.

## Befund 2: Zwölf Funktionen erzeugen KI-Leistung ohne Credits

Diese Funktionen rufen kostenpflichtige KI-Dienste auf, ziehen aber **keine** Credits ab:

| Funktion | Was sie kostet |
|---|---|
| reference-v2-generate-image | Bildgenerierung – teuerster Posten |
| generate-master-banner-image | Bildgenerierung |
| reframe-banner-image | Bildgenerierung (Ideogram) |
| generate-social-caption | Textgenerierung |
| classify-vehicle-images | Bildanalyse |
| detect-vehicle-brand / detect-vehicle-branding | Bildanalyse |
| analyze-offer-image | Bildanalyse |
| analyze-wheel-reference | Bildanalyse |
| suggest-banner-layout | Textanalyse |
| extract-banner-data | Text-/Bildanalyse |
| sales-chat | Chat, pro Nachricht |

## Befund 3: Lücken in der Preistabelle

- Für Aktionen ohne Eintrag greift ein Notfallwert von **1 Credit**. Für eine Bildgenerierung ist das zu wenig.
- `generate-music` bucht auf "admin_adjustment" statt auf eine eigene Musik-Aktion – die Auswertung stimmt dadurch nicht.
- `video_generate` steht bei 4–5 Credits, obwohl ein 8-Sekunden-Video rund 2,96 € Einkauf kostet. Bei 0,50 € je Credit wäre das ein Verlustgeschäft. Die höheren Einträge (17 Credits) sind korrekt.
- Neue Konten bekommen 10 Gratis-Credits. Ohne Begrenzung ist das über mehrere Registrierungen missbrauchbar.

## Was umgesetzt wird

### 1. Keine kostenlose Generierung mehr
Jede der zwölf Funktionen bekommt dieselbe Absicherung wie die bestehenden: Anmeldung prüfen, Credits **vor** dem KI-Aufruf abziehen, bei zu wenig Guthaben mit klarer deutscher Meldung abbrechen. Neue Aktionsarten: Bildanalyse, Textgenerierung, Chat-Nachricht, Banner-Neuzuschnitt, Musik.

### 2. Notfallwert absichern
Fehlt ein Preis in den Einstellungen, wird künftig nicht mehr 1 Credit berechnet, sondern ein hinterlegter Mindestpreis je Kategorie – Bildgenerierung deutlich über Einkaufspreis. Keine Aktion kann mehr unter Einkauf laufen.

### 3. Preistabelle vervollständigen und margengesichert setzen
Alle Aktionen inklusive der neuen bekommen einen Eintrag. Video wird einheitlich auf den margensicheren Wert gesetzt. Grundregel: Verkaufserlös je Aktion mindestens dreifacher Einkaufspreis inklusive Wiederholungsfaktor.

### 4. Rückerstattung bei technischem Fehlschlag
Wenn ein Anbieter komplett ausfällt und kein Ergebnis geliefert wird, werden die abgezogenen Credits automatisch zurückgebucht und protokolliert. Kostenpflichtig bleibt nur, was tatsächlich Kosten verursacht hat.

### 5. Margen-Überwachung im Adminbereich
Eine Ansicht, die je Aktion tatsächliche Einkaufskosten (aus der bestehenden Kostenerfassung) gegen verbrauchte Credits stellt und Aktionen markiert, deren Marge unter eine Schwelle fällt. Dazu eine Warnung, wenn ein Kunde im Monat deutlich mehr Kosten verursacht als sein Paket einbringt.

### 6. Gratis-Credits begrenzen
Startguthaben bleibt, wird aber pro Firma/E-Mail-Domain nur einmal gewährt und deckt keine teuren Aktionen wie Video ab.

## Was du selbst erledigen musst

1. Stripe vom Sandbox- auf das Live-Konto umstellen: Live-Schlüssel hinterlegen.
2. Produkte und Preise im Live-Konto anlegen; ich trage die neuen IDs anschließend ein.
3. Webhook-Adresse im Live-Konto eintragen und das Signatur-Geheimnis hinterlegen.
4. Im Stripe-Konto Kundenportal, Steuerbehandlung (netto zzgl. USt.) und Rechnungsdaten aktivieren.

## Technische Details

- Neue Werte in `credit_action_type`; Migration inklusive Grants.
- Einheitlicher Helfer in `supabase/functions/_shared/credits.ts`: `requireCredits(actionType, tier)` mit Auth über `getClaims`, Abzug vor dem Anbieteraufruf, `refundCredits` bei Totalausfall.
- Notfallpreise als Konstante im Shared-Modul statt hartkodierter 1.
- `admin_settings.credit_costs` per Migration erweitert; Adminoberfläche kann die Werte weiter bearbeiten.
- Margenansicht auf Basis von `api_cost_events` und `credit_transactions`.
- Keine Änderungen an Pipelines, Prompts, Storage oder Auth-Logik.
