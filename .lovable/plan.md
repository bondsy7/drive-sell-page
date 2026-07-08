
## Ziel

Aus dem aktuellen, unrunden Landing-Page-Flow ein Produkt-Feature machen, das sich anfühlt wie das PDF-Tool: **ein Klick → fertige, exzellente Seite** mit sektionsspezifisch generierten Fahrzeugbildern, live editierbar direkt auf der Seite. Datenfundament kommt automatisch aus dem, was AUTO3 schon weiß (PDF/VIN, Dealer-Profil, Galerie, Pflichtangaben). Farben strikt aus `profile.primary_color` / `secondary_color`.

---

## 1. Wie eine Fahrzeug-Landing-Page „vom Profi" aufgebaut ist

Feste, kuratierte Section-Reihenfolge (jede Section ein- / ausblendbar, per Drag umsortierbar):

```text
1. Sticky Header       Händlerlogo · Fahrzeugname · CTA "Anfragen"
2. Hero (Full-Bleed)   generiertes Szenenbild, Overlay-Text, Preis/Rate-Badge, 2 CTAs (Anfrage / WhatsApp)
3. Key Facts Strip     6 Kacheln: EZ · km · Leistung · Getriebe · Kraftstoff · Farbe (auto aus VIN/PDF)
4. Design & Exterior   Editorial 60/40 Split, generiertes 3/4-Frontbild, Fließtext
5. Interieur           Empty-Car Innenraum-Szene, Highlights als Chip-Liste
6. Performance / Antrieb  Zahlen groß (PS/kW, 0-100, Reichweite, Verbrauch), Detail-Crop
7. Ausstattung         2-spaltige Feature-Liste (Kategorien: Komfort, Sicherheit, Multimedia …)
8. Finanzierung        Rate-Karte + Konditionen + § 17 PAngV-Zeile (Bank aus Profil)
9. Galerie             Bestehende Fahrzeugbilder aus useVehicleAssets (Grid + Lightbox)
10. CTA-Band           Volltonstreifen in primary-color, Anfrage-Buttons
11. Kontakt / Standort Adresse, Telefon, WhatsApp, Socials, Öffnungszeiten (optional Map-Embed)
12. Footer + Pflichtangaben  formatMandatoryDisclosure() + Impressum-Link
```

Jede Section hat: `id`, `type`, `enabled`, `headline`, `body`, `imagePrompt?`, `imageUrl?`. Reihenfolge und `enabled` sind pro Projekt persistiert.

---

## 2. Was automatisch befüllt wird (kein Neu-Eintippen)

Prefill-Reihenfolge beim „Landing Page erstellen"-Klick:

| Quelle | Was |
|---|---|
| `projects.vehicle_data` (PDF/VIN-Flow) | Marke, Modell, Titel, Preis, Rate, Laufzeit, Verbrauch, CO₂, CO₂-Klasse, Ausstattung, Bank |
| `profiles` | Firmenname, Logo, Adresse, Telefon, WhatsApp, Socials, `primary_color`, `secondary_color`, `default_legal_text`, `financing_bank` |
| `useVehicleAssets(vehicleId)` | Vorhandene remasterte Bilder + 360°-Frames → Galerie-Section, Fallback für Section-Bilder |
| `getLogoForMake` | Aktuelles Markenlogo (nie historisch, siehe Memory) |
| `formatMandatoryDisclosure()` | Footer-Pflichtzeile (PHEV/BEV/Verbrenner korrekt) |
| Manuell nachgereichte Felder | Nur was noch fehlt (Occasion-Text, freier Prompt) — Modal fragt gezielt |

Wenn ein Feld fehlt → Section wird nicht mit Platzhaltern gefüllt, sondern **automatisch ausgeblendet**. Kein „Lorem ipsum".

---

## 3. Sektion-spezifische AI-Bilder (der wichtigste Fix)

Aktuell: ein Hero-Bild, andere Sections nutzen Wiederholungen/Crops → wirkt verzerrt und unpassend.

Neu: Pro sichtbarer Bild-Section wird ein eigenes Bild mit **Reference Truth Protocol** generiert (identisches Fahrzeug, Kennzeichen, Räder, Badges), aber **passender Szene**:

| Section | Szene | Aspect |
|---|---|---|
| Hero | Cinematic Wide, Umgebung passt zu Occasion (Showroom / City / Alpen) | 16:9 |
| Design & Exterior | 3/4-Front, ruhiger Studiohintergrund in `primary` als flatter Wandton | 4:3 |
| Interieur | Empty-Car Cockpit-Perspektive, warmes Ambient Light | 4:3 |
| Performance | 3/4-Rear in Bewegung / Dynamic Motion Blur nur am Asphalt | 16:9 |
| CTA-Band | abstrakte Detailaufnahme (Scheinwerfer / Felge) mit `secondary`-Tint | 21:9 |

