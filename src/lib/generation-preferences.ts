import type { RemasterConfig } from '@/lib/remaster-prompt';
import { canUseDekraScene, SCENE_OPTIONS, LICENSE_PLATE_OPTIONS, CLEANUP_OPTIONS } from '@/lib/remaster-prompt';
import { ensureCachedBase64 } from '@/lib/image-base64-cache';
import { uploadImageToStorage } from '@/lib/storage-utils';

export interface GenerationSettings {
  config?: RemasterConfig;
  assets?: Record<string, string>;
  selectedKeys?: string[];
  scope?: string;
}
export const DEFAULT_GENERATION_CONFIG: RemasterConfig = {
  scene: 'showroom-1', licensePlate: 'remove', changeColor: false,
  showManufacturerLogo: false, showDealerLogo: false,
};
const assetFields = ['customShowroomBase64', 'customPlateImageBase64', 'dealerLogoBase64', 'manufacturerLogoBase64'] as const;
const assetCache = new Map<string, Promise<string>>();

/** Persist choices and durable asset URLs, never vehicle evidence or image bytes. */
export async function serializeGenerationConfig(config: RemasterConfig, userId: string): Promise<GenerationSettings> {
  const saved: RemasterConfig = {
    scene: config.scene, licensePlate: config.licensePlate,
    customPlateText: config.customPlateText, changeColor: config.changeColor,
    colorHex: config.colorHex, showManufacturerLogo: config.showManufacturerLogo,
    showDealerLogo: config.showDealerLogo, cleanupItems: config.cleanupItems,
    machineryTidyUp: config.machineryTidyUp,
  };
  const assets: Record<string, string> = {};
  for (const field of ['dealerLogoUrl', 'manufacturerLogoUrl'] as const) {
    const url = config[field];
    if (url && !url.startsWith('data:')) saved[field] = url;
  }
  for (const field of assetFields) {
    const value = config[field];
    if (!value) continue;
    const cacheKey = `${userId}:${value}`;
    let upload = assetCache.get(cacheKey);
    if (!upload) {
      upload = uploadImageToStorage(value, userId, `generation-settings/${crypto.randomUUID()}.png`).then(url => {
        if (!url) throw new Error('Bildvorlage konnte nicht gespeichert werden.');
        return url;
      });
      assetCache.set(cacheKey, upload);
      upload.catch(() => assetCache.delete(cacheKey));
    }
    assets[field] = await upload;
  }
  return { config: saved, assets };
}

export function sanitizeGenerationConfig(config: Partial<RemasterConfig>, email?: string | null): RemasterConfig {
  return {
    ...DEFAULT_GENERATION_CONFIG, ...config,
    scene: config.scene === 'dealer-lot-dekra' && !canUseDekraScene(email) ? 'dealer-lot'
      : SCENE_OPTIONS.some(s => s.value === config.scene) ? config.scene || 'showroom-1' : 'showroom-1',
    licensePlate: LICENSE_PLATE_OPTIONS.some(p => p.value === config.licensePlate) ? config.licensePlate || 'remove' : 'remove',
    cleanupItems: (config.cleanupItems || []).filter(k => CLEANUP_OPTIONS.some(o => o.value === k)),
  };
}

export async function restoreGenerationConfig(settings: GenerationSettings, email?: string | null): Promise<RemasterConfig> {
  const config = sanitizeGenerationConfig(settings.config || {}, email);
  for (const field of assetFields) {
    const url = settings.assets?.[field];
    if (url) config[field] = await ensureCachedBase64(url);
    if (url && field === 'manufacturerLogoBase64' && !config.manufacturerLogoUrl) config.manufacturerLogoUrl = url;
    if (url && field === 'dealerLogoBase64' && !config.dealerLogoUrl) config.dealerLogoUrl = url;
  }
  return config;
}

export function restorePipelineSelection(saved: string[] | undefined, jobs: { key: string; defaultSelected?: boolean }[]): Set<string> {
  return new Set(saved === undefined ? jobs.filter(j => j.defaultSelected).map(j => j.key) : saved.filter(key => jobs.some(j => j.key === key)));
}