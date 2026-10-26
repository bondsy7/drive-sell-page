import { describe, it, expect } from 'vitest';
import { reorderSections, liveInsertIndex, LIVE_AT_START } from './landing-section-order';

const c: { sections: { id: string }[]; liveInventoryAfter?: string } = { sections: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };

describe('landing section order', () => {
  it('moves a section between others', () => {
    expect(reorderSections(c, 'c', 'a', 'after').sections.map(s => s.id)).toEqual(['a', 'c', 'b']);
  });
  it('live block defaults to the end and can move to the start', () => {
    expect(liveInsertIndex(c)).toBe(3);
    const r = reorderSections(c, 'live-fahrzeuge', 'a', 'before');
    expect(r.liveInventoryAfter).toBe(LIVE_AT_START);
    expect(liveInsertIndex({ ...c, ...r })).toBe(0);
  });
  it('live block stays anchored after its section', () => {
    const r = reorderSections(c, 'live-fahrzeuge', 'a', 'after');
    expect(r.liveInventoryAfter).toBe('a');
    expect(liveInsertIndex({ ...c, ...r })).toBe(1);
  });
});
