# Analyse: Kundenpräsentation 15.09.2026 (DEKRA, Kollege E. Wakolbinger)

Alle Zeiten in Berliner Zeit. Datenbasis: Fahrzeugakten, Galerie-Einträge, Lauf-Protokolle
(`pipeline_timing_logs`), Speicherordner. Hinweis: die technischen Server-Logs des Tages sind
zwischenzeitlich abgelaufen; die konkrete Fehlermeldung der zwei gescheiterten Läufe ist damit
nicht mehr belegbar (das ist selbst einer der Befunde, siehe F7).

## 1. Zeitlicher Ablauf

| Uhrzeit | Was passierte | Bewertung |
|---|---|---|
| 11:25:23 | Fahrzeugakte 1 angelegt (ohne VIN, „NOVIN-…-1125") | ok |
| 11:28:20 | 3 aufbereitete Bilder (3/4 Front, Seite, Hinten) gespeichert | ok |
| — | Originalfotos zu diesem Durchgang **nicht** gespeichert | **F5** |
| 11:30:28 | Bildergenerierung Lauf 1: **13 von 13 Bildern fehlgeschlagen**, Dauer 4:40 min | **F1** |
| 11:32:20 | Neustart durch den Berater: **13 von 13 fehlgeschlagen**, Dauer 3:55 min | **F1**, **F2** |
| 11:37:48 | Lauf 3 gestartet | ok |
| 11:37:49 | Lauf 4 gestartet – **1 Sekunde später, identisch** (Doppelklick/Doppelstart) | **F2** |
| ~11:39:40 | Beide Läufe erfolgreich (13/13 in 107 s bzw. 122 s) – doppelte Kosten | **F2** |
| ~11:39:40 | Eintrag der 13 Bilder in die Galerie schlug fehl, Fehler wurde verschluckt → App meldete „gespeichert", sichtbar war nichts | **F3**, **F4** |
| 11:43:30 | Fahrzeugakte 2 angelegt (HONDA, VIN JHMGR3890VS201500) – **erst nach** dem Lauf | **F6**, **F5** |
| 12:49:16 | Fahrzeugakte 3 angelegt („NOVIN-…-1249") | **F6** |
| 12:50 | 5 aufbereitete Bilder + Originale gespeichert | ok |
| 12:51:08 | Lauf erfolgreich, 13/13 in 95 s, 12 Bilder in der Galerie | ok |
| 13:34:29 | Fahrzeugakte 4 angelegt („NOVIN-…-1334") | **F6** |
| 13:35:46 | Lauf erfolgreich, 13/13 in 60 s | ok |

Ergebnis des Tages: **4 Fahrzeugakten für 2 reale Fahrzeuge**, ein Motorrad-Durchgang lag
zeitweise in der HONDA-Akte, ca. **9 Minuten reine Wartezeit für zwei komplett fehlgeschlagene
Läufe** plus ein doppelt bezahlter Lauf.

## 2. Befunde (Ursachen)

- **F1 – Generierung scheiterte zweimal vollständig.** Zwei Läufe hintereinander mit 0 von 13
  Bildern. Nach außen sichtbar war nur langes Warten. Ursache heute nicht mehr rekonstruierbar
  (siehe F7); typisch für dieses Muster sind Anbieter-Limits (zu viele parallele Anfragen)
  oder ein Modell-/Antwortfehler, der pro Bild wiederholt wird.
- **F2 – Kein Schutz gegen Doppelstart.** Der Start-Knopf ließ sich mehrfach auslösen; um 11:37
  liefen zwei identische Läufe parallel. Das verdoppelt Kosten und verlangsamt beide Läufe,
  weil sie sich dasselbe Anbieter-Kontingent teilen (mögliche Mitursache von F1).
- **F3 – Speicherfehler wurden verschluckt.** Der Eintrag in die Galerie schlug fehl, die App
  meldete trotzdem Erfolg.
- **F4 – Gespeichert wurde erst ganz am Ende.** Bis dahin existierten die Bilder nur im Browser;
  ein Fehler am Ende vernichtete das Ergebnis des gesamten Laufs.
- **F5 – Originalfotos gingen verloren.** Sie wurden nur im Abschluss-Schritt und nur bei
  vorhandener Fahrzeugakte abgelegt. Beim 11:37-Lauf entstand die Akte erst um 11:43 → Originale
  nie gespeichert und nicht wiederherstellbar.
- **F6 – Jeder Durchgang legte eine neue Fahrzeugakte an.** Aufbereitung, Generierung und
  VIN-Erkennung liefen in getrennte Akten; dadurch wirkten Bilder „verschwunden" oder lagen beim
  falschen Fahrzeug.
- **F7 – Keine dauerhafte Fehleraufzeichnung.** Fehlgeschlagene Bilder werden nur gezählt, nicht
  begründet. Deshalb lässt sich der Präsentationsfehler im Nachhinein nicht mehr benennen.

## 3. Bereits umgesetzt (15.09.2026)

- **Sofort-Speicherung:** Jedes fertige Bild wandert direkt in die Galerie, nicht erst am Ende.
  Abbruch oder geschlossener Tab kosten nur noch das, was noch nicht fertig war. (F4)
- **Ehrliche Fehlermeldung:** Fehlgeschlagene Speicherungen werden gemeldet, nach Auffrischen der
  Anmeldung erneut versucht und nicht mehr als Erfolg dargestellt. (F3)
- **Fahrzeug und Originale zuerst:** Fahrzeugakte und Originalfotos werden **vor** der Generierung
  angelegt bzw. gesichert – auch dann, wenn anschließend kein Lauf startet oder der Lauf scheitert. (F5)
- **Eine Akte statt zwei:** Aufbereitung und Generierung schreiben zwingend in dieselbe
  Fahrzeugakte. (F6, teilweise)
- **Datenkorrektur:** Die 13 fälschlich beim HONDA gelandeten Motorrad-Bilder liegen jetzt beim
  Motorrad; der HONDA zeigt wieder nur seine eigenen Bilder.
- **Doppelstart gesperrt:** Der Start-Knopf ist ab dem ersten Klick blockiert („Wird gestartet…"),
  ein zweiter Klick im selben Moment wird verworfen. Ein identischer Lauf für dasselbe Fahrzeug
  bleibt gesperrt, solange er läuft, und nach erfolgreichem Abschluss weitere 3 Minuten. Ein
  eindeutig fehlgeschlagener Lauf ist sofort wieder startbar. Die Sperre wirkt auch über mehrere
  Tabs und über ein Neuladen der Seite hinweg. (F2)

## 4. Noch offen – empfohlene nächste Schritte

1. **Fehlerursachen dauerhaft protokollieren (hoch).** Pro fehlgeschlagenem Bild Fehlerart und
   Anbieterantwort speichern und im Admin-Bereich sichtbar machen. Ohne das ist jede künftige
   Panne wieder nicht analysierbar. (F7, F1)
2. **Sichtbarer Fehlerzustand für den Nutzer (hoch).** Wenn ein Lauf scheitert, klare Meldung
   statt endloser Wartezeit – inklusive „erneut versuchen" nur für die fehlgeschlagenen Bilder.
3. **Automatischer Wiederholversuch mit Wartezeit (mittel).** Bei Anbieter-Limits gestaffelt
   erneut versuchen, statt alle 13 Bilder gleichzeitig scheitern zu lassen.
4. **Fahrzeugakte immer vorab wählen (mittel).** Beim Start aus dem Hub eine bestehende Akte
   anbieten, statt jedes Mal eine neue anzulegen. (F6 vollständig)
5. **Präsentationsmodus / Vorab-Check (mittel).** Vor Kundenterminen ein kurzer Selbsttest
   (1 Testbild) und ein vorbereitetes Fahrzeug als Fallback.
6. **Fortschritt mit Restzeit (niedrig).** Sichtbarer Zähler „7 von 13 fertig" plus geschätzte
   Restzeit; erfolgreiche Läufe dauern 60–120 s, das lässt sich klar kommunizieren.

## 5. Kurzfazit für die Geschäftsleitung

Es gab **kein Datenverlust-Problem im Kern der KI**, sondern drei organisatorische Schwächen:
die Bilder wurden zu spät gespeichert, Fehler wurden nicht ehrlich angezeigt, und ein
Doppelstart war möglich. Alle drei Punkte sind behoben; die dauerhafte Fehlerprotokollierung
ist der nächste Schritt.
