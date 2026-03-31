

# Prompt-System Komplett-Überarbeitung nach Gemini-Empfehlungen

## Problemanalyse

Die aktuelle Prompt-Architektur hat mehrere Schwächen:

1. **Sprache**: Remaster-Prompt ist Deutsch, Pipeline-Prompt ist Englisch — inkonsistent. Gemini-Bildmodelle reagieren präziser auf **strukturiertes Englisch mit XML-Tags**.
2. **Logo-Inkonsistenz**: Logo-Anweisungen gehen in der Masse des Textes unter. Gemini empfiehlt, `<CRITICAL_ASSET_INTEGRATION>` als **erstes** Element im Prompt zu platzieren.
3. **Fließtext statt Struktur**: Prompts sind als lange Absätze formuliert. XML-Tags (`<IDENTITY_LOCK>`, `<SCENE>`, `<NEGATIVE_CONSTRAINTS>`) helfen dem Modell, Prioritäten zu erkennen.
4. **Redundanz**: Interior-Regeln werden im Remaster-Prompt *immer* angehängt (auch bei Exterior-Shots), was den Prompt unnötig aufbläht und den Fokus verwässert.
5. **Pipeline-Prompts**: Uneinheitliche Showroom/Logo-Referenzen — manche CI-Jobs erwähnen kein Logo, was zum "Vergessen" führt.

## Plan

### 1. Neuer modularer Base-Prompt (remaster-prompt.ts)

Kompletter Rewrite von `buildMasterPrompt()` mit folgender Struktur:

```text
You are a top-tier professional automotive commercial photographer and retoucher.
TASK: Remaster the provided reference vehicle photo into a flawless, dealership-quality promotional image.

<CRITICAL_ASSET_INTEGRATION>
  [Logo-Anweisungen — NUR wenn Logo

<lov-plan>

# Prompt-System Komplett-Überarbeitung nach Gemini-Empfehlungen

## Problemanalyse

1. **Sprache**: Remaster-Prompt Deutsch, Pipeline Englisch — inkonsistent. Gemini-Bildmodelle reagieren präziser auf **strukturiertes Englisch mit XML-Tags**.
2. **Logo geht unter**: Logo-Anweisungen versteckt in der Mitte. Gemini empfiehlt `<CRITICAL_ASSET_INTEGRATION>` als **erstes** Element.
3. **Fließtext statt Struktur**: XML-Tags helfen dem Modell, Prioritäten zu erkennen.
4. **Redundanz**: Interior-Regeln werden IMMER angehängt (auch bei Exterior), bläht Prompt auf und verwässert Fokus.
5. **Pipeline-Inkonsistenz**: Manche CI-Jobs erwähnen kein Logo/Showroom, was zum "Vergessen" führt.

## Änderungen

### 1. `src/lib/remaster-prompt.ts` — Kompletter Rewrite von `buildMasterPrompt()`

Neuer modularer Aufbau in **Englisch** mit XML-Tags nach Gemini-Empfehlung:

```text
You are a top-tier professional automotive commercial photographer.
TASK: Remaster the provided reference vehicle photo into a flawless, dealership-quality image.

<CRITICAL_ASSET_INTEGRATION>        ← Logo ZUERST, höchste Priorität
  [nur wenn Logo aktiviert]
</CRITICAL_ASSET_INTEGRATION>

<IDENTITY_LOCK>                     ← Fahrzeug-Identität schützen
  Paint, Wheels, Lights, Grille, Body, Materials
</IDENTITY_LOCK>

<SCENE_AND_LIGHTING>                ← Szene/Showroom
  [dynamisch je nach config.scene]
</SCENE_AND_LIGHTING>

<LICENSE_PLATE>                     ← Kennzeichen-Handling
</LICENSE_PLATE>

<INTERIOR_RULES>                    ← NUR bei Interior-Slots anhängen
  [Composition, Zero Invention, Cleanup, Structural Integrity]
</INTERIOR_RULES>

<STRICT_NEGATIVE_CONSTRAINTS>       ← Am Ende als Absicherung
</STRICT_NEGATIVE_CONSTRAINTS>

