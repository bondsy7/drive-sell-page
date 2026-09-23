# Desktopbreite projektweit auf 1120 px vereinheitlichen

## Ziel
Alle regulären Seiten und Unterseiten erhalten auf Desktop eine gemeinsame nutzbare Inhaltsbreite von 1120 px. Der Generator wird deutlich breiter, während Mobilansichten und bewusst kompakte Dialoge erhalten bleiben.

## Umsetzung
1. **Gemeinsame Seitenschale**
   - Eine zentrale, wiederverwendbare Containerklasse für 1120 px Nutzbreite plus responsive Seitenabstände ergänzen.
   - Hauptnavigation, Footer und reguläre Seitenbereiche an derselben Achse ausrichten.

2. **Generator verbreitern**
   - Die äußere 768-px-Begrenzung im Generator entfernen.
   - Den Aufnahmebereich von 736 px auf die gemeinsame Desktopbreite erweitern.
   - Raster und Abschnitte auf der größeren Fläche sinnvoll verteilen; Mobilverhalten unverändert lassen.

3. **Seiten und Unterseiten angleichen**
   - Dashboard, Profil, Fahrzeug-/Projektansichten, Rechner, Studios, öffentliche Seiten, Funnel, Rechtsübersicht und Admin-Inhalte auf die gemeinsame Seitenschale umstellen.
   - Bewusst schmale Inhalte wie Login-Formulare, Dialoge, Textabsätze und Medienvorschauen nicht künstlich strecken.

4. **Prüfung**
   - Generator und repräsentative öffentliche/interne Seiten auf Desktop und Mobil prüfen.
   - TypeScript-/Build-Status und Laufzeitfehler kontrollieren.

## Technische Details
- 1120 px werden als nutzbare Inhaltsbreite umgesetzt; mit je 16 px Seitenabstand entspricht die äußere Tailwind-Schale `max-w-6xl`.
- Keine Änderungen an Generatorlogik, Daten, Credits, Authentifizierung oder Backend.
- Kein Deployment und kein Publishing.
