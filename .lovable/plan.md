# Fahrersitz-Perspektive korrigieren

## Umsetzung
- Den Pkw-Slot „Interieur Fahrersitz“ ausdrücklich als Innenraumaufnahme vom geöffneten Fahrerbereich definieren: Fahrersitz, Lenkrad und Armaturenbrett müssen sichtbar bleiben; Außen- und 3/4-Fahrzeugansichten sind verboten.
- Den jeweiligen Aufnahme-Slot bis zur Bildfunktion mitgeben, damit dort Innenraum- und Außenaufnahmen eindeutig unterschieden werden.
- Für Innenraumaufträge serverseitig einen abschließenden Perspektivschutz setzen, der allgemeine Außenbild-, Fahrzeuggrößen- und Showroom-Anweisungen nicht über die Innenraumvorgabe stellen lässt.
- Die bestehende Auto-, Motorrad-, Transporter-, Lkw-, Reisemobil- und Baumaschinenlogik ansonsten unverändert lassen.

## Prüfung
- Einen gezielten Test für die Fahrersitz-Vorgabe ergänzen bzw. ausführen.
- TypeScript, relevante Tests und automatischen Build prüfen.
- Die aktualisierte Bildfunktion ausrollen.
