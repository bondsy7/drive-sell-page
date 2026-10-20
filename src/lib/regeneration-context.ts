/**
 * Regeneration context: the exact look/scene settings of the original pipeline
 * run, persisted per vehicle so a later "Neu generieren" in the lightbox uses
 * the same showroom, look, logo and plate rules as the rest of the series.
 * Stored under vehicles.vehicle_data.__regenerationContext (merge-write).
 */
import type { V2Reference } from '../../supabase/functions/_shared/nb21-v2-contract';
import { supabase } from '@/integrations/supabase/client';
import { SCENE_OPTIONS, type RemasterConfig } from '@/lib/remaster-prompt';
import type { VehicleClassContext } from '@/config/vehicle-class-types';

export const REGEN_CONTEXT_KEY = '__regenerationContext';

export interface RegenerationContext {
  scene: string;
  licensePlate: string;
  customPlateText?: string;
  changeColor: boolean;
  colorHex?: string;
  showManufacturerLogo: boolean;
  showDealerLogo: boolean;
  dealerLogoUrl?: string | null;
  manufacturerLogoUrl?: string | null;
  cleanupItems?: string[];
  equipmentFeatures?: string[];
  classContext?: VehicleClassContext | null;
  vehicleDescription?: string;
  modelTier?: string;
  /** Prompt-Version des Laufs ('nb21-v1' für Nano Banana 2.1; fehlt = 2.0). */
  promptVersion?: string;
  sourceSlot?: string;
  jobKey?: string;
  referenceSources?: Omit<V2Reference, 'image' | 'fileUri' | 'openAIFile'>[];
  savedAt: string;
}

export function buildRegenerationContext(args: {
  remasterConfig: RemasterConfig;
  classContext?: VehicleClassContext | null;
  vehicleDescription?: string;
  modelTier?: string;
  promptVersion?: string;
  referenceSources?: Omit<V2Reference, 'image' | 'fileUri' | 'openAIFile'>[];
  resolvedManufacturerLogoUrl?: string | null;
}): RegenerationContext {
  const c = args.remasterConfig;
  return {
    scene: c.scene,
    licensePlate: c.licensePlate,
    customPlateText: c.customPlateText,
    changeColor: !!c.changeColor,
    colorHex: c.colorHex,
    showManufacturerLogo: !!c.showManufacturerLogo,
    showDealerLogo: !!c.showDealerLogo,
    dealerLogoUrl: c.dealerLogoUrl ?? null,
    manufacturerLogoUrl: args.resolvedManufacturerLogoUrl ?? c.manufacturerLogoUrl ?? null,
    cleanupItems: c.cleanupItems,
    equipmentFeatures: c.equipmentFeatures,
    classContext: args.classContext ?? null,
    vehicleDescription: args.vehicleDescription,
    modelTier: args.modelTier,
    ...(args.promptVersion ? { promptVersion: args.promptVersion } : {}),
    ...(args.referenceSources ? { referenceSources: args.referenceSources } : {}),
    savedAt: new Date().toISOString(),
  };
}

export async function saveRegenerationContext(vehicleId: string, ctx: RegenerationContext): Promise<void> {
  const { data } = await supabase.from('vehicles').select('vehicle_data').eq('id', vehicleId).maybeSingle();
  const current = ((data as any)?.vehicle_data ?? {}) as Record<string, unknown>;
  // Preserve the previous known NB21 context on older results before the vehicle
  // default moves to V2. This is metadata only, not a result/price change.
  const previous = readRegenerationContext(current);
  if (ctx.promptVersion === 'nb21-v2' && previous?.modelTier === 'nb21' && previous.promptVersion !== 'nb21-v2') {
    const { error } = await supabase.from('project_images')
      .update({ generation_context: { ...previous, promptVersion: previous.promptVersion ?? 'nb21-v1' } } as never)
      .eq('vehicle_id', vehicleId).is('generation_context', null);
    if (error) throw new Error('Historische NB21-Laufversion konnte nicht gesichert werden.');
  }
  await supabase
    .from('vehicles')
    .update({ vehicle_data: { ...current, [REGEN_CONTEXT_KEY]: ctx } } as never)
    .eq('id', vehicleId);
}

export function readRegenerationContext(vehicleData: unknown): RegenerationContext | null {
  const raw = (vehicleData as Record<string, unknown> | null)?.[REGEN_CONTEXT_KEY];
  if (!raw || typeof raw !== 'object' || typeof (raw as any).scene !== 'string') return null;
  return raw as RegenerationContext;
}

/** URL of the showroom reference image for a scene (built-in reference or dealer upload). */
export function showroomUrlForScene(scene: string, profileShowroomUrl: string | null): string | null {
  if (scene === 'custom-showroom') return profileShowroomUrl || null;
  const opt = SCENE_OPTIONS.find(s => s.value === scene) as { reference?: string } | undefined;
  return opt?.reference ?? null;
}

/**
 * Legacy vehicles (no saved context): another generated image of the SAME series
 * serves only as environment reference, so the regenerated image keeps the
 * showroom actually used — never the dealer's profile showroom.
 */
export function pickSeriesEnvironmentImage(
  images: { id: string; src: string; perspective?: string | null }[],
  currentId: string,
): string | null {
  const others = images.filter(i => i.id !== currentId && !!i.src);
  const exterior = others.find(i => !/interi|innen|cockpit|dashboard|grid|sitz|seat/i.test(i.perspective || ''));
  return (exterior ?? others[0])?.src ?? null;
}

/**
 * Restores a RemasterConfig from the saved run. Without saved context, a series
 * environment image (if any) is used as showroom reference; the profile showroom
 * is NEVER used unless the original run selected it.
 */
export function restoreRemasterConfig(
  ctx: RegenerationContext | null,
  seriesEnvironmentUrl: string | null,
): RemasterConfig {
  const scene = ctx?.scene ?? (seriesEnvironmentUrl ? 'custom-showroom' : 'none');
  return {
    scene,
    licensePlate: ctx?.licensePlate ?? 'keep',
    customPlateText: ctx?.customPlateText,
    changeColor: ctx?.changeColor ?? false,
    colorHex: ctx?.colorHex,
    showManufacturerLogo: ctx?.showManufacturerLogo ?? false,
    showDealerLogo: ctx?.showDealerLogo ?? false,
    dealerLogoUrl: ctx?.dealerLogoUrl ?? null,
    manufacturerLogoUrl: ctx?.manufacturerLogoUrl ?? null,
    cleanupItems: ctx?.cleanupItems,
    equipmentFeatures: ctx?.equipmentFeatures,
  } as RemasterConfig;
}
