import jacobsCardCss from '@/styles/jacobs-vehicle-cards.css?raw';
import jacobsRegular from '@/assets/jacobs-montserrat-regular.asset.json';
import jacobsBold from '@/assets/jacobs-montserrat-bold.asset.json';

const assetOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const jacobsFonts = `@font-face{font-family:'Jacobs Montserrat';src:url('${assetOrigin}${jacobsRegular.url}') format('truetype');font-weight:400;font-display:swap}@font-face{font-family:'Jacobs Montserrat';src:url('${assetOrigin}${jacobsBold.url}') format('truetype');font-weight:700;font-display:swap}`;

/**
 * Shared logic for the "Live-Fahrzeuge" landing-page block.
 *
 * The landing page never stores vehicle data itself – it stores only the rule
 * (LiveInventoryConfig). The actual vehicles are re-resolved from the connected
 * Auto3/Indicar dealer stock every time the page is shown, so sold cars
 * disappear and new matching cars appear automatically.
 */

export interface LiveVehicle {
  externalVehicleId: string;
  internalNumber?: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  used: boolean | null;
  thumbnail: string | null;
  priceEur: number | null;
  monthlyRate: number | null;
  mileage: number | null;
  firstRegistration?: string | null;
  fuelType?: string | null;
  powerKw?: number | null;
  powerPs?: number | null;
  emissionText?: string | null;
  transmission?: string | null;
  /** Financing details delivered by Auto3 (euro values, interest in percent). */
  financing?: {
    termMonths: number | null;
    downPayment: number | null;
    finalInstallment: number | null;
    netLoan: number | null;
    total: number | null;
    effectiveRate: number | null;
    nominalRate: number | null;
    bank: string | null;
  } | null;
}

export interface LiveVehicleCardDesign {
  preset: 'jacobs';
  detailUrlTemplate: string;
  contactEmail?: string;
  contactPhone?: string;
}

const JACOBS_TEST_PROFILES = ['edin.ljevo@wirsindjacobs.de', 'p.erhard@autoactiva.de', 'd.bonds@autoactiva.de'];

export function resolveProfileCardDesign(email: string | undefined, settings: unknown): LiveVehicleCardDesign | undefined {
  if (!email || !JACOBS_TEST_PROFILES.includes(email.toLowerCase())) return undefined;
  if (!settings || typeof settings !== 'object' || !('liveVehicleCardDesign' in settings)) return undefined;
  const design = settings.liveVehicleCardDesign;
  if (!design || typeof design !== 'object' || !('preset' in design) || design.preset !== 'jacobs') return undefined;
  return { preset: 'jacobs', detailUrlTemplate: 'https://www.wir-sind-jacobs.de/fahrzeuge-details/?intern-nummer={internalNumber}' };
}

