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
}

export interface GenerationResult {
  vehicleData: VehicleData;
  imagePrompt: string;
  imageBase64: string | null;
}

export type AppState = 'idle' | 'uploading' | 'analyzing' | 'generating-image' | 'preview';
