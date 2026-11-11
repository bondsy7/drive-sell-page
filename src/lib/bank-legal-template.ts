import type { VehicleData } from '@/types/vehicle';

/**
 * Bank legal-text templates with offer shortcodes (§ 17 PAngV, UWG Anh. Nr. 23e,
 * EU-Verbraucherkreditrichtlinie 2023/2225 – gilt ab 20.11.2026).
 * Profile texts contain shortcodes; each offer page fills them from its own finance data.
 */

export const CREDIT_WARNING = 'Achtung! Kreditaufnahme kostet Geld.';

export const BANK_SHORTCODES: { code: string; label: string }[] = [
  { code: '{bank_name}', label: 'Bankname' },
  { code: '{fahrzeugpreis}', label: 'Fahrzeugpreis' },
  { code: '{anzahlung}', label: 'Anzahlung' },
  { code: '{sonderzahlung}', label: 'Sonderzahlung' },
  { code: '{nettodarlehensbetrag}', label: 'Nettodarlehensbetrag' },
  { code: '{laufzeit}', label: 'Laufzeit' },
  { code: '{monatsrate}', label: 'Monatsrate' },
  { code: '{schlussrate}', label: 'Schlussrate / Restwert' },
  { code: '{fahrleistung}', label: 'Jährliche Fahrleistung' },
  { code: '{sollzins}', label: 'Sollzins' },
  { code: '{effektiver_zins}', label: 'Effektiver Jahreszins' },
  { code: '{gesamtbetrag}', label: 'Gesamtbetrag' },
  { code: '{kundentyp}', label: 'Privat-/Gewerbekunden' },
];

export const ADDRESS_PLACEHOLDER = '[Anschrift der Bank eintragen]';

export function bankTemplate(type: 'leasing' | 'financing'): string {
  if (type === 'leasing') {
    return `Ein unverbindliches Kilometerleasingangebot der {bank_name}, ${ADDRESS_PLACEHOLDER}. Fahrzeugpreis: {fahrzeugpreis}, Leasingsonderzahlung: {sonderzahlung}, Vertragslaufzeit: {laufzeit}, jährliche Fahrleistung: {fahrleistung}, monatliche Leasingrate: {monatsrate}, Gesamtbetrag: {gesamtbetrag}. Bonität vorausgesetzt. Angebot für {kundentyp}, freibleibend. Wir vermitteln als ungebundener Vermittler.`;
  }
  return `Ein unverbindliches Finanzierungsbeispiel der {bank_name}, ${ADDRESS_PLACEHOLDER}. Fahrzeugpreis: {fahrzeugpreis}, Anzahlung: {anzahlung}, Nettodarlehensbetrag: {nettodarlehensbetrag}, Vertragslaufzeit: {laufzeit}, {laufzeit_zahl} monatliche Raten à {monatsrate}, Schlussrate: {schlussrate}, gebundener Sollzinssatz: {sollzins} p.a., effektiver Jahreszins: {effektiver_zins}, Gesamtbetrag: {gesamtbetrag}. Zugleich repräsentatives Beispiel. Bonität vorausgesetzt. Angebot für {kundentyp}, freibleibend.`;
}

const clean = (v?: string | null) => (v ?? '').toString().trim();
const num = (v: string) => {
  const n = Number(v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const eur = (v: string) => {
  const s = clean(v); if (!s) return '';
  if (/€|eur/i.test(s)) return s;
  const n = num(s); if (n == null) return s;
  return `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};
const pct = (v: string) => { const s = clean(v); if (!s) return ''; return s.includes('%') ? s : `${s} %`; };
const months = (v: string) => { const s = clean(v); if (!s) return ''; return /monat/i.test(s) ? s : `${s} Monate`; };
const km = (v: string) => { const s = clean(v); if (!s) return ''; return /km/i.test(s) ? s : `${s} km`; };

export function shortcodeValues(data: VehicleData, bankName: string): Record<string, string> {
  const f = data.finance || ({} as VehicleData['finance']);
  const special = eur(f.specialPayment);
  const down = eur(f.downPayment) || special;
  return {
    bank_name: clean(bankName),
    fahrzeugpreis: eur(f.totalPrice),
    anzahlung: down,
    sonderzahlung: special || down,
    nettodarlehensbetrag: eur(f.netLoanAmount || ''),
    laufzeit: months(f.duration),
    laufzeit_zahl: clean(f.duration).replace(/\D+/g, ''),
    monatsrate: eur(f.monthlyRate),
    schlussrate: eur(f.residualValue),
    fahrleistung: km(f.annualMileage),
    sollzins: pct(f.nominalInterestRate || ''),
    effektiver_zins: pct(f.interestRate),
    gesamtbetrag: eur(f.totalAmount || '') || leasingTotal(data),
    kundentyp: data.customerType === 'business' ? 'Gewerbekunden' : 'Privatkunden',
  };
}

/** Leasing total = Sonderzahlung + Laufzeit × Monatsrate (mirrors offer-compliance.ts). */
export function leasingTotal(data: VehicleData): string {
  if (!(data.category || '').toLowerCase().includes('leasing')) return '';
  const f: any = (data as any).finance || {};
  const toNum = (v: string) => { const n = Number(v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const rate = toNum(clean(f.monthlyRate)); const n = Number(clean(f.duration).replace(/\D+/g, ''));
  const sp = clean(f.specialPayment) || clean(f.downPayment);
  const special = sp ? toNum(sp) : 0;
  if (rate == null || !clean(f.monthlyRate) || !n || special == null) return '';
  return `${(special + rate * n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Replace shortcodes; clauses whose value is unknown are removed instead of left empty. */
export function resolveBankPlaceholders(text: string, data: VehicleData, bankName: string): string {
  if (!text) return '';
  const vals = shortcodeValues(data, bankName);
  // Drop "Label: {code}" segments with empty values (between commas).
  let out = text.replace(/(,\s*|^)([^,.{}]*?)\{([a-z_]+)\}([^,.{}]*?)(?=,|\.)/g, (m, sep, pre, key, post) =>
    key in vals && !vals[key] ? '' : `${sep}${pre}{${key}}${post}`);
  out = out.replace(/\{([a-z_]+)\}/g, (m, key) => (key in vals ? vals[key] : m));
  out = out.replace(new RegExp(`,?\\s*${ADDRESS_PLACEHOLDER.replace(/[[\]]/g, '\\$&')}`, 'g'), '');
  return out.replace(/\s+,/g, ',').replace(/,\s*\./g, '.').replace(/ {2,}/g, ' ').trim();
}

/** Consumer-credit warning required for consumer financing (not B2B, not cash purchase). */
export function needsCreditWarning(data: VehicleData): boolean {
  const c = (data.category || '').toLowerCase();
  const credit = c.includes('finanzierung') || c.includes('kredit');
  return credit && data.customerType !== 'business';
}

/** Missing mandatory credit values (§ 17 PAngV) for consumer financing. */
export function missingCreditFields(data: VehicleData): string[] {
  if (!needsCreditWarning(data)) return [];
  const v = shortcodeValues(data, '');
  const req: [string, string][] = [['nettodarlehensbetrag', 'Nettodarlehensbetrag'], ['sollzins', 'Sollzins'], ['effektiver_zins', 'Effektiver Jahreszins'], ['laufzeit', 'Laufzeit'], ['monatsrate', 'Monatsrate'], ['gesamtbetrag', 'Gesamtbetrag']];
  return req.filter(([k]) => !v[k]).map(([, l]) => l);
}
