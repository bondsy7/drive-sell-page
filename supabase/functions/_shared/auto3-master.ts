// Pure master-image selection for the Auto3 → OneShot single-upload flow.
// Picks exactly ONE original as the OneShot master. Interior, engine, detail and
// unusable shots can never become the master. No Deno APIs: also unit-tested via vitest.

export interface MasterCandidate {
  file: string;
  category: string;
  quality: number;
  vehicleComplete: boolean;
  note?: string;
}

/** Preference bonus per exterior category (3/4 front is the OneShot hero perspective). */
const EXTERIOR_BONUS: Record<string, number> = {
  front_3_4: 30,
  front: 15,
  side: 10,
  rear_3_4: 5,
  rear: 0,
};

const CATEGORY_DE: Record<string, string> = {
  front_3_4: '3/4 Front', front: 'Front', side: 'Seite', rear_3_4: '3/4 Heck', rear: 'Heck',
};

export const MASTER_MIN_QUALITY = 40;

export interface MasterSelection {
  file: string;
  category: string;
  quality: number;
  score: number;
  reason: string;
  /** Ranked runner-ups (for manual override in the UI). */
  alternatives: { file: string; category: string; quality: number; score: number }[];
}

export function masterScore(a: MasterCandidate): number | null {
  const bonus = EXTERIOR_BONUS[a.category];
  if (bonus === undefined) return null; // interior / engine / detail / other never master
  if (!a.vehicleComplete) return null;   // cropped vehicles never master
  if (a.quality < MASTER_MIN_QUALITY) return null;
  return a.quality + bonus;
}

export function selectMaster(analysis: MasterCandidate[]): MasterSelection | null {
  const ranked = analysis
    .map((a) => ({ a, s: masterScore(a) }))
    .filter((x): x is { a: MasterCandidate; s: number } => x.s !== null)
    .sort((x, y) => y.s - x.s || x.a.file.localeCompare(y.a.file));
  if (!ranked.length) return null;
  const best = ranked[0];
  const parts = [
    `${CATEGORY_DE[best.a.category] || best.a.category}-Aufnahme`,
    'Fahrzeug vollständig im Bild',
    `Qualität ${best.a.quality}/100`,
  ];
  if (best.a.category !== 'front_3_4') {
    const hasFront34 = analysis.some((a) => a.category === 'front_3_4');
    parts.push(hasFront34 ? 'besser bewertet als vorhandene 3/4-Front-Aufnahmen' : 'keine geeignete 3/4-Front-Aufnahme vorhanden');
  }
  return {
    file: best.a.file,
    category: best.a.category,
    quality: best.a.quality,
    score: best.s,
    reason: parts.join(' · '),
    alternatives: ranked.slice(1, 6).map((x) => ({ file: x.a.file, category: x.a.category, quality: x.a.quality, score: x.s })),
  };
}

const INTERIOR_PREF: Record<string, string[]> = {
  'interior-front': ['interior_front', 'front_seats', 'cockpit'],
  'interior-rear': ['rear_seats', 'interior_front'],
  cockpit: ['cockpit', 'interior_front'],
};

/** Best original to use as reference for an interior perspective (never invents one). */
export function selectInteriorReference(analysis: MasterCandidate[], slot: keyof typeof INTERIOR_PREF | string): string | null {
  const prefs = INTERIOR_PREF[slot] || INTERIOR_PREF['interior-front'];
  let best: { file: string; s: number } | null = null;
  for (const a of analysis) {
    const rank = prefs.indexOf(a.category);
    if (rank < 0 || a.quality < MASTER_MIN_QUALITY) continue;
    const s = a.quality - rank * 15;
    if (!best || s > best.s) best = { file: a.file, s };
  }
  return best?.file ?? null;
}
