## Ziel
Ein CI-Layer im Canvas Banner Studio, der **(a) automatisch** Daten aus dem Händler-Profil zieht, **(b) markenspezifische CI-Templates** (BMW, Mercedes, VW, Audi, Porsche, Ford, Opel, Skoda, Hyundai, Kia, Tesla …) anbietet, **(c) das Hersteller-Logo als SVG skalier- und einfärbbar** macht, und **(d) Shortcodes** wie `{{firma}}` in allen Textfeldern auflöst.

## Was wird gebaut

### 1) Datenquellen-Verdrahtung (Profil → Studio)
Aus `profiles` werden bereits Logo & Farben geholt; ich erweitere das um:
- `company_name` → Shortcode `{{firma}}`
- `phone`, `whatsapp_number`, `website`, `address`, `city`, `postal_code` → optionale Shortcodes
- `primary_color`, `secondary_color` → CI-Farben (Default-Palette)
- `logo_url` → Händler-Logo (zusätzlich zum Hersteller-Logo)
- `default_legal_text` → Pflichtangaben-Default

Neue Datei: `src/components/canvas-banner-studio/ci/profileSources.ts`
(mappt Profil + ausgewähltes Fahrzeug → CI-Kontext-Objekt)

### 2) Brand-CI-Presets (Markenvorlagen)
Neue Datei: `src/components/canvas-banner-studio/ci/brandPresets.ts` mit Einträgen wie:
```
{
  brand: "BMW",
  fonts: { display: "BMW Group", body: "Helvetica Neue" }, // mit Web-Font-Fallback
  colors: { primary: "#1c69d4", secondary: "#0653b6", text: "#262626", bg: "#ffffff" },
  logoTreatment: "monochrome-ok",
  ctaStyle: "rounded-pill",
}
```
Marken initial: BMW, Mercedes-Benz, Audi, Volkswagen, Porsche, Ford, Opel, Skoda, Hyundai, Kia, Tesla, Toyota, Renault, Peugeot, Fiat, Volvo, MINI, Smart, Seat, Cupra. + Custom.

Schriften werden über Google-Font-Äquivalente geladen (z. B. BMW Group → "Inter" / "Helvetica" Fallback), keine lizenzpflichtigen Brand-Fonts ausgeliefert. CSS-Loading via `<link>`-Injection on demand (`ensureFontLoaded`).

### 3) Logo-Recoloring (SVG)
Neue Datei: `src/components/canvas-banner-studio/ci/svgRecolor.ts`
- Wenn das Hersteller-Logo eine SVG-URL ist: SVG fetchen, `fill`/`stroke`-Attribute durch Ziel-Farbe ersetzen, als Data-URL zurückgeben.
- Modi: **Original**, **Monochrom Hell** (white), **Monochrom Dunkel** (black), **Custom Color** (color picker).
- Skalierung übernimmt die bestehende Logo-Layer-Resize-Logic.

Falls das Logo PNG ist: Recolor-Optionen ausgrauen + Hinweis "Nur SVG kann eingefärbt werden". Skalierung bleibt verfügbar.

### 4) Shortcodes
Neue Datei: `src/components/canvas-banner-studio/ci/shortcodes.ts`
- Verfügbare Codes: `{{firma}}`, `{{telefon}}`, `{{whatsapp}}`, `{{website}}`, `{{adresse}}`, `{{stadt}}`, `{{plz}}`, `{{marke}}`, `{{modell}}`, `{{preis}}`, `{{rate}}`, `{{laufzeit}}`, `{{anzahlung}}`.
- `resolveShortcodes(text, ciContext)` ersetzt vor dem Render in `BannerCanvas` und `renderComposition`.
- Auto-Shrink-Engine bekommt also den **resolvierten** Text — keine Änderung an Layout-Logik.

### 5) UI: neuer Step "CI" (vor Schritt 2 Bild)
Neue Datei: `src/components/canvas-banner-studio/ci/CiPanel.tsx`
- **Marke** wählen (Dropdown mit Brand-Presets, Default = vom Fahrzeug erkannt)
- **Schrift-Set** Display + Body (vorbelegt aus Brand-Preset, manuell überschreibbar)
- **CI-Farben** 4 Swatches (Primary/Secondary/Text/BG) mit Color-Picker; "Aus Profil übernehmen"-Button
- **Hersteller-Logo** Mode (Original / Weiß / Schwarz / Custom) + Größen-Slider
- **Händler-Logo** Toggle (Position oben/unten/aus)
- **Shortcode-Cheatsheet** zum Copy/Paste

### 6) Persistenz
`StudioState` erweitern um `ci: { brandKey, fontsDisplay, fontsBody, colors{...}, logoMode, logoColor, useDealerLogo, dealerLogoPosition }`.
Wird mit `banner_projects.state` (jsonb) automatisch persistiert (vorhandene Autosave-Logik). Keine DB-Migration nötig.

### 7) Verdrahtung mit bestehender Logik
- Brand-Auswahl → `actions.setLogo(getLogoForMake(brand))` automatisch (Memory-Regel "Logos always latest").
- CI-Farben → text-Layer `color` per Default mit `ci.colors.text` initialisieren; bestehender `resolveColor` priorisiert weiterhin Layer-Eigenwerte (kein Bruch).
- Schrift → Layer-`fontFamily` per Default aus CI gesetzt, override bleibt möglich.
- Shortcodes → resolved nur beim Rendern, originale Strings bleiben editierbar.

## Offen gelassen (bewusst)
- Brand-Compliance-Check (z. B. Mindestabstand zum Logo) — später.
- Eigene Custom-CI-Vorlagen speichern pro User — separater Schritt.
- Upload-eigene-Schrift (TTF/WOFF) — separater Schritt.

## Files (neu)
- `src/components/canvas-banner-studio/ci/brandPresets.ts`
- `src/components/canvas-banner-studio/ci/profileSources.ts`
- `src/components/canvas-banner-studio/ci/shortcodes.ts`
- `src/components/canvas-banner-studio/ci/svgRecolor.ts`
- `src/components/canvas-banner-studio/ci/fontLoader.ts`
- `src/components/canvas-banner-studio/ci/CiPanel.tsx`

## Files (edit)
- `state/types.ts` + `useCanvasBannerStore.ts` → `ci`-Slice + Actions
- `CanvasBannerStudioShell.tsx` → neuer Step "CI", Resolve-Hook für Shortcodes
- `canvas/BannerCanvas.tsx` + `export/renderComposition.ts` → Shortcode-Resolver einhängen
- `controls/TextFieldsPanel.tsx` → Shortcode-Cheatsheet als Hilfetext
