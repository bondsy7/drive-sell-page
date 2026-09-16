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
  /** Zuständige Datenschutzaufsicht (Sitz Hessen). */
  authority: {
    name: 'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit',
    address: 'Gustav-Stresemann-Ring 1, 65189 Wiesbaden',
  },
  versionDate: '16.09.2026',
} as const;

export const LEGAL_VERSIONS = {
  agb: '2026-09-16',
  privacy: '2026-09-16',
  consent: '2026-09-16',
} as const;

/** Dokument-Key für die serverseitig dokumentierte Vertragsannahme. */
export const TERMS_DOCUMENT = 'agb';

export const TERMS_CONFIRM_TEXT =
  'Ich bestätige, dass ich mindestens 18 Jahre alt bin und als Unternehmer im Sinne des § 14 BGB handle. Ich akzeptiere die AGB von AUTO3.';

export const PRIVACY_NOTICE_TEXT =
  'Informationen zur Verarbeitung personenbezogener Daten findest du in der Datenschutzerklärung.';
