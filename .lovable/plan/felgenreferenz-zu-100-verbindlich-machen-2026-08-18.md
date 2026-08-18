# Felgenreferenz zu 100 % verbindlich machen

Ziel: Wenn eine Felgenreferenz hochgeladen wurde, muss die Felge im Remaster exakt aus diesem Bild stammen — nie aus dem Modellwissen des Bildmodells ("die typische Felge dieses Fahrzeugs").

## Befunde aus dem aktuellen Code

- Die Felgenreferenz wird korrekt an Hero-/Exterior-/Composite-/CI-Jobs geroutet und in `remaster-vehicle-image` als eigener Bildteil angehängt.
- **Lücke 1 – Reihenfolge/Gewichtung:** Die Felgenreferenz wird ganz am Ende angehängt, nach Hauptbild und allen "AUTHORITATIVE DETAIL REFERENCES". Sie steht damit im Kontext hinter vielen anderen Bildern.
- **Lücke 2 – OpenAI-Pfad:** Bei den Tiers turbo/ultra/neu werden alle Bilder als anonyme `image`-Dateien an `/v1/images/edits` geschickt. Der Text "the NEXT image is the wheel reference" verliert dort jeden Bezug — das Modell weiß nicht, welches der bis zu 16 Bilder die Felge ist.
- **Lücke 3 – kein Fallback ohne Referenz:** Ist keine dedizierte Felgenreferenz vorhanden, gibt es nur eine allgemeine Textregel. Dann greift das Modell auf gängige OEM-Felgen zurück (genau das beschriebene Symptom).
- **Lücke 4 – keine Nachkontrolle:** Es gibt keine Prüfung, ob die erzeugte Felge zur Referenz passt, und keinen automatischen Korrekturlauf.

## Umsetzung

### 1. Felgenreferenz nach vorn und explizit benennen (Gemini)
- Felgenreferenz direkt **nach dem Hauptbild** und **vor** den allgemeinen Detailreferenzen einfügen.
- Jedes Bild im Request mit einer Positionsbezeichnung versehen ("IMAGE 1 = vehicle blueprint", "IMAGE 2 = WHEEL REFERENCE (authoritative)"), damit der Bezug nicht über "next image" hängt.
- Im allgemeinen Detailreferenz-Block ergänzen: diese Bilder dürfen die Felgenreferenz **niemals** überstimmen.

### 2. OpenAI-Pfad reparieren
- Bilder in fester, dokumentierter Reihenfolge senden und diese Reihenfolge im Prompt-Text auflisten (`ref_0 = Fahrzeug`, `ref_1 = FELGENREFERENZ`, …).
- Dateinamen sprechend machen (`wheel_reference.jpg`), Felgenreferenz an Position 1 setzen und nie durch das 16-Bild-Limit abschneiden lassen (Priorisierung beim Kürzen: Fahrzeug, Felge, Kennzeichen, Logos, Rest).

### 3. Verbindlichere Prompt-Regeln
- `buildWheelReferenceLock` / `<CRITICAL_WHEEL_REFERENCE>` um einen expliziten Zählschritt erweitern: Speichenzahl aus der Referenz zählen, Speichenform, Zweifarbigkeit (z. B. diamantpoliert + Schwarz), Nabendeckel und Bremssattelfarbe übernehmen; ausdrücklich verbieten, eine bekannte Serienfelge des Modells zu verwenden.
- Selbstprüfung vor Ausgabe: "Speichenzahl im Output == Speichenzahl der Referenz? Finish identisch? Wenn nein: neu zeichnen."
- Fahrzeugbeschreibung/Modellname darf nicht als Felgen-Hinweis dienen: Regel ergänzen, dass Modellwissen für Räder gesperrt ist.

### 4. Fallback ohne dedizierte Referenz
- Ist keine Felgenreferenz hochgeladen, wird aus dem Primär-Originalfoto automatisch der Radbereich ausgeschnitten (Vorderrad-Region), hochskaliert und als Felgenreferenz-Bild mitgeschickt — inklusive Hinweis, dass es sich um einen Crop niedriger Auflösung handelt, der geometrisch aber verbindlich ist.
- Damit ist auch bei Nutzern ohne Extra-Upload die Felge quellengebunden.

### 5. Optionale Nachkontrolle (Standard: an)
- Nach der Generierung ein Vision-Check-Aufruf, der Speichenzahl/Finish von Referenz und Ergebnis vergleicht.
- Bei Abweichung genau **ein** automatischer Wiederholungslauf mit verschärftem Felgen-Block; danach wird das Ergebnis mit Warnhinweis in der UI markiert ("Felge weicht evtl. von der Referenz ab").

### 6. Diagnose
- Logging erweitern: pro Job `wheelRefAttached`, Position im Bild-Array, Engine, Ergebnis des Nachchecks — damit künftige Fälle schnell nachvollziehbar sind.

## Technische Details

- `supabase/functions/remaster-vehicle-image/index.ts`: Reihenfolge der `parts`, Bild-Indizierung im Prompt, OpenAI-Formularaufbau und Priorisierung beim 16-Bild-Limit.
- `src/lib/remaster-prompt.ts`: `buildWheelReferenceLock`, `WHEEL_VISIBILITY_RULE`, Zähl-/Selbstprüfregeln, Sperre für Modellwissen.
- `src/lib/wheel-reference.ts`: neuer Crop-Fallback (Canvas) + optionaler Vergleichs-Check.
- `src/contexts/PipelineContext.tsx`, `src/components/ImageCaptureGrid.tsx`: Fallback-Crop erzeugen und wie die echte Referenz durchreichen; Warnstatus anzeigen.
- Kein Datenbankschema-Wechsel nötig.
