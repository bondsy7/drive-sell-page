/**
 * Reisemobil-Profil (Wohnmobil, Kastenwagen, Wohnwagen).
 *
 * Vollständig eigene Aufnahme-Slots. Beeinflusst Pkw, Lkw und Motorrad nicht.
 * Die Slots werden je nach Aufbautyp in `motorhome-workflow.ts` gefiltert
 * (Wohnwagen: kein Fahrerhaus/Cockpit).
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';
import front34Asset from '@/assets/motorhome-perspectives/34front.webp.asset.json';
import sideLeftAsset from '@/assets/motorhome-perspectives/side-left.webp.asset.json';
import sideRightAsset from '@/assets/motorhome-perspectives/side-right.webp.asset.json';
import rearAsset from '@/assets/motorhome-perspectives/rear.webp.asset.json';
import cockpitAsset from '@/assets/motorhome-perspectives/cockpit.webp.asset.json';
import livingAsset from '@/assets/motorhome-perspectives/living.webp.asset.json';
import kitchenAsset from '@/assets/motorhome-perspectives/kitchen.webp.asset.json';
import bathAsset from '@/assets/motorhome-perspectives/bath.webp.asset.json';
import bedAsset from '@/assets/motorhome-perspectives/bed.webp.asset.json';
import garageAsset from '@/assets/motorhome-perspectives/garage.webp.asset.json';
import vinReferenceAsset from '@/assets/capture-perspectives/vin.webp.asset.json';

export const MOTORHOME_CAPTURE_SLOTS: CaptureSlot[] = [
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
    key: 'cockpit',
    label: 'Fahrerhaus',
    icon: cockpitAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['womo_cockpit', 'int_front'],
  },
  {
    key: 'living',
    label: 'Wohnbereich',
    icon: livingAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['womo_living'],
  },
  {
    key: 'kitchen',
    label: 'Küche',
    icon: kitchenAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['womo_kitchen'],
  },
  {
    key: 'bath',
    label: 'Bad',
    icon: bathAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['womo_bath'],
  },
  {
    key: 'bed',
    label: 'Schlafbereich',
    icon: bedAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['womo_bed'],
  },
  {
    key: 'garage',
    label: 'Heckgarage',
    icon: garageAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['womo_garage'],
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

/** Keine harte Coverage-Anforderung – Innenräume sind optional. */
export const MOTORHOME_SOURCE_COVERAGE: Record<string, string[]> = {};

export const MOTORHOME_PROFILE: VehicleClassProfile = {
  key: 'motorhome',
  label: 'Reisemobil',
  description: 'Wohnmobil, Kastenwagen, Alkoven, Wohnwagen',
  remasterPromptProfile: 'motorhome',
  pipelineProfile: 'motorhome',
  validationProfile: 'car',
  pipelinePolicy: 'full',
  captureSlots: MOTORHOME_CAPTURE_SLOTS,
  hasWorkflowWizard: true,
  showSlotSections: true,
  allowedPipelineJobs: null,
  requiredSourceCoverage: MOTORHOME_SOURCE_COVERAGE,
  captureHeadline: 'Außenaufnahmen sind Pflicht, Innenräume optional.',
};
