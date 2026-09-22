// Verbindliche Credit-Preise je Kundenleistung.
// Single Source of Truth für Produktseite, Preisseite und Credit-Rechner.
// Änderungen hier wirken überall – damit können sich die Seiten nicht
// mehr widersprechen.

export interface ProductCreditItem {
  key: string;
  label: string;
  unit: string;
  credits: number;
  icon: string;
  hint: string;
  /** Im Credit-Rechner als Verteilungsposten anzeigen? */
  inCalculator: boolean;
  /** Farbverlauf für die Rechner-Karte */
  color: string;
}

export const PRODUCT_CREDIT_ITEMS: ProductCreditItem[] = [
  {
    key: 'vehicle',
    label: 'Fahrzeugserie',
    unit: 'Fahrzeuge',
    credits: 16,
    icon: '🚗',
    hint: '16 Perspektiven je Fahrzeug, 1 Credit je Bild',
    inCalculator: true,
    color: 'from-blue-50 to-transparent',
  },
  {
    key: 'social',
    label: 'Social-Media-Post',
    unit: 'Posts',
    credits: 5,
    icon: '📱',
    hint: 'Motiv inkl. Text für Instagram/Facebook',
    inCalculator: true,
    color: 'from-violet-50 to-transparent',
  },
  {
    key: 'banner',
    label: 'Banner',
    unit: 'Banner',
    credits: 5,
    icon: '🪧',
    hint: 'Werbebanner in allen gängigen Formaten',
    inCalculator: true,
    color: 'from-amber-50 to-transparent',
  },
  {
    key: 'landing',
    label: 'Landingpage',
    unit: 'Landingpages',
    credits: 19,
    icon: '📄',
    hint: 'Fahrzeugseite inkl. Bilder und Pflichtangaben',
    inCalculator: true,
    color: 'from-emerald-50 to-transparent',
  },
  {
    key: 'video',
    label: 'Video (8 Sek.)',
    unit: 'Videos',
    credits: 17,
    icon: '🎬',
    hint: 'Fahrzeugvideo 16:9 oder 9:16',
    inCalculator: true,
    color: 'from-rose-50 to-transparent',
  },
  {
    key: 'single-image',
    label: 'Einzelbild',
    unit: 'Bilder',
    credits: 1,
    icon: '🖼️',
    hint: 'Einzelne Perspektive oder Nachbearbeitung',
    inCalculator: true,
    color: 'from-sky-50 to-transparent',
  },
];

export const CREDIT_PRICE: Record<string, number> = Object.fromEntries(
  PRODUCT_CREDIT_ITEMS.map((i) => [i.key, i.credits]),
);

/** „16 Credits pro kompletter Fahrzeugserie" usw. */
export function creditHint(key: string, suffix: string): string {
  return `${CREDIT_PRICE[key]} Credits ${suffix}`;
}