Umsetzung:
- Neue Edge Function `generate-landing-scenes` orchestriert 5 parallele Aufrufe von `remaster-vehicle-image` mit sektionsspezifischen Prompts (Templates + Occasion-Kontext + User-CI-Farbe als Environment-Tint).
- **Model-Tier-Routing bindend** (siehe Skill): Nutzerwahl schnell/qualitaet/premium → Gemini-Familie, turbo/ultra/neu → OpenAI. Kein Cross-Engine-Fallback.
- Bilder werden in `vehicle-images` Bucket unter `landing/{projectId}/{sectionId}.jpg` gespeichert und in `projects.vehicle_data.imageMap` referenziert.
- Regenerate pro Section einzeln möglich (bereits vorhandener Flow, aber mit sektionsspezifischem Prompt statt Hero-Wiederverwendung).

Aspect-Ratio via Prompt + Post-Crop (Gemini kennt kein `aspectRatio`, siehe Memory).

---

## 4. WYSIWYG-Inline-Editor

Ersetzt den aktuellen Formularpanel-Editor komplett.

- **Rendering:** Landing-Page wird als React-Komponente (`LandingPageRenderer`) direkt gerendert — nicht mehr als HTML-String in iframe. HTML-Export wird beim Download aus derselben Datenstruktur erzeugt.
- **Inline-Editierung:**
  - Klick auf Headline / Fließtext → `contentEditable` inline, Auto-Save nach Blur (debounced).
  - Hover auf Bild → Overlay mit „Neu generieren" / „Hochladen" / „Aus Galerie wählen" / „Prompt bearbeiten".
  - Section-Rand zeigt beim Hover Toolbar: `Nach oben ↑` `Nach unten ↓` `Ausblenden 👁` `Löschen 🗑`.
  - Floating „+ Section einfügen"-Button zwischen zwei Sections mit Auswahlmenü (Steps, FAQ, Custom Text/Image, Comparison, Benefits).
- **Toolbar oben:** Zurück · Vorschau (Toggle blendet alle Edit-Overlays aus) · Gerätevorschau Mobile/Tablet/Desktop · HTML herunterladen · Publizieren-Toggle.
- **Keine zwei-Spalten-Ansicht mehr** — die Preview *ist* der Editor.
- Auto-Save läuft weiterhin gegen `projects` (bereits existent).

---

## 5. Layout- und Design-Qualität

- **Farben:** Ausschließlich `profile.primary_color` und `secondary_color`. Sekundäre Semantiken aus diesen Farben abgeleitet: `bg-tint = primary @ 6%`, `border = primary @ 15%`, `cta-hover = secondary`. **Keine** hardcodierten Tailwind-Farbklassen im Renderer.
- **Typografie:** Space Grotesk (Display) + Inter (Body) — bereits im Projekt. H1 40–56px, H2 28–36px, Fließtext 16–17px, Line-Height 1.65.
- **Layout-Prinzipien:** 12-Column-Grid mit `max-w-6xl`, konsistentes vertikales Rhythmus-Raster (`py-24` pro Section, `py-16` mobile), großzügige Weißräume, Bilder in fixen Aspect-Ratios (Tailwind `aspect-*`) → **keine verzerrten Bilder mehr**.
- **Bild-Rendering:** `object-cover` + fixe Aspect-Ratio pro Section-Typ, `loading="lazy"`, `decoding="async"`, korrekte `alt`-Texte aus Marke/Modell.
- **Editorial Split-Sections:** 60/40 statt 50/50 mit Overlay-Gradient, alternierend links/rechts, Bild bleibt in fixer Ratio.
- **Motion:** Sanfte Fade-In-on-Scroll für Sections (framer-motion, bereits im Projekt).
- **Responsive:** Mobile-First, sticky CTA-Button unten auf Mobile.

---

## 6. Erstellungs-Flow (nutzerseitig)

1. Nutzer öffnet Fahrzeug im Dashboard → Button „Landing Page erstellen".
2. **Ein Modal**, drei Zeilen:
   - Anlass (Dropdown: Verkauf / Leasing / Finanzierung / Neuwagen-Launch / Tageszulassung).
   - Szenen-Stil (Dropdown: Cinematic / Editorial Studio / Urban / Alpine).
   - Modell-Tier (Slider: schnell → qualitaet → premium, mapped auf Engine).
