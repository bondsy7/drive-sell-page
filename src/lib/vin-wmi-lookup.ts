/**
 * VIN WMI (World Manufacturer Identifier) lookup.
 * Maps the first 2–3 characters of a VIN to a brand name.
 * Sources: user-provided list + Wikipedia Fahrzeug-Identifizierungsnummer.
 *
 * Lookup order: try 3-char prefix first (most specific), then 2-char.
 */

// 3-character WMI → brand
const WMI3: Record<string, string> = {
  // --- User-provided ---
  ZAR: 'Alfa Romeo',
  ZD4: 'Aprilia',
  WAU: 'Audi',
  TRU: 'Audi',
  WUA: 'Audi',
  WBA: 'BMW',
  WBS: 'BMW',
  WBY: 'BMW',
  WB1: 'BMW',
  VF7: 'Citroën',
  VR7: 'Citroën',
  KLY: 'Daewoo',
  JDA: 'Daihatsu',
  WDD: 'Mercedes-Benz',
  WDC: 'Mercedes-Benz',
  WDB: 'Mercedes-Benz',
  W1K: 'Mercedes-Benz',
  W1N: 'Mercedes-Benz',
  WMX: 'Mercedes-Benz',
  WXF: 'Fendt',
  ZFF: 'Ferrari',
  ZDF: 'Ferrari',
  ZFA: 'Fiat',
  WFO: 'Ford',
  WF0: 'Ford',
  VS6: 'Ford',
  WHB: 'Hobby',
  SHS: 'Honda',
  ZDC: 'Honda',
  JH2: 'Honda',
  JHM: 'Honda',
  LUC: 'Honda',
  KMH: 'Hyundai',
  TMA: 'Hyundai',
  ZCF: 'Iveco',
  SAJ: 'Jaguar',
  KNE: 'Kia',
  KNA: 'Kia',
  U5Y: 'Kia',
  U6Z: 'Kia',
  SAL: 'Land Rover',
  SCC: 'Lotus',
  JT1: 'Toyota', // Lexus uses Toyota WMI
  WMA: 'MAN',
  ZMA: 'Maserati',
  ZAM: 'Maserati',
  JM2: 'Mazda',
  JMZ: 'Mazda',
  JMB: 'Mitsubishi',
  XMC: 'Mitsubishi',
  MMB: 'Mitsubishi',
  SJN: 'Nissan',
  JN1: 'Nissan',
  VSK: 'Nissan',
  WOL: 'Opel',
  W0L: 'Opel',
  W0V: 'Opel',
  VXK: 'Opel',
  VF3: 'Peugeot',
  VR3: 'Peugeot',
  WPO: 'Porsche',
  WP0: 'Porsche',
  WP1: 'Porsche',
  PL1: 'Proton',
  VF1: 'Renault',
  VF6: 'Renault',
  VFA: 'Alpine',
  SAR: 'Rover',
  SAX: 'Rover',
  YS3: 'Saab',
  YK1: 'Saab',
  VSS: 'Seat',
  TMB: 'Škoda',
  KPT: 'Ssangyong',
  WTA: 'Tabbert',
  JTF: 'Toyota',
  VNK: 'Toyota',
  WVW: 'Volkswagen',
  WV2: 'Volkswagen',
  WV1: 'Volkswagen',
  WVG: 'Volkswagen',
  WVM: 'Volkswagen',
  YV1: 'Volvo',
  B7J: 'Chrysler',
  S2D: 'Chrysler',
  VR1: 'DS',
  WME: 'Smart',
  WMW: 'MINI',
  ZHW: 'Lamborghini',
  ZLA: 'Lancia',
  WAP: 'Alpina',
  WAG: 'Neoplan',
  WEB: 'EvoBus',
  WSM: 'Schmitz Cargobull',
  LC0: 'BYD',
  LFV: 'Volkswagen',
  LSV: 'Volkswagen',
  LPS: 'Polestar',
  LRW: 'Tesla',
  XP7: 'Tesla',
  SUU: 'Solaris',
  CL9: 'Wallyscar',
  // US-market WMIs
  '1C3': 'Chrysler',
  '1C4': 'Chrysler',
  '1J4': 'Jeep',
  '1FM': 'Ford',
  '2FM': 'Ford',
  '1HF': 'Honda',
  '1VW': 'Volkswagen',
  '3VW': 'Volkswagen',
  '9BW': 'Volkswagen',
  '4US': 'BMW',
  '5YJ': 'Tesla',
  '6T1': 'Toyota',
  '6MM': 'Mitsubishi',
  '2HM': 'Hyundai',
  '1YV': 'Mazda',
  W0S: 'Opel',
};

// 2-character WMI prefix → brand (less specific, fallback)
const WMI2: Record<string, string> = {
  JA: 'Isuzu',
  JF: 'Subaru',
  JH: 'Honda',
  JM: 'Mazda',
  JN: 'Nissan',
  JS: 'Suzuki',
  JT: 'Toyota',
  KL: 'Daewoo',
  KN: 'Kia',
  UU: 'Dacia',
  '1C': 'Chrysler',
  '1F': 'Ford',
  '1G': 'General Motors',
  '1H': 'Honda',
  '1J': 'Jeep',
  '1L': 'Lincoln',
  '1M': 'Mercury',
  '1N': 'Nissan',
  '2F': 'Ford',
  '2G': 'General Motors',
  '2M': 'Mercury',
  '3F': 'Ford',
  '3G': 'General Motors',
  '3H': 'Honda',
  '4F': 'Mazda',
  '4M': 'Mercury',
  '4S': 'Subaru',
  '5L': 'Lincoln',
  '6F': 'Ford',
  '6H': 'Holden',
};

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
  if (WMI3[wmi3]) return WMI3[wmi3];

  // Try 2-char fallback
  const wmi2 = upper.substring(0, 2);
  if (WMI2[wmi2]) return WMI2[wmi2];

  return null;
}
