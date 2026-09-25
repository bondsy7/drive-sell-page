# Interaktive Smartphone-Reveal-Demo im Funnel-Hero

## Ziel
Die bisherige statische Vorher-/Nachher-Grafik im Hero von `/autohaus-fahrzeugbilder` wird durch eine hochwertige, frei verschiebbare Smartphone-Maske ersetzt. Texte, CTAs und alle weiteren Funnel-Bereiche bleiben unverändert.

## Umsetzung
- Eine neue, eigenständige Hero-Demo-Komponente erstellen und nur auf `/autohaus-fahrzeugbilder` einsetzen.
- `before.webp` als dauerhaft sichtbare Grundfläche verwenden.
- Innerhalb des Smartphone-Displays die gewählte `after`-Variante lagegleich zur Grundfläche zeigen. Der Ausschnitt wird aus der Position des Smartphones berechnet, sodass das Bild selbst beim Ziehen feststeht.
- Pointer Events für Maus, Touch und Stift verwenden; Bewegung vollständig auf die Bildfläche begrenzen.
- Einen modernen dunklen Smartphone-Rahmen mit transparenter Displaymaske, dezentem Schatten und responsiver Größe umsetzen.
- Die fünf Zustände über eine leicht austauschbare Konfiguration aus Label und Bildquelle verwalten: Aufbereitung, Showroom, Lackierung, Felgen, Branding.
- Kompakte Umschalter ergänzen; Variantenwechsel weich überblenden.
- Beim ersten Laden eine kurze dezente Bewegung und einen Hinweis „Ziehen und Ergebnis entdecken“ zeigen; bei reduzierter Bewegung deaktivieren.
- Zugänglichkeit ergänzen: klare Beschriftungen, Tastaturauswahl der Varianten und verständlicher Status.

## Prüfung
- Desktop mit Maus und Mobile mit Touch/Pointer prüfen.
- Begrenzung, feste Bildausrichtung, Variantenwechsel, Ladezustand und reduzierte Bewegung kontrollieren.
- Sicherstellen, dass Hero-Texte, CTA und restlicher Funnel unverändert bleiben.
- Projektprüfung und aktuelle Fehleranzeige kontrollieren; nicht veröffentlichen.

## Technische Details
- React-Zustand und native Pointer Events, keine neue Bibliothek.
- Die vorhandene `BeforeAfterShowcase` bleibt für andere Seiten unverändert; die neue Demo wird ausschließlich im Hero der Fahrzeugbilder-Seite eingebunden.
- Die Asset-Zuordnung liegt zentral am Anfang der neuen Komponente und kann später durch Austausch der fünf Imports bzw. Einträge geändert werden.
