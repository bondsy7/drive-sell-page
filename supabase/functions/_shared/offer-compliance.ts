// Offer compliance for external consumers (WordPress plugin via api-vehicles).
// Mirrors src/lib/bank-legal-template.ts so the app and the plugin decide identically:
// missing finance values only hide the rate; the cash offer stays publishable.
// deno-lint-ignore-file no-explicit-any
export const CREDIT_WARNING = "Achtung! Kreditaufnahme kostet Geld.";
const ADDRESS_PLACEHOLDER = "[Anschrift der Bank eintragen]";

const clean = (v: unknown) => (v ?? "").toString().trim();
const num = (v: string) => {
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const eur = (v: unknown) => {
  const s = clean(v); if (!s) return "";
  if (/€|eur/i.test(s)) return s;
  const n = num(s); if (n == null) return s;
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};
const pct = (v: unknown) => { const s = clean(v); return !s ? "" : s.includes("%") ? s : `${s} %`; };
const months = (v: unknown) => { const s = clean(v); return !s ? "" : /monat/i.test(s) ? s : `${s} Monate`; };
const km = (v: unknown) => { const s = clean(v); return !s ? "" : /km/i.test(s) ? s : `${s} km`; };

export function offerType(vd: any): "leasing" | "financing" | "cash" {
  const c = clean(vd?.category).toLowerCase();
  if (c.includes("leasing")) return "leasing";
  if (c.includes("finanzierung") || c.includes("kredit")) return "financing";
  return "cash";
}

/** Leasing total = Sonderzahlung + Laufzeit × Monatsrate (only if all three are known). */
export function leasingTotal(vd: any): string {
  if (offerType(vd) !== "leasing") return "";
  const f = vd?.finance || {};
  const rate = num(clean(f.monthlyRate)); const n = Number(clean(f.duration).replace(/\D+/g, ""));
  const sp = clean(f.specialPayment) || clean(f.downPayment);
  const special = sp ? num(sp) : 0;
  if (rate == null || !n || special == null) return "";
  return eur(String(Math.round((special + rate * n) * 100) / 100).replace(".", ","));
}

/** Financing net loan = Fahrzeugpreis − Anzahlung (Anzahlung missing = 0). Never for leasing. */
export function netLoanFallback(vd: any): string {
  if (offerType(vd) !== "financing") return "";
  const f = vd?.finance || {};
  const price = num(clean(f.totalPrice)); if (price == null || !clean(f.totalPrice)) return "";
  const dp = clean(f.downPayment); const down = dp ? num(dp) : 0;
  if (down == null || down > price) return "";
  return eur(String(Math.round((price - down) * 100) / 100).replace(".", ","));
}

/** Bank name from a legal text like "Ein Angebot der Volkswagen Leasing GmbH, ..." */
export function bankFromLegalText(text: string): string {
  const m = clean(text).match(/\b(?:der|die|des)\s+([^,.\n]{3,80}?(?:GmbH|AG|S\.A\.|SE|Bank|Leasing|Financial Services?|N\.V\.)[^,\n]*?)(?=,|\.\s|\n|$)/i);
  return m ? m[1].trim() : "";
}

export function shortcodeValues(vd: any, bankName: string): Record<string, string> {
  const f = vd?.finance || {};
  const special = eur(f.specialPayment);
  const down = eur(f.downPayment) || special;
  return {
    bank_name: clean(bankName),
    fahrzeugpreis: eur(f.totalPrice),
    anzahlung: down,
    sonderzahlung: special || down,
    nettodarlehensbetrag: eur(f.netLoanAmount) || netLoanFallback(vd),
    laufzeit: months(f.duration),
    laufzeit_zahl: clean(f.duration).replace(/\D+/g, ""),
    monatsrate: eur(f.monthlyRate),
    schlussrate: eur(f.residualValue),
    fahrleistung: km(f.annualMileage),
    sollzins: pct(f.nominalInterestRate),
    effektiver_zins: pct(f.interestRate),
    gesamtbetrag: eur(f.totalAmount) || leasingTotal(vd),
    kundentyp: vd?.customerType === "business" ? "Gewerbekunden" : "Privatkunden",
  };
}

/** Replace shortcodes; clauses with unknown values are removed; no "{...}" ever remains. */
export function resolveBankPlaceholders(text: string, vd: any, bankName: string): string {
  if (!text) return "";
  const vals = shortcodeValues(vd, bankName);
  let out = text.replace(/(,\s*|^)([^,.{}]*?)\{([a-z_]+)\}([^,.{}]*?)(?=,|\.)/g, (_m, sep, pre, key, post) =>
    !vals[key] ? "" : `${sep}${pre}{${key}}${post}`);
  out = out.replace(/\{([a-z_]+)\}/g, (_m, key) => vals[key] || "");
  out = out.split(ADDRESS_PLACEHOLDER).join("").replace(/,\s*,/g, ",");
  return out.replace(/\s+,/g, ",").replace(/,\s*\./g, ".").replace(/[ \t]{2,}/g, " ").trim();
}

const REQUIRED: Record<"leasing" | "financing", [string, string][]> = {
  financing: [["fahrzeugpreis", "Fahrzeugpreis"], ["nettodarlehensbetrag", "Nettodarlehensbetrag"], ["laufzeit", "Laufzeit"], ["monatsrate", "Monatsrate"], ["sollzins", "Sollzins"], ["effektiver_zins", "Effektiver Jahreszins"], ["gesamtbetrag", "Gesamtbetrag"]],
  leasing: [["fahrzeugpreis", "Fahrzeugpreis"], ["laufzeit", "Laufzeit"], ["monatsrate", "Monatsrate"], ["fahrleistung", "Jährliche Fahrleistung"], ["gesamtbetrag", "Gesamtbetrag"]],
};

export function financingStatus(vd: any) {
  const type = offerType(vd);
  const dealer = vd?.dealer || {};
  const hasCashPrice = !!eur(vd?.finance?.totalPrice);
  if (type === "cash") {
    return { offerType: type, customerType: vd?.customerType === "business" ? "business" : "private", canPublishCash: hasCashPrice, canPublishFinancing: false, showRate: false, isComplete: true, computedFields: [] as string[], missingFields: [] as string[], missingLabels: [] as string[], creditWarning: null as string | null, representativeExample: false };
  }
  const legal = clean(type === "leasing" ? dealer.leasingLegalText : dealer.financingLegalText);
  const bank = clean(type === "leasing" ? dealer.leasingBank : dealer.financingBank) || bankFromLegalText(legal);
  const vals = shortcodeValues(vd, bank);
  const miss = REQUIRED[type].filter(([k]) => !vals[k]);
  if (!bank) miss.push(["bank_name", "Bank"]);
  if (!legal) miss.push(["legal_text", "Banktext"]);
  const complete = miss.length === 0;
  const f = vd?.finance || {};
  const computedFields: string[] = [];
  if (!eur(f.netLoanAmount) && vals.nettodarlehensbetrag && type === "financing") computedFields.push("nettodarlehensbetrag");
  if (!eur(f.totalAmount) && vals.gesamtbetrag) computedFields.push("gesamtbetrag");
  const b2c = type === "financing" && vd?.customerType !== "business";
  return {
    offerType: type,
    customerType: vd?.customerType === "business" ? "business" : "private",
    canPublishCash: hasCashPrice,
    canPublishFinancing: complete,
    showRate: complete,
    isComplete: complete,
    missingFields: miss.map(([k]) => k),
    missingLabels: miss.map(([, l]) => l),
    creditWarning: complete && b2c ? CREDIT_WARNING : null,
    representativeExample: complete && b2c,
    computedFields,
  };
}

const unit = (v: unknown, u: string) => { const s = clean(v); return !s ? null : s.toLowerCase().includes(u.toLowerCase().split("/")[0]) ? s : `${s} ${u}`; };
const cls = (v: unknown) => { const s = clean(v).toUpperCase().replace(/\+/g, ""); return /^[A-G]$/.test(s) ? s : null; };
const dec = (v: unknown) => clean(v).replace(/\s*(l|kwh|g|km)\b.*$/i, "").replace(".", ",");

export function buildEnvkv(vd: any) {
  const c = vd?.consumption || {};
  const fuel = clean(c.fuelType || vd?.vehicle?.fuelType);
  const isPhev = !!c.isPluginHybrid || /plug|phev/i.test(`${fuel} ${c.driveType || ""}`);
  const isBev = !isPhev && /elektro|electric|bev/i.test(fuel) && !/hybrid/i.test(fuel);
  const used = clean(c.mileage) && (num(clean(c.mileage)) ?? 0) > 1000;
  const status = clean(vd?.vehicle?.condition) || (used ? "Gebrauchtwagen" : "Neuwagen");
  const power = clean(c.power || vd?.vehicle?.power) || null;
  const w = {
    fuel: isBev ? null : unit(c.consumptionCombined, "l/100 km"),
    electric: (isBev || isPhev) ? unit(isBev ? (c.consumptionElectric || c.consumptionCombined) : c.consumptionElectric, "kWh/100 km") : null,
    co2: unit(c.co2Emissions, "g/km"),
    co2Class: cls(c.co2Class),
  };
  const discharged = isPhev ? {
    fuel: unit(c.consumptionCombinedDischarged, "l/100 km"),
    co2: unit(c.co2EmissionsDischarged, "g/km"),
    co2Class: cls(c.co2ClassDischarged),
  } : null;
  const missing: string[] = [];
  if (!w.co2) missing.push("co2Combined");
  if (!w.co2Class) missing.push("co2Class");
  if (!isBev && !w.fuel) missing.push("consumptionCombined");
  if ((isBev || isPhev) && !w.electric) missing.push("consumptionElectric");
  if (isPhev) {
    if (!discharged?.fuel) missing.push("consumptionCombinedDischarged");
    if (!discharged?.co2Class) missing.push("co2ClassDischarged");
  }
  const parts = [status];
  if (power) parts.push(power);
  if (isPhev) {
    parts.push(`${fuel || "Hybrid (Benzin/Elektro)"} ${dec(c.consumptionElectric)} kWh/100km + ${dec(c.consumptionCombined)} l/100km (gew. komb.), ${dec(c.consumptionCombinedDischarged)} l/100km (entladen, komb.)`);
    parts.push(`${dec(c.co2Emissions)} g CO₂/km (gew. komb.)`);
    parts.push(`CO₂-Klasse ${w.co2Class} (gew. komb.), ${discharged?.co2Class} (entladen, komb.)`);
  } else if (isBev) {
    parts.push(`${fuel || "Elektro"} ${dec(c.consumptionElectric || c.consumptionCombined)} kWh/100km (komb.)`);
    parts.push(`${dec(c.co2Emissions) || "0"} g CO₂/km (komb.)`, `CO₂-Klasse ${w.co2Class} (komb.)`);
  } else {
    parts.push(`${fuel} ${dec(c.consumptionCombined)} l/100km (komb.)`.trim());
    parts.push(`${dec(c.co2Emissions)} g CO₂/km (komb.)`, `CO₂-Klasse ${w.co2Class} (komb.)`);
  }
  return {
    isPhev, isBev, status, fuelType: fuel || null, power,
    wltpCombined: w, dischargedBattery: discharged,
    electricRange: (isPhev || isBev) ? unit(c.electricRange, "km") : null,
    isComplete: missing.length === 0, missingFields: missing,
    summaryText: missing.length === 0 ? parts.join(" • ") : null,
  };
}

/** Machine-readable price block for external consumers (numbers in EUR, null if unknown). */
export function buildPrice(vd: any) {
  const f = vd?.finance || {};
  const toNum = (v: unknown) => { const s = clean(v); return s ? num(s) : null; };
  const status = financingStatus(vd);
  const cash = toNum(f.totalPrice);
  const rate = toNum(f.monthlyRate);
  return {
    currency: "EUR",
    cashPrice: cash,
    cashPriceFormatted: cash != null ? eur(f.totalPrice) : null,
    monthlyRate: status.showRate ? rate : null,
    monthlyRateFormatted: status.showRate && rate != null ? eur(f.monthlyRate) : null,
    source: "vehicle_data.finance.totalPrice",
  };
}

/** Legacy plugins read vehicle_data.finance directly: fill empty totalAmount/netLoanAmount with computed values. */
export function withComputedFinance(vd: any): any {
  if (!vd?.finance) return vd;
  const f = vd.finance;
  const total = eur(f.totalAmount) ? f.totalAmount : leasingTotal(vd);
  const net = eur(f.netLoanAmount) ? f.netLoanAmount : (offerType(vd) === "financing" ? netLoanFallback(vd) : f.netLoanAmount);
  return { ...vd, finance: { ...f, totalAmount: total || f.totalAmount || "", ...(net !== undefined ? { netLoanAmount: net || "" } : {}) } };
}
