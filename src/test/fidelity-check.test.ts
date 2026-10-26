import { describe, it, expect } from 'vitest';
import {
  decideFidelity, buildCorrections, selectFidelityReferences, shouldRunFidelityCheck, isCriticalAttribute,
} from '../../supabase/functions/_shared/fidelity-check';

describe('fidelity decision', () => {
  it('FAIL bei sicherer kritischer Abweichung mit Beleg', () => {
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
  it('normale Abweichung (badges) mit hoher Konfidenz und Beleg → UNCERTAIN, nicht FAIL', () => {
    expect(decideFidelity([
      { attribute: 'paint_color', verdict: 'match', confidence: 0.95 },
      { attribute: 'badges', verdict: 'mismatch', confidence: 0.95, evidence_ref: 'IMAGE 1' },
    ])).toBe('UNCERTAIN');
  });
  it('kritische Abweichung ohne Referenzbeleg → UNCERTAIN, nicht FAIL', () => {
    expect(decideFidelity([{ attribute: 'paint_color', verdict: 'mismatch', confidence: 0.95 }])).toBe('UNCERTAIN');
  });
  it('kritische Abweichung mit niedriger Konfidenz → UNCERTAIN', () => {
    expect(decideFidelity([{ attribute: 'lights', verdict: 'mismatch', confidence: 0.5, evidence_ref: 'IMAGE 1' }])).toBe('UNCERTAIN');
  });
  it('Korrekturliste nur für kritische Abweichungen im vereinbarten Format', () => {
    expect(buildCorrections([{ attribute: 'wheel_design', verdict: 'mismatch', confidence: 0.9, evidence_ref: 'IMAGE 2' }])[0])
      .toEqual({ attribute: 'wheel_design', issue: 'Differs from reference', instruction: 'Reproduce wheel_design exactly from the source reference' });
    expect(buildCorrections([{ attribute: 'badges', verdict: 'mismatch', confidence: 0.95, evidence_ref: 'IMAGE 1' }])).toEqual([]);
  });
  it('Attribut-Klassifizierung: kritisch vs. normal', () => {
    for (const a of ['body_shape', 'paint_color', 'wheel_design', 'lights', 'front_rear', 'interior', 'seats', 'cockpit']) {
      expect(isCriticalAttribute(a)).toBe(true);
    }
    for (const a of ['badges', 'sensors', 'mirrors', 'special_equipment']) {
      expect(isCriticalAttribute(a)).toBe(false);
    }
  });
});

describe('fidelity shadow check scope', () => {
  it('läuft für jeden Generierungsweg – NB21 V2/V3 fallen nicht heraus', () => {
    // Der frühere Ausschluss (!isNb21V2 && !isNb21V3) ist entfernt; die Entscheidung
    // hängt nur noch an Prüfer-Schlüssel und Hauptreferenz, nie an der Prompt-Version.
    expect(shouldRunFidelityCheck({ hasValidatorKey: true, hasMainReference: true })).toBe(true);
  });
  it('überspringt nur ohne Prüfer-Schlüssel oder Hauptreferenz', () => {
    expect(shouldRunFidelityCheck({ hasValidatorKey: false, hasMainReference: true })).toBe(false);
    expect(shouldRunFidelityCheck({ hasValidatorKey: true, hasMainReference: false })).toBe(false);
  });
});

describe('fidelity reference selection', () => {
  const cand = (role: string) => ({ role, part: `part:${role}` });
  it('Außenziel: Felgenreferenz zuerst, danach zielpassende Referenz', () => {
    const selected = selectFidelityReferences({
      targetHint: '34rear rear',
      candidates: [cand('front detail'), cand('wheel reference'), cand('rear_original (34rear)')],
    });
    expect(selected.map((s) => s.role)).toEqual(['wheel reference', 'rear_original (34rear)']);
  });
  it('Innenraumziel: Innenraumreferenz, keine Felge', () => {
    const selected = selectFidelityReferences({
      targetHint: 'interior-front cockpit',
      candidates: [cand('wheel reference'), cand('cabin_original (cockpit)'), cand('front detail')],
    });
    expect(selected.map((s) => s.role)).toEqual(['cabin_original (cockpit)', 'front detail']);
  });
  it('maximal 2 Zusatzreferenzen (insgesamt 3 inkl. Hauptbild)', () => {
    const selected = selectFidelityReferences({
      targetHint: 'side',
      candidates: [cand('a'), cand('b'), cand('c'), cand('d')],
    });
    expect(selected).toHaveLength(2);
  });
  it('keine Kandidaten → leere Auswahl', () => {
    expect(selectFidelityReferences({ targetHint: 'front', candidates: [] })).toEqual([]);
  });
});
