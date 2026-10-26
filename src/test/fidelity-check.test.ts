import { describe, it, expect } from 'vitest';
import { decideFidelity, buildCorrections } from '../../supabase/functions/_shared/fidelity-check';

describe('fidelity decision', () => {
  it('FAIL bei sicherer Abweichung mit Beleg', () => {
    expect(decideFidelity([{ attribute: 'wheel_design', verdict: 'mismatch', confidence: 0.9, evidence_ref: 'IMAGE 2' }])).toBe('FAIL');
  });
  it('UNCERTAIN bei unsicherer Abweichung', () => {
    expect(decideFidelity([{ attribute: 'mirrors', verdict: 'mismatch', confidence: 0.6, evidence_ref: 'IMAGE 1' }])).toBe('UNCERTAIN');
  });
  it('UNCERTAIN wenn nichts prüfbar ist', () => {
    expect(decideFidelity([{ attribute: 'seats', verdict: 'unverifiable', confidence: 1 }])).toBe('UNCERTAIN');
  });
  it('PASS bei Übereinstimmung', () => {
    expect(decideFidelity([{ attribute: 'paint_color', verdict: 'match', confidence: 0.9 }])).toBe('PASS');
  });
  it('Korrekturliste im vereinbarten Format', () => {
    expect(buildCorrections([{ attribute: 'wheel_design', verdict: 'mismatch', confidence: 0.9, evidence_ref: 'IMAGE 2' }])[0])
      .toEqual({ attribute: 'wheel_design', issue: 'Differs from reference', instruction: 'Reproduce wheel_design exactly from the source reference' });
  });
});
