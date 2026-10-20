import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveDetailPerspective } from '@/lib/detail-perspective-analysis';
import { useDetailPerspectiveAnalysis } from '@/hooks/useDetailPerspectiveAnalysis';
import type { AnalyzerVisionResponse } from '@/features/reference-v2/phase1-5/analyzer-contract';
import type { ReferenceV2AnalyzerPort } from '@/features/reference-v2/phase1-5/provider-adapter';
import { getPerspectiveSpec } from '@/features/reference-v2/domain/perspectives/registry';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function response(id: AnalyzerVisionResponse['canonicalPerspectiveId'] = 'DET_HEADLIGHT_LEFT'): AnalyzerVisionResponse {
  const surfaces = id ? Object.fromEntries(getPerspectiveSpec(id).requiredVisibleSurfaces.map(s => [s, 0.95])) : {};
  return {
    schemaVersion: 'reference-v2-vision-1', vehicleDetected: true, vehicleClass: 'car',
    canonicalPerspectiveId: id, perspectiveConfidence: 0.95, classificationConfidence: 0.95,
    azimuthDeg: null, pitchDeg: null, elevationProfile: 'close_detail',
    visibility: { front: 0.9, rear: 0, leftSide: 0, rightSide: 0, roof: 0, surfaces },
    framing: { fullVehicleVisible: false, cropped: true, visibleWheelPositions: [], estimatedPaddingPct: 5 },
    quality: { sharpness: 0.9, occlusion: 0, glare: 0, resolutionAdequacy: 0.9 },
    mirroredSuspected: false, sameVehicleConfidence: null, identityEvidence: {}, issues: [],
  };
}
describe('detail perspective role assignment', () => {
  it.each([
    ['DET_HEADLIGHT_LEFT', 'headlight'], ['DET_HEADLIGHT_RIGHT', 'headlight'],
    ['DET_TAILLIGHT_LEFT', 'taillight'], ['DET_GRILLE', 'frontpanel'],
    ['DET_STEERING_WHEEL', 'steering'], ['DET_CLUSTER', 'cluster'],
    ['DET_INFOTAINMENT', 'screen'], ['DET_CENTER_CONSOLE', 'controls'],
    ['DET_WHEEL_FRONT_RIGHT', 'wheel'], ['INT_CARGO', 'cargo'],
    ['INT_DASH_CENTER', 'dashboard'], ['INT_REAR_FROM_FRONT', 'rear-seats'],
  ] as const)('maps photographed %s to %s', (id, role) => expect(resolveDetailPerspective(response(id)).role).toBe(role));
  it('leaves uncertain perspectives unassigned', () => {
    expect(resolveDetailPerspective({ ...response(), perspectiveConfidence: 0.79 }).role).toBeUndefined();
  });
  it('requires actual visibility of the detail', () => {
    const r = response();
    expect(resolveDetailPerspective({ ...r, visibility: { ...r.visibility, surfaces: { headlight_left: 0.4 } } }).role).toBeUndefined();
  });
  it('does not guess unsupported badges or broad exterior views', () => {
    expect(resolveDetailPerspective(response('DET_FRONT_BADGE')).role).toBeUndefined();
    expect(resolveDetailPerspective(response('EXT_FRONT')).role).toBeUndefined();
  });
  it('does not assign mirrored evidence', () => expect(resolveDetailPerspective({ ...response(), mirroredSuspected: true }).role).toBeUndefined());
  it('analyzes once, retains file reference, and allows manual clearing to override automation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: async () => new Blob(['pixels'], { type: 'image/jpeg' }) }));
    const file = { fileId: 'https://generativelanguage.googleapis.com/v1beta/files/detail', mimeType: 'image/jpeg', providerId: 'gemini-file-api' };
    const port: ReferenceV2AnalyzerPort = { uploadFile: vi.fn().mockResolvedValue(file), analyze: vi.fn().mockResolvedValue({ response: response() }) };
    const { result, rerender } = renderHook(({ images }) => useDetailPerspectiveAnalysis(images, true, port), { initialProps: { images: ['image-a'] } });
    await waitFor(() => expect(result.current.automaticRoles['image-a']).toBe('headlight'));
    expect(result.current.results['image-a'].file).toEqual(file);
    expect({ ...result.current.automaticRoles, 'image-a': '' }['image-a']).toBe('');
    act(() => rerender({ images: ['image-a'] }));
    expect(port.analyze).toHaveBeenCalledTimes(1);
    expect(port.analyze).toHaveBeenCalledWith({ file, anchorFiles: [] });
  });
  it('retains failed images without a guessed role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const port: ReferenceV2AnalyzerPort = { uploadFile: vi.fn(), analyze: vi.fn() };
    const { result } = renderHook(() => useDetailPerspectiveAnalysis(['image-b'], true, port));
    await waitFor(() => expect(result.current.results['image-b'].status).toBe('unavailable'));
    expect(result.current.automaticRoles['image-b']).toBeUndefined();
    expect(port.analyze).not.toHaveBeenCalled();
  });
  it('leaves other model tiers untouched', () => {
    const port: ReferenceV2AnalyzerPort = { uploadFile: vi.fn(), analyze: vi.fn() };
    renderHook(() => useDetailPerspectiveAnalysis(['image-c'], false, port));
    expect(port.uploadFile).not.toHaveBeenCalled();
  });
});