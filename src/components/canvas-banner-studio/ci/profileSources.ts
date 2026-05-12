// Profile- und Vehicle-Quellen → CI-Kontext für Shortcodes & Defaults.

import type { Vehicle } from "@/hooks/useVehicles";

export type DealerProfile = {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  website?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  default_legal_text?: string | null;
};

export type CiContext = {
  firma: string;
  telefon: string;
  whatsapp: string;
  website: string;
  email: string;
  adresse: string;
  stadt: string;
  plz: string;
  marke: string;
  modell: string;
  preis: string;
  rate: string;
  laufzeit: string;
  anzahlung: string;
  ez: string;          // Erstzulassung
  km: string;          // Kilometerstand
  leistung: string;    // PS / kW
  kraftstoff: string;
  getriebe: string;
};

function s(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function pick(d: any, ...paths: string[]): string {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = d;
    for (const part of parts) {
      if (cur && typeof cur === "object" && part in cur) cur = cur[part];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && String(cur).trim() !== "") return String(cur).trim();
  }
  return "";
}

export function buildCiContext(profile?: DealerProfile | null, vehicle?: Vehicle | null): CiContext {
  const d = vehicle?.vehicle_data || {};
  return {
    firma: s(profile?.company_name) || s(profile?.contact_name),
    telefon: s(profile?.phone),
    whatsapp: s(profile?.whatsapp_number),
    website: s(profile?.website),
    email: s(profile?.email),
    adresse: s(profile?.address),
    stadt: s(profile?.city),
    plz: s(profile?.postal_code),
    marke: s(vehicle?.brand) || pick(d, "vehicle.brand", "brand"),
    modell: s(vehicle?.model) || pick(d, "vehicle.model", "model"),
    preis: pick(d, "pricing.cash_price", "vehicle.price", "price"),
    rate: pick(d, "financing.monthly_rate", "leasing.monthly_rate"),
    laufzeit: pick(d, "financing.duration", "leasing.duration"),
    anzahlung: pick(d, "financing.down_payment", "leasing.down_payment"),
    ez: pick(d, "vehicle.first_registration", "vehicle.ez", "first_registration", "ez"),
    km: pick(d, "vehicle.mileage", "consumption.mileage", "mileage", "km"),
    leistung: pick(d, "vehicle.power", "consumption.power", "power", "leistung"),
    kraftstoff: pick(d, "vehicle.fuel_type", "consumption.fuelType", "fuelType", "kraftstoff"),
    getriebe: pick(d, "vehicle.gearbox", "consumption.gearboxType", "gearboxType", "getriebe"),
  };
}
