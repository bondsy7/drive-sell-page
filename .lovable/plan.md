# Nano Banana 2.1 als separater Pfad (Analyse + Plan)

## 1. Ist-Zustand (gefunden)

### Remastering (Einzelbild je Upload-Slot)
- `src/lib/remaster-prompt.ts`
  - `buildMasterPrompt(config, …, slotKey, …, { vehicleClass })` (Z. 360) setzt den Gesamtprompt zusammen.
  - `getPerspectivePrompt(slotKey)` (Z. 238) mit `<CURRENT_PERSPECTIVE>`-Blöcken je Slot: `34front`, `side`, `rear`, `interior-front`, `interior-rear` (SHOT_TYPE / CAMERA_ANGLE / FRAMING / STRUCTURAL_INTEGRITY / FORBIDDEN …).
  - Feste Locks: `PAINT_SCHEME_LOCK`, `CHROME_TRIM_LOCK`, `INTERIOR_CONSOLE_LOCK`, `ASYMMETRIC_EQUIPMENT_LOCK`, `WHEEL_VISIBILITY_RULE`, `buildWheelReferenceLock()`.
- `src/lib/remaster-prompt-defaults.ts` – Admin-pflegbare Blöcke (DB-überschreibbar): `remaster_base_instruction`, `remaster_identity_lock`, `remaster_vehicle_scale_lock`, `remaster_mirror_system_lock`, `remaster_side_skirt_lock`, `remaster_anti_cropping`, `remaster_scene_lighting_exterior/_interior`, `remaster_custom_showroom`, `remaster_negative_constraints`, `remaster_interior_rules`, `remaster_license_plate_remove/_blur`.
- `src/prompts/remaster/{car,truck,van,motorcycle,motorhome,machinery}.ts` – klassengetrennte Profile (`SHARED_PROMPT_BLOCK_KEYS`).
- `src/lib/vehicle-generation-lock.ts` – `buildVehicleGenerationLock()` (Generations-/Facelift-Schutz, VIN-Beschreibung bereinigt).

### Pipeline-Perspektiven (abgeleitete Ansichten)
- `src/lib/pipeline-jobs.ts` – `PIPELINE_JOBS`, je Job nur perspektivischer XML-Text (globale Regeln kommen aus `buildMasterPrompt`):
  Hero `MASTER_IMAGE`; Außen `EXT_FRONT`, `EXT_REAR`, `EXT_SIDE_LEFT`, `EXT_SIDE_RIGHT`, `EXT_34_FRONT_RIGHT`, `EXT_34_REAR_LEFT`, `EXT_34_REAR_RIGHT`, `EXT_LOW_ANGLE`, `EXT_ELEVATED_FRONT`; Innen `INT_DASHBOARD`, `INT_REAR_SEATS`, `INT_WIDE_CABIN`; Detail `DET_HEADLIGHT`, `DET_TAILLIGHT`, `DET_WHEEL`, `DET_GRILLE`; Grids `GRID_EXTERIOR_4`, `GRID_INTERIOR_4`, `GRID_SOCIAL_MEDIA`; CI-Jobs (BMW, Mercedes, Audi, VW, Porsche, Volvo).
  - Helfer: `injectLogoPlaceholder` (`{{LOGO_LINE}}`), `applyPromptOverrides`, `getJobsForProfile`, `getPipelineJobsForVehicleClass`, `jobNeedsWheelReference`.
- Klassen-Jobs: `pipeline-jobs-van.ts`, `-motorhome.ts`, `-motorcycle.ts`, `-machinery.ts`.
- OneShot/Auto3: `src/lib/oneshot-prompts.ts`, `src/lib/auto3-processing.ts` (gleiche Builder).

### Zusammenbau, Referenzzuordnung
- `src/contexts/PipelineContext.tsx`: kombiniert Master- + Job-Prompt, fügt Seiten-Richtungs-Locks ein (~Z. 281), ordnet Referenzen zu: `inferPrimaryReferenceIndex` (Rollen-Regex je Job, z. B. `EXT_SIDE_RIGHT → side_right`, ~Z. 226/255), `getInteriorReferenceIndices`, Supporting-Images, Upload via Gemini File API (~Z. 783ff).
- `src/lib/regeneration-seed.ts`, `src/lib/regeneration-context.ts` – Neu-Generierung (Original/Referenz als Seed, gespeicherter Look).

### Server und Model-Routing
- `supabase/functions/remaster-vehicle-image/index.ts`
  - `ENGINE_MAP` (Z. 523): `qualitaet → gemini-3.1-flash-image-preview` (NB 2), `premium → gemini-3-pro-image-preview`, OpenAI-Tiers; bereits vorhanden `nb21 → 'gemini-nano-banana-2.1'`.
  - Hängt serverseitig IMMER an: `buildModelGenerationLock`, `PROFESSIONAL_REFLECTION_LIGHTING_LOCK`, `buildClassGuardBlock`, `CAR_SIDE_DIRECTION_GUARD` (erkennt per String `SHOT_TYPE: Exterior - Perfect LEFT/RIGHT Side Profile`). Fallback-Prompt aus Admin-Blöcken, falls kein dynamischer Prompt.
