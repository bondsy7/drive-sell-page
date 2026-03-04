/**
 * Kfz-Steuer Calculator
 * Ported from the official BMF KfzRechner logic (Addon_KfzRechner.js + KfzRechner_Calculation.js)
 * Uses ctRichtext.json as tax rate database.
 */

export interface TaxRateEntry {
  Steuersatz: string;
  Fahrzeugart: string;
  ZulaessigeGesamtmasse: string;
  Antriebsart: string;
  Schadstoffnorm: string;
  Partikelreduziert: string;
  Hubraum: string;
  CO2Wert: string;
  Oldtimerart: string;
  ZulaessigeGesamtmasse2: string;
  Stuetzlast: string;
}

export interface KfzSteuerInput {
  hubraum: number;       // in cm³
  co2Wert: number;       // in g/km (WLTP)
  antriebsart: 'Otto' | 'Diesel' | 'Elektro';
  erstzulassungJahr: number;
}

export interface KfzSteuerResult {
  steuerProJahr: number;
  hinweis?: string;
}

let taxDataCache: TaxRateEntry[] | null = null;

async function loadTaxData(): Promise<TaxRateEntry[]> {
  if (taxDataCache) return taxDataCache;
  const resp = await fetch('/data/kfz-steuersaetze.json');
  taxDataCache = await resp.json();
  return taxDataCache!;
}

/**
 * Determine Fahrzeugart from registration year
 */
function getFahrzeugart(jahr: number): string {
  if (jahr >= 2021) return '05PKWnach01012021';
  if (jahr >= 2014) return '04PKWnach01012014';
  if (jahr >= 2012) return '03PKWnach01012012bis31122013';
  if (jahr >= 2009) return '02PKWnach01072009bis31122011';
  return '01PKWnach05112008bis30062009';
}

/**
 * Map fuel type string to Antriebsart value used in the JSON database
 */
function mapAntriebsart(antrieb: string): string {
  const lower = antrieb.toLowerCase();
  if (lower.includes('diesel')) return 'Diesel';
  if (lower.includes('elektro') || lower.includes('electric') || lower === 'ev' || lower === 'bev') return 'Elektro';
  // Otto covers Benzin, Super, E10, Gas, Wankel etc.
  return 'OttoWankel';
}

/**
 * Find the matching tax rate entry from the database
 */
function findTaxEntry(data: TaxRateEntry[], fahrzeugart: string, antriebsart: string): TaxRateEntry | null {
  // For older PKW categories that need Schadstoffnorm, default to best emission class
  const candidates = data.filter(e => e.Fahrzeugart === fahrzeugart);
  
  if (candidates.length === 0) return null;
  
  // Try exact match on Antriebsart
  let match = candidates.find(e => {
    if (!e.Antriebsart) return true; // No restriction on drive type
    return e.Antriebsart === antriebsart;
  });
  
  // For Otto/OttoWankel, try both
  if (!match && antriebsart === 'OttoWankel') {
    match = candidates.find(e => e.Antriebsart === 'Otto');
  }
  if (!match && antriebsart === 'Otto') {
    match = candidates.find(e => e.Antriebsart === 'OttoWankel');
  }
  
  // If multiple matches due to Schadstoffnorm, prefer Euro3bis6 or the first one
  if (!match) {
    match = candidates.find(e => e.Schadstoffnorm === 'Euro3bis6') || candidates[0];
  }
  
  return match || null;
}

// ==================== Calculation formulas ====================

function blockCalculation(entry: number, divisor: number, taxRate: number): number {
  return Math.ceil(entry / divisor) * taxRate;
}

function getTaxForCo2(co2Wert: number, co2TaxRate: number, freeCo2: number): number {
  if (co2Wert > freeCo2) {
    return (co2Wert - freeCo2) * co2TaxRate / 100;
  }
  return 0;
}

function getTaxWithCo2(hubraum: number, taxRate: number, co2Wert: number, co2TaxRate: number, freeCo2: number): number {
  const tax = blockCalculation(hubraum, 100, taxRate) / 100;
  const co2Tax = getTaxForCo2(co2Wert, co2TaxRate, freeCo2);
  return tax + co2Tax;
}

/**
 * Formel 1: Simple displacement-based tax (older vehicles)
 */
function formel1(hubraum: number, steuersatzArray: string[]): number {
  const taxRate = parseInt(steuersatzArray[2]);
  return Math.floor(blockCalculation(hubraum, 100, taxRate) / 100);
}

/**
 * Formel 3: Displacement + CO2 based tax
 */
function formel3(hubraum: number, co2Wert: number, steuersatzArray: string[]): number {
  const taxRate = parseInt(steuersatzArray[3]);
  const co2TaxRate = parseInt(steuersatzArray[4]);
  const freeCo2 = parseInt(steuersatzArray[5]);
  return Math.floor(getTaxWithCo2(hubraum, taxRate, co2Wert, co2TaxRate, freeCo2));
}

/**
 * Formel 1+3: Min of formula 1 and formula 3 (transitional vehicles)
 */
function formel1and3(hubraum: number, co2Wert: number, steuersatzArray: string[]): number {
  const taxRate1 = parseInt(steuersatzArray[3]);
  const taxRate2 = parseInt(steuersatzArray[4]);
  const co2TaxRate = parseInt(steuersatzArray[5]);
  const freeCo2 = parseInt(steuersatzArray[6]);
  const tax1 = blockCalculation(hubraum, 100, taxRate1) / 100;
  const tax2 = getTaxWithCo2(hubraum, taxRate2, co2Wert, co2TaxRate, freeCo2);
  return Math.floor(Math.min(tax1, tax2));
}

