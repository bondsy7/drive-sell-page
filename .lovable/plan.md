# Bestandsaufnahme: Grundlage für Strict-Reference Vehicle Image Pipeline V2

Reine Analyse des Ist-Zustands. Keine Codeänderung vorgenommen, keine Migration vorgeschlagen.

## 1. VIN- und Fahrzeugzuordnung

- VIN-Erkennung: `ocr-vin/index.ts:140` (Gemini-OCR, reine 17-Zeichen-VIN), Stammdaten aus `lookup-vin/index.ts:224-240` (OutVin → flaches `mapped`-Objekt).
- `useVinLookup.ts:53-91` + `applyFields:93-125` schreiben nur React-State; `VinDataDialog.tsx:22-190` ist reine Diff-UI. Kein DB-Write in diesem Pfad.
- Persistenz-Anker ist `ensureVehicle` (`src/lib/vehicle-utils.ts:10-84`): Upsert auf `vehicles` mit `onConflict: 'user_id,vin'`, additiver JSONB-Merge in `vehicle_data`, Redundanzspalten `brand/model/year/color/title/cover_image_url` (`:69-76`). Schema: `types.ts:2790-2833`.
- Asset-Bindung ausschließlich über FK `vehicle_id`: `projects` (`types.ts:1149,1179-1184`), `project_images` (`types.ts:1094,1129-1134`), `spin360_jobs` (`types.ts:2213,2255-2267`). Löschkaskade bestätigt in `useVehicles.ts:344-353`.
- Originale haben KEINE DB-Tabelle: nur Storage-Präfix `originals/<user_id>/<vehicle_id>/…` (`useVehicleAssets.ts:52-171`, `OriginalsTab.tsx:27-52`).
- `image_generation_jobs` hat keinen `vehicle_id`-FK, nur `project_id` und Freitext `vehicle_description` (`types.ts:638,644,684-689`).

Wiederverwendbar für V2: `vehicles.id` als stabiler Anker, `vehicles.vin` als Dedupe-Key, das `ensureVehicle`-Merge-Muster, die Storage-Konvention `<bucket>/<user_id>/<vehicle_id>/…`. Abgrenzen: `project_images` und `image_generation_jobs` sind an den Landingpage-/Projekt-Workflow gekoppelt.

Leak-Lage heute: `Index.tsx:738-739` baut `vehicleDescription` als `"${brand} ${model} ${variant}, Modelljahr …"`; das wandert über `PipelineContext.tsx:298,379` in den Bildcall und gekürzt in die DB (`:736`). Serverseitig wird es wieder neutralisiert (`remaster-vehicle-image/index.ts:109-160`, `buildModelGenerationLock:131-161`). Es existieren also zwei parallele Sanitizer (Client `remaster-prompt.ts:267-289`, `vehicle-generation-lock.ts:52-53` und Server) — für V2 sollte Metadaten-Redaction nur einmal, serverseitig, existieren und der Prompt gar keine Marken-/Modell-/Trim-Strings mehr erhalten.

## 2. Uploads, Klassifikation, Slots

Zwei getrennte, nicht geteilte Systeme:

