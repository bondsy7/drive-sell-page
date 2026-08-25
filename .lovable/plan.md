# 360° Spin – Redesign (Analyse + Architektur)

Analyse des Ist-Stands und Zielarchitektur für einen eigenen, flipbook-artigen 360°-Spin mit maximaler Identitätstreue aus bereits vorhandenen, VIN-verknüpften Fahrzeugbildern. Kein Code in diesem Schritt.

## 1. Ist-Zustand (verifiziert)

**Image2Spin** (`supabase/functions/generate-360-spin/index.ts`, 816 Zeilen, Schritte analyze → normalize → profile → anchor → frames → assemble):
- Bildgenerierung läuft über `callImageGeneration(..., "gemini-2.5-flash")` mit Fallback-Kette `gemini-2.0-flash-exp`, `gemini-2.0-flash-preview-image-generation`. Das sind veraltete bzw. für Bilderzeugung ungeeignete Modelle — der Rest des Projekts nutzt bereits `gemini-3.1-flash-image-preview` / `gemini-3-pro-image-preview` (`generate-banner` MODEL_MAP).
- Pro Frame wird **genau ein** Referenzbild mitgegeben (nächstgelegenes Canonical). Kein Multi-Referenz-Kontext, keine Verkettung mit dem Nachbarframe → Identitäts- und Lichtdrift über 36 Frames.
- Jeder erzeugte Frame wird ungeprüft mit `validation_status: "passed"` gespeichert. Es gibt keinerlei QA-Stufe, obwohl das Schema `validation_status` / `validation_notes` vorsieht.
- Schlägt „normalize“ fehl, wird **das Originalfoto** als Canonical eingetragen (Zeilen 404–410) → Mischung aus Studio-Freistellung und Straßenfoto in derselben Sequenz.
- Winkel-Semantik ist inkonsistent: Canonicals liegen auf 0/90/180/270 mit `left=90`, die Anker-Referenzen mappen 135° auf „left“ und 225° auf „rear“; Prompts beschreiben Winkel rein textuell („90 degrees from center front“) — ein Bildmodell hält daraus keine gleichmäßigen 10°-Schritte ein.
- Credits (1 + 4 + 15) werden **vor** jeder Qualitätsprüfung abgebucht.
- Uploads gehen als Inline-Base64 an Gemini, nicht über die File API (widerspricht der projektweiten „File API First“-Regel).

**Video2Frames** (`Video2FramesProcessor.tsx` + `generate-video`): Veo `veo-3.1-generate-preview` erzeugt ein 8-Sekunden-Turntable, Frames werden **im Browser-Tab** per `<video>`+Canvas extrahiert und einzeln hochgeladen. Tab-Wechsel/Schließen bricht ab; Start-Flicker wird per Pixel-Differenz weggeschnitten (Heuristik); Rotationsgeschwindigkeit ist nicht garantiert konstant → ungleichmäßige Winkelabstände.

**Assets/Schema:** `spin360_jobs` (vehicle_id, project_id, identity_profile, manifest, target_frame_count, retry_count), `spin360_source_images`, `spin360_canonical_images`, `spin360_generated_frames`. `useVehicleAssets` + `VehicleAssetPicker` können bereits Originals/Gallery/Spin/Banner/Video pro `vehicle_id` auflisten — **der Spin-Workflow nutzt das nicht**, `Spin360Upload` verlangt immer 4 (bzw. 3) frische Uploads. `classify-vehicle-images` liefert bereits genau die Kategorien (`exterior_front`, `exterior_34_front`, `exterior_side_left`, …), die für die Quellenauswahl gebraucht würden.

**Viewer** (`Spin360Viewer.tsx`): Preload-Effekt hat `loadedFrames` in den Dependencies und setzt `loadedFrames` → Re-Render-Schleife pro geladenem Bild. Alle Frames sind volle PNGs ohne Sprite-Sheet/WebP/Responsive-Größen; kein Tastatur-Support, kein Trägheits-Drag, kein Embed-Modus.

