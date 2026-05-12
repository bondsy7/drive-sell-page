## Ziel
Den Banner-Erstellprozess von „5 nebeneinander liegenden Schritten mit redundanten Eingaben" zu einem **geführten, AI-first Wizard** umbauen. Maximale Automatisierung, minimale Eingaben, keine doppelten Abfragen.

## Status quo – Probleme
1. **Schritt 0 (Fahrzeug verknüpfen)** und **Schritt 2 (Bild-Upload + PDF-Analyse)** überschneiden sich: beide liefern Headline, Preis, Pflichtangaben, Logo.
2. **CI-Block** wird immer komplett aufgeklappt, obwohl 95 % der User „Profil-CI" wollen.
3. **Schritt 3 (Texte)** zeigt Felder, die schon aus Fahrzeug/PDF befüllt sind – User weiß nicht „wurde das automatisch gezogen oder muss ich tippen?".
4. **Schritt 4 (Layout)** kommt nach Texten – Reihenfolge unlogisch (Layout sollte vor Feinschliff stehen).
5. **Logo, Format, Bildquelle** werden mehrfach abgefragt (Step 0, CI, Step 2).
6. Kein klarer „Fertig"-Zustand → User scrollt zwischen Blöcken hin und her.

## Neue Struktur – 3 statt 5 Schritte

```text
┌────────────────────────────────────────────────────────────┐
│ SCHRITT 1 · QUELLE                                          │
│ Eine Karte, drei Wege:                                      │
│  ① Fahrzeug aus Galerie  → zieht ALLES (Bild, Daten, Logo)  │
│  ② VIN eingeben          → VIN-Lookup + Daten holen         │
│  ③ PDF/Bild hochladen    → analyze-pdf + extract-banner     │
│ → Format-Vorauswahl als Chips (Multi-Select, default IG SQ) │
└────────────────────────────────────────────────────────────┘
                        ↓ Auto-Fill
┌────────────────────────────────────────────────────────────┐
│ SCHRITT 2 · VORSCHAU & FEINSCHLIFF (alles auf einer Seite)  │
│  Links: Live-Canvas (groß)                                  │
│  Rechts: kontextuelle Inspector-Panels:                     │
│   • Layout-Variante (4 Presets als Thumbnails)              │
│   • Texte (alle vorbefüllt, Badge „auto" bei AI-Werten)     │
│   • CI (collapsed default, „Profil-CI verwendet" Badge)     │
│   • Hintergrund (KI-Reframe / Upload / Galerie)             │
│  Klick auf Element im Canvas → öffnet passendes Panel       │
└────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│ SCHRITT 3 · EXPORT                                          │
│  Compliance-Check + Download (PNG/JPG/WebP/ZIP)             │
└────────────────────────────────────────────────────────────┘
```

## Auto-Fill Pipeline (zentral, einmal)

Bei Quelle-Auswahl läuft **eine** Orchestrator-Funktion `prefillBannerFromSource()`:

| Quelle | Zieht automatisch |
|---|---|
| Fahrzeug | Hauptbild (Cover), Marke/Modell → Headline, Preis/Rate, Verbrauch → Pflichtangaben, Marken-Logo via `getLogoForMake`, Händler-Logo + Farben aus `dealer_profile` |
| VIN | `lookup-vin` + danach gleiche Pipeline wie Fahrzeug |
| PDF | `analyze-pdf` (existiert), Felder gemappt durch `extractBannerDataFromPdf` (existiert), Bild aus PDF extrahieren falls vorhanden |

Alle automatisch gefüllten Felder bekommen ein **„✨ auto"-Badge** mit Tooltip „aus Fahrzeugdaten – klicken zum Überschreiben". Ein einziger Button „Alles zurücksetzen auf Auto-Werte".

## UX/UI-Verbesserungen

- **Progress-Header** sticky oben: 3 Steps + ETA („~30 Sek").
- **Smart Defaults**: 
  - CI = Profil-CI (kein Auswahl-Klick nötig)
  - Logo-Quelle = Hersteller wenn Marke erkannt, sonst Händler
  - Format = letztes verwendetes Format des Users (localStorage)
  - Layout = AI-Vorschlag basierend auf Bild (`suggest-banner-layout` existiert)
- **Inline-Edit am Canvas**: Doppelklick auf Text → editieren ohne Panel.
- **Empty-State weg**: Solange kein Bild da ist, zeigt Canvas einen blurred Placeholder mit „Quelle wählen →" CTA, nicht die graue „Noch kein Hintergrundbild" Box.
- **Mobile**: Inspector wird zu Bottom-Sheet.

## Redundanz-Eliminierung (konkret)

| Heute doppelt/dreifach | Neu |
|---|---|
| Logo: Step 0 (Fahrzeug → Marken-Logo) + CI (Logo-Quelle) + Step 2 (Logo upload) | **EIN** Inspector „Logo" mit drei Tabs |
| Format: Step 1 + CI „Wirkt auf alle Formate" Toggle | Format-Chips oben in Schritt 1, scope-toggle nur wenn >1 Format gewählt |
| Texte: Auto aus PDF + manuelles Feld in Step 3 | Ein Feld, Badge zeigt Herkunft |
| Pflichtangaben: aus Fahrzeug + aus PDF + manuell | Auto, mit „Quelle: Fahrzeugdaten" Hinweis |

## Technische Umsetzung

**Neu/Refactor:**
- `prefillBannerFromSource.ts` – ein Orchestrator (nutzt vorhandene `buildPrefillFromVehicle`, `extractBannerDataFromPdf`, `useVinLookup`, `buildCiContext`)
- `SourceStep.tsx` – neue Schritt-1-Komponente (3 Quellen-Karten + Format-Chips)
- `InspectorPanel.tsx` – Tab-Container für Layout/Texte/CI/Hintergrund
- `AutoBadge.tsx` – kleines „✨ auto" Pill mit Tooltip
- `useFieldOrigin.ts` – Hook der trackt, ob Feld auto/manuell ist (im Store als Map)

**Bestehend bleibt** (kein Touch nötig):
- Edge Functions (`analyze-pdf`, `lookup-vin`, `extract-banner-data`, `suggest-banner-layout`, `reframe-banner-image`)
- `BannerCanvas.tsx`, `useCanvasBannerStore.ts` (nur kleine Erweiterung um Field-Origin)
- Export-Pipeline + Compliance-Check
- `CustomLayersPanel.tsx` (wandert in Inspector → Tab „Texte")

**State-Erweiterung:**
```ts
type FieldOrigin = "auto" | "manual";
state.textFieldOrigins: Record<keyof BannerTextFields, FieldOrigin>
```
Sobald User tippt → flippt auf "manual", Badge verschwindet.

## Was ich vor Start klären würde
1. Sollen die alten 5 Schritte als „Pro-Modus" erhalten bleiben (Toggle), oder hart ersetzen?
2. VIN-Lookup als eigene Quelle anbieten oder nur innerhalb „Fahrzeug" als optionales Feld?
3. AI-Layout-Vorschlag automatisch beim ersten Bild ausführen (kostet Credits) oder nur auf Klick?

Sag mir die Antworten zu 1–3, dann baue ich Schritt für Schritt um – beginnend mit dem Source-Step + Auto-Fill-Orchestrator (höchster UX-Hebel, kleinster Risk).
