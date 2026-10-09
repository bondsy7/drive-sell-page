import { describe, it, expect } from 'vitest';
import { buildHeadlightModeRule } from '@/lib/pipeline-jobs';

describe('Scheinwerfer-Weiche', () => {
  it('mit Nahaufnahme: Lampendetails nur aus der Nahaufnahme', () => {
    expect(buildHeadlightModeRule(true)).toContain('CLOSE-UP. The attached detail close-up photo(s) are the ONLY source');
  });
  it('ohne Nahaufnahme: sauberer OEM-Scheinwerfer statt erfundener Matrix', () => {
    const r = buildHeadlightModeRule(false);
    expect(r).toContain('NO CLOSE-UP');
    expect(r).toContain('Never invent matrix cubes');
  });
});
