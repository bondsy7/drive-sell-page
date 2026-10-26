# Vehicle Fidelity Check – minimaler Integrationsweg (nur Planung)

## Kernbefund im bestehenden Code

Ein Hintergrund-Prüfschritt existiert bereits. `remaster-vehicle-image` startet nach erfolgreicher Generierung per `EdgeRuntime.waitUntil` einen Felgenvergleich: Felgenreferenz gegen Ergebnisbild, Gemini, JSON `{match, reason}`. Das Ergebnis wird allerdings nur in die Serverlogs geschrieben und nirgends gespeichert oder ausgewertet (ca. Z. 1700–1740).

Daraus folgt der minimale Weg: kein neues System bauen, sondern genau diesen Hintergrund-Check zum allgemeinen Fidelity Check erweitern. Die Felgenreferenz bleibt dabei eine der Prüfquellen und wird nicht doppelt gebaut.

Was bereits vorhanden ist und wiederverwendet wird:
- **Referenzen:** Die Anfrage enthält schon alle Referenzen, die der Generator für genau dieses Bild bekommen hat: Hauptbild, Zusatzreferenzen mit Rollen und Felgenreferenz, jeweils als Gemini-File-URI oder OpenAI-file_id. Die Referenzbild-Zuordnung ist damit bereits erledigt, und es wird nichts neu hochgeladen.
- **Speicherung:** `savedDelivery` / `persistRemasterGallery` speichert das Ergebnis in `project_images`. Die Spalte `generation_context` (jsonb) wird dort schon beschrieben und kann den Prüfstatus aufnehmen, ohne neue Tabelle.
- **Telemetrie:** `generation_attempt_logs` mit `stage`, `status`, `attempt`, `engine` und `model` wird bereits pro Generierung geschrieben. Die Prüfung schreibt dort eine weitere Zeile mit `stage = 'fidelity'`.
- **Gewollte Abweichungen:** Die Kennzeichen- und Branding-Zonen (`branding-asset-scope`) sind im Job bekannt und werden dem Prüfer als „erlaubte Abweichung" mitgegeben.

## Ablauf (unverändert für den Nutzer)

```text
Generierung wie bisher ──► Bild ausgeliefert + gespeichert
   └─ waitUntil: Fidelity Check (ersetzt den heutigen Felgen-Check)
        PASS / UNCERTAIN ─► Status speichern, fertig
        FAIL ─► genau 1 Korrekturlauf (Selbstaufruf, gleicher Request + corrections[])
                 └─► korrigiertes Bild ersetzt das gespeicherte Bild
                 └─► erneuter Check
                      PASS / UNCERTAIN ─► fertig
                      FAIL ─► generation_context.fidelity.status = "needs_review"
```

Die Auslieferung wartet nie auf die Prüfung. Das erste Bild erscheint wie heute sofort. Ein korrigiertes Bild ersetzt es später still.

## Konkrete Änderungen (wenige Dateien)

1. **Neu: `supabase/functions/_shared/fidelity-check.ts`**, etwa 150 Zeilen und reine Funktionen:
   - Baut den Prüfprompt: nur Merkmale bewerten, die in den gelieferten Referenzen sichtbar sind; kein Wissen über Marke oder Modell; Perspektivwechsel erlaubt; nicht sichtbare Merkmale sind „unverifiable"; die Kennzeichen- und Branding-Zonen sind ausgenommen.
   - Enthält die Merkmalsliste aus der Vorgabe als feste Attribut-Keys (`body_shape`, `paint_color`, `wheel_design`, `lights`, `front_rear`, `bumpers`, `mirrors`, `window_line`, `roof`, `door_count`, `badges`, `sensors`, `interior`, `seats`, `cockpit`, `special_equipment`).
   - Erwartet als Antwort-JSON: `findings[{attribute, verdict: match|mismatch|unverifiable, confidence, evidence_ref, issue, instruction}]`.
   - Entscheidet deterministisch im Code, nicht durch das Modell: FAIL nur bei einem `mismatch` mit Konfidenz ≥ 0,8; UNCERTAIN bei einem Mismatch mit geringerer Konfidenz oder wenn kein einziges Merkmal prüfbar war; sonst PASS.
   - Erzeugt die Korrekturliste genau im Beispielformat `[{attribute, issue, instruction}]`.
