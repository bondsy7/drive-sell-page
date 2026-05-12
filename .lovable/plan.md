# Plan: Canvas Banner Studio (neues, isoliertes Modul)

## Leitprinzipien
- **Keine Änderungen** am bestehenden `BannerGenerator`, an `generate-banner` Edge Function, an Storage-Policies, an existierenden Routen, Tabellen oder am Prompt-System.
- Komplett **neuer Ordner**, neue Route, neue Komponenten, neue (optionale) Edge Function.
- **AI = nur Bildmaterial.** Canvas (Konva) = finales Banner. Text/Logo/Preise/Legal sind immer echte Canvas-Layer.
- Mobile-First, bestehendes Design-System (Tailwind + shadcn + semantische Tokens). Kein neuer visueller Stil.

## Technische Eckpunkte
- Neue Lib: `konva` + `react-konva` (lokal, isoliert, keine Auswirkung auf bestehende Tools).
- Neue Route: `/generator/canvas-banner-studio` (Ergänzung in `App.tsx` ohne bestehende Routen zu ändern).
- Neue Page: `src/pages/CanvasBannerStudio.tsx`.
- Neuer Modul-Ordner: `src/components/canvas-banner-studio/` mit Unterstruktur.
- Neue Hub-Tile in `ActionHub.tsx` (zusätzlicher Eintrag, bestehendes `banner` bleibt).
- Optional später: neue Edge Function `reframe-banner-image` (separat, ohne `generate-banner` zu berühren).
- Keine neuen DB-Tabellen in Phase 1–10. Optional `canvas_banner_projects` ab Phase 9/10 falls Persistenz gewünscht (separat per Migration, additive).

## Datei- & Ordnerstruktur (geplant)
```text
src/pages/CanvasBannerStudio.tsx
src/components/canvas-banner-studio/
  CanvasBannerStudioShell.tsx        (Layout, Step-Nav, Mobile/Desktop Split)
  steps/
    Step1Format.tsx
    Step2Image.tsx
    Step3Text.tsx
    Step4Layout.tsx
    Step5Export.tsx
  canvas/
    BannerCanvas.tsx                 (react-konva Stage)
    layers/TextLayer.tsx
    layers/ImageLayer.tsx
    layers/OverlayLayer.tsx
    layers/LogoLayer.tsx
    layers/SafeAreaOverlay.tsx
  controls/
    FormatPicker.tsx
    ImageUpload.tsx
    OverlayControls.tsx
    TextFieldsPanel.tsx
    LayoutTemplatePicker.tsx
    LogoPanel.tsx
    LayerOrderControls.tsx
  data/
    formats.ts                       (BannerFormat[])
    layoutTemplates.ts               (Templates + responsive Position-Funktionen)
    defaultComposition.ts
  state/
    useCanvasBannerStore.ts          (zustand-light per useReducer; pro Format überschreibbar)
    types.ts                         (BannerFormat, BannerTextFields, BannerLayer, BannerComposition)
  export/
    exportCanvas.ts                  (PNG/JPG/WebP via Konva toDataURL mit echter Pixelgröße)
    zipExport.ts                     (Phase 10, JSZip; nur falls feasible)
  ai/
    reframeClient.ts                 (Phase 11, ruft neue Edge Function)
    layoutSuggestClient.ts           (Phase 12)
```

## Phasenplan (klein, isoliert, jeweils lauffähig)

### Phase 1 — Modul-Shell & Route
- `App.tsx`: zusätzliche `<Route path="/generator/canvas-banner-studio">` (ProtectedRoute + ErrorBoundary).
- `ActionHub.tsx`: neue Tile „Canvas Banner Studio" mit eigenem `HubAction` `'canvas-banner-studio'` und Navigation per `navigate('/generator/canvas-banner-studio')`. Bestehende `banner`-Tile unverändert.
- `CanvasBannerStudioShell` mit Header, Step-Nav (1–5), responsivem 2-Spalten-Layout (Desktop) bzw. Single-Column mit sticky Preview-Anker (Mobile).
- Platzhalter-Content je Step. Ziel: navigierbare leere Hülle.

### Phase 2 — Format-Presets
- `data/formats.ts` mit allen 9 Presets inkl. Kategorien.
- `FormatPicker` (Multi-Select-fähige Datenstruktur, Phase 2 zeigt aber genau 1 aktives Format).
- State: `selectedFormatIds: string[]` + `activeFormatId`.
- Anzeige der exakten Pixelgröße + Kategorie.

### Phase 3 — Canvas-Preview (Konva)
- `bun add konva react-konva`.
- `BannerCanvas` rendert Stage in **realer Zielgröße**, skaliert visuell via `scale` auf Container.
- Layers: Background, Overlay, Headline, Subline, Price, CTA, Logo, Legal, SafeArea-Toggle.
- Demo-Defaults damit sofort etwas sichtbar ist.
- Zoom-to-Fit Logik mit ResizeObserver.

### Phase 4 — Bild-Upload & Hintergrund
- `ImageUpload` mit JPEG/PNG/WebP, Drag&Drop + File-Input (Mobile-tauglich, kein `capture`).
- Bild als `HTMLImageElement` in `ImageLayer`.
- Fit-Modes: Cover, Contain (Manual später).
- Overlay-Controls: Stärke (0–100 %) + Richtung (none, left, right, top, bottom, full-soft).
- Komplett ohne AI.

