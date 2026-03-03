/**
 * Parses a German-formatted price string like "29.990 €" or "29990" to a number.
 */
export function parsePrice(str: string): number {
  if (!str) return 0;
  // Remove currency symbols, whitespace, and handle German number format
  const cleaned = str.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses duration string like "48 Monate" to number of months.
 */
export function parseDuration(str: string): number {
  if (!str) return 0;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parses interest rate string like "3,99 %" or "3.99" to a decimal (e.g. 0.0399).
 */
export function parseInterestRate(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[%\s]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num / 100;
}

/**
 * Formats a number as German price string.
 */
export function formatPrice(num: number): string {
  if (num <= 0) return '';
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

/**
 * Calculate monthly financing rate.
 * Annuity formula: R = (P * r * (1+r)^n) / ((1+r)^n - 1)
 * where P = principal, r = monthly rate, n = months
 */
export function calculateFinancingRate(totalPrice: number, downPayment: number, annualRate: number, months: number): number {
  if (months <= 0) return 0;
  const principal = totalPrice - downPayment;
  if (principal <= 0) return 0;
  if (annualRate <= 0) return principal / months; // 0% financing
  const r = annualRate / 12;
  const factor = Math.pow(1 + r, months);
  return (principal * r * factor) / (factor - 1);
}

/**
 * Calculate monthly leasing rate.
 * Simplified: R = (P - S - RW) / n + (P - S + RW) / 2 * r_monthly
 * where P = price, S = special payment, RW = residual value, n = months, r = monthly rate
 */
export function calculateLeasingRate(totalPrice: number, specialPayment: number, residualValue: number, annualRate: number, months: number): number {
  if (months <= 0) return 0;
  const depreciationPart = (totalPrice - specialPayment - residualValue) / months;
  const r = annualRate / 12;
  const interestPart = ((totalPrice - specialPayment + residualValue) / 2) * r;
  return depreciationPart + interestPart;
}