2. **`remaster-vehicle-image/index.ts`**:
   - Der bestehende `bgCheck`-Block ruft den neuen Helper auf, statt nur die Felgen zu prüfen.
   - Als Eingabe gehen das Ergebnisbild, das Hauptreferenzbild und nur die relevanten Zusatzreferenzen mit: Felge nur bei Außenansicht, Innenraum nur bei Interieur-Zielen. Ausgewählt wird über die schon vorhandenen Rollen bzw. die `sourceRole` des V2/V3-Manifests.
   - Neues optionales Feld `fidelityCorrections[]`. Ist es gesetzt, wird es als zusätzlicher Block am Ende von `dynamicPrompt` angehängt. Die V1/V2/V3-Builder bleiben unverändert, und das fehlerhafte Bild wird nie als Referenz mitgeschickt.
   - Ein internes Flag `fidelityAttempt` (0/1) verhindert eine Schleife: Bei Attempt 1 erfolgt nach FAIL kein weiterer Retry.
   - Status, Score-Kurzinfo und Findings ohne Bilddaten kommen nach `project_images.generation_context.fidelity`, außerdem eine Zeile in `generation_attempt_logs` mit den Hashes von Referenzen und Ergebnis.
3. **Korrekturlauf:** Die Funktion ruft sich selbst innerhalb von `waitUntil` erneut auf, mit dem identischen Request-Body, `fidelityCorrections` und `fidelityAttempt = 1`. Das Selbstaufruf-Muster und der Service-Akteur (`_shared/internal-actor.ts`) existieren schon in `auto3-processing-job`. Gespeichert wird über denselben `gallerySave`-Zielwert mit Upsert auf dieselbe Bild-ID, also ohne Duplikat.
4. **UI (minimal):** In der bestehenden Galerie-Kachel bzw. Lightbox erscheint nur bei `generation_context.fidelity.status === "needs_review"` ein kleiner Hinweis „Abweichung erkannt – bitte Bild prüfen." Es kommt kein neuer Freigabeprozess und kein Wizard dazu.

Keine neue Tabelle, keine Migration nötig, sofern `generation_context` für alle betroffenen Bilder geschrieben werden darf; das wird beim Umsetzen am Schema bestätigt.

## Geltungsbereich und Einschränkung

- Die automatische Korrektur ist nur dort möglich, wo das Ergebnis serverseitig gespeichert wird, also wenn `gallerySave` gesetzt ist (Aufnahme- und Auto3-Flows). Nur dort kann ein korrigiertes Bild das gespeicherte ersetzen, auch wenn der Browser geschlossen ist.
- Pipeline- und Regenerations-Aufrufe ohne `gallerySave` speichern heute im Browser. Dort läuft im ersten Schritt nur der Check mit Protokollierung (Shadow), ohne Ersatz. Die Ausweitung ist Schritt 2.
- `generate-vehicle-image`, Banner und 360° bleiben zunächst unberührt. 360° hat bereits eine eigene Frame-QA.

## Kosten und Modell

- Pro Bild ein Prüfaufruf mit 2–3 kleinen Bildern über die bereits hochgeladenen Datei-Referenzen. Bei Flash-Klasse sind das grob 0,002–0,01 $, die Werte sind beim Umsetzen zu verifizieren.
- Der Korrekturlauf kostet so viel wie eine Generierung, fällt aber nur bei FAIL an.
- Der Prüfer stammt vom anderen Anbieter als der Generator, um Selbstbestätigung zu vermeiden. Bei Gemini-Bildern prüft OpenAI, bei OpenAI-Bildern Gemini, jeweils über die vorhandenen Schlüssel. Fällt der Prüfer aus, gilt das Ergebnis als UNCERTAIN und blockiert nichts.

## Stufen

1. **Shadow:** Der Check läuft und protokolliert nur, ohne Korrektur und ohne Hinweis. Erste Ergebnisse werden ausgewertet und die Konfidenzschwelle bei Bedarf angepasst.
2. **Aktiv:** Korrekturlauf und Hinweis bei `needs_review`, zunächst nur für Test-Accounts, danach für alle.

## Risiken

- **Perspektive und verdeckte Details:** werden als „unverifiable" behandelt und nie als FAIL. Ein FAIL entsteht nur bei hoher Konfidenz mit konkretem Beleg.
- **Bewusste Serienbelichtung:** Der Prüfer vergleicht den Farbton, nicht die Helligkeit.
- **Schlechte Originale:** führen zu UNCERTAIN statt FAIL.

## Offene Entscheidung

- Wer trägt die Kosten des Korrekturlaufs? Vorschlag: Er kostet den Händler keine Credits, weil die Ursache ein Systemfehler ist.
