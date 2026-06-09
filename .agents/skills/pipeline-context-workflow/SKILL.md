---
name: pipeline-context-workflow
description: Pipeline-First Workflow Architektur — PipelineContext, usePipelineSafe Hook, sequenzielle Remastering→ActionHub-Logik, Smart Image Routing nach Job-Keywords, Background-Task-Orchestrierung. Triggert bei Pipeline-Bugs, UI-Crashes durch Context, neuen Pipeline-Jobs oder Cross-Component-Sync.
---

# Pipeline-First Workflow

## Architektur-Prinzip

Alle länger laufenden Bild-Jobs (Remastering, Banner, 360-Spin, Video, Landing-Page) laufen über den globalen `PipelineContext` (`src/contexts/PipelineContext.tsx`) — NICHT lokal in der jeweiligen Komponente.

Vorteile:
- User kann während Generierung navigieren
- `BackgroundPipelineIndicator` zeigt globalen Status
- Ergebnisse landen in `pipeline_results` und sind in allen Tabs sichtbar

## `usePipelineSafe` — PFLICHT statt `usePipeline`

```ts
import { usePipelineSafe } from '@/contexts/PipelineContext';
const pipeline = usePipelineSafe(); // returns null if no Provider
if (!pipeline) return <Fallback />;
```

`usePipeline` (ohne Safe) wirft, wenn Provider fehlt → UI-Crash bei Auth-Wechseln, Deep-Links, neuen Routes. **IMMER Safe-Variante** außer in garantiert gewrappten Routes.

## Sequenzielle Reihenfolge

1. **Remastering** zuerst (Original → Studio-Bild)
2. **ActionHub** danach (Banner, LP, Video aus remastered Bildern)

ActionHub blockiert, solange Remastering nicht `completed` ist. Visualisiert via `ProcessingStatus.tsx`.

## Smart Image Routing (Job-Keywords)

Pipeline-Jobs werden anhand Keywords im Job-Titel automatisch auf passende Quell-Bilder geroutet:

| Keyword im Job | Quell-Bild-Tag |
|---|---|
| `rear`, `heck` | rear / 3/4 hinten |
| `side`, `seite` | seitlich |
| `interior`, `innen`, `cockpit` | innenraum |
| `detail`, `felge`, `wheel` | detail |
| (kein Match) | hero / front |

Filterung in `src/lib/pipeline-jobs.ts`. Bei neuen Job-Typen Keyword-Map dort ergänzen.

## Cascading Deletion

- 360-Spin gelöscht → alle Frames, Video und abgeleitete Bilder löschen
- LP gelöscht → generierte LP-Bilder im Storage löschen (siehe `cleanup-orphaned-storage`)
- Vehicle gelöscht → ON DELETE CASCADE auf Pipeline/Banner/LP via FK

## Background-Tasks vs Pipeline

- `BackgroundTasksContext`: kurze Tasks (Upload, Compress, kleine Fetches) — UI-Toast-basiert
- `PipelineContext`: AI-Generierungen mit Steps und Persistenz — Indicator-basiert

NIE vermischen.

## Live-Preview-Mode

Bei Editoren (LP, Banner): Edit-Mode injiziert Änderungen via `postMessage` ins Preview-Iframe in Echtzeit. Auf Persistenz achten — siehe `landing-page-generator` Skill.
