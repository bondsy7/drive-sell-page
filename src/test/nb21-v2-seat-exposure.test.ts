import { describe, expect, it } from 'vitest';
import { buildNb21V2Prompt, resolveV2Evidence, type V2Reference } from '@/prompts/nb21/v2';
import type { RemasterConfig } from '@/lib/remaster-prompt';

const sources: V2Reference[] = ['front', 'side', 'interior-front', 'interior-rear', 'steering'].map(sourceRole => ({
  sourceId: sourceRole, sourceRole, sourceType: 'original', image: 'data:image/jpeg;base64,YQ==',
}));
const config = { scene: 'showroom-1', licensePlate: 'remove', changeColor: false } as RemasterConfig;
const prompt = (jobKey: string, scene = 'showroom-1', editSlot?: string) => buildNb21V2Prompt({
  manifest: resolveV2Evidence({ jobKey, editSlot, sources }).manifest,
  config: { ...config, scene },
});

describe('NB21 v2 seat preservation and series exposure', () => {
  it.each(['interior-front', 'interior-rear'])('edit %s preserves seat assemblies and the original camera', slot => {
    const text = prompt(slot, 'showroom-1', slot);
    expect(text).toContain('SEAT GEOMETRY LOCK');
    expect(text).toContain('Never flatten, fold, stretch, merge, duplicate or remove a seat/backrest');
    expect(text).toContain('preserve exactly the original camera and framing');
    expect(text).toContain('never becomes a broad slab joined to the armrest or centre console');
    expect(text).not.toContain('VIEW SYNTHESIS CONTRACT');
  });
  it.each(['CI_VOLVO_INT_CENTER', 'CI_VOLVO_INT_PASSENGER', 'CI_VOLVO_INT_REAR', 'CI_VOLVO_INT_STEERING', 'GRID_INTERIOR_4'])('%s preserves seats in synthesized cabin views too', key => {
    expect(prompt(key)).toContain('SEAT GEOMETRY LOCK');
  });
  it.each(['showroom-1', 'keep', 'none'])('scene %s normalizes exposure across exterior, cabin and detail jobs', scene => {
    for (const key of ['EXT_FRONT', 'CI_VOLVO_INT_CENTER', 'CI_VOLVO_INT_STEERING']) {
      const text = prompt(key, scene);
      expect(text).toContain('SERIES EXPOSURE LOCK');
      expect(text).toContain('never reproduce their brightness differences');
      expect(text).toContain('exposure normalization never authorizes recolouring or changing equipment');
      expect(text).not.toContain('Preserve photographed light/environment; improve clarity only.');
    }
  });
  it('seat-specific rules never leak into exterior jobs', () => {
    expect(prompt('EXT_FRONT')).not.toContain('SEAT GEOMETRY LOCK');
  });
});