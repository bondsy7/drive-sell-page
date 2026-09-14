# Responsive Fahrzeugaufnahme kompakter gestalten

## Umsetzung
- Auf dem Smartphone werden alle Pflichtaufnahmen in einer einzigen horizontal scrollbaren 4:3-Reihe dargestellt, statt in mehreren Zeilen.
- Die Kacheln erhalten eine feste mobile Breite und bleiben groß genug für Foto, Perspektive und Touch-Bedienung; Desktop behält die kompakte Fünferreihe.
- Alle Hauptbereiche werden als Accordions einklappbar: Fahrzeugart, Lkw-Konfiguration, Pflichtaufnahmen inklusive VIN, Felgen/Reifen, weitere Detailaufnahmen, Bildgestaltung und Zusammenfassung.
- Die Kopfzeilen zeigen auch im eingeklappten Zustand den wichtigsten Status, etwa Anzahl der Fotos, gewählte Szene oder Vollständigkeit.
- Felgen/Reifen und Detailaufnahmen werden auf Mobil getrennt und höhenoptimiert; auf größeren Ansichten bleiben sie nebeneinander.
- Standardmäßig bleiben die zentralen Pflichtaufnahmen geöffnet; optionale und bereits zusammenfassende Bereiche starten auf Mobil kompakt eingeklappt.

## Technische Details
- Die vorhandene Aufnahme-, VIN-, Upload-, Remastering- und Pipeline-Logik bleibt unverändert.
- Der bestehende Abschnittsbaustein wird zu einem zugänglichen Accordion mit echten Schaltflächen, `aria-expanded` und konfigurierbarem Anfangszustand erweitert.
- Die mobile Pflichtaufnahme-Reihe nutzt horizontales Scrollen mit stabilen 4:3-Abmessungen und Scroll-Snap.
- Nach der Änderung werden Desktop und Smartphone visuell sowie alle relevanten Klick-, Upload- und Accordion-Zustände geprüft.
