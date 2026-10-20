# Prüfbericht nb21-v2 Serverfunktion (nur Prüfung, keine Änderung)

## Ergebnis
- Projektstand ist Commit `5aeeef84` („Referenz-Pfad und Cache ergänzt“).
- Im Code von `remaster-vehicle-image` sind alle V2-Bausteine eingebunden:
  - `validateV2Wire` prüft Manifest und Referenzen vor dem Anbieteraufruf (Zeile 597).
  - `enforceV2SubjectClassLock` ersetzt den Klassenschutz im fertigen Prompt mit den Serverdaten (Zeile 702), nachdem Abschnitt 2 aus dem Manifest neu geschrieben wurde.
  - `v2TransportManifest` protokolliert ohne Base64 (Zeile 1067).
- Vorabprüfung und Upload-Cache laufen nur im Browser. Der Server hängt nicht von ihnen ab und prüft die Referenzen unabhängig nochmal mit derselben gemeinsamen Job-Regel.

## Nicht nachweisbar
- Dass genau diese Version live läuft, kann ich **nicht sicher belegen**. Die Server-Logs zeigen nur Start- und Stopp-Ereignisse, aber keine Version und keinen Commit. Für `remaster-vehicle-image` gibt es im aktuellen Zeitfenster keine Logeinträge.

## Echte Blocker vor dem Volvo-Test
1. Live-Version nicht belegt. Kostenloser Nachweis: ein absichtlich ungültiger V2-Aufruf (z. B. ohne Originalbeleg) muss mit „NB21 v2: …“ abgelehnt werden, bevor der Anbieter angefragt wird. Den führe ich nur nach deiner Freigabe aus.
2. Sonst keine: Vitest, Typecheck und Deno-Check waren zuletzt grün.
