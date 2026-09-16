/**
 * Reisemobil-Workflow: Aufbautyp-Auswahl und daraus abgeleitete Aufnahme-Slots.
 * Vollständig getrennt vom Lkw-Workflow – keine gemeinsame Logik.
 */
import type { CaptureSlot, MotorhomeBodyTypeKey } from './vehicle-class-types';
import { MOTORHOME_CAPTURE_SLOTS } from './profiles/motorhome-profile';

export interface MotorhomeBodyTypeOption {
  key: MotorhomeBodyTypeKey;
  label: string;
  description: string;
}

export const MOTORHOME_BODY_TYPES: MotorhomeBodyTypeOption[] = [
  {
    key: 'semi_integrated',
    label: 'Teilintegriert',
    description: 'Aufbau hinter dem Fahrerhaus, kein Alkoven',
  },
  {
    key: 'alcove',
    label: 'Alkoven',
    description: 'Schlafalkoven über dem Fahrerhaus',
  },
  {
    key: 'fully_integrated',
    label: 'Vollintegriert',
    description: 'Durchgehender Aufbau, Panorama-Frontscheibe',
  },
  {
    key: 'campervan',
    label: 'Kastenwagen',
    description: 'Campervan auf Kastenwagen-Basis, Schiebetür',
  },
  {
    key: 'caravan',
    label: 'Wohnwagen',
    description: 'Anhänger ohne Fahrerhaus, mit Deichsel',
  },
];

export function isMotorhomeSelectionComplete(
  bodyType?: MotorhomeBodyTypeKey | null,
): boolean {
  return !!bodyType && MOTORHOME_BODY_TYPES.some((o) => o.key === bodyType);
}

export function getMotorhomeBodyType(
  bodyType?: MotorhomeBodyTypeKey | null,
): MotorhomeBodyTypeOption | null {
  return MOTORHOME_BODY_TYPES.find((o) => o.key === bodyType) ?? null;
}

/** Wohnwagen haben kein Fahrerhaus – der Cockpit-Slot entfällt. */
export function resolveMotorhomeSlots(
  bodyType?: MotorhomeBodyTypeKey | null,
): CaptureSlot[] {
  if (bodyType !== 'caravan') return MOTORHOME_CAPTURE_SLOTS;
  return MOTORHOME_CAPTURE_SLOTS.filter((s) => s.key !== 'cockpit');
}
