import { describe, it, expect } from 'vitest';
import { selectReferences, missingRequiredSlots, estimatePresetCredits, AUTO3_STANDARD_PRESET, preparationStatusLabel, oneshotHandoffUrl, type OriginalAnalysis } from '@/lib/auto3-oneshot';

const a = (file: string, category: OriginalAnalysis['category'], quality = 80, vehicleComplete = true): OriginalAnalysis => ({ file, category, quality, vehicleComplete });

describe('auto3 oneshot selection', () => {
  it('picks best original per slot, each once', () => {
    const s = selectReferences([a('1', 'front', 90), a('2', 'front_3_4', 70), a('3', 'side'), a('4', 'rear_3_4'), a('5', 'interior_front'), a('6', 'rear_seats'), a('7', 'detail')]);
    expect(s.slots).toEqual({ '34front': '2', side: '3', rear: '4', 'interior-front': '5', 'interior-rear': '6' });
    expect(s.details).toContain('7');
    expect(s.details).not.toContain('2');
  });
  it('skips unusable and cropped exteriors', () => {
    const s = selectReferences([a('1', 'front_3_4', 90, false), a('2', 'front', 70), a('3', 'other', 99), a('4', 'side', 10)]);
    expect(s.slots['34front']).toBe('2');
    expect(s.slots.side).toBeUndefined();
    expect(missingRequiredSlots(s)).toEqual(['side', 'rear']);
  });
  it('video off by default; pipeline credits only for billed lines', () => {
    expect(AUTO3_STANDARD_PRESET.video).toBe(false);
    const c = estimatePresetCredits({ ...AUTO3_STANDARD_PRESET, video: true }, 'Volkswagen');
    expect(c.pipelineCredits).toBe(c.images * 2);
    expect(c.optionalCredits).toBeGreaterThan(0);
  });
  it('status + handoff', () => {
    expect(preparationStatusLabel('ready_for_oneshot', 20)).toBe('20 Originale · bereit für Aufbereitung');
    expect(oneshotHandoffUrl('x')).toBe('/generator/fotos?vehicle=x&originals=auto3&prep=1');
  });
});
