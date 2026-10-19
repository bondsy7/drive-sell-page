import type { CaptureSlot } from '@/config/vehicle-class-types';
export function remasterPerspectives(slots: CaptureSlot[], roles: string[]): string[] {
  return roles.map((role, index) => slots.find(slot => slot.key === role)?.label || `Bild ${index + 1}`);
}
export function unsavedRemasterInputs<T>(items: T[], savedIds?: (string | undefined)[]): { item: T; index: number }[] {
  return items.map((item, index) => ({ item, index })).filter(({ index }) => !savedIds?.[index]);
}