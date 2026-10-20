import { beforeAll, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const { upload, invoke } = vi.hoisted(()=>({upload:vi.fn(async (refs:{id:string}[])=>refs.map(r=>({id:r.id,uri:`files/${r.id}`,mimeType:'image/jpeg'}))),invoke:vi.fn(async (body:unknown)=>({data:{body,imageBase64:'image'},error:null}))}));
vi.mock('@/lib/gemini-file-upload',()=>({uploadToGeminiFiles:upload}));
vi.mock('@/lib/remaster-invoke',()=>({invokeRemasterVehicleImage:invoke}));
import { invokeNb21V3 } from '@/lib/nb21-v3-invoke';
import { createV3LightingProfile, validateV3Wire } from '@/prompts/nb21/v3';
import { V2RunUploadCache } from '@/lib/nb21-v2-upload-cache';
import type { RemasterConfig } from '@/lib/remaster-prompt';
beforeAll(()=>Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true}));
const config={scene:'showroom-1',licensePlate:'remove',changeColor:false,showManufacturerLogo:false,showDealerLogo:false} as RemasterConfig;
const ref=(role:string)=>({sourceId:role,sourceRole:role,sourceType:'original' as const,image:'data:image/jpeg;base64,YQ=='});
it('missing side stops before upload and dispatch, without provider costs',async()=>{
  upload.mockClear();invoke.mockClear();
  await expect(invokeNb21V3({sources:[ref('front'),ref('side')],jobKey:'EXT_34_FRONT_RIGHT',config,lightingProfile:await createV3LightingProfile('blocked')})).rejects.toThrow(/right_original/);
  expect(upload).not.toHaveBeenCalled();expect(invoke).not.toHaveBeenCalled();
});
it('one profile/cache survives concurrent jobs and retry; provider mocked',async()=>{
  upload.mockClear();invoke.mockClear();
  const lightingProfile=await createV3LightingProfile('run'),uploadCache=new V2RunUploadCache(),sources=[ref('front'),ref('side-right')];
  const args={sources,config,lightingProfile,uploadCache};
  await Promise.all(['EXT_SIDE_RIGHT','EXT_34_FRONT_RIGHT'].map(jobKey=>invokeNb21V3({...args,jobKey})));
  await invokeNb21V3({...args,jobKey:'EXT_SIDE_RIGHT',retryReason:'wrong_physical_side'});
  expect(upload).toHaveBeenCalledTimes(2); expect(invoke).toHaveBeenCalledTimes(3);
  for(const call of invoke.mock.calls){const b=call[0] as {promptVersion:string;referenceManifest:Parameters<typeof validateV3Wire>[0];v3References:Parameters<typeof validateV3Wire>[1]};expect(b.promptVersion).toBe('nb21-v3');expect(b.referenceManifest.lightingProfile.hash).toBe(lightingProfile.hash);await validateV3Wire(b.referenceManifest,b.v3References);}
});
it('custom plate stays a plate and disabled stale wall logos are excluded',async()=>{
  invoke.mockClear();
  const asset=(role:string)=>({...ref(role),sourceType:'immutable asset' as const});
  await invokeNb21V3({sources:[ref('front'),ref('side-right'),asset('manufacturer-logo'),asset('dealer-logo')],jobKey:'EXT_34_FRONT_RIGHT',config:{...config,licensePlate:'custom',customPlateImageBase64:'data:image/png;base64,YQ=='},lightingProfile:await createV3LightingProfile('plate-only')});
  const b=invoke.mock.calls[0][0] as {referenceManifest:{entries:{role:string}[]};dynamicPrompt:string};
  expect(b.referenceManifest.entries.filter(e=>['plate','manufacturer-logo','dealer-logo'].includes(e.role)).map(e=>e.role)).toEqual(['plate']);
  expect(b.dynamicPrompt).toContain('No manufacturer or dealer wall logo is authorized');
  expect(b.dynamicPrompt).toContain('must NEVER appear on walls');
});
it('inactive custom mode strips a stale plate asset before upload',async()=>{
  invoke.mockClear();
  await invokeNb21V3({sources:[ref('front'),ref('side-right'),{...ref('plate'),sourceType:'immutable asset'}],jobKey:'EXT_34_FRONT_RIGHT',config,lightingProfile:await createV3LightingProfile('no-plate')});
  const b=invoke.mock.calls[0][0] as {referenceManifest:{entries:{role:string}[]}};
  expect(b.referenceManifest.entries.some(e=>e.role==='plate')).toBe(false);
});
