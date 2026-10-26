import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/image-base64-cache', () => ({ ensureCachedBase64: vi.fn(async (url: string) => `loaded:${url}`) }));
vi.mock('@/lib/storage-utils', () => ({ uploadImageToStorage: vi.fn(async (_image: string, user: string) => `https://assets.example/${user}/saved.png`) }));
import { DEFAULT_GENERATION_CONFIG, restoreGenerationConfig, restorePipelineSelection, sanitizeGenerationConfig, serializeGenerationConfig } from './generation-preferences';

describe('generation preferences', () => {
  it('retains logo, plate, colour, scene and cleanup choices', async () => {
    const config = { ...DEFAULT_GENERATION_CONFIG, showManufacturerLogo: true, showDealerLogo: true, licensePlate: 'custom', customPlateText: 'Standort Berlin', scene: 'forest', changeColor: true, colorHex: '#ffffff', cleanupItems: ['stickers'] };
    expect((await serializeGenerationConfig(config, 'user-a')).config).toMatchObject(config);
  });
  it('stores uploaded references as durable URLs and restores them', async () => {
    const saved = await serializeGenerationConfig({ ...DEFAULT_GENERATION_CONFIG, customPlateImageBase64: 'data:image/png;base64,AA==', wheelReference: { image: 'vehicle-evidence' } as never }, 'user-a');
    expect(JSON.stringify(saved)).not.toContain('base64,');
    expect(saved.config?.wheelReference).toBeUndefined();
    expect(saved.assets?.customPlateImageBase64).toBe('https://assets.example/user-a/saved.png');
    expect((await restoreGenerationConfig(saved)).customPlateImageBase64).toBe('loaded:https://assets.example/user-a/saved.png');
  });
  it('never restores restricted DEKRA scenes for other users', () => {
    expect(sanitizeGenerationConfig({ scene: 'dealer-lot-dekra' }, 'other@example.com').scene).toBe('dealer-lot');
    expect(sanitizeGenerationConfig({ scene: 'dealer-lot-dekra' }, 'dekra@autohaus.ai').scene).toBe('dealer-lot-dekra');
  });
  it('retains explicit empty selections and only loads available job keys', () => {
    const jobs = [{ key: 'front', defaultSelected: true }, { key: 'wheel', defaultSelected: false }];
    expect([...restorePipelineSelection([], jobs)]).toEqual([]);
    expect([...restorePipelineSelection(['wheel', 'other-brand'], jobs)]).toEqual(['wheel']);
    expect([...restorePipelineSelection(undefined, jobs)]).toEqual(['front']);
  });
});