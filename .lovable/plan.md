## Ziel

`/generator/fotos` bekommt eine vorgeschaltete Fahrzeugart-Auswahl (nur **Pkw** und **Lkw**). Pkw läuft danach exakt wie heute weiter. Lkw bekommt einen eigenen 3-stufigen Assistenten, eigene Foto-Slots, eigene Prompts und eine `remaster_only`-Pipeline. Die Architektur wird so gebaut, dass weitere Fahrzeugklassen später nur noch Konfiguration brauchen — ohne dass jetzt irgendwo sichtbar oder funktional vorhanden.

## Bestandsaufnahme (geprüft)

- `src/components/ImageCaptureGrid.tsx` (1011 Z.): hartcodiertes `SLOTS`-Array mit 6 Pkw-Slots, Upload, Kompression, Remaster-Aufruf, VIN-Lookup, rendert `RemasterOptions` + `PipelineRunner`.
- `src/lib/pipeline-jobs.ts` (905 Z.): globale `PIPELINE_JOBS`-Liste mit Kategorien `hero | exterior | interior | detail | composite | ci`.
- `src/lib/remaster-prompt.ts` (621 Z.): `buildMasterPrompt(config, vehicleDescription, slotKey, overrides)` setzt aus `REMASTER_PROMPT_BLOCKS` (Defaults + Admin-Overrides aus `admin_settings.ai_prompts`) einen Masterprompt zusammen; enthält heute bereits Lkw-Sonderregeln (Auflieger, Sideskirts, Spiegel), die künftig ins Lkw-Modul wandern.
- `src/contexts/PipelineContext.tsx`: `startPipeline(config)`, ruft `buildMasterPrompt` als Basiskontext und hängt Job-Prompts an.
- `supabase/functions/remaster-vehicle-image`: nimmt `dynamicPrompt` entgegen, sonst `buildFallbackPrompt()`. Keinerlei Fahrzeugklassen-Kenntnis.
- `admin_settings.ai_prompts` ist ein JSONB-Key-Value-Store → neue Prompt-Keys brauchen **keine** Migration.
- `projects.vehicle_data` und `image_generation_jobs.config` sind JSONB → Auswahlwerte passen dort hinein, **keine** Schemaänderung nötig.

## 1. Neue Dateien

**Registry & Konfiguration**
- `src/config/vehicle-classes.ts` — `VehicleClassKey` (alle künftigen Keys typisiert), `ACTIVE_VEHICLE_CLASSES = ['car','truck']`, `VehicleClassProfile`-Interface, `VEHICLE_CLASS_PROFILES`-Record, `resolveVehicleClass(data)` (fehlend → `'car'`), `getActiveProfiles()`.
- `src/config/profiles/car-profile.ts` — kapselt die **heutigen** Pkw-Slots (1:1 aus `ImageCaptureGrid`), Pipeline-Policy `full`, verweist auf bestehende `PIPELINE_JOBS`-Keys und die bestehenden Source-Coverage-Regeln. Keine inhaltliche Änderung.
- `src/config/profiles/truck-profile.ts` — Lkw-Profil, Policy `remaster_only`.
- `src/config/truck-workflow.ts` — zentrale Entscheidungstabelle: pro `TruckConfigurationKey` → erlaubte Aufbauarten, ob Schritt 2/3 nötig, `subjectScope`, Slot-Bausteine, Pipeline-Kategorien, Prompt-Modul-Keys. Funktionen: `getTruckSteps(sel)`, `getAllowedBodyTypes(cfg)`, `needsCargoStep(cfg, body)`, `resolveSubjectScope(sel)`, `buildTruckSlots(sel)`.
- `src/config/truck-slots.ts` — alle Lkw-Slot-Definitionen (Key, deutsches Label, Hinweis, Pflichtstatus, Seitenverhältnis, Coverage-Tags) als Bausteine, die `buildTruckSlots` je Konfiguration kombiniert.

