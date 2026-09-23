/**
 * Land- & Baumaschinen-Profil.
 *
 * Vollständig eigene Aufnahme-Slots. Beeinflusst Pkw, Lkw, Motorrad,
 * Reisemobil und Transporter nicht. Kein Wizard.
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';
import front34Asset from '@/assets/machinery-perspectives/34front.webp.asset.json';
import sideLeftAsset from '@/assets/machinery-perspectives/side-left.webp.asset.json';
import sideRightAsset from '@/assets/machinery-perspectives/side-right.webp.asset.json';
import rearAsset from '@/assets/machinery-perspectives/rear.webp.asset.json';
import frontAsset from '@/assets/machinery-perspectives/front.webp.asset.json';
import cabinAsset from '@/assets/machinery-perspectives/cabin.webp.asset.json';
import controlsAsset from '@/assets/machinery-perspectives/controls.webp.asset.json';
import undercarriageAsset from '@/assets/machinery-perspectives/undercarriage.webp.asset.json';
import vinReferenceAsset from '@/assets/capture-perspectives/vin.webp.asset.json';

export const MACHINERY_CAPTURE_SLOTS: CaptureSlot[] = [
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
    coverageTags: ['machinery_front'],
  },
  {
    key: 'cabin',
    label: 'Fahrerkabine',
    icon: cabinAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['machinery_cabin', 'int_front'],
  },
  {
    key: 'controls',
    label: 'Bedienstand',
    icon: controlsAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['machinery_controls'],
  },
  {
    key: 'undercarriage',
    label: 'Fahrwerk / Kette',
    icon: undercarriageAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    coverageTags: ['machinery_undercarriage', 'wheel'],
  },
  {
    key: 'vin',
    label: 'VIN / Fahrgestell- / Seriennummer',
    icon: vinReferenceAsset.url,
    required: false,
    aspect: '4/3',
    capture: 'environment',
    isVin: true,
    coverageTags: ['vin'],
  },
];

/** Keine harte Coverage-Anforderung – Kabine und Details sind optional. */
export const MACHINERY_SOURCE_COVERAGE: Record<string, string[]> = {};

export const MACHINERY_PROFILE: VehicleClassProfile = {
  key: 'machinery',
  label: 'Baumaschinen',
  description: 'Traktoren, Bagger, Radlader, Teleskoplader, Land- & Baumaschinen',
  remasterPromptProfile: 'machinery',
  pipelineProfile: 'machinery',
  validationProfile: 'car',
  pipelinePolicy: 'full',
  captureSlots: MACHINERY_CAPTURE_SLOTS,
  hasWorkflowWizard: false,
  showSlotSections: true,
  allowedPipelineJobs: null,
  requiredSourceCoverage: MACHINERY_SOURCE_COVERAGE,
  captureHeadline: 'Außenaufnahmen sind Pflicht, Kabine und Detailaufnahmen optional.',
};
