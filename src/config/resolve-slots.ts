import type {
  CaptureSlot,
  TruckWorkflowSelection,
  VehicleClassProfile,
} from './vehicle-class-types';
import { resolveTruckSlots } from './truck-workflow';

/**
 * Einheitlicher Einstiegspunkt für Capture-Slots.
 * Profile ohne Wizard liefern ihre statischen Slots (Pkw: unverändert),
 * Profile mit Wizard lösen dynamisch auf (Lkw).
 */
export function resolveCaptureSlots(
  profile: VehicleClassProfile,
  selection?: Partial<TruckWorkflowSelection> | null,
): CaptureSlot[] {
  if (!profile.hasWorkflowWizard) return profile.captureSlots;
  if (profile.key === 'truck') return resolveTruckSlots(selection ?? {});
  return profile.captureSlots;
}
