// Auto3 → OneShot background processing: dealer profile, datasheet mapping and plan compilation.
// The plan is compiled from the SAME prompt builders the manual OneShot/Pipeline flows use and is
// executed server-side by the auto3-processing-job orchestrator.
import { PIPELINE_JOBS, applyPromptOverrides, injectLogoPlaceholder, type PipelineJob } from '@/lib/pipeline-jobs';
import { buildMasterPrompt, type RemasterConfig } from '@/lib/remaster-prompt';
import { buildTaskOutputLock } from '@/contexts/PipelineContext';
import { composeOneShotHeroPrompt, buildBannerPrompt } from '@/lib/oneshot-prompts';
import { DEFAULT_FORM, ONESHOT_BANNER_FORMATS, type BannerFormatId, type MarketingForm } from '@/components/oneshot/oneshot-types';
import { selectInteriorReference, type MasterCandidate } from '../../supabase/functions/_shared/auto3-master';

export type AutomationMode = 'off' | 'prepare' | 'full';
export type ModelTierOption = 'schnell' | 'qualitaet' | 'premium';

export interface ProcessingSettings {
  scene: string;
  licensePlate: 'keep' | 'remove' | 'blur';
  perspectiveKeys: string[];
  modelTier: ModelTierOption;
  showManufacturerLogo: boolean;
  bannerEnabled: boolean;
  bannerFormats: BannerFormatId[];
  bannerStyle: string;
  socialSet: boolean;
  videoEnabled: boolean;
  videoPrompt: string;
  websiteTarget: 'none' | 'autoschmitt';
}

/** Perspectives the OneShot pipeline really offers for cars (hero is always generated separately). */
export const ONESHOT_PERSPECTIVE_JOBS: PipelineJob[] = PIPELINE_JOBS.filter((j) => j.key !== 'MASTER_IMAGE' && j.category !== 'ci');

export const DEFAULT_PROCESSING_SETTINGS: ProcessingSettings = {
  scene: 'showroom-1',
  licensePlate: 'remove',
  perspectiveKeys: ONESHOT_PERSPECTIVE_JOBS.filter((j) => j.defaultSelected).map((j) => j.key),
  modelTier: 'qualitaet',
  showManufacturerLogo: false,
  bannerEnabled: false,
  bannerFormats: ['story'],
  bannerStyle: 'premium',
  socialSet: false,
  videoEnabled: false,
  videoPrompt: '',
  websiteTarget: 'autoschmitt',
};

export const MODEL_TIER_OPTIONS: { value: ModelTierOption; label: string }[] = [
  { value: 'schnell', label: 'Schnell' },
  { value: 'qualitaet', label: 'Qualität (Standard)' },
  { value: 'premium', label: 'Premium' },
];

/** Same defaults the generators charge when admin_settings has no override. */
const REMASTER_DEFAULT_COST: Record<string, number> = { schnell: 2, qualitaet: 3, premium: 5 };
const BANNER_COST: Record<string, number> = { schnell: 3, qualitaet: 5, premium: 8 };
export const VIDEO_COST = 17;

export function normalizeSettings(raw: unknown): ProcessingSettings {
  const s = { ...DEFAULT_PROCESSING_SETTINGS, ...((raw && typeof raw === 'object') ? raw as Partial<ProcessingSettings> : {}) };
  const validKeys = new Set(ONESHOT_PERSPECTIVE_JOBS.map((j) => j.key));
  s.perspectiveKeys = (s.perspectiveKeys || []).filter((k) => validKeys.has(k));
  if (!['keep', 'remove', 'blur'].includes(s.licensePlate)) s.licensePlate = 'remove';
  const validFormats = new Set(ONESHOT_BANNER_FORMATS.map((f) => f.id as string));
  s.bannerFormats = (s.bannerFormats || []).filter((f) => validFormats.has(f));
  return s;
}

export function settingsHash(s: ProcessingSettings): string {
  return JSON.stringify(normalizeSettings(s), Object.keys(s).sort());
}

export function effectiveBannerFormats(s: ProcessingSettings): BannerFormatId[] {
  if (!s.bannerEnabled && !s.socialSet) return [];
  const set = new Set<BannerFormatId>(s.bannerEnabled ? s.bannerFormats : []);
  if (s.socialSet) { set.add('story'); set.add('post'); }
  return [...set];
}

function outputCount(job: PipelineJob) { return 1 + (job.extraPrompts?.length || 0); }

export interface CostBreakdown { images: number; imageCost: number; banners: number; bannerCost: number; video: number; total: number; perImage: number }

