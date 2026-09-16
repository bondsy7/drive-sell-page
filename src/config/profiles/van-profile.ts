/**
 * Transporter-Profil (Kastenwagen und Nutzfahrzeuge bis 3,5 t).
 *
 * Vollständig eigene Aufnahme-Slots. Beeinflusst Pkw, Lkw, Motorrad und
 * Reisemobil nicht. Kein Wizard – die Slots sind für alle Transporter gleich.
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';
import front34Asset from '@/assets/van-perspectives/34front.png.asset.json';
import sideLeftAsset from '@/assets/van-perspectives/side-left.png.asset.json';
import sideRightAsset from '@/assets/van-perspectives/side-right.png.asset.json';
import rearAsset from '@/assets/van-perspectives/rear.png.asset.json';
import frontAsset from '@/assets/van-perspectives/front.png.asset.json';
import cockpitAsset from '@/assets/van-perspectives/cockpit.png.asset.json';
import cargoAsset from '@/assets/van-perspectives/cargo.png.asset.json';
import slidingDoorAsset from '@/assets/van-perspectives/sliding-door.png.asset.json';
import vinReferenceAsset from '@/assets/capture-perspectives/vin.png.asset.json';

export const VAN_CAPTURE_SLOTS: CaptureSlot[] = [
  {
    key: '34front',
    label: '3/4 Front',
    icon: front34Asset.url,
    required: true,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['ext_front', '34_front_left'],
  },
  {
    key: 'side-left',
    label: 'Seitenansicht links',
    icon: sideLeftAsset.url,
    required: true,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['ext_side_left', 'side_left'],
  },
  {
    key: 'side-right',
    label: 'Seitenansicht rechts',
    icon: sideRightAsset.url,
    required: true,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['ext_side_right', 'side_right'],
  },
  {
    key: 'rear',
    label: 'Heck',
    icon: rearAsset.url,
    required: true,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['ext_rear', 'rear'],
  },
  {
    key: 'front',
    label: 'Frontansicht',
    icon: frontAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['van_front'],
  },
  {
    key: 'cockpit',
    label: 'Fahrerkabine',
    icon: cockpitAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['van_cockpit', 'int_front'],
  },
  {
    key: 'cargo',
    label: 'Laderaum',
    icon: cargoAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['van_cargo'],
  },
  {
    key: 'sliding-door',
    label: 'Schiebetür',
    icon: slidingDoorAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['van_sliding_door'],
  },
  {
    key: 'vin',
    label: 'VIN',
    icon: vinReferenceAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    isVin: true,
    coverageTags: ['vin'],
  },
];

/** Keine harte Coverage-Anforderung – Laderaum und Kabine sind optional. */
export const VAN_SOURCE_COVERAGE: Record<string, string[]> = {};

export const VAN_PROFILE: VehicleClassProfile = {
  key: 'van',
  label: 'Transporter',
  description: 'Kastenwagen, Hochdachkombi, Pritsche, Koffer bis 3,5 t',
  remasterPromptProfile: 'van',
  pipelineProfile: 'van',
  validationProfile: 'car',
  pipelinePolicy: 'full',
  captureSlots: VAN_CAPTURE_SLOTS,
  hasWorkflowWizard: false,
  showSlotSections: true,
  allowedPipelineJobs: null,
  requiredSourceCoverage: VAN_SOURCE_COVERAGE,
  captureHeadline: 'Außenaufnahmen sind Pflicht, Kabine und Laderaum optional.',
};
