# Spin360 V2 — Identitätsgesperrter 360°-Spin

Kurzreferenz für die aktuelle Implementierung. Reine Logik liegt in
`supabase/functions/_shared/spin360-core.ts` (öffentliche API: `_shared/spin360-v2.ts`,
Frontend-Re-Export: `src/lib/spin360-v2.ts`), Orchestrierung in
`supabase/functions/generate-360-spin/index.ts`.

## Pipeline-Reihenfolge (verbindlich)

```text
analyze → profile → keyframes(0…7) → validate_keyframe(0…7) → generate_frame(sector, planPosition) → assemble
```

- **analyze** — Quellwinkel plausibilisieren, Auswahl in `spin360_source_selection` schreiben,
  Radreferenz per Vision analysieren (`wheelSpec`). Bricht ab, wenn die Mindestabdeckung fehlt.
- **profile** — unveränderliches Identitätsprofil **vor** jeder Generierung. Speichert
  `identity_profile`, `identity_hash` und `qa_summary.identitySourceTier`.
- **keyframes** — 8 Keyframes (0/45/90/135/180/225/270/315), je Aufruf einer. Persistenz wird
  sofort verifiziert; ein fehlgeschlagener Schreibvorgang beendet den Job mit `[keyframes] …`.
- **validate_keyframe** — **ein** Keyframe und **ein** QA-/Reparaturversuch pro Invocation.
  Bestanden ⇒ nächster Keyframe, sonst nächster Versuch (max. `MAX_KEYFRAME_ATTEMPTS`).
- **generate_frame** — **ein** Zwischenframe-Versuch pro Invocation (Sektor + Planposition +
  Versuch). Bestanden ⇒ nächste Planposition, nach der letzten ⇒ nächster Sektor, nach Sektor 7 ⇒ assemble.
- **assemble** — Manifest v2, Credits nach bestandener QA, Status `completed` oder `needs_review`.

Jede Einheit ist **idempotent**: bereits bestandene Keyframes/Frames werden übersprungen, sodass
ein Job nach einem Timeout einfach wieder aufgenommen werden kann. Der aktuelle Stand liegt in
`qa_summary.pipeline_cursor`. Die alten Schritte `validate_keyframes` und `frames` bleiben als
Alias erhalten.

## Fehlerbehandlung und Abrechnung

- Kritische DB-Schreibvorgänge (Quellauswahl, Keyframes, Frames, Job-Updates) werden geprüft;
  bei Fehlern endet der Job sofort mit einer stufenspezifischen Meldung `[stage] …` statt mit
  einer Folgemeldung wie „Nicht alle Keyframes vorhanden".
- Credits werden idempotent über Marker in `qa_summary.billing` gebucht: `analysis`,
  `keyframe:<winkel>` (erst nach erfolgreicher Persistenz) und `frames` (erst nach der QA).
  Wiederholte oder wiederaufgenommene Invocations buchen nicht doppelt.


## Quellenpriorität

| Rang | Quelle | Verwendung |
| --- | --- | --- |
| 1 | `original` | Identitätswahrheit |
| 2 | `upload` | Identitätswahrheit, wenn keine Originale |
| 3 | `gallery` | Fallback mit niedrigerem Vertrauen (`identitySourceTier`) |
| — | generierte Spin-Frames | **niemals** Identitätsquelle, nur Kontinuitätskontext |

Der `SpinSourcePicker` bietet ausschließlich Originale und Galeriebilder an; die Radreferenz
folgt derselben Regel.

## Mindestabdeckung

Pflicht sind die vier Kardinalwinkel **0°, 90°, 180°, 270°** (`REQUIRED_SOURCE_ANGLES`,
`MIN_SOURCE_ANGLES = 4`). Die vier Diagonalen (45/135/225/315) sind optional und erhöhen die
Qualität. Client und Edge Function prüfen identisch über `evaluateSourceCoverage`; bei
Unterdeckung startet kein Job.

## Modelle

| Zweck | Modell |
| --- | --- |
| Analyse, Identitätsprofil, QA | `gemini-3.7-flash` |
| Standard-Bildgenerierung/Reparatur | `gemini-3.1-flash-image` |
| Letzte Reparaturstufe / High Fidelity | `gemini-3-pro-image` |

Keine Cross-Engine-Fallbacks, keine Preview-Modell-IDs.

## QA-Schwellen (fail closed)

Ein Frame besteht nur bei **allen** Bedingungen:

- `verdict === 'pass'`
- keine `hard_failures`
- alle 8 Dimensionen vorhanden und **≥ 95** (identity, wheels, lights, paint,
  angle_continuity, camera_continuity, environment, artifact_free)
- `confidence ≥ 90` (0–1-Werte werden auf 0–100 normalisiert)

Fehlende Werte, Parse-Fehler oder API-Ausfälle ⇒ `regenerate` / `manual_review`, nie `pass`.

## Reparaturen

Keyframes und Zwischenframes: 1 Erstversuch + 2 Standard-Reparaturen + 1 Reparatur mit dem
High-Fidelity-Modell. Der Reparatur-Prompt (`buildRepairPrompt`) enthält die exakten
`hard_failures` **und** `repair_instructions` der QA sowie die Anweisung, alles Übrige
(Winkel, Kamera, Karosseriegeometrie, Framing, Szene, Licht) unverändert zu lassen.
**Kein** Nachbar-Duplikat, **keine** Interpolation als Füller: bleibt ein Pflicht-Frame nach der
letzten Reparatur durchgefallen, endet der Job in `needs_review`.

## Winkelraster

| Tier | Frames | Schritt | Winkel |
| --- | --- | --- | --- |
| Produktion | 48 | 7,5° | 0, 7.5, 15, … 352.5 |
| Diagnose | 32 | 11,25° | 0, 11.25, 22.5, … |

Winkel werden als `numeric` mit Nachkommastellen gespeichert (kein Runden). Sektor-Offsets
bidirektional: 32 → `[1,3,2]`, 48 → `[1,5,2,4,3]`; Sektor 7 wickelt 315° → 0°.

## Abschlusskriterium

`completed` nur bei exakt `targetFrameCount` eindeutigen Indizes `0…n-1`, jedem Frame
`validation_status = 'passed'` und jedem Winkel exakt auf dem Raster (Toleranz 0.001°).
Sonst `needs_review`. Es gibt keine „80 % reicht“-Regel.

## Manifest v2

```json
{ "version": 2, "type": "auto3-spin", "jobId": "…", "vehicleId": "…", "vin": "…",
  "frameCount": 48, "targetFrameCount": 48, "angleStep": 7.5, "direction": "clockwise",
  "startAngle": 0, "frames": [{ "index": 0, "angle": 0, "src": "…" }],
  "qaSummary": { }, "qualityScore": 97, "identityHash": "…" }
```

Das vollständige Identitätsprofil verlässt den Server nicht — nur der Hash.

## Legacy

Alte Jobs (Manifest v1, Video2Frames, `target_frame_count = 36`) bleiben lesbar und werden
nicht migriert oder dedupliziert. Die V2-Regeln gelten nur für neue Jobs.
