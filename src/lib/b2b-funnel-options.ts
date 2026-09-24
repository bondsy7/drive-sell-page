/** Auswahloptionen und Beschriftungen des B2B-Testfunnels (Formular + Admin). */

export const VOLUME_OPTIONS = [
  { value: '1-10', label: '1–10 Fahrzeuge' },
  { value: '11-25', label: '11–25 Fahrzeuge' },
  { value: '26-50', label: '26–50 Fahrzeuge' },
  { value: '51-100', label: '51–100 Fahrzeuge' },
  { value: '101-200', label: '101–200 Fahrzeuge' },
  { value: '200+', label: 'Mehr als 200 Fahrzeuge' },
] as const;

export const LOCATION_OPTIONS = [
  { value: '1', label: '1 Standort' },
  { value: '2-5', label: '2–5 Standorte' },
  { value: '6-10', label: '6–10 Standorte' },
  { value: '11-25', label: '11–25 Standorte' },
  { value: '26-50', label: '26–50 Standorte' },
  { value: '50+', label: 'Mehr als 50 Standorte' },
] as const;

export const ROLE_OPTIONS = [
  { value: 'geschaeftsfuehrung', label: 'Geschäftsführung' },
  { value: 'verkaufsleitung', label: 'Verkaufsleitung' },
  { value: 'gebrauchtwagenleitung', label: 'Gebrauchtwagenleitung' },
  { value: 'marketing', label: 'Marketing & Digital' },
  { value: 'ecommerce', label: 'E-Commerce & Digitalvertrieb' },
  { value: 'disposition', label: 'Disposition & Fahrzeugmanagement' },
  { value: 'sonstiges', label: 'Sonstiges' },
] as const;

export const GOAL_OPTIONS = [
  { value: 'fahrzeugbilder', label: 'Fahrzeugbilder' },
  { value: 'showroom', label: 'Einheitlicher Showroom' },
  { value: 'schneller-online', label: 'Schneller online' },
  { value: 'social-banner', label: 'Social Media & Banner' },
  { value: 'video', label: 'Video' },
  { value: 'landingpages', label: 'Landingpages' },
  { value: 'spin360', label: '360°' },
  { value: 'multi-standort', label: 'Standortübergreifender Prozess' },
] as const;

export const STATUS_OPTIONS = [
  { value: 'new', label: 'Neu' },
  { value: 'validated', label: 'Validiert' },
  { value: 'contacted', label: 'Kontaktiert' },
  { value: 'demo_requested', label: 'Demo gewünscht' },
  { value: 'demo_booked', label: 'Demo gebucht' },
  { value: 'demo_held', label: 'Demo stattgefunden' },
  { value: 'sql', label: 'SQL (qualifiziert)' },
  { value: 'proposal', label: 'Angebot' },
  { value: 'won', label: 'Gewonnen' },
  { value: 'lost', label: 'Verloren' },
] as const;

/** Statuswechsel → Ereignisname (GA4-Empfehlung für Lead-Funnel). */
export const STATUS_EVENT: Record<string, string> = {
  validated: 'working_lead',
  contacted: 'working_lead',
  demo_booked: 'demo_booked',
  demo_held: 'demo_held',
  sql: 'qualify_lead',
  proposal: 'proposal_sent',
  won: 'close_convert_lead',
  lost: 'close_unconvert_lead',
};

export const LOST_REASONS = [
  'Kein Bedarf', 'Preis / Budget', 'Falscher Zeitpunkt', 'Wettbewerber gewählt',
  'Nicht erreichbar', 'Kein Entscheider', 'Kein Händler / Spam', 'Sonstiges',
] as const;

export const LEAD_CLASS_LABELS: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  standard: 'Standard',
};

function toMap(options: readonly { value: string; label: string }[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]));
}

export const VOLUME_LABELS = toMap(VOLUME_OPTIONS);
export const LOCATION_LABELS = toMap(LOCATION_OPTIONS);
export const ROLE_LABELS = toMap(ROLE_OPTIONS);
export const GOAL_LABELS = toMap(GOAL_OPTIONS);
export const STATUS_LABELS = toMap(STATUS_OPTIONS);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
