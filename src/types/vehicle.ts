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
  // PHEV-specific fields
  isPluginHybrid: boolean;
  co2EmissionsDischarged: string;
  co2ClassDischarged: string;
  consumptionCombinedDischarged: string;
  electricRange: string;
  consumptionElectric: string;
  // Extended technical data
  hsnTsn: string;
  electricMotorPower: string;
  electricMotorTorque: string;
  gearboxType: string;
  topSpeed: string;
  acceleration: string;
  curbWeight: string;
  grossWeight: string;
  warranty: string;
  paintColor: string;
}

export interface DealerData {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  logoUrl: string;
  // Social media links
  facebookUrl: string;
  instagramUrl: string;
  xUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  whatsappNumber: string;
  // Banking & legal
  leasingBank: string;
  leasingLegalText: string;
  financingBank: string;
  financingLegalText: string;
  defaultLegalText: string;
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
    description?: string;
    vin?: string;
  };
  finance: {
    monthlyRate: string;
    downPayment: string;
    duration: string;
    totalPrice: string;
    annualMileage: string;
    specialPayment: string;
    residualValue: string;
    interestRate: string;
    nominalInterestRate?: string;
  };
  dealer: DealerData;
  consumption: ConsumptionData;
}

export interface GenerationResult {
  vehicleData: VehicleData;
  imagePrompt: string;
  imageBase64: string | null;
}

export type AppState = 'idle' | 'uploading' | 'analyzing' | 'choosing-image-source' | 'generating-image' | 'uploading-images' | 'preview';
