# Referenzmap: automatische Wiederholung + zuverlässige Seiten-Erkennung

Zwei Probleme aus dem Test:

1. Einzelne Bilder blieben ohne Analyse liegen und mussten von Hand erneut gestartet werden.
2. Die linke und rechte Fahrzeugseite werden verwechselt: zwei verschiedene Bilder landeten beide als „Seitenansicht links · 100 %“, obwohl eines die rechte Seite zeigt.

## 1. Automatische Wiederholung fehlgeschlagener Analysen

- Nach dem Durchlauf einer Hochlade-Charge werden alle Bilder eingesammelt, die als „Analyse nicht verfügbar“ endeten und deren Fehler vorübergehend war (Verbindung, Zeitlimit, Dienst überlastet).
- Diese werden automatisch bis zu zweimal erneut analysiert, mit kurzer Wartezeit dazwischen und weiterhin höchstens vier gleichzeitig.
- Während der Wiederholung zeigt die Karte „Erneuter Versuch …“; scheitert es endgültig, bleibt die Karte sichtbar und manuell zuordenbar wie bisher.
- Der automatische Sprung zur Referenzmap erfolgt erst, wenn auch die Wiederholungen fertig sind — er wartet aber nie unbegrenzt, und Fehler blockieren ihn nicht.
- Der manuelle „Erneut analysieren“-Knopf bleibt erhalten.

## 2. Links/Rechts zuverlässig bestimmen

Die Bildanalyse liefert bereits mehr Hinweise, als heute genutzt werden: den Kamerawinkel, die Sichtbarkeit der linken und rechten Fahrzeugseite sowie einen Verdacht auf gespiegelte Bilder. Diese Angaben werden bisher verworfen.

- Diese Werte werden pro Bild mitgeführt und dienen als Gegenprobe zur vorgeschlagenen Perspektive.
- Widerspricht die Gegenprobe eindeutig (Winkelvorzeichen und Seitensichtbarkeit zeigen klar auf die andere Seite), wird die Perspektive auf die gegenüberliegende Ansicht korrigiert und das Bild als „Seite korrigiert — bitte prüfen“ markiert.
- Ist die Lage uneindeutig, bleibt die Perspektive stehen, das Bild wird aber als unsicher gekennzeichnet statt mit 100 % angezeigt.
- Landen zwei Bilder auf derselben Außenansicht, wird das als Konflikt erkannt: beide werden in der Referenzmap markiert, das schwächere Bild verliert die automatische Belegung und muss bestätigt werden.
- Der Prompt der Bildanalyse wird um eine klare Seitenregel ergänzt (Fahrtrichtung bestimmt links/rechts, niemals die Betrachterseite) und um die Pflicht, Winkel und Seitensichtbarkeit widerspruchsfrei zu melden.
- Es wird weiterhin niemals automatisch gespiegelt und es fließen keine Fahrzeugdaten in die Analyse.

## 3. Bedienung in der Referenzmap

- Eine korrigierte oder unsichere Ansicht zeigt einen kurzen Hinweis samt Grund.
- Bei einem Seitenkonflikt gibt es eine Ein-Klick-Aktion „auf die andere Seite verschieben“, damit die Korrektur nicht über die Kandidatenliste gesucht werden muss.
- Manuelle Zuordnungen haben weiterhin immer Vorrang.

## Technische Umsetzung

- `src/features/reference-v2/phase4/capture-state.ts`: `CaptureItem` um `azimuthDeg`, `leftVisibility`, `rightVisibility`, `mirroredSuspected` erweitern; reine Funktionen `sideEvidence()`, `reconcileSide()` und `detectPerspectiveConflicts()` ergänzen.
- `src/features/reference-v2/phase4/ReferenceWorkspace.tsx`: Analyse-Ergebnis um die Seitenhinweise anreichern, Nachbearbeitung der Charge (Seitenabgleich + Konflikte), automatische Wiederholschleife (max. 2 Runden, nur vorübergehende Fehler über `isTransientIntakeError`), Auto-Sprung erst nach Abschluss der Wiederholungen.
- `src/features/reference-v2/phase4/ReferenceMap.tsx`: Konflikt-/Korrekturhinweis und Aktion „andere Seite“.
- `supabase/functions/reference-v2-analyze-image/index.ts`: Seitenregel im Prompt schärfen; Edge Function neu bereitstellen.
- Tests unter `src/features/reference-v2/__tests__/`: Seitenkorrektur bei widersprüchlichem Winkel, kein Spiegeln, Konflikterkennung bei doppelter Belegung, Auto-Retry nur bei vorübergehenden Fehlern, kein Endlos-Retry.
- Unverändert: strenger Planner, Persistenz, Original-Ablage, Semantik-Firewall, Legacy-Remastering.