## 2. Warum es visuell scheitert

1. Falsches Modell-Tier für Bildgenerierung (2.5-flash statt der 3.x-Image-Modelle).
2. Ein-Bild-Referenz ohne Frame-zu-Frame-Verkettung → Räder, Felgendesign, Leuchtensignatur und Lackton „wandern“.
3. Winkel nur als Text statt als geometrisch verankerte Keyframe-Interpolation → ungleiche Schritte, Rückwärtssprünge, doppelte Ansichten.
4. Keine Validierung/Regeneration: jeder Ausreißer landet in der Sequenz.
5. Fallback auf unnormalisierte Originale zerstört die Hintergrund-/Licht-Konsistenz.
6. Client-seitige Video-Extraktion ist fragil und liefert nicht-äquidistante Winkel.

## 3. Wiederverwenden / Ersetzen

**Wiederverwenden:** Job-/Frame-Tabellen inkl. Step-Self-Invoke-Architektur, `useVehicleAssets` + `VehicleAssetPicker`, `classify-vehicle-images`, `analyze-wheel-reference` + `WHEEL_REFERENCE_LOCK`, `uploadToGeminiFiles`, Credit-/Prompt-Override-Mechanik (`admin_settings.ai_prompts`), Realtime-Statuspolling, `AiDisclosureBadge`.

**Ersetzen:** Modell-Routing im Spin, Prompt-Aufbau, Referenzstrategie, Normalisierungs-Fallback, Frame-Validierung, Quellenerfassung (Upload-Zwang), Frame-Extraktion aus Video (nach serverseitig), Viewer-Rendering-Pfad.

**Optional entfallen lassen:** Video2Frames als Primärpfad → nur noch als „Fallback/Experiment“-Tier hinter einem Flag.

## 4. Zielarchitektur (Phasen)

**Phase 0 – Quellenauswahl statt Upload.** Einstieg in den Spin über Fahrzeug/VIN: `VehicleAssetPicker` mit `allowedKinds=['gallery','original']` vorschalten; `classify-vehicle-images` schlägt automatisch Front/Heck/Links/Rechts (+ 3/4) vor, Nutzer bestätigt oder tauscht. Upload bleibt nur Ergänzungspfad für fehlende Perspektiven. Remasterte Galeriebilder werden bevorzugt (bereits freigestellt/konsistent).

**Phase 1 – Canonical- und Keyframe-Strategie.** 8 Keyframes statt 4: 0/45/90/135/180/225/270/315. Vorhandene Fotos belegen so viele Keyframes wie möglich; nur fehlende werden generiert. Alle Keyframes durchlaufen zwingend dieselbe Normalisierung (identischer Hintergrund, Bodenschatten, Kamerahöhe, Brennweite, Fahrzeug-Bounding-Box). Kein Fallback auf Rohfotos — schlägt Normalisierung dreimal fehl, wird der Job als `needs_review` markiert.

**Phase 2 – Zwischenframes per Doppel-Anker-Interpolation.** Jeder Zwischenframe erhält als Referenzen: linker Keyframe + rechter Keyframe + zuletzt akzeptierter Nachbarframe + Felgen-Referenz + Identity-Profil-JSON. Erzeugung sektorweise in Winkelreihenfolge, damit die Kette nie über einen Keyframe hinaus driftet.

**Phase 3 – Validierung & gezielte Regeneration.** Nach jedem Sektor ein Vision-QA-Call (`gemini-2.5-flash`, JSON): Farbe, Felgendesign, Karosserieform, Türanzahl, Blickwinkel-Plausibilität, Hintergrund-Homogenität, Artefakte. Ergebnis in `validation_status` (`passed`/`failed`) + `validation_notes` + Score. Fehlgeschlagene Frames werden mit verschärftem Prompt bis zu 2× neu erzeugt; danach Interpolation aus Nachbarn oder Job `needs_review`.

