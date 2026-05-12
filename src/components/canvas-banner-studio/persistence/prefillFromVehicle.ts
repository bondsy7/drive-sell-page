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

function fmtPrice(raw?: string | number): string | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.,]/g, "").replace(",", "."));
  if (!isFinite(n) || n <= 0) return typeof raw === "string" ? raw : undefined;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export interface PrefillResult {
  textFields: Partial<BannerTextFields>;
  /** Suggested manufacturer logo path (if brand resolvable). */
  manufacturerLogoUrl?: string;
}

export function buildPrefillFromVehicle(
  vehicle: Vehicle,
  opts: { dealerName?: string; getLogoForMake?: (key: string) => string | null } = {},
): PrefillResult {
  const d = vehicle.vehicle_data || {};
  const brand = vehicle.brand || pick(d, "vehicle.brand", "brand");
  const model = vehicle.model || pick(d, "vehicle.model", "model");
  const variant = pick(d, "vehicle.variant", "variant", "trim");
  const year = vehicle.year || pick(d, "vehicle.year", "year", "first_registration");
  const mileage = pick(d, "vehicle.mileage", "mileage", "kilometers");
  const condition = pick(d, "vehicle.condition", "condition", "vehicle_state") || "Gebrauchtwagen";

  const headline = [brand, model].filter(Boolean).join(" ").trim().toUpperCase() || undefined;
  const subline = variant || (year ? `Baujahr ${year}` : undefined);

  const cashPrice = pick(d, "pricing.cash_price", "price", "vehicle.price", "barpreis");
  const monthly = pick(d, "financing.monthly_rate", "leasing.monthly_rate", "monthly_rate");
  const price = monthly ? `ab ${fmtPrice(monthly) ?? monthly} mtl.` : fmtPrice(cashPrice);

  // Mandatory disclosure
  const drv: MandatoryDisclosureInput = {
    condition,
    powerKw: pick(d, "engine.power_kw", "power_kw", "kw"),
    powerPs: pick(d, "engine.power_ps", "power_ps", "ps", "hp"),
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
  if (mileage) textFields.smallInfo = `${mileage} km`;
  if (legalText) textFields.legalText = legalText;

  return { textFields, manufacturerLogoUrl };
}
