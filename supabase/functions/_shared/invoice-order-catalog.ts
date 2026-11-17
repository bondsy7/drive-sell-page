export type InvoiceOfferKind = "subscription" | "credit_pack" | "service";

export interface ServerInvoiceOffer {
  slug: string;
  name: string;
  kind: InvoiceOfferKind;
  priceCents: number;
  credits: number;
  setupFeeEligible: boolean;
}

const subscription = (slug: string, name: string, priceCents: number, credits: number): ServerInvoiceOffer => ({
  slug, name, kind: "subscription", priceCents, credits, setupFeeEligible: true,
});
const service = (slug: string, name: string, priceCents: number): ServerInvoiceOffer => ({
  slug, name, kind: "service", priceCents, credits: 0, setupFeeEligible: false,
});

export const INVOICE_SETUP_FEE_CENTS = 99000;
export const INVOICE_PAYMENT_TERM_DAYS = 14;

const serverInvoiceOfferList: ServerInvoiceOffer[] = [
  subscription("basic", "Basic", 39900, 600),
  subscription("advanced", "Advanced", 49900, 1000),
  subscription("premium", "Premium", 89900, 2000),
  subscription("ultra", "Ultra", 159800, 4000),
  subscription("foto1", "Fotoservice 1 Fahrzeug", 999, 16),
  subscription("foto25", "Fotoservice 25 Fahrzeuge", 19900, 400),
  subscription("foto50", "Fotoservice 50 Fahrzeuge", 34900, 800),
  subscription("foto100", "Fotoservice 100 Fahrzeuge", 59900, 1600),
  subscription("foto200", "Fotoservice 200 Fahrzeuge", 109800, 3200),
  { slug: "credits-200", name: "200 Credits", kind: "credit_pack", priceCents: 10000, credits: 200, setupFeeEligible: false },
  service("addon-instagram", "Instagram-Post", 250),
  service("addon-facebook", "Facebook-Post", 250),
  service("addon-google-banner", "Google-Banner", 250),
  service("addon-video", "Video", 850),
  service("addon-landingpage", "Landingpage", 950),
  service("extra-marketing-set", "Marketing-Set (einzeln)", 1990),
  service("extra-landingpage-paket", "Landingpage-Paket", 1490),
  service("extra-whitelabel-automarkt", "Whitelabel-Automarkt", 29900),
  service("extra-flipping-plugin", "Flipping-Plugin", 19900),
  service("extra-video-paket", "Video-Paket", 850),
];

export const SERVER_INVOICE_OFFERS: Record<string, ServerInvoiceOffer> = Object.fromEntries(
  serverInvoiceOfferList.map((offer) => [offer.slug, offer]),
);