/**
 * Formel 4: Progressive CO2 tax (modern vehicles ab 2014/2021)
 * This is the most important formula for modern cars.
 */
function formel4(hubraum: number, co2Wert: number, steuersatzArray: string[]): KfzSteuerResult {
  const taxRate = parseInt(steuersatzArray[3]);
  const co2TaxRate = parseInt(steuersatzArray[4]);
  const freeCo2 = parseInt(steuersatzArray[5]);
  
  let hinweis: string | undefined;
  if (co2Wert <= freeCo2) {
    hinweis = 'CO₂-Wert liegt unter dem Freibetrag – nur Hubraum-Anteil wird berechnet.';
  }
  
  let tax = getTaxWithCo2(hubraum, taxRate, co2Wert, co2TaxRate, freeCo2);
  
  // Progressive surcharges (the while-loop from the original)
  const arraySize = steuersatzArray.length;
  let stufe = 0;
  let nextTax = 0;
  
  while (arraySize - 6 - 1 > stufe * 2) {
    stufe++;
    const surchargeRate = parseInt(steuersatzArray[4 + stufe * 2]);
    const surchargeThreshold = parseInt(steuersatzArray[5 + stufe * 2]);
    nextTax += getTaxForCo2(co2Wert, surchargeRate, surchargeThreshold);
  }
  
  tax += nextTax;
  
  return {
    steuerProJahr: Math.floor(tax),
    hinweis,
  };
}

/**
 * Main calculation function – determines which formula to use based on the tax entry
 */
function calculateFromEntry(entry: TaxRateEntry, hubraum: number, co2Wert: number): KfzSteuerResult {
  const steuersatzArray = entry.Steuersatz.split(':');
  const formelId = steuersatzArray[0];
  
  switch (formelId) {
    case '0':
      return { steuerProJahr: Math.floor(parseInt(steuersatzArray[1]) / 100) };
    
    case '1':
      return { steuerProJahr: formel1(hubraum, steuersatzArray) };
    
    case '1b':
      return { steuerProJahr: Math.floor(blockCalculation(hubraum, 25, parseInt(steuersatzArray[2])) / 100) };
    
    case '3':
      return { steuerProJahr: formel3(hubraum, co2Wert, steuersatzArray) };
    
    case '1+3':
      return { steuerProJahr: formel1and3(hubraum, co2Wert, steuersatzArray) };
    
    case '4':
      return formel4(hubraum, co2Wert, steuersatzArray);
    
    case '2':
    case '2b':
    case '2c':
    case '2_e':
    case '2c_e':
      // Weight-based formulas (LKW, Elektro, Wohnmobil, Anhänger)
      // Not commonly needed for car listings, return 0
      return { steuerProJahr: 0, hinweis: 'Gewichtsbasierte Berechnung – bitte manuell eingeben.' };
    
    default:
      return { steuerProJahr: 0, hinweis: 'Unbekannte Berechnungsformel.' };
  }
}

/**
 * Public API: Calculate Kfz-Steuer from vehicle data
 */
export async function berechneKfzSteuer(input: KfzSteuerInput): Promise<KfzSteuerResult> {
  const data = await loadTaxData();
  
  // Electric vehicles are tax-free until 2030
  if (input.antriebsart === 'Elektro') {
    return {
      steuerProJahr: 0,
      hinweis: 'Elektrofahrzeuge sind bis 31.12.2030 von der Kfz-Steuer befreit.',
    };
  }
  
  const fahrzeugart = getFahrzeugart(input.erstzulassungJahr);
  const antriebsart = mapAntriebsart(input.antriebsart);
  
  const entry = findTaxEntry(data, fahrzeugart, antriebsart);
  if (!entry) {
    // Fallback: try simplified formula 4 for modern PKW
    if (input.erstzulassungJahr >= 2014) {
      const baseRate = input.antriebsart === 'Diesel' ? 950 : 200;
      const steuersatz = input.erstzulassungJahr >= 2021
        ? `4:6:7:${baseRate}:200:95:20:115:30:135:40:155:50:175:60:195`
        : `4:6:7:${baseRate}:200:95`;
      return formel4(input.hubraum, input.co2Wert, steuersatz.split(':'));
    }
    return { steuerProJahr: 0, hinweis: 'Keine passende Steuertabelle gefunden.' };
  }
  
  return calculateFromEntry(entry, input.hubraum, input.co2Wert);
}

/**
 * Simplified calculation from consumption data strings.
 * Extracts numeric values from formatted strings like "1.498 cm³" or "130 g/km".
 */
export async function berechneKfzSteuerAusVerbrauchsdaten(
  displacement: string,
  co2Emissions: string,
  fuelType: string,
  year: number
): Promise<KfzSteuerResult> {
  const hubraum = parseInt(displacement.replace(/[^\d]/g, '')) || 0;
  const co2 = parseInt(co2Emissions.replace(/[^\d]/g, '')) || 0;
  
  let antriebsart: KfzSteuerInput['antriebsart'] = 'Otto';
  const ft = fuelType.toLowerCase();
  if (ft.includes('diesel')) antriebsart = 'Diesel';
  else if (ft.includes('elektro') || ft.includes('electric') || ft === 'ev' || ft === 'bev' || ft === 'strom') antriebsart = 'Elektro';
  
  if (hubraum <= 0 && antriebsart !== 'Elektro') {
    return { steuerProJahr: 0, hinweis: 'Hubraum fehlt für die Berechnung.' };
  }
  
  return berechneKfzSteuer({ hubraum, co2Wert: co2, antriebsart, erstzulassungJahr: year });
}
