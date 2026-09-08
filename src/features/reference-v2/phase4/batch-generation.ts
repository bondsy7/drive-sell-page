/**
 * Reference V2 — Phase 4: Batch-Ausfuehrung mit begrenzter Nebenlaeufigkeit.
 *
 * Fehler bleiben pro Zielansicht isoliert: eine fehlgeschlagene Ansicht darf
 * den restlichen Stapel niemals stoppen (fail-isolated, nicht fail-fast).
 * Bewusst frei von React und Netzwerk, damit es testbar bleibt.
 */

export const DEFAULT_GENERATION_CONCURRENCY = 2;

export interface BatchOutcome<T> {
  readonly key: string;
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: string;
}

export interface RunBatchOptions<T> {
  readonly concurrency?: number;
  readonly onProgress?: (done: number, total: number) => void;
  readonly onOutcome?: (outcome: BatchOutcome<T>) => void;
}

export async function runBatch<T>(
  keys: readonly string[],
  worker: (key: string) => Promise<T>,
  options: RunBatchOptions<T> = {},
): Promise<readonly BatchOutcome<T>[]> {
  const total = keys.length;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? DEFAULT_GENERATION_CONCURRENCY, total || 1),
  );
  const outcomes: BatchOutcome<T>[] = new Array(total);
  let next = 0;
  let done = 0;

  const runner = async () => {
    while (true) {
      const index = next++;
      if (index >= total) return;
      const key = keys[index];
      let outcome: BatchOutcome<T>;
      try {
        outcome = { key, ok: true, value: await worker(key) };
      } catch (e) {
        outcome = {
          key,
          ok: false,
          error: e instanceof Error ? e.message : "Generierung fehlgeschlagen.",
        };
      }
      outcomes[index] = outcome;
      done += 1;
      options.onOutcome?.(outcome);
      options.onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => runner()));
  return outcomes;
}
