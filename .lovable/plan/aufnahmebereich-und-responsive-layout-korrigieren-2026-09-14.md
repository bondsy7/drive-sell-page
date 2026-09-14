# Aufnahmebereich und Responsive-Layout korrigieren

## Umsetzung
- Showroom 1 wird als Standard vorausgewählt, ohne spätere Nutzerauswahlen zu überschreiben.
- VIN sowie Innenraum-/Sitzaufnahmen werden als optional behandelt; erforderlich bleiben nur die Außenaufnahmen.
- Der Abschnitt heißt künftig „Aufnahmen“ statt „Pflichtangaben“, inklusive angepasster Status- und Zusammenfassungstexte.
- Die Aufnahmebilder werden auf schmalen Ansichten ohne horizontales Scrollen in einem 2-spaltigen Raster dargestellt: zwei, zwei und ein Bild in der letzten Zeile.
- Die obere Modellauswahl bricht responsiv in mehrere Zeilen um, statt die gesamte Seite seitlich zu verbreitern.
- Weitere lokale horizontale Überläufe im Aufnahmebereich werden beseitigt, ohne Upload-, Remastering-, VIN- oder Pipeline-Abläufe zu verändern.

## Technische Details
- Pflichtstatus und fehlende-Aufnahmen-Hinweise werden aus den aktualisierten Profilen berechnet.
- Desktop behält eine kompakte Fünferreihe, sobald tatsächlich genügend Inhaltsbreite vorhanden ist.
- Smartphone und schmale App-Inhaltsbereiche werden visuell auf seitliches Scrollen geprüft.
