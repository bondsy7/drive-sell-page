// Mapping zwischen subscription_plans-Slugs und Stripe-Preis-IDs
// Paketstruktur gemäß autohaus.ai (Stand 22.09.2026), alle Preise netto zzgl. USt.
//   • All-Incl-Marketing: Basic / Advanced / Premium / Ultra
//   • Fotoservice: 1 / 25 / 50 / 100 / 200 Fahrzeuge mtl. (16 Perspektiven je Fahrzeug)
//   • Einmalige Implementierungskosten: 990 €
//   • Top-Up: 200 Credits für 100 €
export const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  // All-Incl-Marketing
  basic: { monthly: 'price_1UINXLP3eWRHEALNd9tA3iGO', yearly: 'price_1UINXLP3eWRHEALNd9tA3iGO' },
  advanced: { monthly: 'price_1UINXNP3eWRHEALN7RYf2qNH', yearly: 'price_1UINXNP3eWRHEALN7RYf2qNH' },
  premium: { monthly: 'price_1UINXOP3eWRHEALNuZ9k9ZJD', yearly: 'price_1UINXOP3eWRHEALNuZ9k9ZJD' },
  ultra: { monthly: 'price_1UINXQP3eWRHEALNMoIszMxo', yearly: 'price_1UINXQP3eWRHEALNMoIszMxo' },
  // Fotoservice
  foto1: { monthly: 'price_1UINXUP3eWRHEALNEKwVan7t', yearly: 'price_1UINXUP3eWRHEALNEKwVan7t' },
  foto25: { monthly: 'price_1UINXWP3eWRHEALNnycuH46I', yearly: 'price_1UINXWP3eWRHEALNnycuH46I' },
  foto50: { monthly: 'price_1UINXYP3eWRHEALNnVc7lPwS', yearly: 'price_1UINXYP3eWRHEALNnVc7lPwS' },
  foto100: { monthly: 'price_1UINXZP3eWRHEALNxbIQuvkO', yearly: 'price_1UINXZP3eWRHEALNxbIQuvkO' },
  foto200: { monthly: 'price_1UINXaP3eWRHEALNHnFqWkJs', yearly: 'price_1UINXaP3eWRHEALNHnFqWkJs' },
  // Legacy-Grundpaket (nicht mehr aktiv im Verkauf, bestehende Abos laufen weiter)
  basis: { monthly: 'price_1Tl8cuP3eWRHEALNPuSwqIZe', yearly: 'price_1Tl8cuP3eWRHEALNPuSwqIZe' },
};

// Stripe product IDs per plan slug
export const STRIPE_PRODUCTS: Record<string, string> = {
  basic: 'prod_VIzWhtI4tovQvD',
  advanced: 'prod_VIzWSancK2oQHS',
  premium: 'prod_VIzWTzES3Zmp7u',
  ultra: 'prod_VIzWdSX9BrJ4VA',
  foto1: 'prod_VIzW4Bw3j7AzxU',
  foto25: 'prod_VIzWzAqnrdFdhl',
  foto50: 'prod_VIzW3v7GewIwzP',
  foto100: 'prod_VIzWgCX30TFWYQ',
  foto200: 'prod_VIzW4O0kUsuT6Q',
  basis: 'prod_Ukduqj0YRUxMYt',
};

// Einmalige Implementierungskosten (990 € netto), wird bei der Erstbuchung mitberechnet
export const SETUP_FEE_PRICE_ID = 'price_1UINXcP3eWRHEALNRW9nMcih';
export const SETUP_FEE_CENTS = 99000;

// Credit packs for one-time purchase
//   200 Cr → 100,00 € = 0,50 €/Cr
export const CREDIT_PACKS = [
  { priceId: 'price_1Tl8cvP3eWRHEALNhWR3taMN', credits: 200, priceCents: 10000, label: '200 Credits' },
];

// ---------------------------------------------------------------------------
// Anzeige-Konfiguration der Preisseite
// ---------------------------------------------------------------------------

export interface AllInclPackage {
  slug: string;
  name: string;
  subtitle?: string;
  vehiclesPerMonth: number;
  credits: number;
  priceCents: number;
  effectivePerVehicleCents: number;
  recommended?: boolean;
  included: string[];
}