export function estimateJobCost(s: ProcessingSettings, getCost?: (action: string, tier: string) => number): CostBreakdown {
  const perImage = Math.max(getCost?.('image_remaster', s.modelTier) || 0, REMASTER_DEFAULT_COST[s.modelTier] ?? 3);
  const jobs = ONESHOT_PERSPECTIVE_JOBS.filter((j) => s.perspectiveKeys.includes(j.key));
  const images = 1 + jobs.reduce((n, j) => n + outputCount(j), 0);
  const banners = effectiveBannerFormats(s).length;
  const bannerCost = banners * (BANNER_COST[s.modelTier] ?? 5);
  const video = s.videoEnabled ? VIDEO_COST : 0;
  return { images, imageCost: images * perImage, banners, bannerCost, video, total: images * perImage + bannerCost + video, perImage };
}

// ── Datasheet (only structured Auto3 data, never guessed) ──
export type Datasheet = Partial<Record<'brand' | 'model' | 'variant' | 'year' | 'power' | 'mileage' | 'fuelType' | 'transmission' | 'color' | 'firstRegistration' | 'price' | 'co2Class' | 'consumption' | 'bodyType', string>>;

export const DATASHEET_LABELS: Record<keyof Datasheet, string> = {
  brand: 'Marke', model: 'Modell', variant: 'Variante', year: 'Baujahr', power: 'Leistung', mileage: 'Kilometerstand',
  fuelType: 'Kraftstoff', transmission: 'Getriebe', color: 'Farbe', firstRegistration: 'Erstzulassung', price: 'Preis',
  co2Class: 'CO₂-Klasse', consumption: 'Verbrauch/CO₂', bodyType: 'Karosserie',
};

