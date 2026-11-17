// Offer compliance for external consumers (WordPress plugin via api-vehicles).
// Mirrors src/lib/bank-legal-template.ts so the app and the plugin decide identically:
// missing finance values only hide the rate; the cash offer stays publishable.
// deno-lint-ignore-file no-explicit-any
export const CREDIT_WARNING = "Achtung! Kreditaufnahme kostet Geld.";
const ADDRESS_PLACEHOLDER = "[Anschrift der Bank eintragen]";

const clean = (v: unknown) => (v ?? "").toString().trim();
const num = (v: string) => {
  // Read only the numeric amount. Stripping letters alone would retain the dots
  // from "mtl." and turn valid values such as "249,00 €/mtl." into NaN.
  const match = v.replace(/\u00a0/g, " ").match(/-?\d[\d\s.]*(?:,\d+|,-)?/);
  if (!match) return null;
  const n = Number(match[0].replace(/,-(?!\d)/g, ",00").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** One canonical monthly rate for legacy API fields and WordPress price detection. */
export function formatMonthlyRate(v: unknown): string {
  const raw = clean(v);
  if (!raw) return "";
  const match = raw.replace(/\u00a0/g, " ").match(/\d[\d\s.]*(?:,\d+|,-)?/);
  if (!match) return raw;
  const amount = match[0].replace(/\s+/g, "").replace(/,-$/, ",00").replace(/[.,]$/, "");
  return `${amount} €/mtl.`;
}
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
    monatsrate: offerType(vd) === "cash" ? eur(f.monthlyRate) : formatMonthlyRate(eur(f.monthlyRate)),
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

export function buildLegalNotice(vd: any) {
  const dealer = (vd?.dealer as Record<string, any>) || {};
  const category = clean(vd?.category).toLowerCase();
  const isLeasing = category.includes("leasing");
  const isFinancing = category.includes("finanzierung") || category.includes("kredit");

  let type: "leasing" | "financing" | "default" | null = null;
  let text = "";
  let bank = "";
  if (isLeasing && dealer.leasingLegalText) {
    type = "leasing";
    text = clean(dealer.leasingLegalText);
    bank = clean(dealer.leasingBank);
  } else if (isFinancing && dealer.financingLegalText) {
    type = "financing";
    text = clean(dealer.financingLegalText);
    bank = clean(dealer.financingBank);
  } else if (dealer.defaultLegalText) {
    type = "default";
    text = clean(dealer.defaultLegalText);
  }
  if (!text && !bank) return null;
  const status = financingStatus(vd);
  return {
    rawText: text,
    warning: status.creditWarning,
    showFinanceText: type === "default" || status.showRate,
    label: "Bankangaben / Pflichthinweise",
    type,
    bank: bank || null,
    text: resolveBankPlaceholders(text, vd, bank),
    // Jeder ausgegebene Banktext gehört zur Fußnote 1 – unabhängig von der Angebotsart.
    footnoteMarker: "1",
  };
}

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
    monthlyRateFormatted: status.showRate && rate != null ? formatMonthlyRate(eur(f.monthlyRate)) : null,
    source: "vehicle_data.finance.totalPrice",
  };
}

/** Legacy plugins read vehicle_data.finance directly: fill empty totalAmount/netLoanAmount with computed values. */
export function withComputedFinance(vd: any): any {
  if (!vd?.finance) return vd;
  const f = vd.finance;
  const total = eur(f.totalAmount) ? f.totalAmount : leasingTotal(vd);
  const net = eur(f.netLoanAmount) ? f.netLoanAmount : (offerType(vd) === "financing" ? netLoanFallback(vd) : f.netLoanAmount);
  const monthlyRate = offerType(vd) === "cash" ? f.monthlyRate : formatMonthlyRate(f.monthlyRate);
  const out = { ...vd, finance: { ...f, monthlyRate, totalAmount: total || f.totalAmount || "", ...(net !== undefined ? { netLoanAmount: net || "" } : {}) } };
  // Legacy plugins read vehicle_data.vehicle.price although PDF offers store the
  // price in finance.totalPrice. Mirror it only when no explicit vehicle price exists.
  if (!clean(out.vehicle?.price) && clean(f.totalPrice)) {
    out.vehicle = { ...(out.vehicle || {}), price: f.totalPrice };
  }
  // Legacy plugins print dealer.*LegalText verbatim: deliver resolved text (template stays in legalNotice.rawText).
  const d = vd?.dealer;
  if (d) {
    out.dealer = { ...d };
    if (d.leasingLegalText) out.dealer.leasingLegalText = resolveBankPlaceholders(String(d.leasingLegalText), out, clean(d.leasingBank) || bankFromLegalText(String(d.leasingLegalText)));
    if (d.financingLegalText) out.dealer.financingLegalText = resolveBankPlaceholders(String(d.financingLegalText), out, clean(d.financingBank) || bankFromLegalText(String(d.financingLegalText)));
    if (d.defaultLegalText) out.dealer.defaultLegalText = resolveBankPlaceholders(String(d.defaultLegalText), out, "");
  }
  return out;
}