- **OneShotStudio**: freier Multi-Upload, Auto-Klassifikation via `classify-vehicle-images` (17 Kategorien, `index.ts:49-77`, Modelle `:187`, `temperature 0.1`). Ergebnis wird ungefiltert in den State gemerged (`OneShotStudio.tsx:449-502`); `confidence` wird nicht ausgewertet → **kein Gate**. Es gibt **keine UI zur manuellen Korrektur** einer Kategorie, nur Löschen (`:504-506`). Hero-Wahl über Prioritätsliste `HERO_CATEGORY_PRIORITY` (`:86-93`, Fallback „irgendein Bild" `:805-809`). Originale gehen beim Übergang in Storage-Bucket `originals` (`:1184-1209`, Fehler non-fatal).
- **ImageCaptureGrid**: feste Slots pro Klasse, Zuordnung rein manuell, dafür hartes Coverage-Gate (`checkSourceCoverage` `source-coverage.ts:22-39`, Blockade `ImageCaptureGrid.tsx:238-244`). Keine Storage-Persistenz der Originale (nur State/Base64).

Slots: Pkw `34front, side, rear, interior-front, interior-rear, vin` (`car-profile.ts:11-68`, Coverage leer `:75`); Motorrad analog mit `moto-seat-front/rear` (`motorcycle-profile.ts:17-73`); Lkw dynamisch über Wizard (`truck-workflow.ts:259-434`) mit Job-Coverage-Matrix (`truck-profile.ts:17-32`, `pipelinePolicy: 'restricted'`).

Für V2 relevant: Klassifikation existiert, ist aber nur Hinweis; Slot-Modell existiert, aber ohne Klassifikation. V2 braucht beides gekoppelt plus explizite Korrektur-UI und persistierte Slot-Zuordnung in der DB (heute nur State).

## 3. File API vs. Base64

- File-URIs entstehen in `upload-pipeline-images/index.ts:16-117` und `upload-to-gemini-files/index.ts:11-117` (Limit 20 Bilder `:107-109`). Client→Edge ist dabei immer Base64.
- `gemini-file-upload.ts:20-23,45-48,58`: bei jedem Fehler/Teilausfall stiller Rückfall auf Base64.
- `PipelineContext.tsx:206-215,520-532` cached URIs einmal pro Lauf; `:338-349` mischt jedoch `additionalFileUris` und inline Base64 im selben Request. Logos laufen primär als Base64 (`:315-321`), URI nur zusätzlich (`:364`).
- `remaster-invoke.ts:6-43`: Vertrag enthält für jede Referenz beide Kanäle parallel.
- Serverseitig Priorität `file_data` vor `inlineData` (`remaster-vehicle-image/index.ts:559-564,547-548,599-602,621-625,659-676`), Telemetrie `:766,792-800`.
- OpenAI-Engines (`turbo/ultra/neu`, `:394-401`) materialisieren File-URIs per HTTP-Fetch zurück (`:820-853`) → zusätzlicher Roundtrip.
- Ergebnisse immer Base64 (`:919-922`, `:998-1003`, `:1070`), Client lädt in Storage und speichert `image_base64: ''` (`PipelineContext.tsx:670,677,786,825`).

Für V2: „File API first" ist teilweise vorhanden, aber der Mischbetrieb und der stille Base64-Fallback sind die Hauptquelle für nicht reproduzierbare Referenzqualität. V2 sollte Referenzen ausschließlich aus Storage + File-URI beziehen und bei Upload-Fehler hart abbrechen statt fallbacken.

## 4. Showroom

- Presets nur als Konstanten/Dateien: `remaster-prompt.ts:88-106`, `public/images/showrooms/showroom-{1,2,3}.webp`; DEKRA-Szene ist hartcodiertes JSON in der Edge Function (`remaster-vehicle-image/index.ts:316-356`).
- Custom-Showroom: Upload → `compressImageForAI` → Base64 + Storage `vehicle-images/{userId}/showroom.{ext}` (`upsert:true`) + `profiles.custom_showroom_url` (`RemasterOptions.tsx:179-197`). Nur **ein** Showroom pro User, keine Versionierung.
- Übergabe: `customShowroomBase64` (`PipelineContext.tsx:377`) oder `customShowroomFileUri` (`:378`); nie als URL.
- Varianzursachen: kein Compositing, sondern volles Neu-Rendern pro Job (`remaster-vehicle-image/index.ts:488-526`, „FULL VEHICLE RECONSTRUCTION"); Scale/Position nur weiche Textconstraints (`remaster-prompt-defaults.ts:70-84`); Re-Fetch + Kompression + Canvas-Reencoding liefern pro Aufruf leicht andere Bytes; gemischter Base64/URI-Pfad je Job.

## 5. Logos

- Bucket `manufacturer-logos` (Root = Raster, `svg/` = Vektor), Verwaltung `AdminLogos.tsx:18,154,181` mit `upsert:true` → **keine Historie, Überschreiben wirkt rückwirkend auf alle künftigen Generierungen**.
- Zwei widersprüchliche Präferenzregeln: SVG-first in `useVehicleMakes.ts:72-77`, Raster-only (SVG explizit verworfen) in `remaster-prompt.ts:691-717,704`.
- Drei parallele Alias-Systeme: `brand-aliases.ts` (`resolveCanonicalBrand`), `useVehicleMakes.getLogoForMake:110-131`, inline `BRAND_ALIASES` in `RemasterOptions.tsx:95-110` mit Substring-Fallback `:130`.
- Auflösung passiert reaktiv bei jeder Markenänderung (`RemasterOptions.tsx:112-144`), ohne stabile Asset-ID; PNG-Rekonvertierung via Canvas (`ensureLogoCachedAsPng`) verändert das Asset.
- Übergabe: Base64-Cache pro Lauf (`PipelineContext.tsx:200-230,315-321`) plus optional URI (`:364`); Server-Priorität URI → Base64 → URL-Fetch (`remaster-vehicle-image/index.ts:667-721`), Prompt fordert bereits „pixel-perfect" (`:684-694`).

Für V2: Ein Job muss ein **explizit gewähltes, unveränderliches Logo-Asset** referenzieren (feste Objekt-ID/Version/Hash statt Live-Name-Matching), und es darf nur ein Alias-/Präferenzpfad existieren.

## 6. Perspektiven-Katalog

`pipeline-jobs.ts` (974 Zeilen), ~70 Jobs:
- Hero: `MASTER_IMAGE` (`:47-60`).
- Exterior (9): `EXT_FRONT :64`, `EXT_REAR :79`, `EXT_SIDE_LEFT :93`, `EXT_SIDE_RIGHT :109`, `EXT_34_FRONT_RIGHT :125`, `EXT_34_REAR_LEFT :139`, `EXT_34_REAR_RIGHT :154`, `EXT_LOW_ANGLE :169`, `EXT_ELEVATED_FRONT :183`.
- Interior (3): `INT_DASHBOARD :199`, `INT_REAR_SEATS :213`, `INT_WIDE_CABIN :238`.
- Detail (4): `DET_HEADLIGHT :253`, `DET_TAILLIGHT :286`, `DET_WHEEL :301`, `DET_GRILLE :319`.
- Composite (3): `GRID_EXTERIOR_4 :336`, `GRID_INTERIOR_4 :349`, `GRID_SOCIAL_MEDIA :361`.
- CI-Marken-Jobs (~50, `:378-801`), alle `defaultSelected:false`.
- Filterung über Profile: `getJobsForProfile :931-947`; Pkw/Motorrad ungefiltert (`allowedPipelineJobs: null`), Lkw 14 Jobs mit Coverage-Pflicht.

Links/Rechts: konsistent auf LHD-Fahrerseite definiert, mit gegenseitigen „Do NOT mirror"-Klauseln (`:100-102,116-118,148,163`). Lücke: kein `EXT_34_FRONT_LEFT` (implizit `MASTER_IMAGE`) und keine RHD-Variante der Seiten-/¾-Jobs; nur `INT_DASHBOARD :209` erwähnt RHD.

Spin360 V2 als Vorlage: `KEYFRAME_ANGLES [0,45,…,315]` (`spin360-core.ts:32`), Sektorplanung `:150-210`, Identity-Profil/Hash mit Abbruch ohne echte Fotos (`generate-360-spin/index.ts:1014-1036`), Abschlussvalidierung `spin360-v2.ts:90-134`. Das Winkel-/Identity-/QA-Modell ist der einzige Teil des Projekts, der bereits fail-closed arbeitet, und eignet sich als Blaupause für V2.

## 7. QA — echte Gates vs. Prompttext

| Prüfung | Ort | Wirkung |
|---|---|---|
| Spin360 QA | `spin360-core.ts:39-70`, `generate-360-spin/index.ts:896-969,1233-1265` | **Hartes Gate**: Schwellen 90/85/85, 0 hard_failures, Repair-Loop (4 Versuche), sonst `needs_review` |
| classify-vehicle-images | `classify-vehicle-images/index.ts:210-220`, `OneShotStudio.tsx:474-494` | Kein Gate, reines Auto-Tagging, confidence ungenutzt |
| analyze-wheel-reference | `analyze-wheel-reference/index.ts:140-158` | Kein Gate; Fehler → `analysis:null`, Status 200; Ergebnis nur Prompttext (`remaster-vehicle-image/index.ts:580-596`) |
| Wheel-Check nach Generierung | `remaster-vehicle-image/index.ts:1033-1072` | Berechnet und geloggt, im Frontend nirgends konsumiert → folgenlose Telemetrie |

Fazit: Außerhalb von Spin360 gibt es heute **keine** post-generative Identitätsprüfung mit Konsequenz. Genau das ist die Lücke, die V2 schließen müsste.

## 8. Datenbank — Wiederverwendung vs. Abgrenzung

- Wiederverwenden: `vehicles` (`id`, `vin`, `vehicle_data` JSONB), Storage-Präfixkonvention, `spin360_jobs`/`spin360_canonical_images` als strukturelles Vorbild (Job + Frames + QA-Metadaten).
- Abgrenzen: `project_images` (projektgebunden, Landingpage-Kontext), `image_generation_jobs` (kein `vehicle_id`, Freitext-`vehicle_description`), `projects.vehicle_data` (Kopie, driftet gegen `vehicles.vehicle_data`).
- Fehlend für V2: es gibt heute keine Tabelle für Rohbilder/Slot-Zuordnung und keine Tabelle für versionsfixierte Referenz-Assets (Showroom/Logo).

## Offene Punkte für die Planungsrunde

1. Soll V2 eigene Tabellen bekommen oder auf `spin360_jobs`-artige Strukturen aufsetzen?
2. Fail-closed statt Base64-/Logo-Fallback: akzeptierter Abbruch bei fehlender Referenz?
3. Slot-Klassifikation als Gate mit Pflicht-Korrektur-UI?
4. Post-generative Identitäts-QA analog Spin360 für alle Perspektiven — mit welchen Schwellen und wie vielen Repair-Versuchen?
