// Auto3 → OneShot preparation: pure selection/status/cost helpers.
// Image analysis only decides perspective/quality/reference choice – vehicle facts always come from Auto3 vehicle_data.
import { PIPELINE_JOBS, detectBrandFromDescription, getTotalImageCount } from '@/lib/pipeline-jobs';
import { PRODUCT_CREDIT_ITEMS } from '@/lib/credit-prices';

/** Credits per generated pipeline image – same value the PipelineRunner confirmation dialog charges. */
export const PIPELINE_CREDIT_COST_PER_IMAGE = 2;

export type OriginalCategory =
  | 'front' | 'front_3_4' | 'side' | 'rear_3_4' | 'rear'
  | 'interior_front' | 'cockpit' | 'front_seats' | 'rear_seats'
  | 'detail' | 'engine' | 'other';

export const CATEGORY_LABEL: Record<OriginalCategory, string> = {
  front: 'Front', front_3_4: '3/4 Front', side: 'Seite', rear_3_4: '3/4 Heck', rear: 'Heck',
  interior_front: 'Innenraum vorn', cockpit: 'Cockpit', front_seats: 'Vordersitze', rear_seats: 'Rücksitze',
  detail: 'Detail', engine: 'Motorraum', other: 'Sonstiges',
};

export interface OriginalAnalysis {
  file: string;
  category: OriginalCategory;
  quality: number;
  vehicleComplete: boolean;
  note?: string;
}

export type PreparationStatus = 'imported' | 'analyzing_originals' | 'ready_for_oneshot' | 'analysis_failed' | 'started';

export interface PresetOptions {
  remaster: boolean;
  perspectives: boolean;
  banner: boolean;
  social: boolean;
  video: boolean;
}

export const AUTO3_STANDARD_PRESET: PresetOptions = {
  remaster: true, perspectives: true, banner: false, social: false, video: false,
};

/** Preference order per existing car capture slot (keys from CAR_CAPTURE_SLOTS). */
export const CAR_SLOT_PREFERENCES: Record<string, OriginalCategory[]> = {
  '34front': ['front_3_4', 'front'],
  side: ['side', 'front_3_4', 'rear_3_4'],
  rear: ['rear', 'rear_3_4'],
  'interior-front': ['interior_front', 'front_seats', 'cockpit'],
  'interior-rear': ['rear_seats'],
};
const EXTERIOR: OriginalCategory[] = ['front', 'front_3_4', 'side', 'rear_3_4', 'rear'];
const DETAIL_CATEGORIES: OriginalCategory[] = ['detail', 'cockpit', 'front_seats', 'engine', 'front', 'rear_3_4', 'front_3_4', 'rear', 'side', 'interior_front', 'rear_seats'];
export const MIN_USABLE_QUALITY = 35;
export const MAX_DETAIL_REFERENCES = 6;

const score = (a: OriginalAnalysis, rank: number) =>
  a.quality - rank * 15 + (EXTERIOR.includes(a.category) && a.vehicleComplete ? 10 : 0) - (EXTERIOR.includes(a.category) && !a.vehicleComplete ? 30 : 0);

export function isUsable(a: OriginalAnalysis): boolean {
  return a.category !== 'other' && a.quality >= MIN_USABLE_QUALITY;
}

export interface ReferenceSelection {
  slots: Record<string, string>;
  details: string[];
}