// ─── Dealer-facing offer check (API contract for the WordPress plugin) ───────
// One server-side verdict per project so the plugin never re-derives prices or
// guesses error causes: it only renders `offerCheck.issues` for the dealer.
export const OFFER_CHECK_VERSION = 1;

export type OfferIssue = {
  code: string;
  severity: "error" | "warning";
  area: "offer_type" | "price" | "rate" | "bank" | "envkv";
  field: string;
  label: string;
  message: string;
  fix: string;
  value?: string | null;
};

const FINANCE_FIELD_LABELS: Record<string, string> = {
  fahrzeugpreis: "Fahrzeugpreis",
  nettodarlehensbetrag: "Nettodarlehensbetrag",
  laufzeit: "Laufzeit",
  monatsrate: "Monatsrate",
  sollzins: "Sollzins",
  effektiver_zins: "Effektiver Jahreszins",
  gesamtbetrag: "Gesamtbetrag",
  fahrleistung: "Jährliche Fahrleistung",
  bank_name: "Bank",
  legal_text: "Banktext",
};

const ENVKV_FIELD_LABELS: Record<string, string> = {
  co2Combined: "CO₂-Emissionen (kombiniert)",
  co2Class: "CO₂-Klasse",
  consumptionCombined: "Kraftstoffverbrauch (kombiniert)",
  consumptionElectric: "Stromverbrauch (kombiniert)",
  consumptionCombinedDischarged: "Kraftstoffverbrauch bei entladener Batterie",
  co2ClassDischarged: "CO₂-Klasse bei entladener Batterie",
};

const digitsOf = (v: string) => (num(v) == null ? "" : (Math.round((num(v) as number) * 100)).toString());

/** Classifies what a project is, so landing pages and photo-only projects are never checked as offers. */
export function projectKind(vd: any, templateId?: string | null): "offer" | "landing_page" | "media_only" {
  if (clean(templateId) === "landing-page") return "landing_page";
  const f = vd?.finance;
  const hasFinanceValue = !!f && typeof f === "object" && Object.values(f).some((v) => clean(v) !== "");
  if (!clean(vd?.category) && !hasFinanceValue) return "media_only";
  return "offer";
}

