# Zusätzliche Detailbilder im Fotoaufnahme-Prozess

## Ziel

Unterhalb des Perspektiven-Grids in `ImageCaptureGrid` wird ein Multi-Upload-Bereich für zusätzliche Detailaufnahmen hinzugefügt (z.B. Felgen, Schäden, Logos, Motorraum). Diese Bilder werden als `additionalImages` an die Remaster-API gesendet, damit die KI sie als Referenz für bessere Ergebnisse nutzen kann.

## Änderungen

### 1. ImageCaptureGrid.tsx — Neuer Upload-Bereich + State

- Neuer State: `detailImages: string[]` (base64-Array, max 10 Bilder)
- Neuer Drag&Drop/Click-Upload-Bereich zwischen den RemasterOptions und dem VIN-Display
- Vorschau-Grid der hochgeladenen Detailbilder mit Entfernen-Button
- Label: "Weitere Detailaufnahmen" mit Hinweis "Felgen, Schäden, Logos, Motorraum etc."
- Bilder werden komprimiert (gleiche `compressImage`-Funktion)

### 2. ImageCaptureGrid.tsx — Detailbilder an Remaster übergeben

- In `startRemastering()` und `retrySingleSlot()`: `additionalImages: detailImages` zum `invokeRemasterVehicleImage`-Payload hinzufügen
- In `allCapturedBase64` / `allOriginalBase64` für die Pipeline ebenfalls übergeben

### 3. PipelineRunner — additionalImages durchreichen

- Neue optionale Prop `additionalImages?: string[]`
- Wird an `invokeRemasterVehicleImage` in `generateOneImage` weitergereicht

### 4. Edge Function (remaster-vehicle-image)

- `additionalImages` wird bereits im Payload-Interface akzeptiert
- Sicherstellen, dass die Bilder als Referenz-Inline-Images mit beschreibendem Text ("Zusätzliche Detailaufnahme des Fahrzeugs als Referenz") in den Gemini-Request eingefügt werden

## Technische Details

```text
┌─────────────────────────────────────┐
│  Perspektiven-Grid (6 Slots)        │
├─────────────────────────────────────┤
│  + Weitere Detailaufnahmen          │
│  [img] [img] [img] [+ Upload]       │
│  Drag & Drop oder klicken           │
├─────────────────────────────────────┤
│  Remaster-Optionen                  │
├─────────────────────────────────────┤
│  VIN / Progress / Actions           │
└─────────────────────────────────────┘
```

- Max 10 Detailbilder, je max 10MB
- Gleiche Komprimierung wie Perspektiv-Bilder
- Werden NICHT selbst remastert, sondern nur als Kontext/Referenz mitgesendet
- Edge Function fügt sie als `inlineData`-Parts mit Label ein
- Füge das in allen pipelines hinzu

### Betroffene Dateien

- `src/components/ImageCaptureGrid.tsx` (Upload-UI + State + Payload)
- `src/components/PipelineRunner.tsx` (neue Prop + Weiterleitung)
- `supabase/functions/remaster-vehicle-image/index.ts` (Referenz-Bilder einfügen)