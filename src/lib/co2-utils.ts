/**
 * Determines the CO2 class based on combined CO2 emissions in g/km.
 * For standard (non-plugin-hybrid) vehicles.
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

/** CO2 label image paths (public folder) */
export const CO2_LABEL_IMAGES: Record<string, string> = {
  A: '/images/co2/A.jpg',
  B: '/images/co2/B.jpg',
  C: '/images/co2/C.jpg',
  D: '/images/co2/D.jpg',
  E: '/images/co2/E.jpg',
  F: '/images/co2/F.jpg',
  G: '/images/co2/G.jpg',
};