**Prompts (modular, namespaced)**
- `src/prompts/remaster/base.ts` — nur wirklich gemeinsame Regeln (Referenz-Wahrheit, keine Personen, nicht spiegeln, nicht beschneiden, Perspektive halten).
- `src/prompts/remaster/car.ts` — Pkw-Identity-Lock: übernimmt die bestehenden Pkw-Blöcke **unverändert** per Re-Export aus `remaster-prompt-defaults.ts`; Lkw-spezifische Blöcke (Auflieger, Sideskirts, Spiegelsystem) werden dort **herausgelöst** und nach `truck.ts` verschoben.
- `src/prompts/remaster/truck.ts`, `truck-configurations.ts`, `truck-body-types.ts`, `truck-cargo-states.ts`.
- `src/prompts/pipeline/truck.ts` (Phase 3 vorbereitet, aktuell nur remaster-relevante Perspektivtexte).
- Spiegelbild in der Edge Function: `supabase/functions/_shared/prompts/truck.ts` (+ `base.ts`) für die serverseitige Validierung/Fallback-Komposition.

**UI**
- `src/components/capture/VehicleClassPicker.tsx` — zwei große Karten (Pkw / Lkw) mit Linien-Icons.
- `src/components/capture/TruckWizard.tsx` — 3 Schritte, immer nur einer sichtbar, Zurück-Button, Auswahl bleibt erhalten.
- `src/components/capture/truck-sketches/` — technisch korrekte **Inline-SVG-Skizzen** (Zugmaschine ohne Aufbau, Motorwagen, Motorwagen+Anhänger, Sattelzug, Sattelzug+Anhänger, nur Anhänger; sowie Aufbauarten je Konfiguration). SVG statt Bitmaps: scharf auf Mobil, keine Assets zu pflegen, technische Details (Achsen, Kupplung, Königszapfen) exakt zeichenbar.

**Tests**
- `src/test/vehicle-class-registry.test.ts`, `src/test/truck-workflow.test.ts`, `src/test/truck-prompt-composition.test.ts`, `src/test/car-regression.test.ts` — decken die 30 Abnahmekriterien ab (siehe Abschnitt Tests).

## 2. Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/types/vehicle.ts` | optionale Felder `vehicleClass`, `truckConfiguration`, `truckBodyType`, `cargoState`, `subjectScope` — rein additiv |
| `src/components/ImageCaptureGrid.tsx` | `SLOTS` wird durch `profile.captureSlots` ersetzt; für `car` liefert das Profil exakt die heutigen 6 Slots. Neu: vorgeschalteter Klassen-Picker + Lkw-Wizard, Slot-Rendering respektiert `aspectRatio`. Keine Änderung an Upload-/Kompressions-/Remaster-Logik |
| `src/lib/remaster-prompt.ts` | `buildMasterPrompt` bekommt optionalen 5. Parameter `classContext: VehicleClassContext`. Ohne Kontext → Verhalten wie heute (Pkw). Mit `truck` → Pkw-Identity-Lock wird **nicht** geladen, stattdessen Lkw-Module |
| `src/lib/remaster-prompt-defaults.ts` | Lkw-lastige Blöcke (`TRACTOR_TRAILER_SEPARATION`, `side_skirt_lock`, `MIRROR_SYSTEM_LOCK`) nach `prompts/remaster/truck.ts` verschieben; Pkw-Blöcke unverändert. Prompt-Keys bleiben erhalten → bestehende Admin-Overrides bleiben gültig |
| `src/lib/pipeline-jobs.ts` | `PIPELINE_JOBS` unverändert; neu: `getJobsForProfile(profile, selection)` filtert nach `allowedPipelineJobs`. Pkw bekommt weiterhin die volle Liste |
| `src/contexts/PipelineContext.tsx` | `PipelineConfig` um `classContext` erweitert; wird an `buildMasterPrompt` und in jeden Job-Payload durchgereicht und in `image_generation_jobs.config` mitgespeichert |
| `src/components/PipelineRunner.tsx` | Kategorien und Jobs aus dem Profil statt fest; Lkw zeigt Warnhinweis + „nur Remastering“-Modus; Credits nur für ausführbare Jobs |
| `src/components/RemasterOptions.tsx` | Szenen-/Cleanup-Optionen profilabhängig (z. B. „Auflieger entfernen“ nur bei Lkw und nur wenn zur Konfiguration passend) |
| `src/lib/remaster-invoke.ts` | Payload um `vehicleClass`, `truckConfiguration`, `truckBodyType`, `cargoState`, `subjectScope`, `sourcePerspectiveKey` erweitert |
| `supabase/functions/remaster-vehicle-image/index.ts` | Neue Felder lesen, **serverseitig validieren**, Prompt aus den passenden Modulen zusammensetzen; bei fehlenden/widersprüchlichen Werten 400 ohne API-Call und ohne Credit-Abzug |
| `src/pages/Index.tsx` (Autosave) | schreibt die neuen `vehicle_data`-Felder mit |
| `src/pages/admin/AdminPrompts.tsx` | neue Sektion „Remastering – Lkw“ mit den geforderten Gruppen und Keys; Pkw-Gruppen unangetastet |
| `src/components/dashboard/*` / Galerie | Labels aus Slot-Keys + `generationMode` ableiten; Bilder ohne Metadaten fallen auf heutige Darstellung zurück |

