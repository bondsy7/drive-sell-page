/**
 * LKW-Profil.
 *
 * Slots werden NICHT statisch definiert, sondern über den 3-Schritt-Wizard
 * (Konfiguration → Aufbauart → Ladebereich) aufgelöst: siehe truck-workflow.ts.
 */
import type { VehicleClassProfile } from '../vehicle-class-types';

/**
 * Pipeline-Jobs, die für Lkw freigegeben sind (Stufe „restricted“).
 * Pkw-spezifische Jobs (Rücksitzbank, Grid-/CI-Markenlayouts, Low-Angle-
 * Sportaufnahmen) bleiben bewusst ausgeschlossen.
 *
 * Jeder Job nennt die Coverage-Tags, die dafür im Quellmaterial vorliegen
 * müssen. Fehlt ein Tag, wird der Job nicht angeboten.
 */
export const TRUCK_PIPELINE_JOB_COVERAGE: Record<string, string[]> = {
  MASTER_IMAGE: ['cab_34_front_left'],
  EXT_FRONT: ['front'],
  EXT_REAR: ['body_rear'],
  EXT_SIDE_LEFT: ['side_left'],
  EXT_SIDE_RIGHT: ['side_left'],
  EXT_34_FRONT_RIGHT: ['cab_34_front_left'],
  EXT_34_REAR_LEFT: ['body_rear'],
  EXT_34_REAR_RIGHT: ['body_rear'],
  DET_HEADLIGHT: ['cab_34_front_left'],
  DET_TAILLIGHT: ['body_rear'],
  DET_WHEEL: ['side_left'],
  DET_GRILLE: ['front'],
  INT_DASHBOARD: ['cockpit'],
  INT_WIDE_CABIN: ['cockpit'],
};

export const TRUCK_ALLOWED_PIPELINE_JOBS: string[] = Object.keys(TRUCK_PIPELINE_JOB_COVERAGE);

export const TRUCK_PROFILE: VehicleClassProfile = {
  key: 'truck',
  label: 'Lkw',
  description: 'Nutzfahrzeuge über 3,5 t: Zugmaschinen, Motorwagen, Auflieger',
  remasterPromptProfile: 'truck',
  pipelineProfile: 'truck',
  validationProfile: 'truck',
  // Lkw laufen zunächst in der eingeschränkten Stufe: nur abgesicherte Jobs.
  pipelinePolicy: 'restricted',
  captureSlots: [],
  hasWorkflowWizard: true,
  showSlotSections: true,
  allowedPipelineJobs: TRUCK_ALLOWED_PIPELINE_JOBS,
  requiredSourceCoverage: {},
  captureHeadline: 'Aufnahmen passend zur gewählten Lkw-Konfiguration',
};