**Phase 4 – Viewer & Export.** Neuer Renderpfad: WebP-Derivate in zwei Größen, Sprite-Sheets pro 12 Frames, Preload nur ±3 mit `requestIdleCallback`, Trägheits-Drag, Tastatursteuerung, Fixierung des Preload-Effekt-Loops. Export: ZIP der Frames, `manifest.json` (Version, Winkelraster, Frame-URLs, Identity-Hash) und ein `<script>`-Embed über `public/embed.js` analog zur bestehenden Banner-Auslieferung.

## 5. Prompt-Design-Prinzipien

- **Reference Truth Protocol** wie im Remastering: „Use ONLY the reference images. Do NOT invent colors, badges, wheels, trim. Do NOT fall back on generic model knowledge.“
- **Identity Lock als strukturiertes JSON** (Lackton + Finish, Felgendesign, Leuchtensignaturen, Grill, Spiegeltyp, Dachlinie, Badges, Türanzahl) — immer wörtlich mitgeschickt, nie paraphrasiert.
- **Geometrie explizit**: Kamerahöhe, Abstand, Brennweite, Fahrzeugmitte im Bild, Bodenschatten-Position, „exactly N degrees clockwise from the FIRST reference image, not from the second“.
- **Szene eingefroren**: identischer Hintergrund-Gradient und Lichtaufbau als wörtlich wiederholter Block über alle Frames.
- **Negativliste**: keine zweiten Fahrzeuge, keine Personen, keine Kennzeichen, keine Reflexionen fremder Objekte, kein Text/Watermark.
- **Kein „ALWAYS generate an image“** mehr — eine Verweigerung ist ein verwertbares Fehlersignal, erzwungene Ausgabe erzeugt Halluzinationen.

## 6. Modellwahl

| Aufgabe | Modell |
| --- | --- |
| Analyse, Identity-Profil, QA | `gemini-2.5-flash` (JSON) |
| Normalisierung der Keyframes | `gemini-3-pro-image-preview` |
| Zwischenframes | `gemini-3.1-flash-image-preview` |
| Regeneration nach QA-Fail | `gemini-3-pro-image-preview` |
| Video-Fallback | `veo-3.1` (nur hinter Flag) |

Tier→Engine bleibt bindend, kein Cross-Engine-Fallback. Alle Bildtransfers über die Gemini File API.

## 7. Datenmodell-Änderungen

- `spin360_generated_frames`: UNIQUE `(job_id, frame_index)`, `quality_score int`, `attempt_count int`, `source_kind` (`photo`|`normalized`|`generated`|`interpolated`), `reference_frame_ids uuid[]`, `angle_degrees` auf NOT NULL.
- `spin360_jobs`: `source_mode` (`existing_assets`|`upload`|`video`), `keyframe_count`, `qa_summary jsonb`, `manifest_version`, `identity_hash`.
- `spin360_canonical_images`: `angle_degrees`, `is_generated bool`, `normalization_status`.
- Neu `spin360_frame_reviews`: Frame-QA-Historie (job_id, frame_index, attempt, verdict, notes, model_used).
- Neu `spin360_source_selection`: welche `project_images`/Originals-Pfade einem Keyframe zugeordnet wurden (Reproduzierbarkeit ohne Re-Upload).
- GRANTs + RLS für alle neuen Tabellen analog zum Bestand; Credits erst nach bestandener QA final verbuchen (Reservierung → Commit).

## 8. Reihenfolge der Umsetzung

1. Datenmodell + Constraints, Quellenauswahl aus vorhandenen Assets.
2. Keyframe-Normalisierung mit hartem Fail statt Rohfoto-Fallback.
3. Doppel-Anker-Frame-Generierung mit neuem Modell-Routing.
4. QA + gezielte Regeneration, Credit-Commit nach QA.
5. Viewer-Performance, Export/Embed.
