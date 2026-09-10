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
| flare | OpenAI | `gpt-image-2.5-flare` (high, `/v1/images/edits`) |
| sunburst | OpenAI | `gpt-image-2.5-sunburst` (high, **Responses API** `/v1/responses` + `image_generation` tool, `action: "edit"`) |

**Kein Cross-Engine-Fallback.** OpenAI-Fail → NICHT auf Gemini ausweichen. Innerhalb Gemini-Familie erlaubt.

Implementiert in: `remaster-vehicle-image`, `generate-banner`, `generate-vehicle-image` (jeweils `MODEL_MAP`/`ENGINE_MAP`).

Immer loggen: `[function] Engine=X Model=Y Tier=Z (user-selected, binding)`.

## File API First (provider-abhängig)

- **Gemini-Tiers:** ALLE Bild/PDF-Transfers via `uploadToGeminiFiles` → `fileUri`. Base64 nur Fallback.
- **OpenAI Sunburst (file-id-first):** Sobald ein Asset eine `file_id` hat, darf dasselbe Asset NICHT zusätzlich als Base64 im Request stehen (`stripRedundantBase64` in `src/lib/remaster-invoke.ts` erzwingt das). Referenzen EINMAL via `uploadToOpenAIFiles` (Edge Function `upload-to-openai-files`, `POST /v1/files`, `purpose=vision`) → `file_id`. Diese IDs werden für alle Pipeline-Jobs wiederverwendet. Gemini-`file_uri` NIE an OpenAI geben und NIE zu Bytes rematerialisieren. Base64 (`image_url: data:...`) nur Fallback pro Request.
- OpenAI-Key niemals im Browser — Upload immer serverseitig über Edge Function.

**Ausnahme — Veo Video (`generate-video`, `spin360_start`):** `predictLongRunning` akzeptiert KEIN `fileUri`. Client sendet raw base64 direkt.

## OpenAI-Branch Besonderheiten

**Legacy (turbo / ultra / neu / flare):**
- Endpoint: `/v1/images/edits`
- Gemini File-URIs müssen vorher zu inline bytes materialisiert werden

**Sunburst (Test-Track):**
- Endpoint: `POST /v1/responses`, Top-Level ein günstiges aktuelles Mainline-Modell als Orchestrator (`OPENAI_RESPONSES_MODEL`, Default `gpt-5.6-luna`)
- Input: eine User-Message mit `input_text` + `input_image`-Einträgen (`file_id`, `detail: high` für Fahrzeug-Blueprint/Felge/Kennzeichen/Showroom)
- Tool: `{ type: "image_generation", model: "gpt-image-2.5-sunburst", action: "edit", quality: "high" }`
- Ergebnis aus `response.output` → `type === "image_generation_call"` → `.result`, Rückgabe als `data:image/png;base64,...`
- Pipeline lädt Referenzen + `additionalImages` EINMAL hoch und nutzt die IDs für alle Jobs (auch Retry)
- Request-Timeout 135s (innerhalb des Edge-Budgets)
- Bild 1 bleibt immer die primäre Fahrzeugreferenz; kein Fallback auf `gpt-image-1`/`gpt-image-2`, kein Cross-Engine-Fallback
- Max 16 Referenzbilder
- Output: 1536x1024

## Logo-Treue

Immer **aktuellstes** Markenlogo aus `public/images/logos/` (via `getLogoForMake`) — NIE historische Versionen (z.B. VW nur 2019+ flat blue, nie chrome).

Logos via `<CRITICAL_ASSET_INTEGRATION>`-Block im Prompt fixieren.

## API-Constraints

- Gemini Image API unterstützt **KEIN** `aspectRatio` in `generationConfig`.
- Aspect-Ratio nur über Prompt + Post-Crop steuern.

## Kosten: OpenAI GPT-Image-2.5 (Flare / Sunburst)

- Abrechnung ist **tokenbasiert**, nicht pro Bild: Text-Input $5/1M, Image-Input $8/1M, Image-Output $30/1M (Stand 10.09.2026). Sunburst zusätzlich Orchestrator `gpt-5.6-luna` ($0,20 / $0,02 cached / $1,20 pro 1M).
- `file_id` (OpenAI Files, `purpose=vision`) spart nur den **wiederholten Upload**. Die Referenzbilder werden bei **jedem** Generierungs-Request erneut als Image-Input verrechnet: Kosten skalieren mit `Referenzen × erzeugte Bilder`.
- Beide Pfade erzeugen `1536x1024` @ `quality=high` (Sunburst setzt `size` explizit im `image_generation`-Tool).
- Statische Tokenmengen sind Schätzwerte. **Echte Usage schlägt statische Schätzung**: erfolgreiche Responses schreiben defensiv nach `public.api_cost_events` (`measured` / `partial` / `estimated`) – ohne Prompts, Bilddaten oder Keys.
