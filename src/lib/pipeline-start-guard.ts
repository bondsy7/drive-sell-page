/**
 * Doppelstart-Sperre für Generierungsläufe.
 *
 * Verhindert, dass derselbe Lauf (gleicher workflowKey) versehentlich mehrfach
 * gestartet wird – durch Doppelklick, doppelten Tab oder erneutes Öffnen der
 * Seite. Ein Lauf wird erst wieder freigegeben, wenn er eindeutig abgeschlossen
 * (Cooldown) oder fehlgeschlagen (sofort) ist.
 *
 * Der Zustand liegt in localStorage, damit die Sperre auch über mehrere Tabs
 * hinweg greift. Stale "running"-Einträge (Tab-Crash) laufen nach
 * STALE_RUNNING_MS ab.
 */

const STORAGE_KEY = 'auto3_pipeline_runs_v1';
/** Erfolgreich beendete Läufe bleiben so lange gesperrt. */
export const RUN_COOLDOWN_MS = 3 * 60 * 1000;
/** Ein "running"-Eintrag ohne Lebenszeichen gilt danach als verwaist. */
const STALE_RUNNING_MS = 30 * 60 * 1000;
/** Einträge werden nach dieser Zeit aufgeräumt. */
const MAX_AGE_MS = 60 * 60 * 1000;

type RunState = 'running' | 'done' | 'failed';

interface RunRecord {
  startedAt: number;
  updatedAt: number;
  state: RunState;
}

type RunStore = Record<string, RunRecord>;

function readStore(): RunStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RunStore;
    const now = Date.now();
    const cleaned: RunStore = {};
    for (const [key, rec] of Object.entries(parsed || {})) {
      if (rec && typeof rec.updatedAt === 'number' && now - rec.updatedAt < MAX_AGE_MS) {
        cleaned[key] = rec;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeStore(store: RunStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* Speicher nicht verfügbar – Sperre greift dann nur im Arbeitsspeicher */
  }
}

export interface StartCheck {
  allowed: boolean;
  /** Grund der Sperre, direkt anzeigbar. */
  reason?: string;
  remainingMs?: number;
}

export function checkPipelineStart(workflowKey: string): StartCheck {
  if (!workflowKey) return { allowed: true };
  const rec = readStore()[workflowKey];
  if (!rec) return { allowed: true };
  const now = Date.now();

  if (rec.state === 'running') {
    if (now - rec.updatedAt > STALE_RUNNING_MS) return { allowed: true };
    return {
      allowed: false,
      reason: 'Für dieses Fahrzeug läuft bereits eine Generierung. Bitte warte, bis sie abgeschlossen ist.',
    };
  }

  if (rec.state === 'done') {
    const remainingMs = RUN_COOLDOWN_MS - (now - rec.updatedAt);
    if (remainingMs > 0) {
      const sec = Math.ceil(remainingMs / 1000);
      return {
        allowed: false,
        remainingMs,
        reason: `Dieser Lauf wurde gerade erst erfolgreich abgeschlossen. Erneut möglich in ${sec}s – die Bilder findest du bereits in der Galerie.`,
      };
    }
  }

  // 'failed' oder abgelaufener Cooldown → sofort wieder erlaubt
  return { allowed: true };
}

export function markPipelineStarted(workflowKey: string): void {
  if (!workflowKey) return;
  const store = readStore();
  const now = Date.now();
  store[workflowKey] = { startedAt: now, updatedAt: now, state: 'running' };
  writeStore(store);
}

export function markPipelineFinished(workflowKey: string, succeeded: boolean): void {
  if (!workflowKey) return;
  const store = readStore();
  const prev = store[workflowKey];
  store[workflowKey] = {
    startedAt: prev?.startedAt ?? Date.now(),
    updatedAt: Date.now(),
    state: succeeded ? 'done' : 'failed',
  };
  writeStore(store);
}

/** Sperre manuell aufheben (z. B. nach hartem Abbruch). */
export function releasePipelineLock(workflowKey: string): void {
  if (!workflowKey) return;
  const store = readStore();
  delete store[workflowKey];
  writeStore(store);
}
