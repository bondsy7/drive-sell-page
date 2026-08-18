# Dashboard: echte Seiten-Pagination für Fahrzeuge

## Problem

Die Fahrzeugübersicht lädt aktuell zwar seitenweise (24 pro Seite), hängt aber automatisch
alle weiteren Seiten im Hintergrund an (`autoLoadAll`). Bei vielen Fahrzeugen laufen dadurch
laufend RPC-Aufrufe und die Kachel-Liste wächst unbegrenzt — das Dashboard bleibt langsam.

## Lösung

Umstellung auf klassische Seiten-Pagination: es wird immer genau **eine** Seite geladen und
angezeigt, mit Seitennavigation darunter.

- 24 Fahrzeuge pro Seite (Konstante bleibt zentral änderbar).
- Navigation: „Zurück“ / „Weiter“ plus Seitenzahlen (bei vielen Seiten mit Auslassung),
  vorhandene shadcn `pagination`-Komponente nutzen, sonst Buttons im gleichen Stil.
- Anzeige „Fahrzeuge 1–24 von 137 · Seite 1 von 6“.
- Seitenwechsel scrollt nach oben und hält beim Nachladen die vorherige Seite sichtbar
  (kein Layout-Sprung, `keepPreviousData`).
- Nach dem Löschen eines Fahrzeugs: aktuelle Seite neu laden; ist die Seite dadurch leer,
  automatisch eine Seite zurück.
- Nächste Seite wird beim Hover/Fokus auf „Weiter“ vorgeladen (Prefetch), damit der
  Wechsel sofort wirkt.

## Technische Details

- `src/hooks/useVehicles.ts`: neuer Hook `useVehiclesPage(page)` auf Basis von `useQuery`
  mit dem bestehenden RPC `get_vehicle_dashboard_page` (`_limit`, `_offset`), Rückgabe
  `{ items, total, pageCount }`, `keepPreviousData`, `staleTime` 60s.
  Der bestehende `useVehicles()` (Infinite/AutoLoad) bleibt unverändert für die
  Canvas-Banner-Studio-Auswahlen erhalten.
- `src/components/dashboard/VehiclesTab.tsx`: nutzt `useVehiclesPage`, lokaler `page`-State,
  Pagination-Leiste unter dem Grid, angepasster Statustext, Delete-Handling wie oben.
- Keine Datenbank- oder API-Änderungen nötig.

## Nicht Teil dieser Änderung

- Sortierung, Suche/Filter der Fahrzeugliste.
- Andere Dashboard-Tabs (Canvas, Schäden, Songs, Geplant).
