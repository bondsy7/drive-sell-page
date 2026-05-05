/**
 * Shared mappers that turn loose data blobs (datasheet OCR, VIN lookup, PDF analysis)
 * into the nested { vehicle: {...}, consumption: {...} } shape stored in
 * `vehicles.vehicle_data`. Used by every flow so the Daten-Tab is always populated.
 */

import { supabase } from '@/integrations/supabase/client';
import { ensureVehicle } from '@/lib/vehicle-utils';
import type { VehicleData } from '@/types/vehicle';

/* ── Generic helpers ─────────────────────────────────────── */
const pick = (...vals: unknown[]): string | undefined => {
  for (const v of vals) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return undefined;
};

/* ── ScanData (analyze-offer-image) → VehicleData ──────── */
export function scanDataToVehicleData(ext: Record<string, any>): VehicleData {
  const vehicle: Record<string, any> = {};
  const consumption: Record<string, any> = {};

  vehicle.vin = pick(ext.vin);
  vehicle.brand = pick(ext.brand);
  vehicle.model = pick(ext.model);
  vehicle.variant = pick(ext.variant, ext.trim);
  vehicle.year = pick(ext.year);
  vehicle.color = pick(ext.color, ext.exteriorColor);
  vehicle.power = pick(ext.power);
  vehicle.fuelType = pick(ext.fuelType);
  vehicle.transmission = pick(ext.transmission);
  vehicle.mileage = pick(ext.mileage, ext.mileageKm);
  vehicle.firstRegistration = pick(ext.firstRegistration);
  vehicle.condition = pick(ext.condition);

  consumption.consumptionCombined = pick(ext.consumptionCombined);
  consumption.consumptionCity = pick(ext.consumptionCity);
  consumption.consumptionHighway = pick(ext.consumptionHighway);
  consumption.co2Emissions = pick(ext.co2Emissions);
  consumption.co2Class = pick(ext.co2Class);
  consumption.co2ClassDischarged = pick(ext.co2ClassDischarged);
  consumption.consumptionCombinedDischarged = pick(ext.consumptionCombinedDischarged);
  consumption.electricRange = pick(ext.electricRange, ext.wltpRange);
  consumption.energyCostPerYear = pick(ext.energyCostPerYear);
  consumption.vehicleTax = pick(ext.vehicleTax);

  // Strip empty subfields
  for (const k of Object.keys(vehicle)) if (vehicle[k] == null) delete vehicle[k];
  for (const k of Object.keys(consumption)) if (consumption[k] == null) delete consumption[k];

  const out: any = {};
  if (Object.keys(vehicle).length) out.vehicle = vehicle;
  if (Object.keys(consumption).length) out.consumption = consumption;
  if (Array.isArray(ext.features) && ext.features.length) out.equipment = ext.features;
  if (ext.price) out.price = ext.price;
  if (ext.monthlyRate) out.monthlyRate = ext.monthlyRate;
  if (ext.duration) out.duration = ext.duration;
  if (ext.downPayment) out.downPayment = ext.downPayment;
  if (ext.dealer) out.dealer = ext.dealer;
  if (ext.location) out.location = ext.location;
  return out as VehicleData;
}

/* ── VIN-Lookup result → VehicleData ────────────────────── */
export function vinLookupToVehicleData(v: Record<string, any>, vin?: string): VehicleData {
  const vehicle: Record<string, any> = {};
  vehicle.vin = pick(vin, v.vin);
  vehicle.brand = pick(v.make, v.brand);
  vehicle.model = pick(v.model);
  vehicle.variant = pick(v.trim, v.variant);
  vehicle.year = pick(v.year, v.modelYear);
  vehicle.color = pick(v.color, v.exteriorColor);
  vehicle.fuelType = pick(v.fuelType);
  vehicle.transmission = pick(v.transmission);
  vehicle.power = pick(v.power, v.electricMotorPower);
  vehicle.displacement = pick(v.displacement);
  vehicle.cylinders = pick(v.cylinders);
  vehicle.bodyType = pick(v.bodyType);
  vehicle.doors = pick(v.doors);
  vehicle.seats = pick(v.seats);

  for (const k of Object.keys(vehicle)) if (vehicle[k] == null) delete vehicle[k];

  const out: any = {};
  if (Object.keys(vehicle).length) out.vehicle = vehicle;
  if (Array.isArray(v.equipment) && v.equipment.length) out.equipment = v.equipment;
  return out as VehicleData;
}

/* ── Persisters ─────────────────────────────────────────── */

/**
 * Persist a scan/lookup blob to the user's vehicle row (VIN-keyed).
 * Returns the vehicle id, or null when no usable VIN was provided.
 * Silently no-ops without VIN — the same data still lives in component state.
 */
export async function persistScanToVehicle(
  userId: string | null | undefined,
  vin: string | null | undefined,
  data: VehicleData,
): Promise<string | null> {
  if (!userId) return null;
  const cleanVin = (vin || (data as any)?.vehicle?.vin || '').toString().trim().toUpperCase();
  if (!cleanVin || cleanVin.length < 5) return null;
  try {
    return await ensureVehicle(userId, cleanVin, data, null);
  } catch (e) {
    console.warn('[persistScanToVehicle] failed:', e);
    return null;
  }
}

/** Convenience: scan-data straight to DB. */
export async function persistScanData(
  userId: string | null | undefined,
  vin: string | null | undefined,
  ext: Record<string, any>,
): Promise<string | null> {
  return persistScanToVehicle(userId, vin, scanDataToVehicleData(ext));
}

/** Convenience: VIN-lookup result straight to DB. */
export async function persistVinLookup(
  userId: string | null | undefined,
  vin: string,
  v: Record<string, any>,
): Promise<string | null> {
  return persistScanToVehicle(userId, vin, vinLookupToVehicleData(v, vin));
}

/** Re-export so consumers only need one import. */
export { supabase };
