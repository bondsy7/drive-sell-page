# OpenAI file_id-Pfade und Sunburst-Ökonomie

## Umsetzung
- Flare und GPT-Image-2 zusätzlich zu Sunburst über OpenAI Files (`purpose=vision`) und die Responses API mit `image_generation`, `action: edit`, ausführen.
- Vorhandene OpenAI-Datei-IDs in Einzel-Remastering, Wiederholungen und Pipeline-Jobs wiederverwenden; Base64 bleibt nur der assetbezogene Upload-Fallback.
- Gemini-Modelle und deren File-API-Pfad unverändert lassen; kein Cross-Engine-Fallback.
- Responses-Code modellunabhängig zusammenfassen, dabei Modellname, Logs, Fehlermeldungen und Kostentelemetrie dem gewählten Tier zuordnen.
- GPT-Image-2, Flare und Sunburst mit passenden Tests für Tier-Routing und redundanzfreie Payloads absichern.

## Credit-Ökonomie
- Flare nach der Umstellung als einmaligen `file_id`-Transfer plus Responses-Orchestrator kalkulieren.
- Sunburst zusätzlich als Bildgenerierungs-Position in der Credit-Ökonomie ausweisen.
- Admin-Simulator und Hinweise an den neuen Transportweg anpassen; bestehende produktive Credit-Abzüge bleiben unverändert.

## Prüfung
- Relevante Tests, TypeScript und Vorschau-Build prüfen.
- `remaster-vehicle-image` neu bereitstellen und den Responses-Aufruf nach Möglichkeit real testen.

## Technische Grenze
`/v1/images/edits` akzeptiert keine wiederverwendbaren `file_id`s. Deshalb werden Flare und GPT-Image-2 wie Sunburst über Responses `image_generation` angebunden, statt IDs an den Multipart-Endpunkt anzuhängen.
