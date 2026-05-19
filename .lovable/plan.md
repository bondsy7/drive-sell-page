## Ziel

Banner Quick-Generator optimieren: Datenblatt-Analyse + CI/Logo/Prompt-Auswahl bereits **vor** dem „Banner generieren"-Klick. Pro-Modus bleibt vollständig unberührt.

## Quick-Modus (`CanvasBannerStudioQuickShell.tsx`)

### Auto-Analyse bei Upload
- Sobald `pdfFile` gesetzt wird, läuft automatisch `extractBannerDataFromPdf` / `extractBannerDataFromImage`.
- Neue States: `analyzing`, `analyzedFields`, `analyzedBrand`, `analysisError`.
- Marke wird sofort gesetzt → Logo via `getLogoForMake`, CI-Preset via `detectBrandKey`.

### Neue Box „Marke & CI" (zwischen Format-Chips und Button)
Eine Card mit kompaktem, mobile-first Stack:
1. **Hersteller-Logo** + `VehicleBrandPicker` (wie heute am Ergebnis, jetzt oben).
2. **Marken-Vorlage** – `<select>` über `BRAND_PRESETS`, auto-ausgewählt aus erkannter Marke.
3. **CI-Farben** – Swatches für Primary/Secondary/Text/BG. Quelle: Preset-Farben (wenn Preset ≠ custom) oder Dealer-Profil (wenn custom).
4. **Master-Prompt** – Radio-Chips mit 3 Stilen:
   - `showroom-neon` (aktueller Default)
   - `cinematic-showroom` (aus MARKETING_PROMPTS)
   - `studio-white` (aus MARKETING_PROMPTS)

### Generieren-Button
- Aktiv erst wenn: Files vorhanden, Analyse fertig, mind. 1 Format gewählt.
- Übergibt vorab-analysierte Felder + gewählten Prompt an `generateBannersFromInputs`.

### Vorschau-Sektion
- Hersteller-Logo-Zeile am Ergebnis entfernen (steht jetzt oben).
- Buttons „ZIP" und „Im Editor bearbeiten" unverändert.

## `ai/generateBannersFromInputs.ts`
- Neue optionale Inputs: `preExtractedTextFields`, `preDetectedBrand`, `masterPromptOverride`.
- Wenn `preExtractedTextFields` gesetzt → Analyse-Schritt überspringen.
- Wenn `masterPromptOverride` gesetzt → diesen Prompt statt `buildMasterPrompt` verwenden (CI-Farben weiterhin als extraInstruction).
- `totalSteps` entsprechend reduziert.

## Nicht im Scope
- **Pro-Modus (`CanvasBannerStudioProShell.tsx`) bleibt komplett unverändert.**
- `CiPanel.tsx`, Canvas-Renderer, Export, Stores, Templates — alles unangetastet.

## Geänderte Dateien
- `src/components/canvas-banner-studio/CanvasBannerStudioQuickShell.tsx`
- `src/components/canvas-banner-studio/ai/generateBannersFromInputs.ts`
