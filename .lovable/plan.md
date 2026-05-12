# Plan: JSON-Template-System für Canvas Banner Studio

## Ziel
Bestehende Code-Builder-Templates (`layoutTemplates.ts`) durch ein **deklaratives JSON-Format** ersetzen, das pro Format×Template jede Ebene exakt beschreibt. Plus: Admin-UI zum Editieren und CI-Presets dürfen Layer-Positionen überschreiben.

## Phase 1 — Schema & Loader

**Neue Datei** `src/components/canvas-banner-studio/data/templateSchema.ts`
TypeScript-Typen für die JSON-Struktur:
```ts
type LayerSpec = {
  id: string;                  // "headline" | "logo" | ...
  type: "image" | "overlay" | "text" | "legal" | "logo";
  field?: BannerTextFieldKey;
  x: number; y: number;        // absolute px im Format-Koordinatensystem
  width?: number; height?: number;
  anchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";
  fontSize?: number; fontWeight?: number;
  align?: "left" | "center" | "right";
  color?: string;              // semantic token oder hex
  visible?: boolean;
  draggable?: boolean;
  autoShrink?: boolean; minFontSize?: number; maxLines?: number;
  // overlay-only
  direction?: OverlayDirection; strength?: number;
  // image-only
  fit?: "cover" | "contain";
};

type TemplateSpec = {
  templateId: string;          // "classic-offer"
  formatId: string;            // "social-4x5"
  name: string;
  format: { width: number; height: number };
  safeArea: { top: number; right: number; bottom: number; left: number };
  defaults?: { fontDisplay?: string; fontBody?: string };
  layers: LayerSpec[];
};
```

**Neue Datei** `src/components/canvas-banner-studio/data/templateRegistry.ts`
- `loadTemplate(formatId, templateId): TemplateSpec` — sucht erst in DB (`banner_templates`), fällt auf Bundle-JSON zurück.
- `listTemplatesForFormat(formatId): TemplateMeta[]`
- In-Memory-Cache + `invalidate()` für Admin-UI.

**Neue Datei** `src/components/canvas-banner-studio/data/templateToLayers.ts`
- `specToBannerLayers(spec, ci?): BannerLayer[]` — wandelt JSON in das bestehende `BannerLayer[]`-Format. Wendet CI-Override zuletzt an.

`buildDefaultComposition` in `defaultComposition.ts` wird umgestellt: lädt Spec, ruft `specToBannerLayers`.

## Phase 2 — Migration der bestehenden Templates

Einmal-Skript `scripts/generate-template-json.ts` (Node, lokal):
- Importiert die alten 5 Builder aus `layoutTemplates.ts`.
- Iteriert über alle Formate aus `formats.ts`.
- Ruft `build(w, h)` auf, serialisiert das Resultat als JSON.
- Schreibt nach `src/components/canvas-banner-studio/data/templates/{templateId}.{formatId}.json`.

Anschließend manuelle Feinjustierung kritischer Format×Template-Kombinationen (z.B. 970×90 Leaderboard), bei denen die Faktor-Formel heute schief aussieht.

`layoutTemplates.ts` wird auf Re-Export aus dem Registry reduziert (Bestandscode bleibt funktionsfähig); nach Verifikation gelöscht.

## Phase 3 — Datenbank für editierbare Templates

**Neue Tabelle** `banner_templates`:
```
id uuid PK
template_id text          -- "classic-offer"
format_id   text          -- "social-4x5"
name        text
spec        jsonb         -- volle TemplateSpec
is_global   boolean default true     -- Lovable-Standard
user_id     uuid nullable -- null = global, sonst eigener Override
brand_key   text nullable -- z.B. "bmw" für CI-spezifisches Template
created_at, updated_at
UNIQUE(template_id, format_id, COALESCE(user_id, '00000000...'), COALESCE(brand_key, ''))
```

RLS:
- Admins: ALL.
- Authenticated SELECT: `is_global = true OR user_id = auth.uid()`.
- Authenticated INSERT/UPDATE/DELETE: nur eigene Zeilen (`user_id = auth.uid()`).

