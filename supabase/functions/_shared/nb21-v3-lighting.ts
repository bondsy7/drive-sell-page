/** One immutable, server-validated profile per run; no provider calls. */
export const V3_LIGHTING_SPEC = Object.freeze({
  version: 'nb21-v3-lighting-1', whiteBalanceKelvin: 5500,
  exposure: 'balanced neutral midtones', contrast: 'moderate photographic contrast',
  highlightRolloff: 'soft protected highlights', shadowSoftness: 'fixed broad soft key and balanced fill',
  reflectionHardness: 'broad soft controlled reflections', reflectionIntensity: 'restrained consistent intensity',
  paintPerception: 'unchanged intrinsic hue and finish; consistent perceived brightness',
});
export interface V3LightingProfile { version: string; runId: string; hash: string; spec: typeof V3_LIGHTING_SPEC }
async function specHash(): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(V3_LIGHTING_SPEC));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2,'0')).join('');
}
export async function createV3LightingProfile(runId: string): Promise<V3LightingProfile> {
  if (!runId || runId.length > 200) throw new Error('NB21 v3: Ungültige Lichtprofil-Laufidentität.');
  return Object.freeze({ version: V3_LIGHTING_SPEC.version, runId, hash: await specHash(), spec: V3_LIGHTING_SPEC });
}
export async function validateV3LightingProfile(profile: V3LightingProfile): Promise<void> {
  if (!profile || typeof profile.runId !== 'string' || !profile.runId || profile.runId.length > 200 || profile.version !== V3_LIGHTING_SPEC.version || profile.hash !== await specHash() || JSON.stringify(profile.spec) !== JSON.stringify(V3_LIGHTING_SPEC)) throw new Error('NB21 v3: Lichtprofil widerspricht dem Serienvertrag.');
}
export function v3RelightingContract(p: V3LightingProfile): string {
  return `<NB21_V3_RELIGHTING>\nProfile=${p.version}; hash=${p.hash}; run=${p.runId}. ${JSON.stringify(p.spec)}\nOriginals define identity and geometry ONLY. Never inherit per-photo exposure, white balance, colour cast, contrast, shadow mood or reflection mood. Relight every evidenced vehicle surface physically into this SAME series light: fixed scene-space key/fill, exposure response, contrast, highlight rolloff, shadow softness and reflection hardness/intensity. Camera-dependent reflections remain physical. Do not shift, reinterpret or bleach intrinsic paint colour or upholstery. Generated environment and CI styling cannot override this profile. No removal of seats, pillars or roof to brighten the cabin.\n</NB21_V3_RELIGHTING>`;
}
