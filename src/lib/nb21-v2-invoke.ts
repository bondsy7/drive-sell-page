import { uploadToGeminiFiles } from './gemini-file-upload';
import { invokeRemasterVehicleImage, type RemasterInvokePayload } from './remaster-invoke';
import { buildNb21V2Prompt, resolveV2Evidence, wireV2Evidence, type V2Reference } from '@/prompts/nb21/v2';
import type { RemasterConfig } from './remaster-prompt';
import { ensureCachedBase64 } from './image-base64-cache';
import { DEKRA_LOGO_BASE64 } from '../../supabase/functions/_shared/dekra-logo';

/** One canonical selection before upload, prompt generation and provider dispatch. */
export async function invokeNb21V2(args: {
  sources: V2Reference[]; jobKey: string; category?: string; editSlot?: string;
  config: RemasterConfig; correction?: string;
  payload?: Pick<RemasterInvokePayload, 'gallerySave' | 'classContext'>;
}) {
  const effectiveConfig = { ...args.config };
  const sources = [...args.sources];
  if (args.config.scene === 'dealer-lot-dekra' && !sources.some(s => s.sourceRole === 'scene-logo')) sources.push({ sourceId: 'asset:dekra-current-scene-logo', sourceRole: 'scene-logo', sourceType: 'immutable asset', image: `data:image/png;base64,${DEKRA_LOGO_BASE64}` });
  for (const [role, enabled, url] of [
    ['manufacturer-logo', args.config.showManufacturerLogo, args.config.manufacturerLogoUrl],
    ['dealer-logo', args.config.showDealerLogo, args.config.dealerLogoUrl],
  ] as const) {
    if (enabled && url && !sources.some(s => s.sourceRole === role)) sources.push({ sourceId: `asset:${role}`, sourceRole: role, sourceType: 'immutable asset', image: await ensureCachedBase64(url) });
  }
  const plan = resolveV2Evidence({ ...args, sources });
  await Promise.all(plan.references.map(async s => {
    if (s.fileUri || s.openAIFile) return;
    const refs = await uploadToGeminiFiles([{ id: s.sourceId, imageBase64: s.image }]);
    s.fileUri = refs?.[0] ?? null;
  }));
  const dynamicPrompt = buildNb21V2Prompt({ manifest: plan.manifest, config: effectiveConfig, correction: args.correction, vehicleClass: args.payload?.classContext?.vehicleClass });
  return invokeRemasterVehicleImage({
    ...args.payload, modelTier: 'nb21', promptVersion: 'nb21-v2', dynamicPrompt,
    referenceManifest: plan.manifest, v2References: wireV2Evidence(plan),
  });
}

/** Explicit asset scopes; generated showroom/series frames never become originals. */
export function v2ConfigSources(c: RemasterConfig, wheel?: string | null, logos?: { manufacturer?: string | null; dealer?: string | null }): V2Reference[] {
  const out: V2Reference[] = [];
  const add = (role: string, image?: string | null) => { if (image) out.push({ sourceId: `asset:${role}`, sourceRole: role, sourceType: role === 'environment' ? 'generated context' : 'immutable asset', image }); };
  add('wheel', wheel); add('plate', c.customPlateImageBase64); add('environment', c.customShowroomBase64);
  if (c.showManufacturerLogo) add('manufacturer-logo', logos?.manufacturer ?? c.manufacturerLogoBase64);
  if (c.showDealerLogo) add('dealer-logo', logos?.dealer ?? c.dealerLogoBase64);
  return out;
}