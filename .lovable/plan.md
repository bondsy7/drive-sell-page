
# Schritt 2 — Neuer Workflow „Masterbild + Datenblatt"

## Ziel
Schritt 2 wird vom reinen Hintergrundbild-Upload zu einem mehrteiligen Workflow, der ein **werbliches Masterbild** und automatisch befüllte **Texte** erzeugt. Reframe auf die gewählten Formate erfolgt danach (bestehender Mechanismus).

## Neuer Aufbau Schritt 2

Drei Sub-Bereiche untereinander:

### A) Quelle wählen — „Basis-Bild"
Tab-Switcher mit drei Optionen:
1. **Hochladen** (vorhandener `ImageUpload`)
2. **Aus Galerie** — neuer `GalleryPicker` (lädt User-Bilder aus `vehicle_images` / Galerie-Assets via Supabase, Grid mit Auswahl)
3. **Aus Bannern** — Picker auf bereits erzeugte Banner (Tabelle `banners`)

Ergebnis: `sourceImageUrl` im lokalen State (noch nicht der Hintergrund).

### B) Marketing-Prompt → Masterbild
- **Dropdown „Stil/Marketing-Prompt"** mit kuratierten, werbetauglichen Vorlagen, z. B.:
  - „Cinematic Showroom – Spotlights, dunkler Hintergrund"
  - „Sonnenaufgang Küstenstraße"
  - „Studio – Reinweiß, weiche Schatten"
  - „Urban Night – Neonreflexionen"
  - „Berglandschaft – Panorama"
  - „Dynamic Motion Blur"
  - „Luxus Garage – warmes Licht"
  - „Editorial Magazin Look"
  - (8–10 Presets, Defs in `marketingPrompts.ts`)
- Optional: Freitext-Zusatz „Eigene Anweisung"
- Button **„Masterbild generieren"** → ruft neue Edge Function `generate-master-banner-image` (Gemini 2.5 Flash Image / Nano Banana via Lovable AI Gateway, mit Quellbild als Referenz)
- Vorschau des Master-Bildes mit Aktionen:
  - **Übernehmen** → setzt `actions.setBackground(masterUrl)`
  - **Neu generieren** (mit gleichem oder geändertem Prompt)
  - **Verwerfen**

State: `masterImageUrl`, `isGenerating`, `lastPromptUsed`.

### C) Datenblatt-Analyse → Texte
- Eigener Upload-Slot „Datenblatt (PDF/Bild)"
- Button **„Daten extrahieren"** → ruft bestehende `analyze-pdf` (für PDF) bzw. neue Logik in einer schmalen Edge Function `extract-banner-data` (Gemini Vision für Bilder)
- Mapping der extrahierten Felder auf die Banner-Textfelder:
  - `headline` ← „Marke + Modell"
  - `subline` ← „Ausstattung kurz"
  - `price` ← „Barpreis" oder „ab X € mtl."
  - `cta` ← bleibt User-Wahl, default „Jetzt Probefahrt sichern"
  - Pflichtangaben → über bestehende `mandatory-disclosure` Util in `legal`-Layer
- Anzeige eines kleinen Diff-Previews vor Übernahme („Übernehmen / Verwerfen je Feld" + „Alle übernehmen")

## Technische Details

### Frontend
- Neuer Ordner `src/components/canvas-banner-studio/step2/`:
  - `Step2Master.tsx` (Container, ersetzt aktuellen Step-2-Inhalt)
  - `SourcePicker.tsx` (Tabs: Upload/Gallery/Banner)
  - `GalleryPickerDialog.tsx` (Liest `vehicle_images` über bestehenden Hook `useVehicleAssets` o. ä.)
  - `BannerPickerDialog.tsx` (Liest `banners` Tabelle)
  - `MasterPromptPanel.tsx` (Dropdown + Generate + Preview)
  - `DataSheetPanel.tsx` (Upload + Extract + Field-Mapping)
- `data/marketingPrompts.ts` — 8–10 kuratierte Prompts mit `id`, `label`, `description`, `promptText`
- `ai/masterImageClient.ts` — `invoke('generate-master-banner-image', …)`
- `ai/dataSheetClient.ts` — `invoke('extract-banner-data', …)`
- `CanvasBannerStudioShell.tsx`: Step-2-Block ersetzen durch `<Step2Master/>`. Reframe-Block bleibt, aber wandert ans Ende von Schritt 2 (für Anpassung an Formate nach Masterbild-Freigabe).

### Edge Functions
- `generate-master-banner-image/index.ts` (NEU)
  - Input: `{ sourceImageUrl, promptText, extraInstruction? }`
  - Verwendet **direkte Gemini-API** (Nutzer-Key — gemäß User-Memory „immer Nutzer-Keys, nie LOVABLE_API_KEY"), Modell `gemini-2.5-flash-image`
  - Bild-Referenz via Gemini File API (memory: File API First)
  - Output: `{ imageDataUrl }`
- `extract-banner-data/index.ts` (NEU, schlank)
  - Input: `{ fileDataUrl, mimeType }`
  - PDF → wiederverwendet Logik aus `analyze-pdf`
  - Bild → Gemini Vision (Nutzer-Key)
  - Output: strukturiertes JSON `{ make, model, price, monthlyRate, equipment, fuel, co2, … }`

### Reframe-Hinweis
Der vorhandene „Ideogram Reframe"-Block bleibt. Hinweistext erweitern: „Erst Masterbild freigeben, dann auf alle Zielformate reframen."

## Was nicht geändert wird
- Schritt 1 (Format), Schritt 3–5 bleiben unverändert
- State-Store `useCanvasBannerStore` bekommt nur eine optionale `sourceImageUrl`-Spur (nicht persistent nötig); ansonsten keine Schema-Änderung
- Keine DB-Migrationen nötig (Galerie/Banner werden nur gelesen)

## Reihenfolge der Umsetzung
1. `marketingPrompts.ts` + Edge Function `generate-master-banner-image` (Kern)
2. `Step2Master.tsx` + `SourcePicker` + `MasterPromptPanel` + Integration in Shell
3. `GalleryPickerDialog` & `BannerPickerDialog`
4. Edge Function `extract-banner-data` + `DataSheetPanel` + Field-Mapping in Store
5. Smoke-Test über Preview

## Offene Punkte / Annahmen
- Galerie-Quelle: nehme `vehicle_images` (Tabelle existiert laut Codebase). Bestätigung nicht erforderlich, wird per Hook `useVehicleAssets` o. ä. eingebunden.
- Modell für Masterbild: `google/gemini-2.5-flash-image` (Nano Banana). Falls du explizit Pro willst (`gemini-3-pro-image-preview`), bitte sagen — sonst Default.
