import type { ConsumptionData } from '@/types/vehicle';

/**
 * Determines the CO2 class based on combined CO2 emissions in g/km.
 * Thresholds per Pkw-EnVKV Anlage 1 (§ 3a):
 *   A: 0 g/km, B: 1–95, C: 96–115, D: 116–135, E: 136–155, F: 156–175, G: >175
 */
export function getCO2ClassFromEmissions(co2EmissionsStr: string): string | null {
  const match = co2EmissionsStr?.match(/(\d+)/);
  if (!match) return null;
  const gkm = parseInt(match[1], 10);

  if (gkm === 0) return 'A';
  if (gkm <= 95) return 'B';
  if (gkm <= 115) return 'C';
  if (gkm <= 135) return 'D';
  if (gkm <= 155) return 'E';
  if (gkm <= 175) return 'F';
  return 'G';
}

/**
 * Checks whether a vehicle is a Plugin-Hybrid based on consumption data.
 */
export function isPluginHybrid(consumption: ConsumptionData): boolean {
  if (consumption.isPluginHybrid) return true;
  // Also detect from driveType or fuelType keywords
  const dt = (consumption.driveType || '').toLowerCase();
  const ft = (consumption.fuelType || '').toLowerCase();
  return dt.includes('plug') || dt.includes('phev') || ft.includes('plug') || ft.includes('phev');
}

/**
 * Returns the CO2 label image path.
 * For standard vehicles: /images/co2/{CLASS}.jpg  (e.g. /images/co2/C.jpg)
 * For PHEV: /images/co2/phev/{WEIGHTED}{DISCHARGED}.jpg  (e.g. /images/co2/phev/BC.jpg)
 *   where first letter = CO₂-Klasse gewichtet kombiniert
 *         second letter = CO₂-Klasse bei entladener Batterie
 */
export function getCO2LabelPath(consumption: ConsumptionData): string {
  const phev = isPluginHybrid(consumption);

  if (phev) {
    const clsWeighted = (consumption.co2Class || getCO2ClassFromEmissions(consumption.co2Emissions) || 'A').toUpperCase();
    const clsDischarged = (consumption.co2ClassDischarged || getCO2ClassFromEmissions(consumption.co2EmissionsDischarged) || clsWeighted).toUpperCase();
    return `/images/co2/phev/${clsWeighted}${clsDischarged}.jpg`;
  }

  const cls = (consumption.co2Class || getCO2ClassFromEmissions(consumption.co2Emissions) || 'A').toUpperCase();
  return `/images/co2/${cls}.jpg`;
}

/** CO2 label image paths for standard vehicles (public folder) */
export const CO2_LABEL_IMAGES: Record<string, string> = {
  A: '/images/co2/A.jpg',
  B: '/images/co2/B.jpg',
  C: '/images/co2/C.jpg',
  D: '/images/co2/D.jpg',
  E: '/images/co2/E.jpg',
  F: '/images/co2/F.jpg',
  G: '/images/co2/G.jpg',
};
