/**
 * Zentrale Rechts-Stammdaten für AUTO3 (Produkt der Breadcrumb Marketing GmbH).
 * Diese Werte werden auf allen Rechtsseiten und im Registrierungsflow verwendet.
 */
export const LEGAL = {
  product: 'AUTO3',
  company: 'Breadcrumb Marketing GmbH',
  street: 'Corniceliusstraße 8',
  city: '63450 Hanau',
  country: 'Deutschland',
  managingDirector: 'Leonhard Paul',
  phone: '+49 (0) 6181 9090-0',
  email: 'info@breadcrumb.de',
  registerCourt: 'Amtsgericht Hanau',
  registerNumber: 'HRB 91223',
  vatId: 'DE 237 914 287',
  /** Zuständige Datenschutzaufsicht (Sitz Hessen), Anschrift seit 16.03.2026. */
  authority: {
    name: 'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit',
    address: 'Wilhelmstraße 7, 65185 Wiesbaden',
  },
  versionDate: '16.09.2026',
} as const;

export const LEGAL_VERSIONS = {
  agb: '2026-09-16',
  privacy: '2026-09-16',
  consent: '2026-09-16',
} as const;

/** Dokument-Keys für die serverseitig dokumentierten Bestätigungen. */
export const TERMS_DOCUMENT = 'agb';
export const B2B_DOCUMENT = 'b2b_confirmation';

export const TERMS_CONFIRM_TEXT =
  'Ich habe die AGB für AUTO3 gelesen und akzeptiere sie.';

export const B2B_CONFIRM_TEXT =
  'Ich bestätige, dass ich mindestens 18 Jahre alt bin, als Unternehmer im Sinne des § 14 BGB und nicht als Verbraucher handle und zur Vertretung des angegebenen Unternehmens berechtigt bin.';

export const PRIVACY_NOTICE_TEXT =
  'Informationen zur Verarbeitung personenbezogener Daten findest du in der Datenschutzerklärung.';
