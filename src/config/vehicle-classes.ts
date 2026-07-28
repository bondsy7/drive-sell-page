/**
 * Central, extensible vehicle-class registry.
 *
 * ONLY `car` and `truck` are active. All other keys exist purely as typed
 * extension points so future vehicle groups can be added by registering a
 * profile — WITHOUT touching ImageCaptureGrid, PipelineRunner, PipelineContext,
 * the remaster edge function or the gallery.
 *
 * Rules:
 * - Components must NEVER switch on a vehicle class. They resolve a profile.
 * - A missing vehicleClass ALWAYS resolves to 'car' (backwards compatibility).
 */

// ── Keys ────────────────────────────────────────────────────────────────────

/** Vehicle classes that are functionally implemented and visible in the UI. */
export type ActiveVehicleClassKey = 'car' | 'truck';

/**
 * All vehicle classes the architecture is prepared for.
 * NOT active — no UI, no slots, no prompts, no pipeline jobs.
 */
export type VehicleClassKey =
  | ActiveVehicleClassKey
  | 'motorcycle'
  | 'ebike'
  | 'motorhome'
  | 'campervan'
  | 'caravan'
  | 'bus'
  | 'agriculture'
  | 'construction_machine'
  | 'special_vehicle';

export const ACTIVE_VEHICLE_CLASSES: ActiveVehicleClassKey[] = ['car', 'truck'];

export type TruckConfigurationKey =
  | 'tractor_unit'
  | 'rigid_truck'
  | 'rigid_truck_with_trailer'
  | 'semi_truck'
  | 'semi_truck_with_trailer'
  | 'trailer_only';

export type TruckBodyTypeKey =
  | 'box_closed'
  | 'platform_open'
  | 'tipper'
  | 'tank'
  | 'low_loader'
  | 'vehicle_transport'
  | 'unknown';

export type CargoStateKey =
  | 'empty'
  | 'loaded_accessible'
  | 'not_accessible'
  | 'not_applicable';

export type SubjectScopeKey =
  | 'car_complete'
  | 'tractor_unit_only'
  | 'rigid_truck_complete'
  | 'rigid_truck_and_trailer_complete'
  | 'tractor_and_semi_trailer_complete'
  | 'complete_multi_part_combination'
  | 'trailer_or_semi_trailer_only';

// ── Slots ───────────────────────────────────────────────────────────────────

export type SlotAspect = '4/3' | '16/9' | '2/1';

export interface CaptureSlot {
  /** Stable technical key – used for storage, coverage and prompt selection. */
  key: string;
  /** German UI label. */
  label: string;
  /** Optional PNG icon (car workflow uses the existing perspective icons). */
  icon?: string;
  /** Optional sketch id for SVG line drawings (truck workflow). */
  sketch?: string;
  /** Short capture hint shown below the label. */
  hint?: string;
  required: boolean;
  aspect: SlotAspect;
  capture: 'environment' | 'user';
  isVin?: boolean;
  /** Source-coverage tags this slot satisfies. */
  coverageTags: string[];
}

// ── Profile ─────────────────────────────────────────────────────────────────

export type PipelinePolicy = 'full' | 'restricted' | 'remaster_only';

export interface VehicleClassProfile {
  key: VehicleClassKey;
  label: string;
  description: string;
  /** Prompt namespace, e.g. 'car' -> remaster_car_*, 'truck' -> remaster_truck_* */
  remasterPromptProfile: string;
  pipelineProfile: string;
  validationProfile: string;
  pipelinePolicy: PipelinePolicy;
  /** Static slots. Classes with a wizard (truck) resolve slots dynamically instead. */
  captureSlots: CaptureSlot[];
  /** True when the class resolves its slots from a workflow selection. */
  hasWorkflowWizard: boolean;
  /** Visually split required vs. optional slots (truck) or render one flat grid (car). */
  showSlotSections: boolean;
  /** null => all existing PIPELINE_JOBS are allowed (car, unchanged). */
  allowedPipelineJobs: string[] | null;
  requiredSourceCoverage: Record<string, string[]>;
  /** Optional headline shown above the capture grid. */
  captureHeadline?: string;
  /** Reserved extension point for future vehicle groups. */
  experimental?: boolean;
}

export interface VehicleClassContext {
  vehicleClass: ActiveVehicleClassKey;
  truckConfiguration?: TruckConfigurationKey | null;
  truckBodyType?: TruckBodyTypeKey | null;
  cargoState?: CargoStateKey | null;
  subjectScope?: SubjectScopeKey | null;
  /** Slot key of the source photo being remastered. */
  sourcePerspectiveKey?: string | null;
}

// ── Registry ────────────────────────────────────────────────────────────────

import { CAR_PROFILE } from './profiles/car-profile';
import { TRUCK_PROFILE } from './profiles/truck-profile';

const REGISTRY: Partial<Record<VehicleClassKey, VehicleClassProfile>> = {
  car: CAR_PROFILE,
  truck: TRUCK_PROFILE,
};

export function isActiveVehicleClass(key: unknown): key is ActiveVehicleClassKey {
  return typeof key === 'string' && (ACTIVE_VEHICLE_CLASSES as string[]).includes(key);
}

/** Missing / unknown / inactive class always resolves to 'car'. */
export function resolveVehicleClass(value: unknown): ActiveVehicleClassKey {
  return isActiveVehicleClass(value) ? value : 'car';
}

export function getVehicleClassProfile(value: unknown): VehicleClassProfile {
  return REGISTRY[resolveVehicleClass(value)] as VehicleClassProfile;
}

export function getActiveProfiles(): VehicleClassProfile[] {
  return ACTIVE_VEHICLE_CLASSES.map((k) => REGISTRY[k] as VehicleClassProfile);
}
