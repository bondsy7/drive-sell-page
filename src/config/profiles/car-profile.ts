/**
 * PKW-Profil.
 *
 * Datenreihenfolge (Array-Reihenfolge) ist historisch: 3/4 Front, Seite,
 * Heck, Interieur vorne, Interieur hinten. Darauf bauen gespeicherte
 * Originale, Galerie-Beschriftungen und Fallbacks auf – diese Reihenfolge
 * und die Keys dürfen sich NICHT ändern. Neue empfohlene Rundgang-Slots
 * werden deshalb HINTEN angehängt und nur über `displayOrder` in die
 * Rundgang-Reihenfolge (Front → links herum → Front rechts) einsortiert.
 * Empfohlene Slots sind `referenceOnly`: kein eigenes Remastering, kein
 * zusätzlicher Output, keine zusätzlichen Credits.
 */
import type { CaptureSlot, VehicleClassProfile } from '../vehicle-class-types';
import frontThreeQuarterIcon from '@/assets/capture-perspectives/34front.webp.asset.json';
import frontIcon from '@/assets/capture-perspectives/front.webp.asset.json';
import sideIcon from '@/assets/capture-perspectives/seite.webp.asset.json';
import rearIcon from '@/assets/capture-perspectives/back.webp.asset.json';
import rearThreeQuarterIcon from '@/assets/capture-perspectives/34rear.webp.asset.json';
import cockpitIcon from '@/assets/capture-perspectives/cockpit.webp.asset.json';
import rearSeatIcon from '@/assets/capture-perspectives/rucksitz.webp.asset.json';

export const CAR_CAPTURE_SLOTS: CaptureSlot[] = [
  {
    key: '34front',
    label: '3/4 Front links',
    icon: frontThreeQuarterIcon.url,
    // Das Referenz-Asset zeigt die rechte Fahrzeugseite; für „3/4 Front links" gespiegelt.
    iconFlip: true,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    displayOrder: 2,
    coverageTags: ['ext_front', '34_front_left'],
  },
  {
    key: 'side',
    label: 'Seite links',
    icon: sideIcon.url,
    // Das Referenz-Asset zeigt die rechte Fahrzeugseite; für „Seite links" gespiegelt.
    iconFlip: true,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    displayOrder: 3,
    coverageTags: ['ext_side_left', 'side_left'],
  },
  {
    key: 'rear',
    label: 'Heck',
    icon: rearIcon.url,
    capture: 'environment',
    required: true,
    aspect: '4/3',
    displayOrder: 5,
    coverageTags: ['ext_rear', 'rear'],
  },
  {
    key: 'interior-front',
    label: 'Interieur Fahrersitz',
    icon: cockpitIcon.url,
    capture: 'environment',
    required: false,
    aspect: '4/3',
    displayOrder: 8,
    coverageTags: ['interior_front', 'cockpit'],
  },
  {
    key: 'interior-rear',
    label: 'Interieur Rücksitz',
    icon: rearSeatIcon.url,
    capture: 'environment',
    required: false,
    aspect: '4/3',
    displayOrder: 9,
    coverageTags: ['interior_rear'],
  },
  // ── Empfohlene Rundgang-Referenzen (nur Eingabe, kein eigener Output) ──
  {
    key: 'front',
    label: 'Front',
    icon: frontIcon.url,
    capture: 'environment',
    required: false,
    recommended: true,
    referenceOnly: true,
    aspect: '4/3',
    displayOrder: 1,
    coverageTags: ['ext_front_center', 'front_center'],
  },
  {
    key: '34rear',
    label: '3/4 Heck links',
    icon: rearThreeQuarterIcon.url,
    capture: 'environment',
    required: false,
    recommended: true,
    referenceOnly: true,
    aspect: '4/3',
    displayOrder: 4,
    coverageTags: ['ext_34_rear_left', '34_rear_left'],
  },
  {
    key: 'side-right',
    label: 'Seite rechts',
    icon: sideIcon.url,
    capture: 'environment',
    required: false,
    recommended: true,
    referenceOnly: true,
    aspect: '4/3',
    displayOrder: 6,
    coverageTags: ['ext_side_right', 'side_right'],
  },
  {
    key: '34front-right',
    label: '3/4 Front rechts',
    icon: frontThreeQuarterIcon.url,
    capture: 'environment',
    required: false,
    recommended: true,
    referenceOnly: true,
    aspect: '4/3',
    displayOrder: 7,
    coverageTags: ['ext_34_front_right', '34_front_right'],
  },
  {
    key: '34rear-right',
    label: '3/4 Heck rechts',
    icon: rearThreeQuarterIcon.url,
    // Das Referenz-Asset zeigt 3/4 Heck links; für rechts gespiegelt.
    iconFlip: true,
    capture: 'environment',
    required: false,
    recommended: true,
    referenceOnly: true,
    aspect: '4/3',
    displayOrder: 5.5,
    coverageTags: ['ext_34_rear_right', '34_rear_right'],
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

/** Slot-Keys, die nur als Eingabe-Referenz dienen (kein Remastering, kein Galerie-Eintrag). */
export const REFERENCE_ONLY_SLOT_KEYS = new Set(
  CAR_CAPTURE_SLOTS.filter(s => s.referenceOnly).map(s => s.key),
);

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
