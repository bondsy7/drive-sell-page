import type { Vehicle } from "@/hooks/useVehicles";
import type { BannerTextFields } from "../state/types";
import {
  formatMandatoryDisclosure,
  type MandatoryDisclosureInput,
} from "@/lib/mandatory-disclosure";

/** Best-effort string lookup over nested vehicle_data. */
function pick(data: any, ...paths: string[]): string | undefined {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = data;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && String(cur).trim() !== "") {
      return String(cur).trim();
    }
  }
  return undefined;
}

function fmtEUR(raw?: string | number): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number"
    ? raw
    : parseFloat(String(raw).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return typeof raw === "string" ? raw : undefined;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

type OfferType = "leasing" | "finanzierung" | "barkauf";

function detectOfferType(d: any): OfferType {
  const cat = String(pick(d, "category", "finance.type", "financing.type", "offer_type") ?? "").toLowerCase();
  if (cat.includes("leasing")) return "leasing";
  if (cat.includes("finanz") || cat.includes("kredit")) return "finanzierung";
  if (cat.includes("bar") || cat.includes("kauf")) return "barkauf";
  if (pick(d, "leasing.monthly_rate", "finance.residual_value", "finance.special_payment")) return "leasing";
  if (pick(d, "financing.monthly_rate", "finance.monthly_rate", "finance.interest_rate")) return "finanzierung";
  return "barkauf";
}

export interface PrefillResult {
  textFields: Partial<BannerTextFields>;
  manufacturerLogoUrl?: string;
}

export function buildPrefillFromVehicle(
  vehicle: Vehicle,
  opts: { dealerName?: string; getLogoForMake?: (key: string) => string | null } = {},
): PrefillResult {
  const d = vehicle.vehicle_data || {};
  const brand = vehicle.brand || pick(d, "vehicle.brand", "brand");
  const model = vehicle.model || pick(d, "vehicle.model", "model");
  const year = vehicle.year || pick(d, "vehicle.year", "year", "first_registration");
  const mileageRaw = pick(d, "vehicle.mileage", "mileage", "kilometers");
  const condition = pick(d, "vehicle.condition", "condition", "vehicle_state") || "Gebrauchtwagen";
  const powerPs = pick(d, "engine.power_ps", "power_ps", "ps", "hp", "vehicle.power_ps");
  const power = pick(d, "engine.power", "vehicle.power", "power");
  const customerType = String(pick(d, "customer_type", "customerType") ?? "private").toLowerCase();
  const vat = customerType === "business" ? " zzgl. MwSt." : "";

  const headline = [brand, model].filter(Boolean).join(" ").trim().toUpperCase().slice(0, 28) || undefined;

  const offer = detectOfferType(d);

  // Daten für Subline-Logik
  const cashPrice = pick(d, "pricing.cash_price", "price", "vehicle.price", "barpreis", "finance.total_price");
  const monthly = pick(d, "financing.monthly_rate", "leasing.monthly_rate", "finance.monthly_rate", "monthly_rate");
  const durationRaw = pick(d, "financing.duration", "leasing.duration", "finance.duration");
  const durationMonths = durationRaw ? (String(durationRaw).match(/\d+/)?.[0]) : undefined;
  const annualKmRaw = pick(d, "financing.annual_mileage", "leasing.annual_mileage", "finance.annual_mileage");
  const downRaw = pick(d, "financing.down_payment", "leasing.special_payment", "finance.down_payment", "finance.special_payment");
  const interestRate = pick(d, "financing.interest_rate", "finance.interest_rate", "finance.nominal_interest_rate", "finance.effective_interest_rate");
  const finalRate = pick(d, "financing.final_rate", "finance.final_rate", "finance.balloon");
  const listPrice = pick(d, "pricing.list_price", "vehicle.list_price", "list_price", "uvp");
  const savings = pick(d, "pricing.savings", "vehicle.savings", "savings", "preisvorteil");
  const fmtMonthly = monthly ? (fmtEUR(monthly) ?? monthly) : undefined;
  const fmtDown = downRaw ? (fmtEUR(downRaw) ?? downRaw) : undefined;

  // Subline: kontextabhängig, mit {{firma}}
  let subline: string | undefined;
  if (offer === "leasing") {
    if (fmtMonthly && durationMonths) subline = `Leasing ab ${fmtMonthly} mtl. bei ${durationMonths} Monaten`;
    else if (fmtDown) subline = `Leasing mit ${fmtDown} Anzahlung bei {{firma}}`;
    else if (customerType === "business") subline = "Gewerbeleasing mit attraktiven Raten bei {{firma}}";
    else if (downRaw === undefined || /^0/.test(String(downRaw))) subline = "Leasing ohne Anzahlung bei {{firma}}";
    else subline = "Attraktives Leasingangebot von {{firma}}";
  } else if (offer === "finanzierung") {
    if (fmtMonthly && durationMonths) subline = `Finanzierung ab ${fmtMonthly} mtl. bei ${durationMonths} Monaten`;
    else if (interestRate) subline = `Finanzierung ab ${String(interestRate).replace(/\s+/g, "")} eff. Jahreszins`;
    else if (finalRate) subline = "Flexible Finanzierung mit Schlussrate bei {{firma}}";
    else if (fmtDown) subline = `Finanzierung mit ${fmtDown} Anzahlung bei {{firma}}`;
    else subline = "Finanzierung mit starken Konditionen bei {{firma}}";
  } else {
    if (savings) subline = `Jetzt mit ${fmtEUR(savings) ?? savings} Preisvorteil bei {{firma}}`;
    else if (listPrice) subline = `Statt ${fmtEUR(listPrice) ?? listPrice} Listenpreis bei {{firma}}`;
    else subline = "Sofort verfügbar bei {{firma}}";
  }

  // Price-Zeile
  let price: string | undefined;
  if ((offer === "leasing" || offer === "finanzierung") && fmtMonthly) {
    price = `ab ${fmtMonthly} mtl.${vat}`;
  } else if (cashPrice) {
    const cp = fmtEUR(cashPrice) ?? cashPrice;
    price = offer === "barkauf" ? `Barpreis ${cp}${vat}` : `${cp}${vat}`;
  }

  // smallInfo: Faktencluster
  const parts: string[] = [];
  if (offer === "leasing" || offer === "finanzierung") {
    if (durationRaw) parts.push(String(durationRaw).replace(/\bMonate?\b/i, "Mon."));
    if (annualKmRaw) parts.push(String(annualKmRaw).replace(/\s*km\s*\/\s*jahr/i, " km"));
    if (fmtDown) parts.push(`${fmtDown} Anzahlung`);
    else if (offer === "leasing") parts.push("0 € Anzahlung");
  } else {
    if (year) parts.push(`EZ ${String(year).slice(-4)}`);
    if (mileageRaw) parts.push(`${String(mileageRaw).replace(/\s*km.*$/i, "")} km`);
    const ps = powerPs || (power ? String(power).match(/(\d+)\s*PS/i)?.[1] : undefined);
    if (ps) parts.push(`${ps} PS`);
  }
  const smallInfo = parts.filter(Boolean).join(" · ").slice(0, 70) || undefined;

  // CTA – kontextabhängig
  let cta: string;
  if (offer === "leasing") cta = fmtMonthly ? "Jetzt Rate sichern" : "Leasing anfragen";
  else if (offer === "finanzierung") cta = fmtMonthly ? "Jetzt finanzieren" : "Rate berechnen";
  else cta = "Jetzt sichern";

  // Mandatory disclosure
  const drv: MandatoryDisclosureInput = {
    condition,
    powerKw: pick(d, "engine.power_kw", "power_kw", "kw"),
    powerPs: powerPs,
    fuelType: pick(d, "engine.fuel_type", "fuel_type", "fuel"),
    driveType: pick(d, "engine.drive_type", "drive_type"),
    consumptionCombined: pick(d, "consumption.combined", "consumption_combined"),
    consumptionElectric: pick(d, "consumption.electric_combined", "consumption_electric"),
    consumptionCombinedDischarged: pick(d, "consumption.combined_discharged"),
    co2Emissions: pick(d, "emissions.co2_combined", "co2_combined", "co2"),
    co2EmissionsDischarged: pick(d, "emissions.co2_discharged"),
    co2Class: pick(d, "emissions.co2_class", "co2_class"),
    co2ClassDischarged: pick(d, "emissions.co2_class_discharged"),
  };
  let legalText: string | undefined;
  try {
    const formatted = formatMandatoryDisclosure(drv);
    if (formatted && formatted.trim()) {
      legalText = opts.dealerName ? `${formatted} · Ein Angebot der ${opts.dealerName}.` : formatted;
    }
  } catch {
    /* noop */
  }

  // Manufacturer logo
  let manufacturerLogoUrl: string | undefined;
  if (brand && opts.getLogoForMake) {
    const key = brand.toLowerCase().replace(/\s+/g, "-");
    const url = opts.getLogoForMake(key) || opts.getLogoForMake(brand.toLowerCase());
    if (url) manufacturerLogoUrl = url;
  }

  const textFields: Partial<BannerTextFields> = {};
  if (headline) textFields.headline = headline;
  if (subline) textFields.subline = subline;
  if (price) textFields.price = price;
  if (cta) textFields.cta = cta;
  if (smallInfo) textFields.smallInfo = smallInfo;
  if (legalText) textFields.legalText = legalText;

  return { textFields, manufacturerLogoUrl };
}