- Frontend-Tier: `src/components/ModelSelector.tsx` (`nb21`, admin-only), Preise `AdminPricing.tsx`, Remaster-Default `nb21: 3`.
- Getrennt und NICHT betroffen: `generate-vehicle-image`, `generate-banner`, `reference-v2-generate-image` (eigener `prompt-assembler`), Freisteller.

## 2. Ziel-Architektur 2.1 (rein additiv)

```text
Tier "nb21" ──► promptVersion "nb21-v1" ──► src/prompts/nb21/*  (neu)
alle anderen ──► unveränderter 2.0-Pfad (buildMasterPrompt + PIPELINE_JOBS)
```

Neuer Ordner `src/prompts/nb21/`:
- `sections.ts` – feste Reihenfolge der 9 Sektionen: MAIN TASK, REFERENCE ROLES, ALLOWED CHANGES, VEHICLE IDENTITY LOCK, PERSPECTIVE LOCK, ENVIRONMENT, LIGHTING/PHYSICAL INTEGRATION, CAMERA/OUTPUT, FINAL PRIORITY CONSTRAINT; Renderer erzwingt jede Sektion genau einmal.
- `remaster-nb21.ts` – `buildRemasterPromptNb21(config, slotKey, ctx)` separat für das Remastering, je Slot (`34front`, `side`, `rear`, `interior-front`, `interior-rear`) eigene PERSPECTIVE-LOCK-Daten.
- `perspectives-nb21.ts` – ein Eintrag je bestehendem Job-Key (Liste oben, inkl. Grids und CI-Jobs) mit eigenen PERSPECTIVE- und CAMERA-Inhalten; Jobs ohne Eintrag → Build-Fehler im Test (keine stille 2.0-Übernahme).
- Inhalte der Locks werden aus den bestehenden Texten fachlich übernommen (Paint, Chrome, Konsole, Asymmetrie, Felge, Generation, Seitenrichtung, Klassen-Guard), aber als neue Konstanten kopiert – 2.0-Texte bleiben byte-identisch.
- `PROMPT_VERSION_NB21 = 'nb21-v1'`, wird im Generation-Log und `__regenerationContext` gespeichert, damit Neu-Generierung dieselbe Version nutzt.

Verdrahtung:
- `PipelineContext.tsx`: einzige Weiche `tier === 'nb21' ? nb21Builder : bestehender Builder`. Referenz-Zuordnung (`inferPrimaryReferenceIndex` etc.) bleibt gemeinsam und unverändert; 2.1 benennt die Rollen nur in REFERENCE ROLES (R1 primär, R2… Flanke/Innenraum/Felge, Showroom/Logo als Umgebung).
- `remaster-vehicle-image`: bei `promptVersion === 'nb21-v1'` die serverseitigen Anhänge in strukturierter Form an die passende Sektion statt als Blob anhängen (Invarianten bleiben Pflicht, nur andere Darstellung); sonst unverändert.
- Admin-Prompt-Overrides gelten zunächst nur für 2.0.

## 3. Umsetzungsschritte
1. Offizielle Modell-ID von Nano Banana 2.1 verifizieren (aktuell `gemini-nano-banana-2.1` unbestätigt) und in `ENGINE_MAP.nb21` korrigieren.
2. Sektions-Renderer + Remaster-Builder 2.1.
3. Perspektiven-Builder 2.1 für alle Pkw-Jobs; danach Klassen (Van, Reisemobil, Motorrad, Maschinen, Lkw) separat.
4. Weiche in Client und Server, Prompt-Version speichern.
5. Tests (siehe unten), dann A/B mit identischem Fahrzeug: „Qualität" vs. „NB 2.1 (Test)".

## 4. Risiken / Regressionen
- Falsche Modell-ID → jede 2.1-Anfrage scheitert (kein Fallback auf NB 2 gewünscht).
- Server-Guards erkennen Seitenansichten per String-Match; neue 2.1-Texte müssen diese Marker bewusst ersetzen, sonst fehlt der Richtungsschutz.
- Doppelte Locks (Client-Sektion + Server-Anhang) → widersprüchliche Prioritäten.
- Referenzrollen sind Index-/Regex-basiert; 2.1-Texte dürfen keine andere Reihenfolge annehmen.
- Klassen-Trennung: Lkw-/Trailer-Regeln dürfen nicht in Pkw-2.1 gelangen.
- Neu-Generierung alter Läufe ohne Prompt-Version → muss 2.0 bleiben.
- Gemeinsame Dateien (`remaster-prompt.ts`, `pipeline-jobs.ts`) nur lesen/importieren, nie ändern.
- Kosten: Tier-Preise `nb21` sind Platzhalter (Remaster 3 Credits).

## Technische Absicherung (Tests)
- Snapshot-freie Vergleichstests: 2.0-Prompt für jeden Job/Slot ist identisch zu vor der Änderung (Hash-Vergleich).
- 2.1: jede der 9 Sektionen genau einmal und in Reihenfolge, für jeden Job-Key und Slot.
- 2.1-Pkw enthält keine Lkw-Marker; Seitenansichten enthalten korrekte Richtung.
- Tier ≠ `nb21` ruft nie den 2.1-Builder.
