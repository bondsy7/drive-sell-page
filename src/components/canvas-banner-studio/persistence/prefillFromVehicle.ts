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

  // Subline: Hook mit Firmen-Shortcode
  let subline: string | undefined;
  if (offer === "leasing") subline = "Leasingangebot von {{firma}}";
  else if (offer === "finanzierung") subline = "Top-Finanzierung von {{firma}}";
  else subline = "Hauspreis bei {{firma}}";

  // Price
  const cashPrice = pick(d, "pricing.cash_price", "price", "vehicle.price", "barpreis", "finance.total_price");
  const monthly = pick(d, "financing.monthly_rate", "leasing.monthly_rate", "finance.monthly_rate", "monthly_rate");
  let price: string | undefined;
  if ((offer === "leasing" || offer === "finanzierung") && monthly) {
    price = `ab ${fmtEUR(monthly) ?? monthly} mtl.${vat}`;
  } else if (cashPrice) {
    price = `${fmtEUR(cashPrice) ?? cashPrice}${vat}`;
  }

  // smallInfo: Faktencluster
  const parts: string[] = [];
  if (offer === "leasing" || offer === "finanzierung") {
    const duration = pick(d, "financing.duration", "leasing.duration", "finance.duration");
    const annualKm = pick(d, "financing.annual_mileage", "leasing.annual_mileage", "finance.annual_mileage");
    const down = pick(d, "financing.down_payment", "leasing.special_payment", "finance.down_payment", "finance.special_payment");
    if (duration) parts.push(String(duration).replace(/\bMonate?\b/i, "Mon."));
    if (annualKm) parts.push(String(annualKm).replace(/\s*km\s*\/\s*jahr/i, " km"));
    if (down) parts.push(`${fmtEUR(down) ?? down} Anzahlung`);
    else if (offer === "leasing") parts.push("0 € Anzahlung");
  } else {
    if (year) parts.push(`EZ ${String(year).slice(-4)}`);
    if (mileageRaw) parts.push(`${String(mileageRaw).replace(/\s*km.*$/i, "")} km`);
    const ps = powerPs || (power ? String(power).match(/(\d+)\s*PS/i)?.[1] : undefined);
    if (ps) parts.push(`${ps} PS`);
  }
  const smallInfo = parts.filter(Boolean).join(" · ").slice(0, 70) || undefined;

  // CTA
  const cta = offer === "barkauf" ? "Jetzt Probefahrt!" : "Jetzt sichern!";

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
