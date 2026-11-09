/**
 * Globaler Auffang-Schutz für unbehandelte Promise-Fehler.
 *
 * Hintergrund: Antwortet eine Serverfunktion mit HTTP 402 (nicht genug
 * Credits), kann eine nicht abgefangene Ablehnung die komplette Ansicht
 * leeren. Dieser Guard erkennt Credit-Fehler, zeigt eine verständliche
 * Meldung und verhindert den Absturz. Alle anderen Fehler bleiben
 * unverändert und werden weiterhin gemeldet.
 */
import { toast } from 'sonner';

const CREDIT_ERROR_PATTERN =
  /insufficient_credits|nicht genug credits|nicht genügend credits|guthaben|returned 402/i;

/** True, wenn die Fehlermeldung ein Credit-/402-Problem beschreibt. */
export function isCreditErrorMessage(message: unknown): boolean {
  if (message == null) return false;
  return CREDIT_ERROR_PATTERN.test(String(message));
}

function extractMessage(reason: unknown): string {
  if (reason == null) return '';
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) return reason.message;
  const maybe = (reason as { message?: unknown }).message;
  return typeof maybe === 'string' ? maybe : String(reason);
}

const PROVIDER_ERROR_PATTERN = /edge function returned (5\d\d|429)|gemini (5\d\d|429)|openai (5\d\d|429)/i;

/** True, wenn ein vorübergehender KI-/Serverfehler (5xx/429) gemeldet wird. */
export function isTransientProviderErrorMessage(message: unknown): boolean {
  if (message == null) return false;
  return PROVIDER_ERROR_PATTERN.test(String(message));
}

/** Einmalig beim App-Start aufrufen (main.tsx). */
export function installGlobalErrorGuard(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (event) => {
    const msg = extractMessage(event.reason);
    if (isTransientProviderErrorMessage(msg) && !isCreditErrorMessage(msg)) {
      event.preventDefault();
      toast.error('Der KI-Dienst ist gerade gestört. Es wurden keine Credits abgezogen – bitte in einer Minute erneut versuchen.', { duration: 8000 });
      return;
    }
    if (!isCreditErrorMessage(msg)) return;
    event.preventDefault();
    toast.error('Nicht genug Credits. Bitte Credits aufladen und danach erneut starten.', {
      duration: 8000,
    });
  });
}
