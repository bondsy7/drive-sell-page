import { describe, it, expect } from 'vitest';
import { CAR_CAPTURE_SLOTS } from '@/config/profiles/car-profile';
import { captureSlotFrameClass, isPflichtSlot } from '@/lib/capture-slot-frame';

describe('Rahmen der Aufnahme-Kästen', () => {
  it('Pflichtaufnahmen stehen in einem roten Rahmen, leer und gefüllt', () => {
    const pflichtKeys = CAR_CAPTURE_SLOTS.filter(isPflichtSlot).map(s => s.key);
    expect(pflichtKeys).toEqual(['34front', 'side', 'rear']);
    CAR_CAPTURE_SLOTS.filter(isPflichtSlot).forEach(s => {
      expect(captureSlotFrameClass(s, false)).toContain('border-destructive');
      expect(captureSlotFrameClass(s, true)).toContain('border-destructive');
    });
  });

  it('empfohlene Referenzen bleiben gestrichelt, VIN wird nie rot', () => {
    const front = CAR_CAPTURE_SLOTS.find(s => s.key === 'front')!;
    expect(captureSlotFrameClass(front, false)).toContain('border-dashed');
    expect(captureSlotFrameClass(front, false)).not.toContain('border-destructive');
    expect(captureSlotFrameClass(front, true)).not.toContain('border-destructive');
    const vin = CAR_CAPTURE_SLOTS.find(s => s.isVin)!;
    expect(captureSlotFrameClass(vin, false)).not.toContain('border-destructive');
    expect(isPflichtSlot(vin)).toBe(false);
  });
});
