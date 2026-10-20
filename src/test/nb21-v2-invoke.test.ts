import { describe, expect, it, vi } from 'vitest';
const { uploaded, invoked } = vi.hoisted(() => ({
  uploaded: vi.fn(async (images: { id: string }[]) => images.map(i => ({ id: i.id, uri: `files/${i.id}`, mimeType: 'image/jpeg' }))),
  invoked: vi.fn(async (body: unknown) => ({ data: { imageBase64: 'data:image/jpeg;base64,YQ==', body }, error: null })),
}));
vi.mock('@/lib/gemini-file-upload', () => ({ uploadToGeminiFiles: uploaded }));
vi.mock('@/lib/remaster-invoke', () => ({ invokeRemasterVehicleImage: invoked }));
import { invokeNb21V2 } from '@/lib/nb21-v2-invoke';
import { V2RunUploadCache } from '@/lib/nb21-v2-upload-cache';
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
  it('concurrent jobs and retries reuse one authoritative upload per run, not per URL', async () => {
    uploaded.mockClear(); invoked.mockClear();
    const uploadCache = new V2RunUploadCache();
    const makeSources = () => [{ sourceId: 'front-source', assetId: 'archive/front-original.jpg', sourceRole: 'front', sourceType: 'original' as const, image: 'data:image/jpeg;base64,YQ==' }];
    await Promise.all(['EXT_FRONT', 'EXT_ELEVATED_FRONT'].map(jobKey => invokeNb21V2({ sources: makeSources(), jobKey, config, uploadCache })));
    await invokeNb21V2({ sources: makeSources(), jobKey: 'EXT_FRONT', config, uploadCache });
    expect(uploaded).toHaveBeenCalledTimes(1);
    expect(invoked).toHaveBeenCalledTimes(3);
    await invokeNb21V2({ sources: makeSources(), jobKey: 'EXT_FRONT', config, uploadCache: new V2RunUploadCache() });
    expect(uploaded).toHaveBeenCalledTimes(2);
  });
  it('existing file URI seeds run cache and takes precedence over OpenAI and upload', async () => {
    uploaded.mockClear(); invoked.mockClear();
    const uploadCache = new V2RunUploadCache();
    const ref = { sourceId: 'front', assetId: 'asset-123', sourceRole: 'front', sourceType: 'original' as const, image: 'data:image/jpeg;base64,YQ==' };
    const fileUri = { uri: 'files/preexisting', mimeType: 'image/jpeg' };
    await invokeNb21V2({ sources: [{ ...ref, fileUri, openAIFile: { fileId: 'file-oa' } }], jobKey: 'EXT_FRONT', config, uploadCache });
    await invokeNb21V2({ sources: [{ ...ref, sourceId: 'alias-of-same-asset' }], jobKey: 'EXT_ELEVATED_FRONT', config, uploadCache });
    expect(uploaded).not.toHaveBeenCalled();
    const body = invoked.mock.calls[1]?.[0] as { v2References: { fileUri: { uri: string } }[] };
    expect(body.v2References[0]?.fileUri.uri).toBe('files/preexisting');
  });
  it('rejects reused source ID with different bytes within a run', async () => {
    const cache = new V2RunUploadCache();
    const ref = { sourceId: 'front', sourceRole: 'front', sourceType: 'original' as const, image: 'first' };
    await cache.resolve(ref);
    await expect(cache.resolve({ ...ref, image: 'different' })).rejects.toThrow(/andere Bilddaten/);
    await expect(new V2RunUploadCache().resolve({ ...ref, image: 'different' })).resolves.toBeTruthy();
  });
});