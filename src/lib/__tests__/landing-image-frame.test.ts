import { describe, it, expect } from 'vitest';
import { snapEdge, normalizeImageFrame } from '@/lib/landing-image-frame';

describe('landing image frame', () => {
  it('rastet innerhalb von 5 px an der Nachbarkante ein', () => {
    expect(snapEdge(495, [500]).value).toBe(500);
    expect(snapEdge(505, [500]).value).toBe(500);
  });
  it('rastet ab 6 px Abstand nicht ein', () => {
    expect(snapEdge(494, [500])).toEqual({ value: 494, guide: null });
  });
  it('Rahmen darf nicht über die Inhaltsbreite hinaus', () => {
    const f = normalizeImageFrame({ widthPct: 140, offsetPct: 30 }, 1);
    expect(f.widthPct).toBe(100);
    expect(f.offsetPct).toBe(0);
    expect(normalizeImageFrame({ widthPct: 60, offsetPct: 70 }, 1).offsetPct).toBe(40);
  });
});
