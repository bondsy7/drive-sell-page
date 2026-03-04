/**
 * Cost calculation utilities for vehicle operating costs.
 * Calculates: Energy costs/year, CO₂ costs (10 years), fuel price defaults.
 */

import { berechneKfzSteuerAusVerbrauchsdaten, KfzSteuerResult } from './kfz-steuer';

// ==================== Default fuel prices ====================

const DEFAULT_FUEL_PRICES: Record<string, number> = {
  benzin: 1.80,
  super: 1.80,
  'super e10': 1.80,
  'super e5': 1.80,
  'super plus': 1.90,
  diesel: 1.70,
  erdgas: 1.30,    // €/kg
  autogas: 0.75,   // €/l (LPG)
  strom: 0.35,     // €/kWh
  elektro: 0.35,
  electric: 0.35,
};

/**
 * Get default fuel price based on fuel type
 */
export function getDefaultFuelPrice(fuelType: string): number {
  const ft = fuelType.toLowerCase().trim();
  for (const [key, price] of Object.entries(DEFAULT_FUEL_PRICES)) {
    if (ft.includes(key)) return price;
  }
  return 1.80; // Default to Super/Benzin
}

/**
 * Get fuel price unit based on fuel type
 */
export function getFuelPriceUnit(fuelType: string): string {
  const ft = fuelType.toLowerCase();
  if (ft.includes('strom') || ft.includes('elektro') || ft.includes('electric')) return '€/kWh';
  if (ft.includes('erdgas')) return '€/kg';
  return '€/l';
}

// ==================== CO₂ emission factors ====================

/** kg CO₂ per liter of fuel */
const CO2_FACTORS: Record<string, number> = {
  benzin: 2.35,
  super: 2.35,
  'super e10': 2.35,
  diesel: 2.65,
  erdgas: 2.79,  // kg CO₂ per kg CNG
  autogas: 1.64, // kg CO₂ per liter LPG
};

function getCO2Factor(fuelType: string): number {
  const ft = fuelType.toLowerCase().trim();
  for (const [key, factor] of Object.entries(CO2_FACTORS)) {
    if (ft.includes(key)) return factor;
  }
  return 2.35; // default benzin
}

// ==================== CO₂ price scenarios (€/tonne, average over 10 years) ====================

/**
 * German CO₂ price schedule + projections (average over 10 years from 2025):
 * 2025: 55 €/t, 2026: 55-65 €/t, 2027+: EU ETS expected 100-250+ €/t
 * 
 * These are AVERAGE prices over a 10-year period, accounting for annual increases.
 */
const CO2_PRICE_SCENARIOS = {
  low: 100,    // Conservative: slow increase beyond 2027
  medium: 150, // Expected: moderate EU ETS trajectory
  high: 250,   // Aggressive: fast convergence to high EU ETS prices
};

// ==================== Calculation functions ====================

export interface ParsedConsumption {
  consumptionLPer100km: number;
  annualMileageKm: number;
  fuelPricePerUnit: number;
  fuelType: string;
}

