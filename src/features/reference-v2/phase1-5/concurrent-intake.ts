import {
  analyzeSingleFile,
  type AnalyzeFileContext,
  type AnalyzeFileDeps,
  type AutomaticIntakeOutcome,
} from "./analysis-coordinator";

/**
 * Reference V2 — Phase 4: Nebenlaeufiger Intake.
 *
 * Der eingefrorene sequenzielle `analyzeFileBatch` bleibt unveraendert
 * erhalten (Identitaets-Anker-Kette). Fuer den Produktivpfad wird hier ein
 * begrenzter Worker-Pool genutzt: Anker werden NUR aus bereits akzeptierten
 * Referenzen uebernommen; es wird nicht der ganze Stapel serialisiert, nur um
 * Anker zu erzeugen. Ein Fehler bleibt strikt auf seine Datei begrenzt.
 */

export const DEFAULT_INTAKE_CONCURRENCY = 4;

export async function runWithConcurrency<T, R>(
  values: readonly T[],
  limit: number,
  worker: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const size = Math.max(1, Math.floor(limit));
  const results = new Array<R>(values.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(size, values.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export interface ConcurrentIntakeOptions {
  readonly concurrency?: number;
  readonly onOutcome?: (outcome: AutomaticIntakeOutcome, index: number) => void;
}

export async function analyzeFilesConcurrently(
  files: readonly File[],
  ctx: AnalyzeFileContext,
  deps: AnalyzeFileDeps,
  options: ConcurrentIntakeOptions = {},
): Promise<readonly AutomaticIntakeOutcome[]> {
  const concurrency = options.concurrency ?? DEFAULT_INTAKE_CONCURRENCY;
  return runWithConcurrency(files, concurrency, async (file, index) => {
    let outcome: AutomaticIntakeOutcome;
    try {
      outcome = await analyzeSingleFile(file, ctx, deps);
    } catch (e) {
      outcome = {
        fileName: file.name,
        ok: false,
        gateCodes: ["ANALYSIS_UNAVAILABLE"],
        errorMessage: e instanceof Error ? e.message : "Unbekannter Fehler",
      };
    }
    options.onOutcome?.(outcome, index);
    return outcome;
  });
}

/** Uebersetzt technische Rohfehler in verstaendlichen deutschen Text. */
export function friendlyIntakeError(raw: string | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) return "Analyse nicht verfügbar.";
  if (/failed to send a request|failed to fetch|networkerror|load failed/i.test(message)) {
    return "Analyse konnte nicht gestartet werden (Verbindungsproblem). Bitte erneut analysieren.";
  }
  if (/timeout|timed out|aborted|abort/i.test(message)) {
    return "Analyse hat zu lange gedauert. Bitte erneut analysieren.";
  }
  if (/not authenticated|sitzung|401|jwt/i.test(message)) {
    return "Sitzung abgelaufen — bitte neu anmelden und erneut analysieren.";
  }
  if (/semantic_firewall|invalid_analyzer_json|schema/i.test(message)) {
    return "Analyse-Ergebnis war unbrauchbar. Das Bild bleibt nutzbar und kann manuell zugeordnet werden.";
  }
  if (/file_reference_unsupported|mime/i.test(message)) {
    return "Dieses Bildformat konnte nicht übertragen werden.";
  }
  if (/503|502|overloaded|unavailable/i.test(message)) {
    return "Der Analysedienst ist gerade überlastet. Bitte erneut analysieren.";
  }
  return message;
}

/** Nur voruebergehende Fehler duerfen automatisch wiederholt werden. */
export function isTransientIntakeError(raw: string | undefined): boolean {
  const message = (raw ?? "").toLowerCase();
  if (!message) return false;
  if (/semantic_firewall|invalid_analyzer_json|file_reference_unsupported/.test(message)) {
    return false;
  }
  return /failed to send|failed to fetch|networkerror|load failed|timeout|timed out|abort|503|502|504|overloaded|unavailable/.test(
    message,
  );
}
