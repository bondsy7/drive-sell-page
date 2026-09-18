# Doppelte Bilder im Dashboard beseitigen

## Bestätigte Ursache
Beim gezeigten BMW X7 liegen tatsächlich doppelte Galeriezeilen mit derselben Bildadresse und Perspektive vor. Beispielsweise wurden „Master-Bild“, „Low-Angle Hero“, „Exterieur-Grid“ und weitere Ergebnisse zuerst am 10.09. und nochmals am 14.09. gespeichert. Die Bilddatei wurde dabei überschrieben bzw. wiederverwendet, aber der zugehörige Galerieeintrag erneut angelegt.

Der aktuelle Ablauf begünstigt dies an zwei Stellen:
- Ein Pipeline-Lauf speichert jedes fertige Bild sofort und übergibt am Ende denselben Ergebnissatz nochmals an den Seitenabschluss, der ihn erneut speichern kann.
- Wiederholte Läufe verwenden stabile Bildadressen, legen dafür jedoch ohne Dublettenprüfung neue Galeriezeilen an.

Das Dashboard zeigt jede gespeicherte Zeile einzeln und macht diese Dubletten deshalb sichtbar.

## Umsetzung
- Die Pipeline-Sofortspeicherung als einzige Speicherung für Pipeline-Ergebnisse beibehalten; der Abschluss übernimmt nur noch Status, Fahrzeugzuordnung und Navigation.
- Direkte Remastering-Abläufe ohne Pipeline weiterhin regulär speichern, damit bestehende Upload- und Generatorfunktionen nicht beeinträchtigt werden.
- Speichervorgänge idempotent machen: dieselbe Bildadresse und Perspektive innerhalb derselben Galerie darf nur einmal vorkommen.
- Eine Datenbankabsicherung ergänzen, damit parallele oder wiederholte Aufrufe keine neue Dublette erzeugen können.
- Bestehende exakte Dubletten bereinigen: jeweils den ältesten gültigen Galerieeintrag behalten und nur spätere Zeilen mit identischer Fahrzeug-/Ordner-/Perspektiven-/Bildadress-Kombination entfernen; Bilddateien selbst bleiben bestehen.
- Die Galerie zusätzlich beim Anzeigen defensiv nach Bildadresse filtern, damit historische Sonderfälle nicht doppelt erscheinen.

## Prüfung
- Einen normalen Lauf und einen erneuten Lauf mit derselben Auswahl prüfen.
- Sicherstellen, dass pro Ergebnis genau eine Galeriezeile existiert und Direkt-Remastering weiterhin gespeichert wird.
- TypeScript, relevante Tests und automatischen Build prüfen.
