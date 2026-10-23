import { JACOBS_FALLBACK_FINANCE, jacobsFallbackMonthlyRate, jacobsMonthlyRate, jacobsTitleLabel, liveTitleLabel, type LiveInventoryConfig, type LiveVehicle } from '@/lib/live-inventory';

/**
 * § 17 PAngV footnotes for every live vehicle that shows a monthly rate.
 * Each rate gets its own number (¹, ², ³ …) and a complete example calculation,
 * computed from the same figures the card shows – nothing is typed by hand.
 */

export interface FinanceFootnote {
  number: number;
  vehicleId: string;
  title: string;
  internalNumber?: string | null;
  text: string;
  /** false when the rate comes from Auto3 without the full financing details. */
  complete: boolean;
}

const eur = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const pct = (n: number) => `${(n * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

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

export function buildFinanceFootnotes(vehicles: LiveVehicle[], config: LiveInventoryConfig, bank?: string): FinanceFootnote[] {
  const jacobs = config.cardDesign?.preset === 'jacobs';
  const lender = bank?.trim() || 'der Partnerbank des Autohauses';
  const notes: FinanceFootnote[] = [];
  for (const v of vehicles) {
    const shown = jacobs ? jacobsMonthlyRate(v) : v.monthlyRate;
    if (!shown) continue;
    const title = jacobs ? jacobsTitleLabel(v) : liveTitleLabel(v);
    const ref = v.internalNumber ? ` (Nr. ${v.internalNumber})` : '';
    const number = notes.length + 1;
    if (!v.monthlyRate && v.priceEur) {
      const e = financeExample(v.priceEur);
      notes.push({
        number, vehicleId: v.externalVehicleId, title, internalNumber: v.internalNumber, complete: true,
        text: `${title}${ref}: Ein unverbindliches Finanzierungsbeispiel ${lender}. Fahrzeugpreis ${eur(e.priceEur)}, Anzahlung ${eur(e.downPayment)}, Nettodarlehensbetrag ${eur(e.netLoan)}, Laufzeit ${e.termMonths} Monate, ${e.termMonths} monatliche Raten à ${eur(e.rate)}, Schlussrate ${eur(e.finalInstallment)}, gebundener Sollzinssatz ${pct(e.nominal)} p.a., effektiver Jahreszins ${pct(e.effective)}, Gesamtbetrag ${eur(e.total)}. Bonität vorausgesetzt. Angebot für Privatkunden, freibleibend.`,
      });
    } else {
      notes.push({
        number, vehicleId: v.externalVehicleId, title, internalNumber: v.internalNumber, complete: false,
        text: `${title}${ref}: Monatliche Rate ab ${eur(shown)} lt. Finanzierungsangebot des Autohauses. Die vollständigen Pflichtangaben gem. § 17 PAngV (Darlehensgeber, Sollzins, effektiver Jahreszins, Gesamtbetrag) finden Sie im jeweiligen Fahrzeugangebot. Bonität vorausgesetzt.`,
      });
    }
  }
  return notes;
}

export const toSuperscript = (n: number) => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
