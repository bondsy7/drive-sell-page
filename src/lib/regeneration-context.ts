/**
 * Regeneration context: the exact look/scene settings of the original pipeline
 * run, persisted per vehicle so a later "Neu generieren" in the lightbox uses
 * the same showroom, look, logo and plate rules as the rest of the series.
 * Stored under vehicles.vehicle_data.__regenerationContext (merge-write).
 */
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
  savedAt: string;
}

export function buildRegenerationContext(args: {
  remasterConfig: RemasterConfig;
  classContext?: VehicleClassContext | null;
  vehicleDescription?: string;
  modelTier?: string;
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
    savedAt: new Date().toISOString(),
  };
}

export async function saveRegenerationContext(vehicleId: string, ctx: RegenerationContext): Promise<void> {
  const { data } = await supabase.from('vehicles').select('vehicle_data').eq('id', vehicleId).maybeSingle();
  const current = ((data as any)?.vehicle_data ?? {}) as Record<string, unknown>;
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

/** Restores a RemasterConfig; without saved context the dealer showroom (if any) is the default. */
export function restoreRemasterConfig(
  ctx: RegenerationContext | null,
  profileShowroomUrl: string | null,
): RemasterConfig {
  const scene = ctx?.scene ?? (profileShowroomUrl ? 'custom-showroom' : 'none');
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
