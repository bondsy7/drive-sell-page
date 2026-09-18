# Doppelte Bilder und vermischte Fahrzeugakten verhindern

## Bestätigte Ursache am genannten Fahrzeug
Das Fahrzeug `f4905765-185d-49bc-ad44-21e9a73c9a77` gehört zum anderen genannten Konto und ist der BMW X7 mit VIN `5UXCW2C01L9B43107`. Es enthält 44 Galeriezeilen, aber nur 32 unterschiedliche Bildadressen. Zwölf Pipeline-Ergebnisse wurden am 27.05. angelegt und am 18.09. unter derselben Bildadresse und Perspektive nochmals als neue Zeile gespeichert. Das erklärt exakt die zwölf sichtbaren Paare im Screenshot.

Wiederholte Pipeline-Läufe verwenden für dasselbe Fahrzeug stabile Bildadressen, legen dafür bislang aber ohne Dublettenprüfung neue Galeriezeilen an. Das Dashboard zeigt jede gespeicherte Zeile einzeln.

Die Fahrzeugzuordnung verwendet bei vorhandener VIN bereits eine eindeutige Kombination aus Konto und VIN. Ohne VIN wird dagegen ein Ersatzwert nur aus Fahrzeugdaten und der aktuellen Minute erzeugt. Zwei neue Vorgänge für ein gleiches Fahrzeug innerhalb derselben Minute können deshalb unbeabsichtigt dieselbe Akte wiederverwenden und Inhalte vermischen.

## Umsetzung
### Bilder eines vorhandenen Fahrzeugs
- Pipeline-Ergebnisse idempotent speichern: dieselbe Bildadresse und Perspektive darf innerhalb derselben Fahrzeugakte nur einmal als Galeriezeile vorkommen.
- Eine Datenbankabsicherung ergänzen, damit parallele oder wiederholte Aufrufe keine identische Galeriezeile erzeugen können.
- Bestehende exakte Dubletten bereinigen: den ältesten gültigen Eintrag behalten und nur spätere Zeilen mit identischem Konto, Fahrzeug, Ordner, Perspektive und Bildadresse entfernen. Die Bilddateien selbst bleiben bestehen.
- Die Galerie zusätzlich beim Anzeigen nach Bildadresse filtern, damit historische Sonderfälle nicht doppelt erscheinen.

### Klare Fahrzeugtrennung
- Mit echter VIN gilt innerhalb eines Kontos: dieselbe VIN führt immer in dieselbe Fahrzeugakte; die vorhandene eindeutige Absicherung bleibt bestehen.
- Ohne VIN gilt: Jeder neu begonnene Upload-/Generatorvorgang legt ausnahmslos eine neue Fahrzeugakte mit einer zufällig eindeutigen internen Kennung an – auch bei identischen Bildern, Marke, Modell oder gleichzeitig gestarteten Vorgängen.
- Innerhalb desselben laufenden Vorgangs wird die einmal erzeugte Fahrzeug-ID durch alle Schritte weitergereicht, damit Originale, remasterte Bilder, Pipeline-Ergebnisse und Projekte zusammenbleiben.
- Ein ausdrücklich aus einer bestehenden Fahrzeugseite gestarteter Vorgang bleibt an genau diese ausgewählte Akte gebunden; es wird weder eine zweite Akte angelegt noch mit einer anderen Akte vermischt.
- Alle Zuordnungen bleiben auf das angemeldete Konto begrenzt; übergebene fremde Fahrzeug-IDs dürfen keine Zuordnung oder Änderung bewirken.

## Prüfung
- Das genannte BMW-Fahrzeug nach Bereinigung auf 32 statt 44 Galeriezeilen prüfen; die zwölf sichtbaren Paare müssen verschwinden.
- Einen erneuten Pipeline-Lauf für ein Fahrzeug mit VIN prüfen: keine zweite Fahrzeugakte und keine identische Galeriezeile.
- Zwei neue Vorgänge ohne VIN mit denselben Bildern direkt nacheinander prüfen: zwei getrennte Fahrzeugakten, keine vermischten Bilder.
- Einen Vorgang aus einer bestehenden Fahrzeugseite prüfen: sämtliche Ergebnisse bleiben ausschließlich in dieser Akte.
- Angemeldete Zuordnung und Versuch mit einer fremden Fahrzeug-ID getrennt prüfen; eine fremde ID darf nicht wirksam werden.
- TypeScript, relevante Tests und automatischen Build prüfen.
