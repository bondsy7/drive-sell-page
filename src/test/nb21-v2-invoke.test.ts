import { describe, expect, it, vi } from 'vitest';
const { uploaded, invoked } = vi.hoisted(() => ({
  uploaded: vi.fn(async (images: { id: string }[]) => images.map(i => ({ id: i.id, uri: `files/${i.id}`, mimeType: 'image/jpeg' }))),
  invoked: vi.fn(async (body: unknown) => ({ data: { imageBase64: 'data:image/jpeg;base64,YQ==', body }, error: null })),
}));
vi.mock('@/lib/gemini-file-upload', () => ({ uploadToGeminiFiles: uploaded }));
vi.mock('@/lib/remaster-invoke', () => ({ invokeRemasterVehicleImage: invoked }));
import { invokeNb21V2 } from '@/lib/nb21-v2-invoke';
import { validateV2Wire } from '../../supabase/functions/_shared/nb21-v2-wire';
import type { RemasterConfig } from '@/lib/remaster-prompt';
const config = { scene: 'showroom-1', licensePlate: 'remove', changeColor: false, showManufacturerLogo: false, showDealerLogo: false } as RemasterConfig;
describe('NB21 V2 invocation without provider charges', () => {
  it('resolves, uploads and serializes only the selected set in exact manifest order', async () => {
    invoked.mockClear(); uploaded.mockClear();
    const sources = ['rear','screen','front','frontpanel','side','interior-front'].map(role => ({ sourceId: `original:${role}`, sourceRole: role, sourceType: 'original' as const, image: 'data:image/jpeg;base64,YQ==', assetId: `storage/${role}` }));
    const result = await invokeNb21V2({ sources, jobKey: 'EXT_ELEVATED_FRONT', config });
    expect(result.data.imageBase64).toBe('data:image/jpeg;base64,YQ==');
    expect(uploaded.mock.calls.flatMap(call => call[0].map(i => i.id))).toEqual(['original:front','original:frontpanel','original:side']);
    const body = invoked.mock.calls[0]?.[0] as any;
    expect(body.modelTier).toBe('nb21');
    expect(body.promptVersion).toBe('nb21-v2');
    expect(body.v2References.map((r: any) => r.sourceId)).toEqual(body.referenceManifest.entries.map((e: any) => e.sourceId));
    expect(body.v2References.every((r: any) => r.transport === 'file_uri' && !r.imageBase64)).toBe(true);
    expect(body.dynamicPrompt).toContain('IMAGE 1: front_original');
    validateV2Wire(body.referenceManifest, body.v2References);
  });
  it('missing cargo original stops before upload and invocation', async () => {
    invoked.mockClear(); uploaded.mockClear();
    await expect(invokeNb21V2({ sources: [{ sourceId: 'rear', sourceRole: 'rear', sourceType: 'original', image: 'data:image/jpeg;base64,YQ==' }], jobKey: 'CI_VOLVO_INT_BOOT', config })).rejects.toThrow(/cargo_original/);
    expect(uploaded).not.toHaveBeenCalled();
    expect(invoked).not.toHaveBeenCalled();
  });
});