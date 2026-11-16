import { describe, expect, it } from 'vitest';
import { normalizeTextFrame, resizeTextFrame, textFrameOuterCss } from './landing-text-frame';

describe('Landingpage-Textbreiten', () => {
  it('zieht den rechten Rand von 100 auf 60 Prozent', () => {
    expect(resizeTextFrame({ widthPct: 100, offsetPct: 0 }, -40, 'right')).toEqual({ widthPct: 60, offsetPct: 0 });
  });

  it('zieht den linken Rand auf 40 Prozent ein und behält die rechte Kante', () => {
    expect(resizeTextFrame({ widthPct: 100, offsetPct: 0 }, 40, 'left')).toEqual({ widthPct: 60, offsetPct: 40 });
  });

  it('verhindert schmalere Blöcke als 20 Prozent und ungültige Verschiebungen', () => {
    expect(resizeTextFrame({ widthPct: 50, offsetPct: 25 }, -100, 'right')).toEqual({ widthPct: 20, offsetPct: 25 });
    expect(normalizeTextFrame({ widthPct: 80, offsetPct: 50 })).toEqual({ widthPct: 80, offsetPct: 20 });
  });

  it('gibt exakt dieselbe prozentuale Geometrie an den HTML-Export weiter', () => {
    expect(textFrameOuterCss({ widthPct: 62.5, offsetPct: 12.5 })).toBe('width:62.5%;margin-left:12.5%');
  });
});