## 3. Wie der Pkw-Prozess unverändert bleibt

- Das Car-Profil ist eine **wörtliche Kopie** der heutigen `SLOTS` und der heutigen Job-Auswahl; kein Slot-Key, kein Pipeline-Key wird umbenannt.
- `buildMasterPrompt` ohne `classContext` verhält sich byte-identisch — abgesichert durch einen Snapshot-Test, der den heutigen Pkw-Prompt einfriert (Snapshot wird **vor** dem Refactor erzeugt).
- Kein Lkw-Modul kann in einen Pkw-Prompt gelangen: die Komposition erlaubt nur Module, die im aufgelösten Profil gelistet sind; ein Test prüft, dass im Pkw-Prompt keine Lkw-Marker (`TRACTOR`, `TRAILER`, `SEMI_`, `CARGO_`) vorkommen und umgekehrt kein Pkw-Marker im Lkw-Prompt.

## 4. Datenfluss der Auswahl

```text
VehicleClassPicker ─► TruckWizard ─► TruckWorkflowSelection
        │                                  │
        ▼                                  ▼
 vehicle_data.vehicleClass       vehicle_data.truckConfiguration
                                 vehicle_data.truckBodyType
                                 vehicle_data.cargoState
                                 vehicle_data.subjectScope
        │
        ├─► ImageCaptureGrid  → Slots
        ├─► remaster-invoke   → Edge-Function-Payload  → Promptkomposition
        ├─► PipelineContext   → image_generation_jobs.config
        └─► project_images    → Metadaten für Galerie-Labels
```

Persistenz gegen Seitenwechsel: Auswahl liegt in `vehicle_data` (autosave) **und** gespiegelt in `sessionStorage` unter `truck-workflow:<projectId|draft>`, damit ein Reload vor dem ersten Speichern nicht verloren geht.

## 5. Datenbank

Keine Migration nötig:
- Auswahlwerte → `projects.vehicle_data` (JSONB) und `vehicles.vehicle_data` (JSONB, per bestehendem Write-Through).
- Job-Metadaten → `image_generation_jobs.config` (JSONB).
- Bild-Metadaten → `project_images.gallery_folder` bleibt wie bisher; zusätzliche Metadaten werden im Job-Config referenziert (kein neues Feld). Falls sich in Phase 2 zeigt, dass Galerie-Labels ohne Bildzeilen-Metadaten nicht sauber ableitbar sind, kommt dort eine additive JSONB-Spalte `metadata` — erst dann, mit separatem Hinweis.
- Neue Prompt-Keys → `admin_settings.ai_prompts` (JSONB), keine Migration.

## 6. Abwärtskompatibilität

- `resolveVehicleClass()` liefert für alles ohne `vehicleClass` konsequent `'car'`.
- Lkw-Felder werden für Pkw-Projekte nie gelesen oder gesetzt.
- Alte `image_generation_jobs` ohne `classContext` werden als Pkw interpretiert und bleiben lesbar.
- Alte Galerieeinträge ohne Metadaten behalten ihre heutigen Labels.
- Keine Spalte, kein Prompt-Key, kein Pipeline-Key wird entfernt oder umbenannt.

