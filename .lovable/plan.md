# Originalgetreues Remastering der vorderen Innenaufnahme

## Ziel
Die Aufnahme „Interieur Fahrersitz“ wird nicht in eine fest vorgegebene Standardperspektive umgebaut. Kamera, Blickrichtung, Bildausschnitt und sichtbare Innenraumteile bleiben so, wie der Kunde sie fotografiert hat. Nur die gewählten Remastering-Optionen werden angewendet; die gewählte Showroom-Umgebung erscheint ausschließlich in den tatsächlich sichtbaren Fensterflächen bzw. im vorhandenen Hintergrund.

## Umsetzung
- Die widersprüchliche feste Perspektivvorgabe für den Pkw-Slot entfernen und durch eine verbindliche Originalperspektiven-Regel ersetzen: keine Außenansicht, keine 3/4-Ansicht, keine erfundene Kameraposition und keine Erweiterung des Bildausschnitts.
- Den konkreten Aufnahme-Slot „interior-front“ bis zur Bildfunktion übertragen, damit die vordere Innenaufnahme serverseitig eindeutig als Innenraum erkannt und geschützt wird.
- Die Referenzzuordnung der Pipeline korrigieren: Der Innenraumauftrag verwendet vorrangig die vorhandene vordere Innenaufnahme. Ein Wort im Auftragstext darf nicht mehr versehentlich die 3/4-Front-Außenaufnahme auswählen.
- Die Innenraumreferenz weiterhin wie gewohnt als verbindliche Fahrzeugreferenz für nachfolgende Pipeline-Bilder verwenden.
- Die Logo-Regel neu priorisieren: Das Logo wird nur eingebaut, wenn es ohne Beschnitt oder Verdrängung des eigentlichen Motivs möglich ist. Fahrzeug bzw. Innenraum, Originalperspektive und vollständiger vorhandener Bildausschnitt haben immer Vorrang; das Logo darf kleiner, versetzt oder nicht sichtbar sein.
- Alle Änderungen auf die Pkw-Innenaufnahme und die gemeinsame Logo-Priorität begrenzen; andere Fahrzeugklassen und deren getrennte Pipelines bleiben unverändert.

## Technische Prüfung
- Gezielte Tests für Referenzwahl, Innenraum-Perspektivtreue und Logo-Priorität ergänzen.
- TypeScript und relevante Tests ausführen; anschließend den automatischen Build prüfen.
- Die aktualisierte Bildfunktion ausrollen und einen echten Remastering-Aufruf kontrollieren.
