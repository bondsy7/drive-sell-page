# Reference V2 — Strict-Reference Vehicle Image Pipeline

**Phase 0: Spezifikation + isolierter Domain-Kern.**
Vollstaendig isoliert unter `src/features/reference-v2/`. Kein Import aus
Legacy-Code (`pipeline-jobs.ts`, `remaster-prompt.ts`, PipelineContext, …),
keine Provider-Anbindung, keine UI, keine Datenbank.

## Domain-Grundsaetze

1. **Business Vehicle Context** (Marke, Modell, Variante, Baujahr, VIN, Titel,
   Beschreibungen) existiert **ausserhalb** der Bildgeneration. Im internen Job
   erscheint er ausschliesslich als `vehicleId` (FK) — siehe
   `domain/job-context.ts`.
2. **Visual Reference Context** besteht nur aus Asset-IDs, visuellen Analysen
   (Vision Intake), Perspektiven und explizit aktivierten Bearbeitungsmodulen.
3. **Generierungs-Requests** (`domain/generation-request.ts`) sind
   provider-neutral und besitzen strukturell KEINE Felder fuer
   `brand`, `make`, `model`, `variant`, `trim`, `year`, `modelYear`, `vin`,
   `vehicleDescription`, `title`. Das Schema ist `.strict()` — unbekannte
   Felder werden abgelehnt, nicht gestrippt.
4. **Reference images are the sole authority for visual vehicle identity.**
   Kein Katalogwissen, keine Marken-/Modell-Sonderregeln (bewusst auch keine
   Enyaq-Regel o. ae.).

## Winkel- & Seitenkonvention

Draufsicht, fahrzeugrelativ, Wertebereich `(-180, 180]`:

```text
        0 Front
 -45           +45
 -90 Left      +90 Right
-135          +135
       180 Rear
```
(Alle Werte in Grad.)

- Links/Rechts sind **immer fahrzeugrelativ**, niemals Betrachterseite,
  niemals LHD/RHD-abhaengig.
- Orientierungskonvention laut Spezifikation:
  - `EXT_SIDE_RIGHT` (+90°): rechte Fahrzeugseite sichtbar, **Front im Bild
    nach links** (`vehicleFrontImageDirection: "left"`).
  - `EXT_SIDE_LEFT` (−90°): linke Fahrzeugseite sichtbar, **Front im Bild nach
    rechts** (`vehicleFrontImageDirection: "right"`).
- Aenderungen an dieser Konvention sind ein Registry-Versionssprung, kein
  stilles Editieren.

## Perspective Registry V1

`domain/perspectives/` — 57 versionierte Specs in 6 Kategorien:
8 Standard-Exterieur, 5 Hero, 6 Low-Angle, 6 Elevated, 12 Interior, 20 Detail.

- **HERO** ist ein Output-Key mit `basePerspectiveId`-Bezug auf eine
  Standardperspektive — identische Geometrie, nur Praesentation.
- **Interior/Detail** nutzen semantische Camera/Surface-Constraints statt
  erfundener Azimut-Praezision.
- **Elevated** hat `riskLevel: "high"`, weil das Dach selten durch Referenzen
  abgedeckt ist; `roof` ist Teil der `requiredCoverageSurfaces`.
- Cockpit-Seite (Lenkradposition) kommt ausschliesslich aus Referenzen.
- `CapabilityProfile` (`domain/capability-profiles.ts`) erlaubt spaeter
  klassen-spezifische Ergaenzungen (LKW, Motorrad, …) ohne Registry-Umbau.

## Readiness & Matching

Status: `READY_EXACT`, `READY_MULTI_REFERENCE`, `NEEDS_CONFIRMATION`,
`INSUFFICIENT_REFERENCE`, `BLOCKED_IDENTITY_CONFLICT`,
`BLOCKED_FILE_UNAVAILABLE`.

Score-Gewichte (Summe 1.0): 40 % Kamerawinkel, 25 % korrekte Seite/Flaeche,
15 % Flaechenabdeckung, 10 % Qualitaet, 10 % Framing.

**Hard-Fail-Regeln sind separat typisiert** (`REFERENCE_HARD_FAIL_CODES`):
eine falsche linke/rechte Fahrzeugseite disqualifiziert einen Kandidaten
immer — kein Gesamtscore kann das kompensieren
(`evaluateReferenceCandidate`).

## Editing-Module

- `SAFE_CLEANUP` (default an): dirt/dust/fingerprint/waterSpot/glass,
  whiteBalance, exposureNormalization, removableClutter.
- `COSMETIC_REPAIR` (default aus): light scratches, rim scratches, small paint
  defects, minor dents.
- `TRANSFORMATION` (im strict_reference Modus **immer unzulaessig**):
  paintColorChange, wheelReplacement, wrapChange, addPart, removePart.
  Durchgesetzt via `validateModuleSelection` / `assertModuleSelectionAllowed`
  sowie im Request-Schema und im Prompt-Assembler.

## QA

`domain/qa.ts`: Verdicts `PASS | REPAIR | NEEDS_REVIEW`.
Startschwellen (`QA_STRICT_REFERENCE_THRESHOLDS_V0`, **provisorisch, nicht
final — empirisch zu kalibrieren**): korrekte Seite hard, mirror=false hard,
Perspektive ≥ 92, kritische Identitaet ≥ 92, sekundaere Identitaet ≥ 86,
Confidence ≥ 88, Hard Failures = 0, max. 2 automatische Versuche
(initial + 1 Repair). Hard Fails fuehren nie zu PASS.

## Scenes & Logos

`domain/scene-logo.ts`: `ScenePack`/`ScenePlate` versioniert + immutable mit
`sha256`, Kamera-/Elevations-Kompatibilitaet und normalisiertem
Fahrzeug-Anker. `LogoAsset` ist ausschliesslich `environment_branding`
(Wand/Boden) — **Fahrzeugembleme kommen niemals aus einem LogoAsset**,
sondern nur aus den Referenzbildern.

## Prompt-Assembler

`domain/prompt-assembler.ts`: deterministisch, genau vier Bereiche
`CORE`, `PERSPECTIVE`, `ACTIVE_MODULES`, `REFERENCE_MANIFEST`.
Der CORE ist kurz, ohne Wiederholungs-Locks, mit **genau einer**
Prioritaetshierarchie:

1. Visuelle Identitaet aus den zugewiesenen Referenzen
2. Ziel-PerspectiveSpec
3. explizit aktivierte nicht-transformative Module
4. fotografische Verbesserung

Konfliktregel: eine niedrigere Prioritaet darf eine hoehere niemals
veraendern. Keine Marke/Modell/Baujahr/VIN im Prompt — strukturell
ausgeschlossen.

## Tests

`__tests__/` — Konventionen (Winkel/Seiten), Registry-Integritaet,
Metadaten-Verbote, Modul-Validierung, QA-Hard-Fails, Readiness,
Prompt-Determinismus. Ausfuehren mit `npm test` / `bunx vitest run`.
