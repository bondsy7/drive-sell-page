import type { CaptureSlot } from "@/config/vehicle-class-types";

/**
 * Pflichtaufnahme: muss vor dem Remastern vorliegen – weder eine nur empfohlene
 * Rundgang-Referenz noch eine reine Eingabe-Referenz.
 */
export function isPflichtSlot(slot: CaptureSlot): boolean {
  return slot.required !== false && !slot.recommended && !slot.referenceOnly;
}

/**
 * Rahmen eines Aufnahme-Kastens.
 *
 * - Pflichtaufnahmen: roter Rahmen, damit sofort klar ist, was fehlen darf nicht.
 * - Empfohlene Referenzen (noch leer): dezenter gestrichelter Rahmen.
 * - Alles andere: normaler Rahmen.
 */
export function captureSlotFrameClass(slot: CaptureSlot, hasCapture: boolean): string {
  if (slot.recommended && !hasCapture) {
    return "border border-dashed border-muted-foreground/40";
  }
  if (isPflichtSlot(slot)) {
    return "border-2 border-solid border-destructive/70 hover:border-destructive";
  }
  return "border border-solid border-border hover:border-accent/50";
}