Loader-Priorität (höchste zuerst):
1. User-Override (`user_id = me`, mit/ohne brand_key)
2. Brand-spezifisch global (`is_global, brand_key = ci.brandKey`)
3. Globaler Default (`is_global, brand_key IS NULL`)
4. Bundle-JSON aus `data/templates/`

## Phase 4 — Admin-UI

**Neue Route** `/admin/banner-templates` (`src/pages/admin/AdminBannerTemplates.tsx`):
- Tabelle: Template × Format × Variante (global/brand/user).
- Filter: Brand, Template, Format.
- Aktionen: **Neu**, **Editieren**, **Duplizieren als Brand-Variante**, **Reset auf Bundle-Default**, **Löschen**.

**Editor** (`src/pages/admin/AdminBannerTemplateEditor.tsx`):
- Linke Spalte: **JSON-Editor** (Monaco) mit Schema-Validierung.
- Rechte Spalte: **Live-Preview** über `BannerCanvas` mit Dummy-Texten.
- Toolbar: Speichern, „Auf alle Formate anwenden" (kopiert Layer-Verhältnisse), Vorschau pro Format-Liste.
- Visuelles Editieren ist später möglich (gleicher Canvas wie im Studio); im ersten Wurf nur JSON + Live-Preview.

In `src/pages/admin/AdminLayout.tsx` Navigationspunkt ergänzen.

## Phase 5 — CI-Position-Overrides

`CiState.layerOverrides?: Partial<LayerSpec>[]` (per Brand-Preset).

`brandPresets.ts` bekommt optional `layerOverrides`-Feld:
```ts
{ brand: "BMW", layerOverrides: [
  { id: "logo", anchor: "top-right", x: …, y: …, visible: true }
]}
```

`templateToLayers.ts` mergt Reihenfolge: Bundle → DB-Brand → DB-User → CI-Override.

## Technische Details

- **Anchor-Resolution**: `anchor` ist optionaler Hint; wenn gesetzt, wird `x/y` relativ zur Safe-Area-Ecke interpretiert. Sonst absolut.
- **Backwards-Compat**: Bestehende Banner-Projects (`banner_projects.state` jsonb) speichern weiterhin `BannerLayer[]` direkt — nur die **Default-Generierung** läuft jetzt über JSON. Lade-Pfad bleibt unverändert.
- **Persistierte Compositions** werden NICHT migriert — User behält seine Edits.
- **Admin-Zugriff** via existierender `has_role(_, 'admin')`-Pattern.

## Files (neu)
- `data/templateSchema.ts`
- `data/templateRegistry.ts`
- `data/templateToLayers.ts`
- `data/templates/*.json` (~50 Dateien per Skript)
- `scripts/generate-template-json.ts`
- `pages/admin/AdminBannerTemplates.tsx`
- `pages/admin/AdminBannerTemplateEditor.tsx`
- DB-Migration: `banner_templates` + RLS

## Files (edit)
- `data/defaultComposition.ts` — JSON-Loader statt Builder-Funktion
- `data/layoutTemplates.ts` — Re-Export aus Registry, später entfernt
- `ci/brandPresets.ts` — `layerOverrides`-Feld
- `state/types.ts` — `CiState.layerOverrides`
- `pages/admin/AdminLayout.tsx` — Nav-Link
- `App.tsx` — Route

## Reihenfolge der Umsetzung
1. Schema + Loader + Generator-Skript + Bundle-JSON (Phase 1+2). Studio läuft danach unverändert, nur Quelle der Wahrheit ist JSON.
2. DB-Migration `banner_templates` (Phase 3).
3. CI-Layer-Overrides (Phase 5) — klein, daher früh.
4. Admin-UI (Phase 4) — größter Brocken.

## Bewusst weggelassen (für später)
- WYSIWYG-Drag-Editor im Admin (erstmal JSON + Preview).
- Versionierung/History pro Template.
- Bulk-Import/Export von Templates als ZIP.
