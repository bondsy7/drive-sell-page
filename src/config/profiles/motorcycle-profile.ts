/**
 * Motorrad-/Zweirad-Profil.
 *
 * Eigenständige Zweirad-Konfiguration: eigene Aufnahmeperspektiven
 * (linke und rechte Fahrzeugseite getrennt), eigene Pipeline-Jobs
 * (`MOTORCYCLE_PIPELINE_JOBS`) und eigene Prompt-Blöcke
 * (`src/prompts/remaster/motorcycle.ts`). Die Pkw-Konfiguration wird
 * dadurch nicht verändert.
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';
import moto34Front from '@/assets/moto-perspectives/34front.png.asset.json';
import motoSideLeft from '@/assets/moto-perspectives/side-left.png.asset.json';
import motoSideRight from '@/assets/moto-perspectives/side-right.png.asset.json';
import motoRear from '@/assets/moto-perspectives/rear.png.asset.json';
import motoCockpit from '@/assets/moto-perspectives/rider-seat.png.asset.json';

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
    key: 'side-left',
    label: 'Seitenansicht links',
    hint: 'Linke Fahrzeugseite (Seitenständer-Seite)',
    icon: motoSideLeft.url,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_side_left', 'side_left'],
  },
  {
    key: 'side-right',
    label: 'Seitenansicht rechts',
    hint: 'Rechte Fahrzeugseite (Auspuff-/Bremshebel-Seite)',
    icon: motoSideRight.url,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    coverageTags: ['ext_side_right', 'side_right'],
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
    key: 'cockpit',
    label: 'Sitz / Cockpit',
    hint: 'Sattel, Lenker und Display',
    icon: motoCockpit.url,
    capture: 'environment',
    required: false,
    aspect: '4/3',
    coverageTags: ['moto_cockpit', 'moto_seat_front'],
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