<CURRENT_PERSPECTIVE>               ← Dynamischer Perspektiv-Block
  [je nach slotKey]
</CURRENT_PERSPECTIVE>
```

Kernänderungen:
- **Interior-Regeln nur bei Interior-Shots** (slotKey enthält "interior"), nicht bei Exterior
- **Logo-Block steht ganz oben** — nicht mehr in der Mitte versteckt
- **Komplett Englisch** — alle Gemini-Bildmodelle performen besser damit
- **Kürzerer, fokussierter Prompt** — kein doppeltes Wiederholen derselben Regeln

### 2. `src/lib/pipeline-jobs.ts` — Pipeline-Prompts modernisieren

- `IDENTITY_LOCK` kürzen und fokussieren (aktuell ~60 Zeilen, Ziel ~30 Zeilen)
- `INTERIOR_RULES` nur bei Interior-Jobs, nicht mehr als globaler Prefix
- **Jeden Pipeline-Job als `<CURRENT_PIPELINE_SHOT>`-Block** strukturieren mit klaren Feldern:
  - `SHOT_TYPE`, `CAMERA_ANGLE`, `FRAMING`, `FOCUS_ELEMENTS`, `ENVIRONMENT_INTERACTION`
- **Logo-Referenz in JEDEM Job** explizit erwähnen: `"The provided company logo MUST be integrated on the background wall"`
- CI-Jobs: `BRAND_ENVIRONMENT_OVERRIDE` Block der den generischen Showroom überschreibt
- Perspektiv-Prompts nach Gemini-Empfehlung verschärfen (z.B. "mathematically centered", "perfectly circular steering wheel")

### 3. `supabase/functions/remaster-vehicle-image/index.ts` — Edge Function anpassen

- `DEFAULT_PROMPT` auf das neue englische XML-Format umstellen (Fallback wenn kein dynamicPrompt kommt)
- Logo-Injection-Text kürzen und als `<LOGO_REFERENCE>` taggen
- Interior-Detection: Wenn `dynamicPrompt` das Wort "interior" enthält, Interior-spezifische Anweisungen automatisch anhängen

### 4. Perspektiv-Prompts verbessern (`PERSPECTIVE_PROMPTS` in remaster-prompt.ts)

Aktuell Deutsch und vage. Neu in Englisch mit Gemini-empfohlener Präzision:

```text
'34front': '<CURRENT_PERSPECTIVE>
  SHOT_TYPE: Exterior - Front 3/4 Hero View
  CAMERA_ANGLE: Eye-level, 30-45° left of center axis
  FRAMING: Front fascia and one full side visible. Both wheels on visible side in frame.
  ENVIRONMENT: Logo MUST be visible on background wall.
</CURRENT_PERSPECTIVE>'

'interior-front': '<CURRENT_PERSPECTIVE>
  SHOT_TYPE: Interior - Rear Seat POV Looking Forward
  CAMERA_ANGLE: From center of rear seat, looking at dashboard and windshield
  STRUCTURAL: Complete roof, ALL A/B pillars, headliner, rearview mirror MUST be fully visible
  FORBIDDEN: Do NOT crop roof, do NOT shoot from above without roof
</CURRENT_PERSPECTIVE>'
```

## Nicht geändert

- Keine Änderungen an der technischen Pipeline-Logik (PipelineContext, ImageCaptureGrid)
- Keine Änderungen am Logo-Caching (ensureLogoCachedAsPng bleibt)
- Keine Änderungen an der Edge Function Retry/Fallback-Logik

## Zusammenfassung der Verbesserungen

| Vorher | Nachher |
|--------|---------|
| Deutsch + Fließtext | Englisch + XML-Tags |
| Logo in der Mitte versteckt | Logo als erstes Element |
| Interior-Regeln immer angehängt | Nur bei Interior-Shots |
| Pipeline-Jobs ohne Logo-Referenz | Jeder Job referenziert Logo |
| Vage Perspektiv-Beschreibungen | Strukturiert (SHOT_TYPE, ANGLE, FRAMING) |
| ~3000 Wörter pro Prompt | ~1500 Wörter, fokussierter |