/** The public dealer uses its internal stock number, never the Auto3 record ID. */
export function liveVehicleHref(v: LiveVehicle, design?: LiveVehicleCardDesign, inventoryUrl?: string): string | undefined {
  if (design?.preset === 'jacobs') {
    if (!v.internalNumber?.trim()) return undefined;
    return 'https://www.wir-sind-jacobs.de/fahrzeuge-details/?intern-nummer=' + encodeURIComponent(v.internalNumber.trim());
  }
  try { const url = new URL(inventoryUrl || ''); return /^https?:$/.test(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

export const jacobsTitleLabel = (v: LiveVehicle) => v.variant ? `${v.brand || ''} ${v.variant}`.trim() : liveTitleLabel(v);
export const jacobsPriceLabel = (v: LiveVehicle) => v.priceEur != null ? `${v.priceEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'Preis auf Anfrage';

/** Same example financing the Jacobs website plugin uses when Auto3 delivers no rate:
 *  20 % down payment, 48 months, 40 % final installment, 5.99 % p.a. */
export const JACOBS_FALLBACK_FINANCE = { downPaymentShare: 0.2, termMonths: 48, finalShare: 0.4, annualRate: 0.0599 } as const;
export function jacobsFallbackMonthlyRate(priceEur: number | null | undefined): number | null {
  if (!priceEur || !Number.isFinite(priceEur) || priceEur <= 0) return null;
  const { downPaymentShare, termMonths: n, finalShare, annualRate } = JACOBS_FALLBACK_FINANCE;
  const r = annualRate / 12;
  const loan = priceEur * (1 - downPaymentShare);
  const disc = Math.pow(1 + r, -n);
  return Math.round(((loan - priceEur * finalShare * disc) / ((1 - disc) / r)) * 100) / 100;
}
/** Auto3 rate wins; otherwise the website's example calculation. Rounded up to whole euros like the website. */
export const jacobsMonthlyRate = (v: LiveVehicle): number | null => {
  const rate = v.monthlyRate || jacobsFallbackMonthlyRate(v.priceEur);
  return rate ? Math.round(rate) : null;
};
export const jacobsFuelLabel = (v: LiveVehicle) => ({ FUEL: 'Benzin', PETROL: 'Benzin', DIESEL: 'Diesel', ELECTRIC: 'Elektro', HYBRID: 'Hybrid', PLUGIN_HYBRID: 'Plug-in-Hybrid' }[v.fuelType || ''] || v.fuelType || '—');
export const jacobsPowerLabel = (v: LiveVehicle) => v.powerKw != null ? `${v.powerKw} kW${v.powerPs != null ? ` (${v.powerPs} PS)` : ''}` : '—';

/** Saved rule: the renderer (and later the website plugin) re-resolves live vehicles from this. */
export interface LiveInventoryConfig {
  enabled: boolean;
  mode: 'filter' | 'manual';
  brand: string; // '' = alle
  model: string; // '' = alle
  condition: 'all' | 'new' | 'used';
  selectedIds: string[];
  maxItems: number;
  layout: 'slider' | 'grid';
  title: string;
  cardDesign?: LiveVehicleCardDesign;
  /** Lender named in the § 17 PAngV footnotes when Auto3 does not deliver one. */
  financeBank?: string;
  /** Heading above the finance footnotes; empty = default wording. */
  financeTitle?: string;
}

export const DEFAULT_LIVE_INVENTORY: LiveInventoryConfig = {
  enabled: false, mode: 'filter', brand: '', model: '', condition: 'all',
  selectedIds: [], maxItems: 8, layout: 'slider', title: 'Aktuelle Fahrzeuge aus unserem Bestand',
};

export function isLiveInventoryConfig(v: unknown): v is LiveInventoryConfig {
  return !!v && typeof v === 'object' && 'mode' in (v as any) && 'layout' in (v as any);
}

export function matchesLiveFilter(v: LiveVehicle, c: LiveInventoryConfig): boolean {
  if (c.brand && (v.brand || '').toLowerCase() !== c.brand.toLowerCase()) return false;
  if (c.model && (v.model || '').toLowerCase() !== c.model.toLowerCase()) return false;
  if (c.condition === 'new' && v.used !== false) return false;
  if (c.condition === 'used' && v.used !== true) return false;
  return true;
}

/** Vehicles that the block shows for this rule. Nothing is frozen – always resolved from the current stock. */
export function resolveLiveVehicles(items: LiveVehicle[], c: LiveInventoryConfig): LiveVehicle[] {
  if (!c.enabled) return [];
  if (c.mode === 'manual') {
    const wanted = new Set(c.selectedIds);
    return items.filter(v => wanted.has(v.externalVehicleId));
  }
  return items.filter(v => matchesLiveFilter(v, c)).slice(0, Math.max(1, c.maxItems));
}

/* ─── formatting (identical in editor preview and exported HTML) ─── */

export const livePriceLabel = (v: LiveVehicle) =>
  v.priceEur ? `${v.priceEur.toLocaleString('de-DE')} €` : 'Preis auf Anfrage';

export const liveTitleLabel = (v: LiveVehicle) => [v.brand, v.model].filter(Boolean).join(' ') || 'Fahrzeug';

export const liveSpecLabel = (v: LiveVehicle) => [
  v.used === false ? 'Neuwagen' : v.used ? 'Gebrauchtwagen' : null,
  v.year ? `${v.year}` : null,
  v.mileage != null ? `${v.mileage.toLocaleString('de-DE')} km` : null,
].filter(Boolean).join(' · ');

/* ─── Shared block styles: one source for the editor canvas and the exported HTML ─── */

export const LIVE_INVENTORY_CSS = `
${jacobsFonts}
${jacobsCardCss}
.lp-live-inner{max-width:1200px;margin:0 auto;padding:96px 32px}
.lp-live-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px;flex-wrap:wrap}
.lp-live-title{font-size:34px;font-weight:700;color:#0f172a;line-height:1.15}
.lp-live-nav{display:flex;gap:8px}
.lp-live-nav button{width:34px;height:34px;border-radius:999px;border:1px solid var(--lp-border);background:#fff;color:#0f172a;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color 140ms ease}
.lp-live-nav button:hover{background:var(--lp-tint)}
.lp-live-track{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 4px 18px;scrollbar-width:thin}
.lp-live-track > .lp-live-card{flex:0 0 320px;scroll-snap-align:start}
.lp-live-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.lp-live-card{display:flex;flex-direction:column;border:1px solid var(--lp-border);border-radius:16px;overflow:hidden;background:#fff;text-decoration:none;color:inherit;transition:box-shadow 180ms ease, transform 180ms ease}
.lp-live-card:hover{box-shadow:0 10px 30px rgba(15,23,42,.10);transform:translateY(-2px)}
.lp-live-media{position:relative;aspect-ratio:4/3;background:var(--lp-tint);overflow:hidden;display:flex;align-items:center;justify-content:center;color:rgba(15,23,42,.35)}
.lp-live-media img{width:100%;height:100%;object-fit:cover;display:block}
.lp-live-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px}
.lp-live-name{font-size:16px;font-weight:700;color:#0f172a;line-height:1.3}
.lp-live-variant{font-size:13px;color:#64748b;line-height:1.4}
.lp-live-specs{font-size:12px;color:#64748b}
.lp-live-price{font-size:19px;font-weight:800;color:var(--lp-primary);margin-top:6px}
.lp-live-rate{font-size:12px;color:#64748b}
.lp-live-more{margin-top:10px;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--lp-primary)}
.lp-live-empty{padding:28px;border:1px dashed var(--lp-border);border-radius:14px;text-align:center;color:#64748b;font-size:14px}
`;

/** Narrow layouts (tablet / mobile preview and real devices): one card per view. */
export const LIVE_INVENTORY_NARROW_CSS = `
  .lp-live-inner{padding:56px 20px !important}
  .lp-live-title{font-size:26px !important}
  .lp-live-track > .lp-live-card{flex:0 0 82%}
`;
