/**
 * Per-landing-page contact form configuration. The recipient is stored only with the
 * saved page and resolved server-side by submit-lead, never sent from the public page.
 */
export interface LandingContactFormConfig {
  recipientEmail: string;
  subject: string;
  heading: string;
  intro: string;
}

export const DEFAULT_CONTACT_HEADING = 'Interesse an diesem Fahrzeug?';

export const CONTACT_LIMITS = { recipientEmail: 255, subject: 200, heading: 120, intro: 600 } as const;

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function isValidRecipientEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= CONTACT_LIMITS.recipientEmail && EMAIL_RE.test(v);
}

export function normalizeDealerPrivacyUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate || candidate.length > 1000) return '';
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/** Once loaded, the current profile is authoritative, including an intentionally cleared URL. */
export function resolveLandingPrivacyUrl(profileValue: unknown, savedValue?: unknown, profileLoaded = true): string {
  return normalizeDealerPrivacyUrl(profileLoaded ? profileValue : savedValue);
}

export function defaultContactFormConfig(vehicleTitle: string, fallbackEmail = ''): LandingContactFormConfig {
  return {
    recipientEmail: fallbackEmail,
    subject: vehicleTitle ? `Anfrage zu ${vehicleTitle}` : 'Neue Anfrage über die Landingpage',
    heading: DEFAULT_CONTACT_HEADING,
    intro: vehicleTitle,
  };
}

export function sanitizeContactFormConfig(raw: unknown, fallback: LandingContactFormConfig): LandingContactFormConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const text = (key: keyof LandingContactFormConfig) =>
    typeof r[key] === 'string' ? (r[key] as string).trim().slice(0, CONTACT_LIMITS[key]) : fallback[key];
  const email = text('recipientEmail');
  return {
    recipientEmail: email === '' || isValidRecipientEmail(email) ? email : fallback.recipientEmail,
    subject: text('subject') || fallback.subject,
    heading: text('heading') || fallback.heading,
    intro: text('intro'),
  };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
