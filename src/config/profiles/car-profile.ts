/**
 * PKW-Profil.
 *
 * WICHTIG: Die Slots sind eine wörtliche Kopie der bisher in
 * ImageCaptureGrid.tsx hartcodierten SLOTS-Liste. Keys, Labels, Icons und
 * Kamera-Ausrichtung dürfen sich NICHT ändern – der Pkw-Prozess bleibt
 * funktional, visuell und qualitativ identisch.
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';

export const CAR_CAPTURE_SLOTS: CaptureSlot[] = [
  {
    key: '34front',
    label: '3/4 Front',
    icon: '/images/perspectives/34_Vorne.png',
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_front', '34_front_left'],
  },
  {
    key: 'side',
    label: 'Seite',
    icon: '/images/perspectives/Seite.png',
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_side_left', 'side_left'],
  },
  {
    key: 'rear',
    label: 'Hinten',
    icon: '/images/perspectives/Hinten.png',
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_rear', 'rear'],
  },
  {
    key: 'interior-front',
    label: 'Interieur Fahrersitz',
    icon: '/images/perspectives/Interieur_Fahrersitz.png',
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['interior_front', 'cockpit'],
  },
  {
    key: 'interior-rear',
    label: 'Interieur Rücksitz',
    icon: '/images/perspectives/Interieur_Ruecksitz.png',
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['interior_rear'],
  },
  {
    key: 'vin',
    label: 'VIN',
    icon: '/images/perspectives/VIN.png',
    capture: 'environment',
    required: true,
    aspect: '4/3',
    isVin: true,
    coverageTags: ['vin'],
  },
];

/**
 * Bestehende Pkw-Source-Coverage. Die Pkw-Pipeline lief bisher ohne harte
 * Coverage-Prüfung – deshalb bleibt diese Map bewusst leer, damit sich am
 * Pkw-Verhalten nichts ändert.
 */
export const CAR_SOURCE_COVERAGE: Record<string, string[]> = {};

export const CAR_PROFILE: VehicleClassProfile = {
  key: 'car',
  label: 'Pkw',
  description: 'Personenkraftwagen, SUV, Transporter bis 3,5 t',
  remasterPromptProfile: 'car',
  pipelineProfile: 'car',
  validationProfile: 'car',
  pipelinePolicy: 'full',
  captureSlots: CAR_CAPTURE_SLOTS,
  hasWorkflowWizard: false,
  showSlotSections: false,
  allowedPipelineJobs: null,
  requiredSourceCoverage: CAR_SOURCE_COVERAGE,
};
