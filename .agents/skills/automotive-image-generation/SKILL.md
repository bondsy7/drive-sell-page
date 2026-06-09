---
name: automotive-image-generation
description: Fahrzeug-Bildgenerierung mit Reference Truth Protocol — keine KI-Halluzinationen bei Farben/Felgen/Innenraum, korrekte Perspektiven-Logik, Model-Tier-Routing (Gemini vs OpenAI), Logo-Treue und Empty-Car-Regeln. Triggert bei Remastering, Pipeline-Jobs, Banner-Generierung, 360-Spin und allen Bild-Edge-Functions.
---

# Automotive Image Generation

## Reference Truth Protocol (PFLICHT)

Bei JEDEM Prompt an Bild-APIs explizit anweisen:

> "Use ONLY the reference image. Do NOT invent colors, badges, wheels, interior trim, stitching, or UI elements. Every visible attribute MUST match the reference exactly. Do NOT fall back on generic model knowledge."

**Warum:** Ohne diesen Block halluziniert das Modell (z.B. gelber Mercedes-Taxi wird blauer Sportwagen, schwarzes Leder wird beige).

## Perspektiven-Regeln

- **3/4 Hinten Links/Rechts** sind eigenständige Renders mit 30–40° Kamera-Offset — NIE gespiegelt.
- **Innenraum:** Empty Car (keine Personen, kein Müll, kein Handy), A/B-Säulen und Dach NIE anschneiden.
- **Scheinwerfer:** 7-Punkte-Check (Form, LED-Signatur, Reflektoren, Blende, Höhe, Außenkante, Innenkante).
- **Kennzeichen:** Entfernen ODER reproduzieren — nie halb sichtbar / unscharf.

## Model-Tier → Engine Routing (BINDEND)

| Tier | Engine | Modell |
|---|---|---|
| schnell | Gemini | `gemini-2.5-flash-image` |
| qualitaet | Gemini | `gemini-3.1-flash-image-preview` (Nano Banana 2) |
| premium | Gemini | `gemini-3-pro-image-preview` (Nano Banana Pro) |
| turbo | OpenAI | `gpt-image-1` (medium) |
| ultra | OpenAI | `gpt-image-1` (high) |
| neu | OpenAI | `gpt-image-2` (high) |

**Kein Cross-Engine-Fallback.** OpenAI-Fail → NICHT auf Gemini ausweichen. Innerhalb Gemini-Familie erlaubt.

Implementiert in: `remaster-vehicle-image`, `generate-banner`, `generate-vehicle-image` (jeweils `MODEL_MAP`/`ENGINE_MAP`).

Immer loggen: `[function] Engine=X Model=Y Tier=Z (user-selected, binding)`.

## File API First (Gemini)

ALLE Bild/PDF-Transfers zu AI-Edge-Functions via `uploadToGeminiFiles` → `fileUri`. Base64 nur Fallback.

**Ausnahme — Veo Video (`generate-video`, `spin360_start`):** `predictLongRunning` akzeptiert KEIN `fileUri`. Client sendet raw base64 direkt.

## OpenAI-Branch Besonderheiten

- Endpoint: `/v1/images/edits`
- Gemini File-URIs müssen vorher zu inline bytes materialisiert werden
- Max 16 Referenzbilder
- Output: 1536x1024

## Logo-Treue

Immer **aktuellstes** Markenlogo aus `public/images/logos/` (via `getLogoForMake`) — NIE historische Versionen (z.B. VW nur 2019+ flat blue, nie chrome).

Logos via `<CRITICAL_ASSET_INTEGRATION>`-Block im Prompt fixieren.

## API-Constraints

- Gemini Image API unterstützt **KEIN** `aspectRatio` in `generationConfig`.
- Aspect-Ratio nur über Prompt + Post-Crop steuern.
