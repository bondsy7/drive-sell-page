## Ziel

Hersteller-, Händler- und Eigenes-Logo lassen sich auf demselben Banner **unabhängig voneinander** ein- und ausschalten. Buttons sind reine Toggles (zweiter Klick = aus), niemals disabled, und "Kein Logo" deaktiviert alle drei gleichzeitig. Fehlt eine Logo-Quelle, öffnet der Klick den passenden Picker (Marke wählen / Profil-Logo / Upload).

## Architektur-Änderungen

### 1. State-Modell (`state/types.ts`)
- `BannerComposition` bekommt drei feste Logo-Slots statt einem:
  - `logoUrl?: string`  → Slot **Hersteller** (bestehend, semantisch jetzt fix Hersteller)
  - `dealerLogoUrl?: string` → Slot **Händler**
  - `customLogoUrl?: string` → Slot **Eigenes**
- Reihenfolge / Position kommen über drei feste Layer-IDs: `"logo"` (Hersteller), `"logo-dealer"`, `"logo-custom"`. Default-Positionen werden im Template als Zeile (Hersteller links, Händler mittig, Custom rechts) im Footerbereich vergeben.

### 2. Reducer (`state/useCanvasBannerStore.ts`)
- `SET_LOGO` wird zu `SET_LOGO_SLOT` mit `slot: "manufacturer" | "dealer" | "custom"`, `url?: string`, `scope: "all" | "current"`.
- Setzt `composition[slotField]` und togglet `visible` des passenden Layers (`url === undefined` → hidden, sonst sichtbar). Bestehende Felder bleiben für Migration erhalten.
- Neuer Action-Typ `CLEAR_ALL_LOGOS` für "Kein Logo".

### 3. CI-Panel (`ci/CiPanel.tsx`)
- Buttons werden zu echten Toggles mit eigenem aktiv/inaktiv-Status pro Slot (`activeSlots: { manufacturer, dealer, custom }` aus Composition abgeleitet).
- Kein `disabled` mehr. Wenn URL fehlt:
  - **Hersteller** ohne Marke → öffnet Brand-Picker-Dialog (oder Toast mit Hinweis + Fokus auf Marke-Auswahl).
  - **Händler** ohne Profil-Logo → Toast "Bitte Händler-Logo im Profil hinterlegen" + Link.
  - **Eigenes** ohne Upload → öffnet File-Picker (`fileInputRef.current?.click()`).
- Klick auf aktiven Slot → Slot ausschalten.
- "Kein Logo" → ruft `CLEAR_ALL_LOGOS` (alle drei aus).
- Scope-Toggle (Alle Formate / Nur aktives) bleibt; gilt pro Slot-Aktion.

### 4. Rendering
- `canvas/BannerCanvas.tsx`: drei `useState`/`useEffect`-Paare für `logoSrc`, `dealerLogoSrc`, `customLogoSrc` mit jeweils eigenem Recolor-Aufruf. Loop über drei Logo-Layer-IDs zum Zeichnen.
- `export/renderComposition.ts`: gleiche Schleife — drei Slots laden, recolorn, an jeweiligen Layer-Positionen zeichnen.

### 5. AI-Generator (`ai/generateBannersFromInputs.ts`)
- Default-Belegung: Marke erkannt → `logoUrl` (Hersteller) automatisch gesetzt und sichtbar. `dealerLogoUrl`/`customLogoUrl` bleiben undefined.
- Quick-Handoff (`state/quickHandoff.ts`) übernimmt alle drei Slots.

### 6. Migration
- `useCanvasBannerStore` Hydration: alte Compositions mit nur `logoUrl` bleiben unverändert (Hersteller-Slot). `dealerLogoUrl`/`customLogoUrl` werden initial undefined gesetzt. Keine Datenbank-Migration nötig — Banner-Projects-JSON ist forward-compatible.

## Geänderte Dateien

- `src/components/canvas-banner-studio/state/types.ts` (BannerComposition erweitern)
- `src/components/canvas-banner-studio/state/useCanvasBannerStore.ts` (Reducer + neue Actions + Default-Layer)
- `src/components/canvas-banner-studio/ci/CiPanel.tsx` (Toggle-UI, keine disabled-Buttons, Upload-Fallback)
- `src/components/canvas-banner-studio/canvas/BannerCanvas.tsx` (drei Logo-Render-Pfade)
- `src/components/canvas-banner-studio/export/renderComposition.ts` (drei Slots im Export)
- `src/components/canvas-banner-studio/ai/generateBannersFromInputs.ts` (Default nur Hersteller aktiv)
- `src/components/canvas-banner-studio/state/quickHandoff.ts` (drei Slots durchreichen)
- ggf. `templates/*` für sinnvolle Default-Positionen der zusätzlichen Logo-Layer

## Nicht im Scope

- Keine Änderung am Banner-Generierungs-Prompt (Master-Image bleibt logo-frei, Logos werden weiterhin als Overlay-Layer im Canvas gerendert).
- Keine neuen DB-Migrationen.
- Frei positionierbar bleiben alle drei Layer per Drag (unverändert).