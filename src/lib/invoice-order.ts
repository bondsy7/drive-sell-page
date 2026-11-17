import { ALL_INCL_PACKAGES, FOTO_PACKAGES } from '@/lib/stripe-plans';

export const INVOICE_SETUP_FEE_CENTS = 99000;
export const INVOICE_VAT_RATE = 0.19;
export const INVOICE_PAYMENT_TERM_DAYS = 14;

export type InvoiceOfferKind = 'subscription' | 'credit_pack' | 'service';

export interface InvoiceOffer {
  slug: string;
  name: string;
  subtitle: string;
  kind: InvoiceOfferKind;
  priceCents: number;
  unit: string;
  bullets: string[];
  credits?: number;
  setupFeeEligible?: boolean;
  fromPrice?: boolean;
}

export interface InvoiceTotals {
  serviceNetCents: number;
  setupFeeCents: number;
  netCents: number;
  vatCents: number;
  totalGrossCents: number;
}

const subscriptionOffers: InvoiceOffer[] = [
  ...ALL_INCL_PACKAGES.map((pkg) => ({
    slug: pkg.slug,
    name: pkg.name,
    subtitle: 'All-Incl-Marketing',
    kind: 'subscription' as const,
    priceCents: pkg.priceCents,
    unit: '/ Monat netto',
    bullets: [
      `${pkg.credits.toLocaleString('de-DE')} Credits / Monat`,
      `${pkg.vehiclesPerMonth} Fahrzeuge / Monat`,
      ...pkg.included.slice(0, 2),
    ],
    credits: pkg.credits,
    setupFeeEligible: true,
  })),
  ...FOTO_PACKAGES.map((pkg) => ({
    slug: pkg.slug,
    name: `Fotoservice ${pkg.vehicles} Fahrzeug${pkg.vehicles === 1 ? '' : 'e'}`,
    subtitle: 'Fotoservice',
    kind: 'subscription' as const,
    priceCents: pkg.monthlyCents,
    unit: '/ Monat netto',
    bullets: [
      `${pkg.credits.toLocaleString('de-DE')} Credits / Monat`,
      `${pkg.vehicles} Fahrzeug${pkg.vehicles === 1 ? '' : 'e'} / Monat`,
      '16 Perspektiven je Fahrzeug',
    ],
    credits: pkg.credits,
    setupFeeEligible: true,
  })),
];

const serviceOffers: InvoiceOffer[] = [
  { slug: 'credits-200', name: '200 Credits', subtitle: 'Credit-Paket', kind: 'credit_pack', priceCents: 10000, unit: 'einmalig netto', credits: 200, bullets: ['200 zusätzliche Credits', 'Verfallen nicht zum Monatsende', 'Freigabe durch einen Admin'] },
  { slug: 'addon-instagram', name: 'Instagram-Post', subtitle: 'Zusatzapplikation', kind: 'service', priceCents: 250, unit: 'pro Post netto', bullets: ['Alle gängigen Formate wählbar'] },
  { slug: 'addon-facebook', name: 'Facebook-Post', subtitle: 'Zusatzapplikation', kind: 'service', priceCents: 250, unit: 'pro Post netto', bullets: ['Alle gängigen Formate wählbar'] },
  { slug: 'addon-google-banner', name: 'Google-Banner', subtitle: 'Zusatzapplikation', kind: 'service', priceCents: 250, unit: 'pro Banner netto', bullets: ['Alle gängigen Formate wählbar'] },
  { slug: 'addon-video', name: 'Video', subtitle: 'Zusatzapplikation', kind: 'service', priceCents: 850, unit: 'pro Video netto', bullets: ['Formate 16:9 oder 9:16'] },
  { slug: 'addon-landingpage', name: 'Landingpage', subtitle: 'Zusatzapplikation', kind: 'service', priceCents: 950, unit: 'pro Landingpage netto', bullets: ['Inklusive Fahrzeugdaten und Pflichtangaben'] },
  { slug: 'extra-marketing-set', name: 'Marketing-Set (einzeln)', subtitle: 'Einzelset', kind: 'service', priceCents: 1990, unit: 'netto', fromPrice: true, bullets: ['Umfang wird vor der Rechnungsstellung abgestimmt'] },
  { slug: 'extra-landingpage-paket', name: 'Landingpage-Paket', subtitle: 'Zusatzpaket', kind: 'service', priceCents: 1490, unit: 'pro Landingpage netto', bullets: ['Einzelne Landingpage als Zusatzleistung'] },
  { slug: 'extra-whitelabel-automarkt', name: 'Whitelabel-Automarkt', subtitle: 'Zusatzpaket', kind: 'service', priceCents: 29900, unit: '/ Monat netto', bullets: ['Einrichtung wird individuell abgestimmt'] },
  { slug: 'extra-flipping-plugin', name: 'Flipping-Plugin', subtitle: 'Zusatzpaket', kind: 'service', priceCents: 19900, unit: '/ Monat netto', bullets: ['Einrichtung wird individuell abgestimmt'] },
  { slug: 'extra-video-paket', name: 'Video-Paket', subtitle: 'Zusatzpaket', kind: 'service', priceCents: 850, unit: 'pro Video netto', fromPrice: true, bullets: ['Umfang wird vor der Rechnungsstellung abgestimmt'] },
];

export const INVOICE_OFFERS: InvoiceOffer[] = [...subscriptionOffers, ...serviceOffers];

export function getInvoiceOffer(slug: string | null | undefined): InvoiceOffer | undefined {
  return INVOICE_OFFERS.find((offer) => offer.slug === slug);
}

export function calculateInvoiceTotals(offer: InvoiceOffer, firstBooking: boolean): InvoiceTotals {
  const setupFeeCents = firstBooking && offer.setupFeeEligible ? INVOICE_SETUP_FEE_CENTS : 0;
  const netCents = offer.priceCents + setupFeeCents;
  const vatCents = Math.round(netCents * INVOICE_VAT_RATE);
  return {
    serviceNetCents: offer.priceCents,
    setupFeeCents,
    netCents,
    vatCents,
    totalGrossCents: netCents + vatCents,
  };
}

export function formatInvoiceEuro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