### Phase 5 — Text-Eingaben
- `TextFieldsPanel` mit allen Feldern (headline, subline, price, cta, smallInfo, legalText) inkl. Platzhaltern.
- Pro Feld: Show/Hide Toggle, FontSize-Slider, Bold-Toggle, Farbpicker (nur semantische Tokens), Align L/C/R.
- Live-Update der Canvas-Layer.

### Phase 6 — Layout-Templates
- `data/layoutTemplates.ts` mit 5 Templates (Classic Offer, Social Strong, Clean Dealer, Story Format, Display Compact).
- Jedes Template = Funktion `(width, height) => Partial<BannerLayer>[]` → responsive Positionen pro Format.
- `LayoutTemplatePicker` setzt Layer-Positionen beim Wechsel; per Format gespeichert.

### Phase 7 — Drag & einfache Edit-Controls
- `react-konva` `draggable` für selektierte Layer (Touch + Maus).
- Sidebar: Move/Resize-Slider, Reset Layout, Center, Bring Forward, Send Backward.
- Selection-Outline + Touch-freundliche Hit-Targets.

### Phase 8 — Logo
- Eigener Logo-Upload (kein Eingriff in bestehendes Logo-System).
- Show/Hide, Größe, Position via Template, Drag.
- Hinweis-Kommentar im Code: spätere Anbindung an `dealer profile` möglich.

### Phase 9 — Export (Single Format)
- `exportCanvas.ts`: Konva `Stage.toDataURL({ pixelRatio: realW / displayW })` → echte Zielgröße.
- Buttons: PNG, JPG, WebP. Dateiname `canvas-banner-studio-{formatSlug}-{w}x{h}.{ext}`.
- „Save to project": **nur** falls `banners` Bucket-Policies trivialen Upload unter `userId/...` erlauben → in `try/catch` mit Fallback auf reinen Download. Keine Policy-Änderungen.

### Phase 10 — Multi-Format
- State erlaubt `Record<formatId, BannerComposition>` mit shared Textfields + per-Format Layer-Overrides.
- Preview-Grid aller selektierten Formate (Thumbnails).
- Klick → aktives Format zum Feintuning.
- Export: einzeln + optional ZIP via `jszip` (only if no conflicts).

### Phase 11 — Ideogram Reframe (optional)
- Neue Edge Function `supabase/functions/reframe-banner-image/index.ts` (CORS, JWT-Validierung mit `getClaims`, `getSecret('IDEOGRAM_API_KEY')`).
- Falls `IDEOGRAM_API_KEY` noch nicht gesetzt: `add_secret`-Anfrage an User vor Implementierung.
- Input: `imageUrl|storagePath`, `targetWidth`, `targetHeight`. Output: gespeichertes Bild im `banners` Bucket (eigener Pfad `userId/canvas-studio/reframed/...`).
- UI-Buttons „Bild auf Format anpassen" / „auf alle Formate anpassen".
- Bestehendes `generate-banner` bleibt unangetastet.

### Phase 12 — AI Layout-Suggest (optional)
- Nutzt vorhandenen `GEMINI_API_KEY` über bestehendes Pattern (eigene neue Funktion `suggest-banner-layout` oder direkt im Frontend via existierender helper falls erlaubt).
- Liefert nur JSON (`recommendedOverlay`, `headlinePosition`, …) → mappt auf Template + Overlay-Direction. Keine Bildgenerierung.

### Phase 13 — Legal-Text-Handling
- Auto-Wrap im Canvas-Layer, Min-Font-Size-Warnung, Safe-Area-Check.
- Warnung bei kleinen Display-Formaten (300×250, 728×90, 160×600).
- Spätere Verbindung zu `mandatory-disclosure.ts` als Read-Only-Import (kein Eingriff).

### Phase 14 — UX-Feinschliff
- Empty States, Defaults, Tooltip-Erklärungen pro Step, Sticky Preview-Drawer mobil, große Touch-Buttons, klar sichtbarer Export-Button.

### Phase 15 — Safety-Checkliste (bei jedem Commit prüfen)
- Keine Änderung an: `BannerGenerator.tsx`, `generate-banner/`, bestehenden Routen außer Add, `supabase/integrations/*`, RLS, Buckets, Prompts, Pipelines.
- Neue Tabellen nur additive Migrationen, falls überhaupt nötig.

## Klärende Fragen (vor Phase 1 beantworten)
1. **Ideogram-API-Key**: Ist bereits ein `IDEOGRAM_API_KEY` vorhanden oder soll ich beim Erreichen von Phase 11 per `add_secret` danach fragen?
2. **„Save to project" in Phase 9**: Soll ich versuchen, in den bestehenden `banners` Bucket unter `userId/canvas-studio/...` zu speichern (ohne Policy-Änderung)? Falls Policies das nicht zulassen: nur lokaler Download — okay?
3. **Persistente Projekte (Tabelle `canvas_banner_projects`)**: In Version 1 weglassen (nur lokaler State + Export) — okay, oder von Anfang an persistieren?
4. **Hub-Tile-Platzierung**: Direkt neben dem bestehenden „Banner Generator" einfügen, mit dezentem „NEU"-Badge — okay?

Nach Beantwortung arbeite ich Phase 1 → 15 sequenziell ab und melde mich bei jedem unerwarteten Risiko.