## 7. Source-Coverage

`src/lib/source-coverage.ts` (neu) mit `checkCoverage(jobKey, availableSlotKeys, profile, selection)`:
- Pkw: bestehende Regeln unverändert übernommen.
- Lkw: die im Auftrag genannten Mappings, zusätzlich gefiltert nach `truckConfiguration` (bei `tractor_unit` keine Trailer-Quellen verlangt, bei `trailer_only` keine Cockpit-Quellen).
- Ergebnis steuert UI (Job deaktiviert + Klartext „Fehlende Aufnahme: Seite links“), Credit-Berechnung und Job-Start.

## 8. Serverseitige Validierung

In der Edge Function vor jedem Modell-Call:
1. `vehicleClass` bekannt und aktiv.
2. Bei `truck`: `truckConfiguration` gesetzt; `truckBodyType` konsistent (bei `tractor_unit` muss `null` sein); `cargoState` konsistent (bei `tank` → `not_applicable`); `subjectScope` passt zur Konfiguration.
3. Promptprofil auflösbar, geladene Module gehören alle zur Klasse.
Bei Verstoß: HTTP 400 mit verständlicher deutscher Meldung, kein API-Call, kein Credit-Abzug.

## 9. Erweiterungspunkte für spätere Fahrzeugarten

Vorbereitet, aber **nicht** funktional:
- `VehicleClassKey` enthält die künftigen Keys bereits als Typ-Union; `ACTIVE_VEHICLE_CLASSES` enthält nur `car` und `truck`. UI iteriert ausschließlich über die aktive Liste.
- `VehicleClassProfile` deckt Capture-, Remaster-, Pipeline- und Validation-Profil generisch ab; optionale Felder für spätere Klassen sind im Interface vorgesehen.
- Prompt-Keys sind durchgängig namespaced (`remaster_<class>_...`).
- Keine `switch (vehicleClass)`-Blöcke in Komponenten — nur Lookups in der Registry.
Ein späteres Profil ergänzt man durch: Key aktivieren, Profil + Slots + Promptmodul + Coverage-Regeln registrieren. Keine Änderung an `ImageCaptureGrid`, `PipelineRunner`, `PipelineContext`, Edge Function oder Galerie nötig.

## 10. Umsetzung in testbaren Schritten

1. **Snapshot sichern** — heutiger Pkw-Prompt + heutige Slot-/Job-Liste als Regressionstest einfrieren.
2. **Typen & Registry** — `vehicle.ts` erweitern, Registry + Car-Profil (reine Kapselung, kein Verhalten geändert). Test 1–4.
3. **Prompt-Modularisierung** — `prompts/`-Struktur, Lkw-Blöcke aus den Pkw-Defaults herauslösen, Leakage-Tests.
4. **Klassen-Picker + Lkw-Wizard** inkl. SVG-Skizzen und Persistenz. Test 5, 10–17.
5. **Dynamische Slots** aus `truck-workflow.ts`. Test 6, 14, 18–20.
6. **Payload + Edge-Function-Validierung + Lkw-Promptkomposition**. Test 7–9, 21–26, 29, 30.
7. **Pipeline `remaster_only`** für Lkw, Kategorienfilter, Coverage, Credits. Test 27.
8. **Galerie-Labels & Job-Metadaten**. Test 28.
9. **Admin-Promptgruppen** für Lkw.

Phase 2 (Coverage-Feintuning, Slotprofile, Qualitätstests mit echten Lkw-Fotos) und Phase 3 (einzelne freigeschaltete Lkw-Pipeline-Jobs) folgen separat.

## Technische Hinweise

- TypeScript strikt, keine neuen `as any` in Kernkomponenten.
- `usePipelineSafe` bleibt der Zugriffsweg auf den Pipeline-Kontext.
- Upload-, Kompressions- und Gemini-File-API-Pfad bleiben unverändert.
- Lkw-Slots mit Seitenverhältnis 2:1 rendern als breite Karten, die auf Mobil volle Breite einnehmen.
