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
  for(const call of invoke.mock.calls){const b=call[0] as Parameters<typeof validateV3Wire>[0] extends never ? never : {promptVersion:string;referenceManifest:Parameters<typeof validateV3Wire>[0];v3References:Parameters<typeof validateV3Wire>[1]};expect(b.promptVersion).toBe('nb21-v3');expect(b.referenceManifest.lightingProfile.hash).toBe(lightingProfile.hash);await validateV3Wire(b.referenceManifest,b.v3References);}
});
