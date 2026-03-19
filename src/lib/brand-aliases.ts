/**
 * Centralized brand alias mapping.
 * Used by WMI lookup, logo matching, and brand detection.
 *
 * Keys and values are all lowercase, no spaces/dashes.
 * The "canonical" name is whatever appears in vehicle-makes-models.json.
 */

// Canonical brand → list of known aliases (all lowercase, stripped)
export const BRAND_ALIAS_MAP: Record<string, string[]> = {
  volkswagen: ['vw', 'volkswagon'],
  'mercedes-benz': ['mercedes', 'mercedesbenz', 'mb', 'mercedesamg', 'daimler', 'daimlerchrysler'],
  bmw: ['bayerischemotorenwerke'],
  'alfa romeo': ['alfaromeo', 'alfa'],
  'aston martin': ['astonmartin'],
  'land rover': ['landrover'],
  'rolls-royce': ['rollsroyce', 'rolls royce'],
  citroën: ['citroen', 'citröen'],
  škoda: ['skoda'],
  mini: ['bmwmini'],
  smart: ['smartcar'],
  opel: ['vauxhall'],
  peugeot: ['peugot'],
  renault: ['renaultsport'],
  toyota: ['lexus'],
  porsche: ['porscheag'],
  fiat: ['fiatchrysler', 'stellantis'],
  seat: ['cupra'],
  ds: ['dsautomobiles'],
  alpine: ['alpinecars'],
  nissan: ['datsun'],
  hyundai: ['genesis'],
  ssangyong: ['kgmobility'],
  tesla: ['teslamotors'],
  ford: ['fordmotor'],
  honda: ['acura'],
  chevrolet: ['chevy'],
  chrysler: ['mopar'],
  jeep: ['jeepeagle'],
  mazda: ['toyokogyo'],
  mitsubishi: ['netherlandscar'],
  volvo: ['volvocars', 'polestar'],
  subaru: ['fuji'],
  suzuki: ['maruti'],
  dacia: ['daciarenault'],
  kia: ['kiamotors'],
  lamborghini: ['lambo'],
  maserati: ['maseratiitalia'],
  ferrari: ['ferrariitalia', 'scuderiaferrari'],
  audi: ['audiag'],
  lancia: ['lanciaitalia'],
  jaguar: ['jaguarlandrover', 'jlr'],
  bentley: ['bentleymotors'],
  bugatti: ['bugattiautomobiles'],
  lotus: ['lotuscars'],
  mclaren: ['mclarencars'],
  pagani: ['paganiautomobili'],
  koenigsegg: ['koenigseggautomotive'],
  rimac: ['rimacautomobili'],
  byd: ['buildyourdreams'],
  polestar: ['polestarcars'],
  cupra: ['cupraofficial'],
  genesis: ['genesismotors'],
};

/**
 * Normalize a string for comparison: lowercase, remove spaces/dashes/underscores.
 */
export function normalizeBrand(name: string): string {
  return name.toLowerCase().replace(/[-_\s.]+/g, '').trim();
}

/**
 * Resolve an input brand name to the canonical name used in the makes list.
 * Returns the canonical key or null.
 */
export function resolveCanonicalBrand(
  input: string,
  makeKeys: string[],
): string | null {
  const inputNorm = normalizeBrand(input);
  if (!inputNorm) return null;

  // Direct match
  const direct = makeKeys.find(k => normalizeBrand(k) === inputNorm);
  if (direct) return direct;

  // Check aliases → canonical
  for (const [canonical, aliases] of Object.entries(BRAND_ALIAS_MAP)) {
    const canonicalNorm = normalizeBrand(canonical);
    if (canonicalNorm === inputNorm || aliases.some(a => normalizeBrand(a) === inputNorm)) {
      // Find the make key that matches the canonical name
      const match = makeKeys.find(k => normalizeBrand(k) === canonicalNorm);
      if (match) return match;
      // Also try aliases to find a make key
      for (const alias of aliases) {
        const aliasMatch = makeKeys.find(k => normalizeBrand(k) === normalizeBrand(alias));
        if (aliasMatch) return aliasMatch;
      }
    }
  }

  // Reverse: check if input matches any canonical via make keys
  for (const [canonical, aliases] of Object.entries(BRAND_ALIAS_MAP)) {
    const makeMatch = makeKeys.find(k => normalizeBrand(k) === normalizeBrand(canonical));
    if (makeMatch && aliases.some(a => normalizeBrand(a) === inputNorm)) {
      return makeMatch;
    }
  }

  // Partial match as last resort
  const partial = makeKeys.find(k => {
    const kNorm = normalizeBrand(k);
    return kNorm.includes(inputNorm) || inputNorm.includes(kNorm);
  });
  return partial || null;
}
