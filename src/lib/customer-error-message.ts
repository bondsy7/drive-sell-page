const TRANSLATIONS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-Mail-Adresse oder Passwort sind nicht korrekt.'],
  [/email not confirmed/i, 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.'],
  [/user already registered|already been registered/i, 'Für diese E-Mail-Adresse besteht bereits ein Konto.'],
  [/password should be at least|password.*characters/i, 'Das Passwort erfüllt die Mindestanforderungen nicht.'],
  [/unable to validate email address|invalid email/i, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'],
  [/email rate limit exceeded|too many requests|rate limit/i, 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.'],
  [/signup is disabled/i, 'Die Registrierung ist derzeit nicht verfügbar.'],
  [/network|failed to fetch|fetch failed/i, 'Die Verbindung zum Server ist fehlgeschlagen. Bitte versuchen Sie es erneut.'],
  [/unauthorized|not authorized|permission denied/i, 'Sie sind für diese Aktion nicht berechtigt.'],
  [/session.*expired|jwt expired/i, 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.'],
];

export function customerErrorMessage(error: unknown, fallback = 'Ein unerwarteter Fehler ist aufgetreten.'): string {
  const raw = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === 'string'
        ? String((error as { message: string }).message)
        : '';

  if (!raw) return fallback;
  const translation = TRANSLATIONS.find(([pattern]) => pattern.test(raw));
  if (translation) return translation[1];

  // Technische oder englische Anbietertexte gehören nicht in die Kundenoberfläche.
  if (/\b(error|failed|invalid|unknown|unauthorized|required|timeout|not found|server|database|function)\b/i.test(raw)) {
    return fallback;
  }

  return raw;
}