import { invokeRemasterVehicleImage, type RemasterInvokePayload } from './remaster-invoke';
import { resolveV3Evidence, wireV3Evidence, buildNb21V3Prompt, validateV3LightingProfile, v3Policy, v3UsesAsset, type V3Reference, type V3LightingProfile, type V3RetryReason } from '@/prompts/nb21/v3';
import type { RemasterConfig } from './remaster-prompt';
import { ensureCachedBase64 } from './image-base64-cache';
import { DEKRA_LOGO_BASE64 } from '../../supabase/functions/_shared/dekra-logo';
import { V2RunUploadCache } from './nb21-v2-upload-cache';
export async function invokeNb21V3(args: {
  sources: V3Reference[]; jobKey: string; category?: string; editSlot?: string;
  config: RemasterConfig; correction?: string; lightingProfile: V3LightingProfile; retryReason?: V3RetryReason;
  payload?: Pick<RemasterInvokePayload,'gallerySave' | 'classContext'>; uploadCache?: V2RunUploadCache;
}) {
  await validateV3LightingProfile(args.lightingProfile);
  // Missing evidence fails BEFORE asset fetch, upload, authentication or provider dispatch.
  resolveV3Evidence(args);
  const policy = v3Policy(args.jobKey, args.category, args.editSlot);
  const sources = args.sources.filter(s => s.sourceType !== 'immutable asset' || (v3UsesAsset(policy, s.sourceRole) && (
    s.sourceRole === 'manufacturer-logo' ? args.config.showManufacturerLogo :
    s.sourceRole === 'dealer-logo' ? args.config.showDealerLogo :
    s.sourceRole === 'plate' ? args.config.licensePlate === 'custom' :
    s.sourceRole === 'scene-logo' ? args.config.scene === 'dealer-lot-dekra' : true
  )));
  if (v3UsesAsset(policy, 'scene-logo') && args.config.scene === 'dealer-lot-dekra' && !sources.some(s => s.sourceRole === 'scene-logo')) sources.push({sourceId:'asset:dekra-current-scene-logo',sourceRole:'scene-logo',sourceType:'immutable asset',image:`data:image/png;base64,${DEKRA_LOGO_BASE64}`});
  if (v3UsesAsset(policy, 'plate') && args.config.licensePlate === 'custom' && args.config.customPlateImageBase64 && !sources.some(s => s.sourceRole === 'plate')) sources.push({sourceId:'asset:custom-plate',sourceRole:'plate',sourceType:'immutable asset',image:args.config.customPlateImageBase64});
  for (const [role,enabled,url] of [['manufacturer-logo',args.config.showManufacturerLogo,args.config.manufacturerLogoBase64 || args.config.manufacturerLogoUrl],['dealer-logo',args.config.showDealerLogo,args.config.dealerLogoBase64 || args.config.dealerLogoUrl]] as const) {
    if (v3UsesAsset(policy, role) && enabled && url && !sources.some(s => s.sourceRole === role)) sources.push({sourceId:`asset:${role}`,sourceRole:role,sourceType:'immutable asset',image:await ensureCachedBase64(url)});
  }
  const plan = resolveV3Evidence({...args,sources});
  const cache = args.uploadCache ?? new V2RunUploadCache();
  plan.references = await Promise.all(plan.references.map(async s => ({...s,fileUri:await cache.resolve(s)})));
  return invokeRemasterVehicleImage({...args.payload,modelTier:'nb21',promptVersion:'nb21-v3',referenceManifest:plan.manifest,v3References:wireV3Evidence(plan),dynamicPrompt:buildNb21V3Prompt({manifest:plan.manifest,config:args.config,correction:args.correction,classContext:args.payload?.classContext})});
}