export function buildOfferCheck(vd: any, templateId?: string | null) {
  const kind = projectKind(vd, templateId);
  const f = vd?.finance || {};
  const status = financingStatus(vd);
  const price = buildPrice(vd);
  const rawCategory = clean(vd?.category);
  const values = {
    offerType: status.offerType,
    category: rawCategory || null,
    cashPrice: price.cashPrice,
    cashPriceFormatted: price.cashPriceFormatted,
    cashPriceRaw: clean(f.totalPrice) || null,
    monthlyRate: price.monthlyRate,
    monthlyRateFormatted: price.monthlyRateFormatted,
    showRate: status.showRate,
  };
  if (kind !== "offer") {
    return {
      version: OFFER_CHECK_VERSION, kind, status: "not_an_offer" as const,
      publishable: false, rateVisible: false, values, issues: [] as OfferIssue[],
      summary: kind === "landing_page" ? "SEO-Landingpage – kein Fahrzeugangebot, keine Preisprüfung." : "Nur Fahrzeugbilder – kein Fahrzeugangebot, keine Preisprüfung.",
    };
  }

  const issues: OfferIssue[] = [];
  const add = (i: OfferIssue) => issues.push(i);
  const rawRate = clean(f.monthlyRate);

  // 1) Angebotsart
  const known = /leasing|finanzierung|kredit|barkauf|kauf|bar/i.test(rawCategory);
  if (!rawCategory && rawRate) {
    add({ code: "offer_type_missing", severity: "warning", area: "offer_type", field: "category", label: "Angebotsart",
      message: "Angebotsart fehlt – das Angebot wird als Barkauf angezeigt, die eingetragene Monatsrate bleibt ausgeblendet.",
      fix: "Im Angebot die Angebotsart Leasing, Finanzierung oder Barkauf auswählen.", value: null });
  } else if (rawCategory && !known) {
    add({ code: "offer_type_unknown", severity: "warning", area: "offer_type", field: "category", label: "Angebotsart",
      message: `Angebotsart „${rawCategory}“ ist unbekannt – das Angebot wird als Barkauf angezeigt.`,
      fix: "Im Angebot die Angebotsart Leasing, Finanzierung oder Barkauf auswählen.", value: rawCategory });
  }

  // 2) Barpreis
  const rawPrice = clean(f.totalPrice);
  if (!rawPrice) {
    add({ code: "cash_price_missing", severity: status.offerType === "cash" ? "error" : "warning", area: "price", field: "finance.totalPrice", label: "Fahrzeugpreis",
      message: status.offerType === "cash" ? "Fahrzeugpreis fehlt – das Angebot kann ohne Preis nicht veröffentlicht werden." : "Fahrzeugpreis fehlt – er wird im Angebot und im Banktext benötigt.",
      fix: "Im Angebot den Fahrzeugpreis (Barpreis) eintragen.", value: null });
  } else if (price.cashPrice == null) {
    add({ code: "cash_price_unreadable", severity: "error", area: "price", field: "finance.totalPrice", label: "Fahrzeugpreis",
      message: `Fahrzeugpreis „${rawPrice}“ enthält keinen lesbaren Betrag.`,
      fix: "Im Angebot den Fahrzeugpreis als Betrag eintragen, z. B. 34.669,20.", value: rawPrice });
  }

  // 3) Rate / Bankangaben (nur Leasing & Finanzierung)
  if (status.offerType !== "cash") {
    if (rawRate && num(rawRate) == null) {
      add({ code: "monthly_rate_unreadable", severity: "warning", area: "rate", field: "finance.monthlyRate", label: "Monatsrate",
        message: `Monatsrate „${rawRate}“ enthält keinen lesbaren Betrag – die Rate wird ausgeblendet.`,
        fix: "Im Angebot nur den Betrag eintragen, z. B. 249,00 – „€/mtl.“ wird automatisch ergänzt.", value: rawRate });
    }
    for (let i = 0; i < status.missingFields.length; i++) {
      const key = status.missingFields[i];
      if (key === "fahrzeugpreis" && !rawPrice) continue; // already reported as cash_price_missing
      if (key === "monatsrate" && rawRate && num(rawRate) == null) continue;
      const isBank = key === "bank_name" || key === "legal_text";
      const label = FINANCE_FIELD_LABELS[key] || status.missingLabels[i] || key;
      add({ code: isBank ? `bank_${key}_missing` : `finance_${key}_missing`, severity: "warning", area: isBank ? "bank" : "rate", field: key, label,
        message: `${label} fehlt – die Monatsrate wird ausgeblendet, der Barpreis bleibt sichtbar.`,
        fix: isBank ? `Im Profil unter Banken die ${status.offerType === "leasing" ? "Leasing" : "Finanzierungs"}bank und den Banktext hinterlegen.` : `Im Angebot unter ${status.offerType === "leasing" ? "Leasing" : "Finanzierung"} „${label}“ eintragen.`,
        value: null });
    }
    // Banktext muss die gezeigten Pflichtbeträge tatsächlich nennen.
    if (status.showRate) {
      const notice = buildLegalNotice(vd);
      const text = clean(notice?.text);
      const vals = shortcodeValues(vd, clean(notice?.bank));
      const amountsInText = (text.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) || []).map(digitsOf);
      const mentions = (amount: string) => { const d = digitsOf(amount); return !d || amountsInText.includes(d); };
      for (const [key, placeholder] of [["gesamtbetrag", "{gesamtbetrag}"], ["monatsrate", "{monatsrate}"]] as const) {
        if (text && vals[key] && !mentions(vals[key])) {
          add({ code: `bank_text_${key}_not_mentioned`, severity: "warning", area: "bank", field: "legal_text", label: "Banktext",
            message: `Der Banktext nennt ${key === "gesamtbetrag" ? "den Gesamtbetrag" : "die Monatsrate"} (${vals[key]}) nicht.`,
            fix: `Im Profil unter Banken im Banktext den Platzhalter ${placeholder} einfügen.`, value: vals[key] });
        }
      }
    }
  }

  // 4) Pkw-EnVKV
  const envkv = buildEnvkv(vd);
  const isUsed = /gebraucht/i.test(envkv.status);
  for (const key of envkv.missingFields) {
    const label = ENVKV_FIELD_LABELS[key] || key;
    add({ code: `envkv_${key}_missing`, severity: isUsed ? "warning" : "error", area: "envkv", field: `consumption.${key}`, label,
      message: `${label} fehlt – Pflichtangabe nach Pkw-EnVKV.`,
      fix: `Im Angebot unter Verbrauch/CO₂ „${label}“ eintragen.`, value: null });
  }

  const hasError = issues.some((i) => i.severity === "error");
  const publishable = price.cashPrice != null && !issues.some((i) => i.area === "price" && i.severity === "error");
  return {
    version: OFFER_CHECK_VERSION, kind, status: issues.length ? "incomplete" as const : "ok" as const,
    publishable, rateVisible: status.showRate, values, issues,
    summary: issues.length === 0 ? "Alle Angaben vollständig." : `${issues.length} Angabe${issues.length === 1 ? "" : "n"} prüfen${hasError ? " (Pflicht)" : ""}: ${issues.map((i) => i.label).filter((l, i, a) => a.indexOf(l) === i).join(", ")}.`,
  };
}