const formatPrice = (p: string) => {
  const n = Number(String(p).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? `${Math.round(n).toLocaleString('de-DE')} €` : '';
};

/** OneShot marketing form filled exclusively from the Auto3 datasheet. Missing fields stay empty and are omitted from the banner. */
export function marketingFormFromDatasheet(d: Datasheet, s: ProcessingSettings): MarketingForm {
  const title = [d.brand, d.model, d.variant].filter(Boolean).join(' ');
  const km = d.mileage && Number(d.mileage) > 0 ? `${Number(d.mileage).toLocaleString('de-DE')} km` : '';
  return {
    ...DEFAULT_FORM,
    brand: d.brand || '', model: d.model || '', variant: d.variant || '', vehicleTitle: title,
    priceType: 'buy', occasion: 'buy', priceText: d.price ? formatPrice(d.price) : '',
    headline: [d.brand, d.model].filter(Boolean).join(' '),
    subline: [d.power, d.year ? `Baujahr ${d.year}` : '', km].filter(Boolean).join(' · '),
    legalText: d.consumption || '',
    style: s.bannerStyle, scene: 'showroom',
  };
}

export interface CompiledPlan {
  vehicleDescription: string;
  modelTier: string;
  manufacturerLogoUrl: string | null;
  galleryFolder: string;
  hero: { prompt: string; cost: number };
  perspectives: { key: string; label: string; prompt: string; cost: number; interior: boolean; referenceFile: string | null }[];
  banners: { formatId: string; label: string; w: number; h: number; prompt: string; cost: number }[];
  video: { enabled: boolean; prompt: string | null; cost: number };
}

const REAR_INTERIOR = /rear|fond|rück/i;

export function compileJobPlan(args: {
  settings: ProcessingSettings;
  datasheet: Datasheet;
  analysis: MasterCandidate[];
  overrides: Record<string, string>;
  manufacturerLogoUrl?: string | null;
  getCost?: (action: string, tier: string) => number;
}): CompiledPlan {
  const s = normalizeSettings(args.settings);
  const d = args.datasheet;
  const cost = estimateJobCost(s, args.getCost);
  const vehicleLabel = [d.brand, d.model, d.variant].filter(Boolean).join(' ');
  const vehicleDescription = [vehicleLabel, d.year ? `Modelljahr ${d.year}` : ''].filter(Boolean).join(' ') || 'Fahrzeug';
  const logoUrl = s.showManufacturerLogo ? (args.manufacturerLogoUrl || null) : null;
  const config: RemasterConfig = {
    scene: s.scene, licensePlate: s.licensePlate, changeColor: false,
    showManufacturerLogo: !!logoUrl, showDealerLogo: false,
  };
  const hasLogo = !!logoUrl;

  // Hero: identical to OneShotStudio.generateHero
  const [master] = applyPromptOverrides(PIPELINE_JOBS.filter((j) => j.key === 'MASTER_IMAGE'), args.overrides);
  const heroPrompt = composeOneShotHeroPrompt(
    buildMasterPrompt(config, vehicleLabel, undefined, args.overrides),
    injectLogoPlaceholder(master.prompt, hasLogo),
  );

  // Perspectives: identical composition to PipelineContext (master context + task lock + perspective)
  const jobs = applyPromptOverrides(ONESHOT_PERSPECTIVE_JOBS.filter((j) => s.perspectiveKeys.includes(j.key)), args.overrides);
  const perspectives: CompiledPlan['perspectives'] = [];
  for (const job of jobs) {
    const interior = job.category === 'interior';
    const slot = interior ? (REAR_INTERIOR.test(`${job.key} ${job.label} ${job.labelDe}`) ? 'interior-rear' : 'interior-front') : undefined;
    const base = buildMasterPrompt(config, vehicleDescription, slot, args.overrides);
    const lock = buildTaskOutputLock(job);
    const referenceFile = interior ? selectInteriorReference(args.analysis, slot!) : null;
    [job.prompt, ...(job.extraPrompts || [])].forEach((p, i) => {
      perspectives.push({
        key: i === 0 ? job.key : `${job.key}_${i + 1}`,
        label: i === 0 ? job.labelDe : `${job.labelDe} ${i + 1}`,
        prompt: `${base}\n\n${lock}\n\n--- PERSPECTIVE INSTRUCTION ---\n${injectLogoPlaceholder(p, hasLogo)}`,
        cost: cost.perImage, interior, referenceFile,
      });
    });
  }

  const form = marketingFormFromDatasheet(d, s);
  const bannerUnit = cost.banners ? Math.round(cost.bannerCost / cost.banners) : 0;
  const banners = effectiveBannerFormats(s).map((id) => {
    const fmt = ONESHOT_BANNER_FORMATS.find((f) => f.id === id)!;
    return { formatId: id, label: fmt.label, w: fmt.w, h: fmt.h, prompt: buildBannerPrompt(form, fmt), cost: bannerUnit };
  });

  return {
    vehicleDescription, modelTier: s.modelTier, manufacturerLogoUrl: logoUrl,
    galleryFolder: `OneShot Auto3 – ${vehicleLabel || 'Fahrzeug'}`,
    hero: { prompt: heroPrompt, cost: cost.perImage },
    perspectives, banners,
    video: { enabled: s.videoEnabled, prompt: s.videoPrompt.trim() || null, cost: s.videoEnabled ? VIDEO_COST : 0 },
  };
}

export function planTotal(p: CompiledPlan): number {
  return p.hero.cost + p.perspectives.reduce((n, x) => n + x.cost, 0) + p.banners.reduce((n, x) => n + x.cost, 0) + (p.video.enabled ? p.video.cost : 0);
}

export type JobStatus = 'master_selected' | 'queued' | 'oneshot_processing' | 'generating_perspectives' | 'generating_banner' | 'generating_video' | 'ready_for_review' | 'failed' | 'paused';
export const RUNNING_STATUSES: JobStatus[] = ['queued', 'oneshot_processing', 'generating_perspectives', 'generating_banner', 'generating_video'];

export interface JobRow {
  id: string; vehicle_id: string; status: JobStatus; master_file: string | null; master_reason: string | null;
  progress_done: number; progress_total: number; progress_label: string | null; pause_reason: string | null;
  error: string | null; cost_estimate: number; credits_spent: number; updated_at: string;
}

export function jobStatusLabel(job: Pick<JobRow, 'status' | 'progress_done' | 'progress_total' | 'pause_reason' | 'progress_label'> | null | undefined, originals = 0): string {
  if (!job) return originals ? `${originals} Originale · importiert` : 'Importiert';
  switch (job.status) {
    case 'master_selected': return `${originals ? `${originals} Originale · ` : ''}Master erkannt`;
    case 'queued': return 'Aufbereitung in Warteschlange';
    case 'oneshot_processing':
    case 'generating_perspectives': return `Aufbereitung läuft ${job.progress_done}/${job.progress_total}`;
    case 'generating_banner': return 'Banner wird erstellt';
    case 'generating_video': return 'Video wird erstellt';
    case 'ready_for_review': return 'Fertig – Ergebnisse prüfen';
    case 'paused': return job.pause_reason === 'credits' ? 'Pausiert – Credits erforderlich' : job.pause_reason === 'budget' ? 'Pausiert – Budget überschritten' : 'Pausiert';
    case 'failed': return 'Fehlgeschlagen – erneut versuchen';
    default: return job.progress_label || '';
  }
}
