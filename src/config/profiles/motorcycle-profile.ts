/**
 * Motorrad-Profil.
 *
 * Der Prozess entspricht funktional exakt dem Pkw-Prozess (gleiche Pipeline,
 * gleiche Optionen). Unterschiede sind ausschließlich:
 * - Motorrad-Icons in den Upload-Feldern
 * - „Fahrersitz" / „Rücksitz" statt „Interieur Fahrersitz" / „Interieur Rücksitz"
 * - kein Icon-/Vorschlags-Guide beim Multiupload für Detailaufnahmen
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';
import moto34Front from '@/assets/moto-perspectives/34front.png.asset.json';
import motoSide from '@/assets/moto-perspectives/side.png.asset.json';
import motoRear from '@/assets/moto-perspectives/rear.png.asset.json';
import motoSeatFront from '@/assets/moto-perspectives/rider-seat.png.asset.json';
import motoSeatRear from '@/assets/moto-perspectives/pillion-seat.png.asset.json';

export const MOTORCYCLE_CAPTURE_SLOTS: CaptureSlot[] = [
  {
    key: '34front',
    label: '3/4 Front',
    icon: moto34Front.url,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_front', '34_front_left'],
  },
  {
    key: 'side',
    label: 'Seite',
    icon: motoSide.url,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_side_left', 'side_left'],
  },
  {
    key: 'rear',
    label: 'Hinten',
    icon: motoRear.url,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_rear', 'rear'],
  },
  {
    key: 'moto-seat-front',
    label: 'Fahrersitz',
    icon: motoSeatFront.url,
    capture: 'environment',
    required: false,
    aspect: '4/3',
    coverageTags: ['moto_seat_front'],
  },
  {
    key: 'moto-seat-rear',
    label: 'Rücksitz',
    icon: motoSeatRear.url,
    capture: 'environment',
    required: false,
    aspect: '4/3',
    coverageTags: ['moto_seat_rear'],
  },
  {
    key: 'vin',
    label: 'VIN',
    icon: '/images/perspectives/VIN.png',
    capture: 'environment',
    required: false,
    aspect: '4/3',
    isVin: true,
    coverageTags: ['vin'],
  },
];

/** Wie beim Pkw: keine harte Coverage-Prüfung. */
export const MOTORCYCLE_SOURCE_COVERAGE: Record<string, string[]> = {};

export const MOTORCYCLE_PROFILE: VehicleClassProfile = {
  key: 'motorcycle',
  label: 'Motorrad',
  description: 'Motorräder, Roller, Naked Bikes, Tourer',
  remasterPromptProfile: 'motorcycle',
  pipelineProfile: 'car',
  validationProfile: 'car',
  pipelinePolicy: 'full',
  captureSlots: MOTORCYCLE_CAPTURE_SLOTS,
  hasWorkflowWizard: false,
  showSlotSections: false,
  allowedPipelineJobs: null,
  requiredSourceCoverage: MOTORCYCLE_SOURCE_COVERAGE,
};
