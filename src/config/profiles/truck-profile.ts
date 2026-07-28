/**
 * LKW-Profil.
 *
 * Slots werden NICHT statisch definiert, sondern über den 3-Schritt-Wizard
 * (Konfiguration → Aufbauart → Ladebereich) aufgelöst: siehe truck-workflow.ts.
 */
import type { VehicleClassProfile } from '../vehicle-class-types';

/**
 * Pipeline-Jobs, die für Lkw freigegeben sind.
 * Pkw-spezifische Jobs (z. B. Interieur-Rücksitz-Szenen) bleiben ausgeschlossen.
 */
export const TRUCK_ALLOWED_PIPELINE_JOBS: string[] = [
  'hero',
  'hero-front',
  'side',
  'rear',
  'detail-front',
  'detail-rear',
  'detail-wheel',
  'interior-cockpit',
];

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
