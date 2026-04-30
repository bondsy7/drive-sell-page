// Shared types for the OneShot Studio (Beta) workflow.

export type ImageCategory =
  | 'exterior_front'
  | 'exterior_rear'
  | 'exterior_side_left'
  | 'exterior_side_right'
  | 'exterior_34_front'
  | 'exterior_34_rear'
  | 'interior_front'
  | 'interior_rear'
  | 'interior_dashboard'
  | 'detail_wheel'
  | 'detail_headlight'
  | 'detail_taillight'
  | 'detail_emblem'
  | 'detail_other'
  | 'vin_plate'
  | 'datasheet'
  | 'unknown';

export interface ClassifiedImage {
  id: string;
  /** data URL (jpg) */
  base64: string;
  category: ImageCategory;
  confidence: 'high' | 'medium' | 'low';
  labelDe: string;
  isExterior: boolean;
  isInterior: boolean;
  isDetail: boolean;
  /** Local file metadata (for UX) */
  fileName?: string;
}

export interface ScanData {
  vehicleTitle?: string;
  brand?: string;
  model?: string;
  variant?: string;
  price?: string;
  priceType?: 'buy' | 'lease' | 'finance' | 'abo';
  monthlyRate?: string;
  duration?: string;
  mileage?: string;
  downPayment?: string;
  power?: string;
  fuelType?: string;
  transmission?: string;
  mileageKm?: string;
  consumptionCombined?: string;
  consumptionCity?: string;
  consumptionHighway?: string;
  co2Emissions?: string;
  co2Class?: string;
  co2ClassDischarged?: string;
  consumptionCombinedDischarged?: string;
  electricRange?: string;
  wltpRange?: string;
  energyCostPerYear?: string;
  vehicleTax?: string;
  year?: string;
  color?: string;
  vin?: string;
  features?: string[];
  legalText?: string;
  headline?: string;
  subline?: string;
  dealer?: string;
  location?: string;
}

/** Tracks where a value came from – important for the user to see what's auto vs manual. */
export type FieldSource = 'manual' | 'datasheet' | 'vin' | 'image';

export interface MarketingForm {
  // Vehicle base
  brand: string;
  model: string;
  variant: string;
  vehicleTitle: string;

  // Offer
  priceType: 'buy' | 'lease' | 'finance' | 'abo';
  priceText: string;
  monthlyRate: string;
  duration: string;
  downPayment: string;
  mileage: string;

  // Banner copy
  occasion: string;
  scene: string;
  style: string;
  priceDisplay: string;
  headline: string;
  subline: string;
  ctaText: string;
  accentColor: string;
  freePrompt: string;
  legalText: string;
  headlineFont: string;
  sublineFont: string;

  // Logo
  showLogo: boolean;
  logoSource: 'dealer' | 'manufacturer';
}

export interface FieldSources {
  brand: FieldSource;
  model: FieldSource;
  variant: FieldSource;
  vehicleTitle: FieldSource;
  priceText: FieldSource;
  priceType: FieldSource;
  monthlyRate: FieldSource;
  duration: FieldSource;
  downPayment: FieldSource;
  mileage: FieldSource;
  headline: FieldSource;
  subline: FieldSource;
  legalText: FieldSource;
}

export const DEFAULT_FORM: MarketingForm = {
  brand: '',
  model: '',
  variant: '',
  vehicleTitle: '',
  priceType: 'buy',
  priceText: '',
  monthlyRate: '',
  duration: '',
  downPayment: '',
  mileage: '',
  occasion: 'buy',
  scene: 'showroom',
  style: 'premium',
  priceDisplay: 'sign',
  headline: '',
  subline: '',
  ctaText: 'Jetzt anfragen',
  accentColor: '#174f6b',
  freePrompt: '',
  legalText: '',
  headlineFont: 'modern-sans',
  sublineFont: 'match',
  showLogo: false,
  logoSource: 'dealer',
};

export const DEFAULT_SOURCES: FieldSources = {
  brand: 'manual',
  model: 'manual',
  variant: 'manual',
  vehicleTitle: 'manual',
  priceText: 'manual',
  priceType: 'manual',
  monthlyRate: 'manual',
  duration: 'manual',
  downPayment: 'manual',
  mileage: 'manual',
  headline: 'manual',
  subline: 'manual',
  legalText: 'manual',
};

/** Banner formats (mirror of BannerGenerator). */
export const ONESHOT_BANNER_FORMATS = [
  { id: 'story', label: 'Instagram Story', w: 1080, h: 1920, ratio: '9:16' },
  { id: 'post', label: 'Instagram Post', w: 1080, h: 1080, ratio: '1:1' },
  { id: 'fb-ad', label: 'Facebook Ad', w: 1200, h: 628, ratio: '16:9' },
  { id: 'hero', label: 'Website Banner', w: 1920, h: 1080, ratio: '16:9' },
] as const;

export type BannerFormatId = typeof ONESHOT_BANNER_FORMATS[number]['id'];