3. „Generieren"-Klick → Edge Function `generate-landing-page` liefert:
   - Strukturierten Text (SEO-Titel, Hero-Copy, alle Section-Bodies) via Gemini/OpenAI mit Prefill-Daten als Kontext.
   - Parallel: `generate-landing-scenes` erzeugt 5 Section-Bilder.
   - Pflichtangaben werden lokal via `formatMandatoryDisclosure()` gesetzt (nicht vom LLM erfunden).
4. Nutzer landet direkt im Inline-Editor mit fertiger Seite.
5. Editieren nach Belieben → Auto-Save → „HTML herunterladen" oder „Publizieren".

**Keine Zwischenschritte, keine leeren Formulare** — analog zum PDF-Flow.

---

## 7. Technische Umsetzung

### Frontend
- **Neu:** `src/components/landing/LandingRenderer.tsx` — React-Renderer mit allen Section-Typen als Sub-Komponenten (`HeroSection`, `FactsStrip`, `EditorialSplit`, `SpecsSection`, `FinanceSection`, `GallerySection`, `CtaBand`, `ContactSection`, `LegalFooter`).
- **Neu:** `src/components/landing/InlineEditor.tsx` — Hook, der `contentEditable`, Bild-Overlays und Section-Toolbars steuert; nutzt Context `LandingEditContext`.
- **Neu:** `src/components/landing/SectionInserter.tsx` — der „+ Section"-Button zwischen Blöcken.
- **Neu:** `src/components/landing/GenerateLandingModal.tsx` — 3-Feld-Modal für Occasion/Szene/Tier.
- **Refactor:** `LandingPageEditor.tsx` schrumpft auf Shell (Toolbar + Renderer + Editor-Overlays).
- **Refactor:** `landing-page-builder.ts` → wird zu `buildLandingPageHTMLFromModel(model)` und rendert dieselbe Datenstruktur zu statischem HTML **nur beim Export/Download**.
- **Datenmodell** (in `projects.vehicle_data`):
  ```ts
  {
    type: 'landing-page-v2',
    occasion, sceneStyle, tier,
    hero: { headline, subheadline, ctaText, priceBadge, imageUrl, imagePrompt },
    facts: [{ label, value }...],
    sections: [{ id, type, enabled, order, headline, body, imageUrl?, imagePrompt? }],
    finance: { rate, duration, downPayment, bank, effectiveRate, legalLine },
    disclosure: '<gesamter Pflichttext>',
    dealer, brand, model, colors: { primary, secondary }
  }
  ```

### Edge Functions
- **Refactor:** `generate-landing-page` — Prompt komplett neu (strukturiertes JSON-Schema fest, keine kreativen Section-Typen aus dem Nichts, Pflichtangaben werden **nicht** vom LLM erzeugt).
- **Neu:** `generate-landing-scenes` — orchestriert 5 parallele `remaster-vehicle-image`-Calls mit sektionsspezifischen Templates. Nutzt File-API-First (`uploadToGeminiFiles`).

### Farben & Design-Tokens
- CI-Farben aus Profil werden als CSS-Variablen `--lp-primary` / `--lp-secondary` in den Renderer injected. Alle Sub-Komponenten nutzen ausschließlich diese + `--lp-bg-tint`, `--lp-border`, `--lp-text` (aus HSL-Helligkeit abgeleitet).
- Kein `text-white` / `bg-black` in Komponenten (siehe Core-Regel).

---

## 8. Migration

- `type: 'landing-page'` (alt) wird beim Laden erkannt und bleibt im alten Renderer öffnungsfähig (readonly-Fallback), damit alte Projekte nicht brechen.
- Neue Generierungen → immer `landing-page-v2`.

---

## 9. Was NICHT Teil dieses Schritts ist

- API-Integration nach außen (Publish an Kunden-Domain) — kommt im nächsten Schritt „wie beim PDF-Tool", separater Plan.
- CMS-artige Multi-Version-Verwaltung.
- A/B-Varianten pro Landing Page.

Die Grundlage dafür (saubere Datenstruktur, statisch renderbares HTML) wird hier bereits gelegt.

---

## Ergebnis

Ein einziger Klick auf einem Fahrzeug erzeugt eine visuell konsistente, technisch saubere Landing Page mit fünf sektionsspezifisch generierten Fahrzeugbildern in den CI-Farben des Händlers, direkt inline editierbar wie in Notion / Framer — ohne Formular-Sidebar. Bilder sind nicht mehr verzogen (fixe Aspect-Ratios + `object-cover`), Texte sitzen im 12-Col-Grid mit sauberem vertikalem Rhythmus, Pflichtangaben stimmen automatisch.
