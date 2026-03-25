import type { VehicleData, ConsumptionData, DealerData } from '@/types/vehicle';
import type { DealerBank } from '@/hooks/useDealerBanks';

export interface TemplateEditorProps {
  data: VehicleData;
  consumption: ConsumptionData;
  imageBase64: string | null;
  galleryImages: string[];
  allImages: string[];
  isBuyCategory: boolean;
  category: string;
  updateVehicle: (key: keyof VehicleData['vehicle'], val: string) => void;
  updateFinance: (key: keyof VehicleData['finance'], val: string) => void;
  updateDealer: (key: keyof DealerData, val: string) => void;
  updateConsumption: (key: keyof ConsumptionData, val: string) => void;
  updatePower: (val: string) => void;
  updateFuelType: (val: string) => void;
  onDataChange: (data: VehicleData) => void;
  recalculateRate: () => void;
  calculateCosts: () => Promise<void>;
  costCalculating: boolean;
  costMissingFields: string[];
  addFeature: () => void;
  updateFeature: (index: number, val: string) => void;
  removeFeature: (index: number) => void;
  vinLookup: any;
  dealerBanks?: DealerBank[];
}