export const ALL_INCL_PACKAGES: AllInclPackage[] = [
  {
    slug: 'basic',
    name: 'Basic',
    vehiclesPerMonth: 30,
    credits: 600,
    priceCents: 39900,
    effectivePerVehicleCents: 1330,
    included: ['360 Fahrzeugbilder', '30 Instagram-Motive', '30 Facebook-Motive', '30 Google-Banner'],
  },
  {
    slug: 'advanced',
    name: 'Advanced',
    vehiclesPerMonth: 50,
    credits: 1000,
    priceCents: 49900,
    effectivePerVehicleCents: 998,
    recommended: true,
    included: ['600 Fahrzeugbilder', '50 Instagram-Motive', '50 Facebook-Motive', '50 Google-Banner'],
  },
  {
    slug: 'premium',
    name: 'Premium',
    subtitle: 'Für Mehrmarken-Autohäuser',
    vehiclesPerMonth: 100,
    credits: 2000,
    priceCents: 89900,
    effectivePerVehicleCents: 899,
    included: ['1.200 Fahrzeugbilder', '100 Instagram-Motive', '100 Facebook-Motive', '100 Google-Banner'],
  },
  {
    slug: 'ultra',
    name: 'Ultra',
    subtitle: 'Für Autohaus-Gruppen',
    vehiclesPerMonth: 200,
    credits: 4000,
    priceCents: 159800,
    effectivePerVehicleCents: 799,
    included: ['2.400 Fahrzeugbilder', '200 Instagram-Motive', '200 Facebook-Motive', '200 Google-Banner'],
  },
];

export interface FotoPackage {
  slug: string;
  vehicles: number;
  pricePerVehicleCents: number;
  monthlyCents: number;
  credits: number;
  recommended?: boolean;
}

export const FOTO_PACKAGES: FotoPackage[] = [
  { slug: 'foto1', vehicles: 1, pricePerVehicleCents: 999, monthlyCents: 999, credits: 16 },
  { slug: 'foto25', vehicles: 25, pricePerVehicleCents: 799, monthlyCents: 19900, credits: 400 },
  { slug: 'foto50', vehicles: 50, pricePerVehicleCents: 699, monthlyCents: 34900, credits: 800 },
  { slug: 'foto100', vehicles: 100, pricePerVehicleCents: 599, monthlyCents: 59900, credits: 1600, recommended: true },
  { slug: 'foto200', vehicles: 200, pricePerVehicleCents: 549, monthlyCents: 109800, credits: 3200 },
];

export const FOTO_ADDONS = [
  { label: 'Instagram-Post', hint: 'Alle gängigen Formate wählbar', price: '+ 2,50 €', unit: 'pro Post' },
  { label: 'Facebook-Post', hint: 'Alle gängigen Formate wählbar', price: '+ 2,50 €', unit: 'pro Post' },
  { label: 'Google-Banner', hint: 'Alle gängigen Formate wählbar', price: '+ 2,50 €', unit: 'pro Banner' },
  { label: 'Video', hint: 'Formate 16:9 oder 9:16', price: '+ 8,50 €', unit: 'pro Video' },
  { label: 'Landingpage', hint: 'Inklusive Fahrzeugdaten und Pflichtangaben', price: '+ 9,50 €', unit: 'pro Landingpage' },
];

export const EXTRA_PACKAGES: Array<{ label: string; price: string; unit: string; onRequest?: boolean }> = [
  { label: 'Marketing-Set (einzeln)', price: 'ab 19,90 €', unit: '' },
  { label: 'Landingpage-Paket', price: '14,90 €', unit: 'pro Landingpage' },
  { label: 'Whitelabel-Automarkt', price: '299,– €', unit: 'pro Monat', onRequest: true },
  { label: 'Flipping-Plugin', price: '199,– €', unit: 'pro Monat', onRequest: true },
  { label: 'Video-Paket', price: 'ab 8,50 €', unit: 'pro Video' },
];

// Mindestvertragslaufzeit in Monaten (siehe AGB § 7)
export const MIN_TERM_MONTHS = 12;