function parseNumber(str: string): number {
  if (!str) return 0;
  // Extract the first number group from the string
  // Handles: "6,5 l/100 km" → 6.5, "15.000 km" → 15000, "1.498 cm³" → 1498, "130 g/km" → 130
  const match = str.match(/([\d]+(?:\.[\d]{3})*(?:,[\d]+)?)/);
  if (!match) return 0;
  // German format: dots are thousands separators, comma is decimal
  const cleaned = match[1].replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Calculate annual energy cost.
 * Formula: (annualMileage / 100) × consumption × fuelPrice
 */
export function calculateEnergyCostPerYear(
  consumptionCombined: string,
  annualMileage: string,
  fuelPrice: string,
  fuelType: string
): number {
  const consumption = parseNumber(consumptionCombined);
  let mileage = parseNumber(annualMileage);
  if (mileage <= 0) mileage = 15000; // Default 15.000 km/Jahr
  let price = parseNumber(fuelPrice);
  if (price <= 0) price = getDefaultFuelPrice(fuelType);
  
  if (consumption <= 0) return 0;
  
  return (mileage / 100) * consumption * price;
}

/**
 * Calculate CO₂ costs over 10 years for a given scenario.
 * Formula: (annualMileage / 100) × consumption(l/100km) × CO2Factor(kg/l) × avgCO2Price(€/t) / 1000 × 10
 */
export function calculateCO2Cost10Years(
  consumptionCombined: string,
  annualMileage: string,
  fuelType: string,
  scenario: 'low' | 'medium' | 'high'
): number {
  const consumption = parseNumber(consumptionCombined);
  let mileage = parseNumber(annualMileage);
  if (mileage <= 0) mileage = 15000;
  
  if (consumption <= 0) return 0;
  
  const ft = fuelType.toLowerCase();
  // Electric vehicles have no direct CO₂ emissions
  if (ft.includes('elektro') || ft.includes('electric') || ft.includes('strom') || ft === 'ev' || ft === 'bev') {
    return 0;
  }
  
  const co2Factor = getCO2Factor(fuelType);
  const co2PricePerTon = CO2_PRICE_SCENARIOS[scenario];
  
  // Annual CO₂ in kg: (mileage/100) * consumption * co2Factor
  const annualCO2kg = (mileage / 100) * consumption * co2Factor;
  // Annual cost: CO2 in tonnes * price per tonne
  const annualCost = (annualCO2kg / 1000) * co2PricePerTon;
  
  return Math.round(annualCost * 10); // 10 years
}

/**
 * Format a number as German Euro string
 */
function formatEuro(num: number): string {
  if (num <= 0) return '';
  return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatEuroRounded(num: number): string {
  if (num <= 0) return '';
  return Math.round(num).toLocaleString('de-DE') + ' €';
}

/**
 * Main function: Calculate all cost values and return them as formatted strings.
 */
export interface CalculatedCosts {
  energyCostPerYear: string;
  fuelPrice: string;
  co2CostLow: string;
  co2CostMedium: string;
  co2CostHigh: string;
  vehicleTax: string;
  vehicleTaxHinweis?: string;
}

export async function calculateAllCosts(
  consumptionCombined: string,
  annualMileage: string,
  fuelType: string,
  displacement: string,
  co2Emissions: string,
  vehicleYear: number,
  existingFuelPrice?: string
): Promise<CalculatedCosts> {
  console.log('[Kostenberechnung] Eingaben:', { consumptionCombined, annualMileage, fuelType, displacement, co2Emissions, vehicleYear, existingFuelPrice });
  
  // Fuel price: use existing or default
  let fuelPriceNum = parseNumber(existingFuelPrice || '');
  if (fuelPriceNum <= 0) {
    fuelPriceNum = getDefaultFuelPrice(fuelType);
  }
  const fuelPriceStr = fuelPriceNum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  // Energy cost per year
  const consumptionNum = parseNumber(consumptionCombined);
  const mileageNum = parseNumber(annualMileage) || 15000;
  const energyCost = consumptionNum > 0 ? (mileageNum / 100) * consumptionNum * fuelPriceNum : 0;
  
  console.log('[Kostenberechnung] Parsed:', { consumptionNum, mileageNum, fuelPriceNum, energyCost });
  
  // CO₂ costs (10 years)
  const co2Low = calculateCO2Cost10Years(consumptionCombined, annualMileage, fuelType, 'low');
  const co2Med = calculateCO2Cost10Years(consumptionCombined, annualMileage, fuelType, 'medium');
  const co2High = calculateCO2Cost10Years(consumptionCombined, annualMileage, fuelType, 'high');
  
  console.log('[Kostenberechnung] CO2:', { co2Low, co2Med, co2High });
  
  // Kfz-Steuer
  let taxResult: KfzSteuerResult = { steuerProJahr: 0 };
  try {
    taxResult = await berechneKfzSteuerAusVerbrauchsdaten(
      displacement,
      co2Emissions,
      fuelType,
      vehicleYear || 2024
    );
    console.log('[Kostenberechnung] Kfz-Steuer:', taxResult);
  } catch (e) {
    console.warn('Kfz-Steuer Berechnung fehlgeschlagen:', e);
  }
  
  return {
    energyCostPerYear: energyCost > 0 ? formatEuro(energyCost) : '',
    fuelPrice: fuelPriceStr,
    co2CostLow: co2Low > 0 ? formatEuroRounded(co2Low) : '',
    co2CostMedium: co2Med > 0 ? formatEuroRounded(co2Med) : '',
    co2CostHigh: co2High > 0 ? formatEuroRounded(co2High) : '',
    vehicleTax: taxResult.steuerProJahr > 0 ? formatEuroRounded(taxResult.steuerProJahr) : '',
    vehicleTaxHinweis: taxResult.hinweis,
  };
}
