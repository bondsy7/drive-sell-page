## Problem

Der Kompatibilitäts-Check im `SocialPublishModal` sperrt zu viele Banner-Formate für Instagram. Aktuell erlaubt er nur Ratio **0.80 – 1.91** (Feed). Damit wird auch **1080×1920 (9:16, 0.5625)** blockiert, obwohl Instagram Stories/Reels genau dieses Format brauchen.

Tatsächlich soll nur zwei Formate ablehnen:
- **Google Display Medium Rectangle 300×250** — zu klein (Instagram Minimum 320 px Kantenlänge) und Ratio egal
- **Google Display Leaderboard 728×90** — Ratio 8.09:1, extrem breit, nicht unterstützt

Alle anderen (Square 1:1, Portrait 4:5, Story 9:16, Landscape 1.91:1, Hero 1920×800) sollen posten dürfen.

## Neue Regel für Instagram-Kompatibilität

Datei: `src/components/dashboard/SocialPublishModal.tsx`

Instagram akzeptiert, wenn **alle drei** Bedingungen erfüllt sind:

1. **Ratio zwischen 0.5 und 1.91** (deckt 9:16 Story = 0.5625, 4:5 = 0.8, 1:1, 1.91:1)
2. **Kleinste Kante ≥ 320 px** (Instagrams Mindest-Uploadgröße)
3. **Größte Kante ≥ 600 px** (Sanity-Guard gegen 728×90-artige Banner mit extrem geringer Höhe)

Damit:

| Format | Größe | Ratio | Erlaubt? |
|---|---|---|---|
| IG Square | 1080×1080 | 1.00 | ✅ |
| IG Portrait 4:5 | 1080×1350 | 0.80 | ✅ |
| IG Story 9:16 | 1080×1920 | 0.5625 | ✅ (bisher fälschlich blockiert) |
| FB Feed | 1200×1200 | 1.00 | ✅ |
| FB Link Ad | 1200×628 | 1.91 | ✅ |
| Web Hero | 1920×800 | 2.40 | ⚠️ FB ok, IG blockiert (Ratio zu breit) |
| Google MedRect | 300×250 | 1.20 | ❌ (Kante < 320) |
| Google Leaderboard | 728×90 | 8.09 | ❌ (Ratio + Höhe < 320) |
| Google Skyscraper | 160×600 | 0.27 | ❌ (Kante < 320) |

Facebook-Regel bleibt wie sie ist (Ratio 0.4 – 2.5), passt zu allen außer 728×90 und 160×600.

## Umsetzung — nur eine Datei

`src/components/dashboard/SocialPublishModal.tsx`, Zeilen 56–66:

```ts
const ratio = dimensions ? dimensions.w / dimensions.h : null;
const minEdge = dimensions ? Math.min(dimensions.w, dimensions.h) : null;
const maxEdge = dimensions ? Math.max(dimensions.w, dimensions.h) : null;

// Instagram: Feed 4:5–1.91:1 ODER Story 9:16, min. 320 px kürzeste Kante, min. 600 px längste Kante
const IG_MIN_RATIO = 0.5;   // 9:16 Story = 0.5625
const IG_MAX_RATIO = 1.91;  // Landscape Feed
const IG_MIN_EDGE  = 320;
const IG_MIN_LONG  = 600;
const instagramCompatible = ratio === null || minEdge === null || maxEdge === null
  ? true
  : ratio >= IG_MIN_RATIO && ratio <= IG_MAX_RATIO
    && minEdge >= IG_MIN_EDGE
    && maxEdge >= IG_MIN_LONG;

// Facebook bleibt tolerant, blockiert nur extreme Banner-Formate
const FB_MIN_RATIO = 0.4;
const FB_MAX_RATIO = 2.5;
const FB_MIN_EDGE  = 200;
const facebookCompatible = ratio === null || minEdge === null
  ? true
  : ratio >= FB_MIN_RATIO && ratio <= FB_MAX_RATIO && minEdge >= FB_MIN_EDGE;
```

Warnhinweis-Text im gelben Banner anpassen: statt „nur 4:5–1.91:1" jetzt

> „Instagram braucht mindestens 320 px kürzeste Kante und akzeptiert Seitenverhältnisse zwischen 9:16 (Story) und 1,91:1 (Landscape). Für Displaywerbung wie 300×250 oder 728×90 bitte Facebook Page oder X.com nutzen."

## Betroffene Datei

- `src/components/dashboard/SocialPublishModal.tsx` — Kompatibilitäts-Logik + Warntext

Keine Änderungen an Edge Functions oder Formaten-Katalog nötig.
