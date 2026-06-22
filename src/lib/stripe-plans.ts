// Mapping between subscription_plans slugs and Stripe price IDs
// Vereinfachte Preisstruktur (2026-06-22):
//   • EIN Grundpaket "basis" – 1000 Credits/Monat für 490 €
//   • EIN Top-Up "200 Credits" für 100 €
export const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  basis: {
    monthly: 'price_1Tl8cuP3eWRHEALNPuSwqIZe',
    // Kein separater Jahrespreis – wir verrechnen auf identischer Basis.
    yearly: 'price_1Tl8cuP3eWRHEALNPuSwqIZe',
  },
};

// Stripe product IDs per plan slug
export const STRIPE_PRODUCTS: Record<string, string> = {
  basis: 'prod_Ukduqj0YRUxMYt',
};

// Credit packs for one-time purchase
//   200 Cr → 100,00 € = 0,50 €/Cr
export const CREDIT_PACKS = [
  { priceId: 'price_1Tl8cvP3eWRHEALNhWR3taMN', credits: 200, priceCents: 10000, label: '200 Credits' },
];