/** Picks the best original per slot (each original used at most once) plus extra detail references. */
export function selectReferences(analysis: OriginalAnalysis[], slotKeys: string[] = Object.keys(CAR_SLOT_PREFERENCES)): ReferenceSelection {
  const used = new Set<string>();
  const slots: Record<string, string> = {};
  for (const key of slotKeys) {
    const prefs = CAR_SLOT_PREFERENCES[key];
    if (!prefs) continue;
    let best: { file: string; s: number } | null = null;
    for (const a of analysis) {
      if (used.has(a.file) || !isUsable(a) || (EXTERIOR.includes(a.category) && !a.vehicleComplete)) continue;
      const rank = prefs.indexOf(a.category);
      if (rank < 0) continue;
      const s = score(a, rank);
      if (!best || s > best.s) best = { file: a.file, s };
    }
    if (best) { slots[key] = best.file; used.add(best.file); }
  }
  const details = analysis
    .filter((a) => !used.has(a.file) && isUsable(a) && DETAIL_CATEGORIES.includes(a.category))
    .sort((a, b) => (DETAIL_CATEGORIES.indexOf(a.category) - DETAIL_CATEGORIES.indexOf(b.category)) || b.quality - a.quality)
    .slice(0, MAX_DETAIL_REFERENCES)
    .map((a) => a.file);
  return { slots, details };
}

export const REQUIRED_CAR_SLOTS = ['34front', 'side', 'rear'];
export function missingRequiredSlots(sel: ReferenceSelection): string[] {
  return REQUIRED_CAR_SLOTS.filter((k) => !sel.slots[k]);
}

/** Default pipeline jobs exactly as PipelineRunner preselects them for a car. */
export function defaultCarPipelineJobKeys(brand?: string | null, description = ''): Set<string> {
  const detected = detectBrandFromDescription(description, brand || undefined);
  return new Set(PIPELINE_JOBS.filter((j) => j.defaultSelected && (j.category !== 'ci' || j.brand === detected)).map((j) => j.key));
}

const priceOf = (key: string) => PRODUCT_CREDIT_ITEMS.find((i) => i.key === key)?.credits ?? 0;

export interface PresetCostLine { key: keyof PresetOptions; label: string; credits: number; note: string; billedHere: boolean }

/** Real credits the existing confirmation will request; optional marketing items show list prices billed in their own generator. */
export function estimatePresetCredits(opts: PresetOptions, brand?: string | null, description = '') {
  const images = opts.remaster || opts.perspectives ? getTotalImageCount(defaultCarPipelineJobKeys(brand, description)) : 0;
  const lines: PresetCostLine[] = [
    { key: 'perspectives', label: `${images} Showroom-Bilder & Standardperspektiven`, credits: images * PIPELINE_CREDIT_COST_PER_IMAGE, note: `${PIPELINE_CREDIT_COST_PER_IMAGE} Credits je Bild`, billedHere: true },
  ];
  if (opts.banner) lines.push({ key: 'banner', label: 'Marketing-Banner', credits: priceOf('banner'), note: 'im Banner-Generator, eigene Bestätigung', billedHere: false });
  if (opts.social) lines.push({ key: 'social', label: 'Social-Media-Set', credits: priceOf('social'), note: 'je Post, eigene Bestätigung', billedHere: false });
  if (opts.video) lines.push({ key: 'video', label: 'Fahrzeugvideo', credits: priceOf('video'), note: 'im Video-Generator, eigene Bestätigung', billedHere: false });
  const pipelineCredits = lines.filter((l) => l.billedHere).reduce((s, l) => s + l.credits, 0);
  const optionalCredits = lines.filter((l) => !l.billedHere).reduce((s, l) => s + l.credits, 0);
  return { images, lines, pipelineCredits, optionalCredits, total: pipelineCredits + optionalCredits };
}

export function preparationStatusLabel(status: PreparationStatus | null | undefined, originals = 0): string {
  switch (status) {
    case 'analyzing_originals': return `${originals} Originale · werden analysiert`;
    case 'ready_for_oneshot': return `${originals} Originale · bereit für Aufbereitung`;
    case 'analysis_failed': return `${originals} Originale · Analyse erneut starten`;
    case 'started': return 'Aufbereitung gestartet';
    default: return originals ? `${originals} Originale · importiert` : 'Importiert';
  }
}

/** Handoff URL into the existing capture → PipelineRunner flow (cost confirmation + start guard live there). */
export function oneshotHandoffUrl(vehicleId: string): string {
  return `/generator/fotos?vehicle=${vehicleId}&originals=auto3&prep=1`;
}
