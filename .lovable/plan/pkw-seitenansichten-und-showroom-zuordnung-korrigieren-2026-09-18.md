# PKW-Seitenansichten und Showroom-Zuordnung korrigieren

## Ziel
- „Pipeline: Rechte Seite“ zeigt die echte rechte Fahrzeugseite mit Fahrzeugfront/Fahrtrichtung nach rechts.
- „Pipeline: Linke Seite“ zeigt die echte linke Fahrzeugseite mit Fahrzeugfront/Fahrtrichtung nach links.
- Beide Bilder verwenden ausschließlich den im aktuellen Vorgang ausgewählten Showroom; keine abweichende oder aus anderen Vorgängen stammende Szene.

## Umsetzung
1. Die beiden PKW-Seitenprompts mit eindeutigen Front-/Heckpositionen, Fahrzeugseite und abschließender Sichtprüfung korrigieren.
2. Eine serverseitige, nicht durch ältere Einstellungen überschreibbare Seitenrichtungs-Sicherung ergänzen, damit alle Bildmodelle dieselbe Zuordnung erhalten.
3. Die Showroom-Referenz pro Auftrag klar als einzige verbindliche Szene markieren und widersprüchliche Sonder-/Fallback-Beschreibungen verhindern.
4. Automatische Tests für beide Seitenrichtungen und die unveränderte Trennung zu anderen Fahrzeugklassen ergänzen.
5. Funktion bereitstellen sowie Tests und Vorschau-Build prüfen.

## Technische Details
- Scope: ausschließlich PKW-Bildpipeline und gemeinsam notwendige serverseitige Schutzregel.
- Keine Änderungen an Motorrad-, Reisemobil-, Transporter-, LKW- oder Baumaschinen-Prompts.
- Referenzbilder bleiben alleinige Wahrheit für Fahrzeugidentität und sichtbare Seitendetails.
