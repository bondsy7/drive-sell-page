import { supabase } from '@/integrations/supabase/client';

/**
 * Dauerhaftes Protokoll jeder Generierungsstufe.
 *
 * Jeder Versuch – erfolgreich oder nicht – wird mit Fehlercode, Anbieter-Antwort,
 * Dauer und Wiederholungsstand in `generation_attempt_logs` gespeichert. Ohne dieses
 * Protokoll ist eine Panne im Kundentermin im Nachhinein nicht mehr analysierbar
 * (Serverlogs laufen nach wenigen Tagen ab).
 *
 * Grundregel: Protokollieren darf niemals die Generierung stören – alle Fehler
 * werden hier geschluckt.
 */

export type GenerationStage = 'generate' | 'retry' | 'single-retry' | 'save';
export type GenerationStatus = 'success' | 'error';

export interface GenerationAttemptLog {
  userId: string;
  workflowKey?: string | null;
  projectId?: string | null;
  vehicleId?: string | null;
  jobKey?: string | null;
  jobLabel?: string | null;
  promptIndex?: number;
  stage: GenerationStage;
  attempt?: number;
  status: GenerationStatus;
  modelTier?: string | null;
  engine?: string | null;
  model?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  providerStatus?: number | null;
  providerResponse?: unknown;
  retryable?: boolean | null;
}

/** Fehlerklassen, die dem Nutzer verständlich erklärt werden können. */
export type GenerationErrorCode =
  | 'insufficient_credits'
  | 'rate_limited'
  | 'provider_overloaded'
  | 'timeout'
  | 'provider_rejected'
  | 'reference_upload_failed'
  | 'no_image_returned'
  | 'auth'
  | 'network'
  | 'save_failed'
  | 'unknown';

/** Leitet aus Nachricht/Status eine stabile, auswertbare Fehlerklasse ab. */
export function classifyGenerationError(
  message?: string | null,
  providerStatus?: number | null,
): GenerationErrorCode {
  const m = (message || '').toLowerCase();
  if (!m && !providerStatus) return 'unknown';
  if (/insufficient_credits|nicht genug credits|guthaben/.test(m)) return 'insufficient_credits';
  if (providerStatus === 429 || /rate limit|too many requests|quota/.test(m)) return 'rate_limited';
  if (/überlastet|overload|unavailable|503|budget exhausted/.test(m)) return 'provider_overloaded';
  if (/zeitüberschreitung|timeout|abort/.test(m)) return 'timeout';
  if (/referenzbild konnte|validating file|file ownership/.test(m)) return 'reference_upload_failed';
  if (/kein bild|no image/.test(m)) return 'no_image_returned';
  if (/nicht authentifiziert|nicht eingeloggt|401|jwt/.test(m)) return 'auth';
  if (/netzwerk|failed to fetch|network/.test(m)) return 'network';
  if (/galerie|speichern|storage/.test(m)) return 'save_failed';
  if (providerStatus && providerStatus >= 400) return 'provider_rejected';
  return 'unknown';
}

/** Klartext-Erklärung samt Handlungsempfehlung für die Oberfläche. */
export function describeGenerationError(code: GenerationErrorCode): { title: string; hint: string } {
  switch (code) {
    case 'insufficient_credits':
      return { title: 'Guthaben aufgebraucht', hint: 'Bitte Credits aufladen und danach nur die fehlgeschlagenen Bilder erneut starten.' };
    case 'rate_limited':
      return { title: 'Anbieter-Limit erreicht', hint: 'Kurz warten (ca. 1 Minute) und dann die fehlgeschlagenen Bilder erneut versuchen.' };
    case 'provider_overloaded':
      return { title: 'KI-Dienst überlastet', hint: 'Das passiert bei hoher Auslastung. In wenigen Sekunden erneut versuchen.' };
    case 'timeout':
      return { title: 'Zeitüberschreitung', hint: 'Der Dienst hat zu lange gebraucht. Erneut versuchen – meist klappt der zweite Anlauf.' };
    case 'reference_upload_failed':
      return { title: 'Referenzbild nicht lesbar', hint: 'Das Referenzbild konnte beim Anbieter nicht geladen werden. Erneut versuchen.' };
    case 'no_image_returned':
      return { title: 'Kein Bild geliefert', hint: 'Der Dienst hat kein Bild zurückgegeben. Erneut versuchen oder eine andere Qualitätsstufe wählen.' };
    case 'auth':
      return { title: 'Anmeldung abgelaufen', hint: 'Bitte Seite neu laden und erneut anmelden.' };
    case 'network':
      return { title: 'Verbindungsproblem', hint: 'Internetverbindung prüfen und erneut versuchen.' };
    case 'save_failed':
      return { title: 'Speichern fehlgeschlagen', hint: 'Das Bild wurde erzeugt, aber nicht in der Galerie abgelegt. Erneut versuchen.' };
    case 'provider_rejected':
      return { title: 'Anfrage abgelehnt', hint: 'Der KI-Dienst hat die Anfrage abgelehnt. Details stehen im Protokoll.' };
    default:
      return { title: 'Unbekannter Fehler', hint: 'Bitte erneut versuchen. Die Details sind im Protokoll gespeichert.' };
  }
}

function trimResponse(value: unknown): unknown {
  if (value == null) return null;
  try {
    const json = JSON.stringify(value);
    if (json.length <= 4000) return JSON.parse(json);
    return { truncated: true, preview: json.slice(0, 4000) };
  } catch {
    return { unserializable: true };
  }
}

/** Schreibt einen Protokolleintrag. Wirft nie. */
export async function logGenerationAttempt(entry: GenerationAttemptLog): Promise<void> {
  try {
    const { error } = await supabase.from('generation_attempt_logs' as never).insert({
      user_id: entry.userId,
      workflow_key: entry.workflowKey ?? null,
      project_id: entry.projectId ?? null,
      vehicle_id: entry.vehicleId ?? null,
      job_key: entry.jobKey ?? null,
      job_label: entry.jobLabel ?? null,
      prompt_index: entry.promptIndex ?? 0,
      stage: entry.stage,
      attempt: entry.attempt ?? 1,
      status: entry.status,
      model_tier: entry.modelTier ?? null,
      engine: entry.engine ?? null,
      model: entry.model ?? null,
      duration_ms: entry.durationMs ?? null,
      error_code: entry.errorCode ?? null,
      error_message: entry.errorMessage ? entry.errorMessage.slice(0, 1000) : null,
      provider_status: entry.providerStatus ?? null,
      provider_response: trimResponse(entry.providerResponse),
      retryable: entry.retryable ?? null,
    } as never);
    if (error) console.warn('[generation-log] insert failed:', error.message);
  } catch (e) {
    console.warn('[generation-log] insert threw:', e);
  }
}
