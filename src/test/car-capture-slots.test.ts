import { describe, it, expect } from 'vitest';
import { CAR_CAPTURE_SLOTS } from '@/config/profiles/car-profile';

describe('Pkw-Aufnahmefelder', () => {
  it('historische Datenreihenfolge bleibt unverändert', () => {
    expect(CAR_CAPTURE_SLOTS.slice(0, 5).map(s => s.key)).toEqual(['34front', 'side', 'rear', 'interior-front', 'interior-rear']);
  });
  it('Rundgang beginnt mit der Front und endet mit 3/4 Front rechts', () => {
    const tour = CAR_CAPTURE_SLOTS.filter(s => !s.isVin && (s.displayOrder ?? 99) <= 7)
      .sort((a, b) => a.displayOrder! - b.displayOrder!).map(s => s.key);
    expect(tour).toEqual(['front', '34front', 'side', '34rear', 'rear', '34rear-right', 'side-right', '34front-right']);
  });
  it('empfohlene Felder sind keine Pflicht und erzeugen keinen eigenen Output', () => {
    const rec = CAR_CAPTURE_SLOTS.filter(s => s.recommended);
    expect(rec.map(s => s.key).sort()).toEqual(['34front-right', '34rear', '34rear-right', 'front', 'side-right']);
    rec.forEach(s => { expect(s.required).toBe(false); expect(s.referenceOnly).toBe(true); });
  });
  it('3/4 Heck rechts ist gespiegelt und sitzt zwischen Heck und Seite rechts', () => {
    const slot = CAR_CAPTURE_SLOTS.find(s => s.key === '34rear-right');
    expect(slot?.iconFlip).toBe(true);
    expect(slot?.displayOrder).toBeGreaterThan(
      CAR_CAPTURE_SLOTS.find(s => s.key === 'rear')!.displayOrder!,
    );
    expect(slot?.displayOrder).toBeLessThan(
      CAR_CAPTURE_SLOTS.find(s => s.key === 'side-right')!.displayOrder!,
    );
  });
  it('Pflicht bleibt bei 3/4 Front, Seite, Heck', () => {
    expect(CAR_CAPTURE_SLOTS.filter(s => s.required).map(s => s.key)).toEqual(['34front', 'side', 'rear']);
  });
});
