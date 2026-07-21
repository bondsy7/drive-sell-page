# LKW-Rückspiegel & Kamera-Ersatz korrekt remastern

## Problem
Beim Remastering von LKW-Exterieur-Aufnahmen verwechselt das Modell moderne Kamera-Rückspiegel-Systeme (z.B. MAN OptiView, Mercedes MirrorCam) mit klassischen Glasspiegeln – oder umgekehrt. Ergebnis: fehlende Kameras, halbierte Spiegelarme, aus einer Kamera wird ein Glasspiegel „erfunden".

## Ursache
Der aktuelle Prompt hat keinen expliziten Block für Spiegel-/Kamera-Hardware am Fahrerhaus. Das `REFERENCE_TRUTH_PROTOCOL` allein reicht bei kleinen, seitlich montierten Bauteilen nicht – das Modell fällt auf sein Trainings-„Standard-LKW"-Bild zurück.

## Lösung: Neuer Prompt-Block `MIRROR_SYSTEM_LOCK`

Ergänzung in `src/lib/remaster-prompt.ts` – wird für alle Exterieur-Perspektiven (nicht Interieur) eingefügt, unabhängig von Cleanup-Optionen. Kern-Regeln:

1. **Erkennen vor Rendern:** Vor dem Rendern die Spiegel-/Kamera-Hardware am A-Pillar / Dach / Türblatt analysieren.
2. **Zwei Varianten unterscheiden:**
   - **Klassische Glasspiegel** (Haupt- + Weitwinkel- + Rampenspiegel auf Auslegerarm).
   - **Kamera-Monitor-System** (schlanke, aerodynamische Kamera-Gehäuse an Kabinen-Ecken/-Dach anstelle großer Spiegelköpfe – z.B. MAN OptiView, Mercedes MirrorCam, Volvo Camera Monitor System).
3. **Pixel-genaue Reproduktion:** Anzahl, Position, Ausleger-Geometrie, Gehäuseform und -farbe **exakt** aus der Referenz übernehmen. Kein Wechsel zwischen den Systemen.
4. **Verbot:** Keine Glasspiegel hinzufügen, wenn das Original Kameras zeigt. Keine Kameras erfinden, wenn Original Glasspiegel zeigt. Keine „Hybrid-Kombination".
5. **Innenseiten-Displays:** Falls Kamera-System erkannt: die zugehörigen Innen-Displays an den A-Säulen bei Interieur-Perspektiven ebenfalls beibehalten (Verweis im Interior-Perspektiven-Block).

Block wird in `buildMasterPrompt` direkt nach `IDENTITY_LOCK` / vor `VEHICLE_SCALE_LOCK` eingefügt, nur wenn `!interior`.

## Zusätzlich: Admin-editierbar

- Als neuer Eintrag `mirror_system_lock` in `REMASTER_PROMPT_BLOCKS` (`src/lib/remaster-prompt-defaults.ts`), damit er unter *Admin → Prompt-Verwaltung* nachjustierbar ist – identisches Muster wie die anderen Blöcke.

## Nicht Teil dieses Plans
- Keine neue UI-Checkbox – Regel greift automatisch für alle Exterieur-Bilder (User muss nichts auswählen).
- Kein zusätzlicher Vision-Pre-Scan / keine Extra-Credits.
- Keine Änderung an Interieur-Prompts außer einer kurzen Zeile zum Erhalt der Kamera-Displays.

## Betroffene Dateien
- `src/lib/remaster-prompt.ts` – neuer Block + Aufruf in `buildMasterPrompt`
- `src/lib/remaster-prompt-defaults.ts` – Default-Text unter `mirror_system_lock`
