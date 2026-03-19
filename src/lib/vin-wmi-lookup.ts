/**
 * VIN WMI (World Manufacturer Identifier) lookup.
 * Maps the first 2–3 characters of a VIN to a brand name.
 * Sources: Wikibooks WMI list + user-provided data.
 *
 * Lookup order: try 3-char prefix first (most specific), then 2-char.
 */

import { WMI3_DATA } from './wmi-data/wmi3';
import { WMI2_DATA } from './wmi-data/wmi2';

/**
 * Look up a brand from a VIN string using the WMI prefix.
 * Returns the brand name or null if not found.
 */
export function lookupBrandFromVin(vin: string): string | null {
  if (!vin || vin.length < 3) return null;
  const upper = vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.length < 3) return null;

  // Try 3-char first
  const wmi3 = upper.substring(0, 3);
  if (WMI3_DATA[wmi3]) return WMI3_DATA[wmi3];

  // Try 2-char fallback
  const wmi2 = upper.substring(0, 2);
  if (WMI2_DATA[wmi2]) return WMI2_DATA[wmi2];

  return null;
}

/** Expose maps for admin display */
export const WMI3_MAP = WMI3_DATA;
export const WMI2_MAP = WMI2_DATA;
