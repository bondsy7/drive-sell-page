

# Plan: Video2Frames -- Zweite 360° Spin-Variante

## Zusammenfassung

In der Spin360-Workflow-Oberfläche wird nach dem Upload der 4 Bilder ein **Slider/Toggle** angezeigt, mit dem der Nutzer zwischen zwei Methoden wählen kann:

- **Image2Spin** (bestehend): KI generiert Einzelbilder aus 4 Fotos (36 Frames)
- **Video2Frames** (neu): KI generiert ein 360°-Spin-Video via Veo API, dann werden daraus 48 Frames extrahiert

## Architektur

```text
┌─────────────────────────────────────┐
│  Spin360Upload (4 Fotos)            │
│  ┌───────────────────────────────┐  │
│  │  Toggle: Image2Spin │ Video2F │  │
│  └───────────────────────────────┘  │
│  Preis: dynamisch je nach Modus     │
│  [360° Spin erstellen]              │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
Image2Spin            Video2Frames
(existing edge fn)    (new edge fn action)
generate-360-spin     generate-video action="spin360"
36 Frames             → Video → 48 Frames
                      (server-side extraction)
```

## Technische Umsetzung

### 1. Edge Function `generate-video` erweitern

Neue `action: "spin360"` hinzufuegen die:
- 4 Bilder als Base64/URLs entgegennimmt
- Einen optimierten, konsistenten Prompt verwendet (kein Sound, perfekte Drehung, weisser Showroom, gleichmaessige Geschwindigkeit)
- Video via Veo API generiert (start + poll, wie bestehend)
- Nach Video-Fertigstellung: **Server-seitig 48 Frames extrahieren** mittels Gemini Vision API (Frames bei bestimmten Timestamps als Screenshots anfragen) oder alternativ das Video in Storage speichern und die Frame-Extraction client-seitig via Canvas machen
- Frames als Einzelbilder in Storage hochladen
- In `spin360_generated_frames` Tabelle eintragen (gleiche Struktur wie Image2Spin)

**Prompt fuer 360° Spin Video:**
```
Professional 360-degree turntable rotation of the exact vehicle shown in the reference images. 
The car rotates smoothly and continuously on a white turntable platform, completing exactly one 
full 360-degree rotation. Clean white studio background, soft even lighting, no shadows. 
Perfectly steady camera at eye level, fixed position. No sound. Smooth constant rotation speed. 
8 seconds duration for one complete revolution.
```

### 2. Spin360Workflow.tsx anpassen

- Neuer State: `spinMode: 'image2spin' | 'video2frames'`
- Kosten dynamisch berechnen:
  - Image2Spin: bestehend (analysisCost + normalizeCost + generateCost ≈ 20 Credits)
  - Video2Frames: z.B. 10 Credits (Video-Generierung)
- Nach Upload der 4 Bilder: Toggle/Slider zwischen den Modi anzeigen
- Bei Video2Frames: eigener Processing-Flow mit Video-Generierung + Frame-Extraction

### 3. Spin360Upload.tsx anpassen

- Neuer Prop: `spinMode` + `onModeChange` callback
- Nach den 4 Upload-Slots: Slider/Toggle-UI fuer Moduswahl
- Button-Text anpassen je nach Modus

### 4. Frame-Extraction Strategie

Da server-seitige Video-Frame-Extraction in Deno Edge Functions komplex ist (kein ffmpeg), wird die **client-seitige Extraction via HTML5 Canvas** verwendet:
- Video wird in ein `<video>` Element geladen
- Bei 48 gleichmaessig verteilten Zeitpunkten wird jeweils ein Frame via `canvas.drawImage()` + `canvas.toDataURL()` extrahiert
- Frames werden in Storage hochgeladen und in `spin360_generated_frames` gespeichert

### 5. Neue Komponente: `Video2FramesProcessor.tsx`

Client-seitige Logik:
1. Video von Storage URL laden
2. 48 Frames extrahieren (video.currentTime setzen, seeked-Event abwarten, Canvas-Screenshot)
3. Frames in Storage hochladen
4. In DB eintragen
5. Spin360Viewer mit Frames anzeigen

### 6. Dateien

| Datei | Aenderung |
|-------|-----------|
| `src/components/spin360/Spin360Upload.tsx` | Toggle fuer spinMode hinzufuegen |
| `src/components/spin360/Spin360Workflow.tsx` | spinMode State, dynamische Kosten, Video2Frames-Flow |
| `src/components/spin360/Video2FramesProcessor.tsx` | **Neu** - Client-seitige Frame-Extraction |
| `src/components/spin360/Spin360Progress.tsx` | Zusaetzliche Steps fuer Video-Modus |
| `src/components/spin360/index.ts` | Export ergaenzen |
| `supabase/functions/generate-video/index.ts` | Neue action `spin360` mit 4-Bild-Input |

### 7. Credit-Kosten

- Video2Frames nutzt den bestehenden `spin360_video` Action-Type (neu in admin_settings/credit_costs)
- Default: 10 Credits (entspricht der Video-Generierung)
- Image2Spin bleibt bei ~20 Credits

