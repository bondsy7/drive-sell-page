import { JACOBS_FALLBACK_FINANCE, jacobsFallbackMonthlyRate, jacobsTitleLabel, liveTitleLabel, type LiveInventoryConfig, type LiveVehicle } from '@/lib/live-inventory';

/**
 * § 17 PAngV footnotes for live vehicles.
 * Rule: a monthly rate is only shown when every mandatory detail is known.
 * Otherwise the rate is hidden on the page and the configurator lists what is missing.
 */

export interface FinanceFootnote {
  number: number;
  vehicleId: string;
  title: string;
  internalNumber?: string | null;
  /** Rate shown on the card (whole euros). */
  rate: number;
  text: string;
}

export interface FinanceGap {
  vehicleId: string;
  title: string;
  internalNumber?: string | null;
  missing: string[];
}

const eur = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

export function financeExample(priceEur: number) {
  const { downPaymentShare, termMonths, finalShare, annualRate } = JACOBS_FALLBACK_FINANCE;
  const rate = jacobsFallbackMonthlyRate(priceEur)!;
  const downPayment = Math.round(priceEur * downPaymentShare * 100) / 100;
  const netLoan = Math.round((priceEur - downPayment) * 100) / 100;
  const finalInstallment = Math.round(priceEur * finalShare * 100) / 100;
  const total = Math.round((rate * termMonths + finalInstallment) * 100) / 100;
  const effective = Math.pow(1 + annualRate / 12, 12) - 1;
  return { priceEur, rate, downPayment, netLoan, finalInstallment, total, termMonths, nominal: annualRate, effective };
}

interface Resolved {
  rate: number | null;
  missing: string[];
  d?: { price: number | null; rate: number; termMonths: number; downPayment: number; netLoan: number; finalInstallment: number | null; total: number; nominal: number; effective: number; bank: string };
}

/** All mandatory § 17 PAngV values for one vehicle, or the list of what is missing. */
export function resolveVehicleFinance(v: LiveVehicle, config: LiveInventoryConfig): Resolved {
  const jacobs = config.cardDesign?.preset === 'jacobs';
  const profileBank = config.financeBank?.trim() || '';
  if (v.monthlyRate) {
    const f = v.financing || null;
    const bank = f?.bank || profileBank;
    const missing: string[] = [];
    if (!f?.termMonths) missing.push('Laufzeit');
    if (f?.downPayment == null) missing.push('Anzahlung');
    if (!f?.netLoan) missing.push('Nettodarlehensbetrag');
    if (!f?.nominalRate) missing.push('Sollzins');
    if (!f?.effectiveRate) missing.push('Effektiver Jahreszins');
    if (!f?.total) missing.push('Gesamtbetrag');
    if (!bank) missing.push('Bank');
    if (missing.length || !f) return { rate: null, missing };
    return { rate: Math.round(v.monthlyRate), missing, d: {
      price: v.priceEur, rate: v.monthlyRate, termMonths: f.termMonths!, downPayment: f.downPayment!, netLoan: f.netLoan!,
      finalInstallment: f.finalInstallment, total: f.total!, nominal: f.nominalRate!, effective: f.effectiveRate!, bank,
    } };
  }
  // No Auto3 rate: only the Jacobs website example calculation may fill in.
  if (!jacobs || !v.priceEur) return { rate: null, missing: [] };
  if (!profileBank) return { rate: null, missing: ['Bank'] };
  const e = financeExample(v.priceEur);
  return { rate: Math.round(e.rate), missing: [], d: {
    price: e.priceEur, rate: e.rate, termMonths: e.termMonths, downPayment: e.downPayment, netLoan: e.netLoan,
    finalInstallment: e.finalInstallment, total: e.total, nominal: e.nominal * 100, effective: e.effective * 100, bank: profileBank,
  } };
}

const titleOf = (v: LiveVehicle, config: LiveInventoryConfig) => config.cardDesign?.preset === 'jacobs' ? jacobsTitleLabel(v) : liveTitleLabel(v);

export function buildFinanceFootnotes(vehicles: LiveVehicle[], config: LiveInventoryConfig): FinanceFootnote[] {
  const notes: FinanceFootnote[] = [];
  for (const v of vehicles) {
    const r = resolveVehicleFinance(v, config);
    if (!r.d || !r.rate) continue;
    const d = r.d;
    const title = titleOf(v, config);
    const ref = v.internalNumber ? ` (Nr. ${v.internalNumber})` : '';
    notes.push({
      number: notes.length + 1, vehicleId: v.externalVehicleId, title, internalNumber: v.internalNumber, rate: r.rate,
      text: `${title}${ref}: Ein unverbindliches Finanzierungsbeispiel der ${d.bank}. ${d.price ? `Fahrzeugpreis ${eur(d.price)}, ` : ''}Anzahlung ${eur(d.downPayment)}, Nettodarlehensbetrag ${eur(d.netLoan)}, Laufzeit ${d.termMonths} Monate, ${d.termMonths} monatliche Raten à ${eur(d.rate)}${d.finalInstallment ? `, Schlussrate ${eur(d.finalInstallment)}` : ''}, gebundener Sollzinssatz ${pct(d.nominal)} p.a., effektiver Jahreszins ${pct(d.effective)}, Gesamtbetrag ${eur(d.total)}. Bonität vorausgesetzt. Angebot für Privatkunden, freibleibend.`,
    });
  }
  return notes;
}

/** Vehicles whose rate is hidden because mandatory details are missing. */
export function findFinanceGaps(vehicles: LiveVehicle[], config: LiveInventoryConfig): FinanceGap[] {
  return vehicles.flatMap(v => {
    const r = resolveVehicleFinance(v, config);
    return r.missing.length ? [{ vehicleId: v.externalVehicleId, title: titleOf(v, config), internalNumber: v.internalNumber, missing: r.missing }] : [];
  });
}

export const toSuperscript = (n: number) => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
