import type {
  CaptureSlot,
  CaptureWorkflowSelection,
  VehicleClassProfile,
} from './vehicle-class-types';
import { resolveTruckSlots } from './truck-workflow';
import { resolveMotorhomeSlots } from './motorhome-workflow';

/**
 * Einheitlicher Einstiegspunkt für Capture-Slots.
 * Profile ohne Wizard liefern ihre statischen Slots (Pkw: unverändert),
 * Profile mit Wizard lösen dynamisch auf (Lkw, Reisemobil).
 */
export function resolveCaptureSlots(
  profile: VehicleClassProfile,
  selection?: CaptureWorkflowSelection | null,
): CaptureSlot[] {
  if (!profile.hasWorkflowWizard) return profile.captureSlots;
  if (profile.key === 'truck') return resolveTruckSlots(selection ?? {});
  if (profile.key === 'motorhome') return resolveMotorhomeSlots(selection?.motorhomeBodyType ?? null);
  return profile.captureSlots;
}
