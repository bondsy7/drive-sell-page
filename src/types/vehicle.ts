export interface ConsumptionData {
  origin: string;
  mileage: string;
  displacement: string;
  power: string;
  driveType: string;
  fuelType: string;
  consumptionCombined: string;
  co2Emissions: string;
  co2Class: string;
  consumptionCity: string;
  consumptionSuburban: string;
  consumptionRural: string;
  consumptionHighway: string;
  energyCostPerYear: string;
  fuelPrice: string;
  co2CostMedium: string;
  co2CostLow: string;
  co2CostHigh: string;
  vehicleTax: string;
}

export interface VehicleData {
  category: string;
  vehicle: {
    brand: string;
    model: string;
    variant: string;
    year: number;
    color: string;
    fuelType: string;
    transmission: string;
    power: string;
    features: string[];
  };
  finance: {
    monthlyRate: string;
    downPayment: string;
    duration: string;
    totalPrice: string;
    annualMileage: string;
    specialPayment: string;
    residualValue: string;
  };
  dealer: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  consumption: ConsumptionData;
}

export interface GenerationResult {
  vehicleData: VehicleData;
  imagePrompt: string;
  imageBase64: string | null;
}

export type AppState = 'idle' | 'uploading' | 'analyzing' | 'generating-image' | 'preview';
