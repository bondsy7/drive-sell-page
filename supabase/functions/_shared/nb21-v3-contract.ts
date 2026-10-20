import type { V2Reference, V2ManifestEntry, V2Target, V2WireReference } from './nb21-v2-contract.ts';
import { validateV3LightingProfile, type V3LightingProfile } from './nb21-v3-lighting.ts';
export type V3Reference = V2Reference;
export type V3Target = V2Target;
export type V3Entry = V2ManifestEntry;
export type V3WireReference = V2WireReference;
export const V3_RETRY_REASONS = ['wrong_physical_side','wrong_view_quadrant','unsupported_visible_surface','lighting_inconsistent','identity_drift'] as const;
export type V3RetryReason = typeof V3_RETRY_REASONS[number];
export type V3ViewKey = 'side-left' | 'side-right' | '34-front-left' | '34-front-right' | '34-rear-left' | '34-rear-right';
export type V3Surface = 'front' | 'rear' | 'left' | 'right';
export interface V3ViewContract {
  key: V3ViewKey; physicalSide: 'left' | 'right'; visibleSurfaces: V3Surface[];
  requiredOriginalRoles: { surface: V3Surface; slots: string[] }[];
  optionalSupportingRoles: string[]; forbiddenAuthorityRoles: string[]; forbiddenSubstitutions: string[];
}
const LEFT = ['side','side-left','side-left-full','truck-cab-side-left'];
const RIGHT = ['side-right','side-right-full','truck-cab-side-right'];
const FRONT_ROLES = ['front','34front','34front-right','front-left','front-right'];
const REAR_ROLES = ['rear','34rear','34rear-right','rear-left','rear-right'];
export const V3_VIEW_CONTRACTS: Record<V3ViewKey, V3ViewContract> = Object.fromEntries(
  (['side-left','side-right','34-front-left','34-front-right','34-rear-left','34-rear-right'] as V3ViewKey[]).map(key => {
    const physicalSide = key.endsWith('right') ? 'right' as const : 'left' as const;
    const pole = key.includes('front') ? 'front' : key.includes('rear') ? 'rear' : null;
    return [key, { key, physicalSide, visibleSurfaces: pole ? [pole, physicalSide] : [physicalSide],
      requiredOriginalRoles: [...(pole ? [{ surface: pole, slots: pole === 'front' ? FRONT_ROLES : REAR_ROLES }] : []), { surface: physicalSide, slots: physicalSide === 'left' ? LEFT : RIGHT }],
      optionalSupportingRoles: ['wheel','plate','manufacturer-logo','dealer-logo','scene-logo','environment'],
      forbiddenAuthorityRoles: physicalSide === 'right' ? LEFT : RIGHT,
      forbiddenSubstitutions: ['opposite-side mirroring','brand/model knowledge','generated geometry','front/rear-only side reconstruction'] }];
  })
) as Record<V3ViewKey, V3ViewContract>;
export function normalizeV3Role(role: string): string { return role.toLowerCase().replace(/_/g, '-').trim(); }
/** Explicit aliases for historical jobs whose names omit the physical side. */
const VIEW_ALIASES: Record<string, V3ViewKey> = {
  MASTER_IMAGE: '34-front-left', VAN_MASTER_IMAGE: '34-front-left', MOTO_MASTER_IMAGE: '34-front-left', MACH_MASTER_IMAGE: '34-front-left', WOMO_MASTER_IMAGE: '34-front-left',
  EXT_LOW_ANGLE: '34-front-left', EXT_ELEVATED_FRONT: '34-front-left', MOTO_EXT_LOW_ANGLE: '34-front-left', WOMO_EXT_HIGH_ANGLE: '34-front-left', CI_PORSCHE_LOW: '34-front-left',
  WOMO_EXT_REAR_34: '34-rear-right', VAN_EXT_REAR_34: '34-rear-right', MACH_EXT_REAR_34: '34-rear-right', MACH_EXT_LOW_ANGLE: '34-front-left', CI_VOLVO_SIDE: 'side-right',
  '34FRONT': '34-front-left', '34FRONT_RIGHT': '34-front-right', '34REAR': '34-rear-left', '34REAR_RIGHT': '34-rear-right', SIDE: 'side-left',
};
for (const brand of ['BMW','MERCEDES','AUDI','VW','PORSCHE']) {
  VIEW_ALIASES[`CI_${brand}_SIDE`] = 'side-left';
  VIEW_ALIASES[`CI_${brand}_34_FRONT`] = '34-front-left';
  VIEW_ALIASES[`CI_${brand}_34_REAR`] = '34-rear-left';
}
export function v3ViewForJob(jobKey: string): V3ViewContract | undefined {
  const k = jobKey.toUpperCase().replace(/-/g, '_');
  const direct = jobKey.toLowerCase() as V3ViewKey;
  if (V3_VIEW_CONTRACTS[direct]) return V3_VIEW_CONTRACTS[direct];
  const alias = VIEW_ALIASES[k];
  if (alias) return V3_VIEW_CONTRACTS[alias];
  const side = /(?:^|_)SIDE_(LEFT|RIGHT)$/.exec(k);
  if (side) return V3_VIEW_CONTRACTS[`side-${side[1].toLowerCase()}` as V3ViewKey];
  const quarter = /(?:^|_)(?:34_(FRONT|REAR)|(FRONT|REAR)_34)_(LEFT|RIGHT)$/.exec(k);
  if (quarter) return V3_VIEW_CONTRACTS[`34-${(quarter[1] ?? quarter[2]).toLowerCase()}-${quarter[3].toLowerCase()}` as V3ViewKey];
  return undefined;
}
export interface V3Manifest {
  version: 'nb21-v3'; jobKey: string; mode: 'edit' | 'view_synthesis'; editSlot?: string;
  target: V3Target; budget: number; entries: V3Entry[];
  viewContract?: V3ViewContract; requestedPhysicalSide?: 'left' | 'right'; visibleSurfaces: string[];
  surfaceAuthority: Record<string, string[]>; lightingProfile: V3LightingProfile; retryReason?: V3RetryReason;
}
export interface V3EvidencePlan { manifest: V3Manifest; references: V3Reference[] }
export function classifyV3Target(key: string, category?: string): V3Target {
  const k = key.toUpperCase();
  if (/GRID|COMPOSITE|COLLAGE/.test(k) || category === 'composite') return 'composite';
  if (/BOOT|CARGO|GARAGE/.test(k)) return 'cargo_area';
  if (/WHEEL/.test(k)) return 'wheel_detail';
  if (/STEERING|CLUSTER|SCREEN|MBUX|CONTROLS/.test(k)) return 'interior_detail';
  if (/DET_COCKPIT/.test(k)) return 'interior_detail';
  if (/^(LIVING|KITCHEN|BATH|BED|SLEEPER)$/.test(k)) return 'interior_cabin';
  if (/INT_|INTERIOR|COCKPIT|CABIN/.test(k) || category === 'interior') return 'interior_cabin';
  if (/HEADLIGHT|TAILLIGHT|GRILLE|PANEL|DET_/.test(k) || category === 'detail') return 'exterior_detail';
  return 'exterior';
}

export interface V3Requirement { role: string; slots: string[]; authority: string; required?: boolean }
export interface V3Policy { target: V3Target; budget: number; requirements: V3Requirement[]; wheel: boolean }
const req = (role: string, slots: string[], authority: string, required = true): V3Requirement => ({ role, slots, authority, required });
const FRONT = ['front', '34front', '34front-right', 'front-left', 'front-right'];
const REAR = ['rear', '34rear', '34rear-right', 'rear-left', 'rear-right'];
const COCKPIT = ['cockpit', 'interior-front', 'cabin', 'truck-cab-interior', 'controls'];
export function v3BasePolicy(key: string, category?: string, editSlot?: string): V3Policy {
  const k = key.toUpperCase();
  const target = editSlot ? classifyV3Target(editSlot.toUpperCase().replace(/-/g, '_')) : classifyV3Target(key, category);
  if (editSlot) return { target, budget: 6, wheel: !target.startsWith('interior') && target !== 'cargo_area', requirements: [req('same_view_original', [normalizeV3Role(editSlot)], 'same-view geometry, camera and visible identity')] };
  if (target === 'cargo_area') return { target, budget: 3, wheel: false, requirements: [req('cargo_original', ['cargo', 'boot', 'open-boot', 'cargo-area', 'garage'], 'cargo floor, cover, backrests, hooks and side trim'), req('rear_evidence', REAR, 'hatch, rear lights and surrounding body')] };
  if (target === 'interior_detail') {
    const local = /STEERING/.test(k) ? ['steering', 'steering-wheel'] : /CLUSTER/.test(k) ? ['cluster', 'instrument-cluster', 'steering', 'steering-wheel'] : /SCREEN|MBUX/.test(k) ? ['screen', 'center-screen', 'dashboard'] : ['controls', 'dashboard'];
    return { target, budget: 3, wheel: false, requirements: [req('interior_detail_original', [...local, ...COCKPIT], 'photographed controls, selector, contours, materials and display layout'), req('cabin_evidence', COCKPIT, 'surrounding cabin geometry', false)] };
  }
  if (target === 'interior_cabin') {
    const rear = /REAR|SEAT|FOND/.test(k) && !/FRONT_SEAT/.test(k);
    const specific = /LIVING|KITCHEN|BATH|BED|SLEEPER/.exec(k)?.[0]?.toLowerCase();
    return { target, budget: 3, wheel: false, requirements: [req('cabin_original', specific ? [specific] : rear ? ['interior-rear', 'rear-seats', 'passenger-seat'] : [...COCKPIT, 'dashboard'], rear ? 'rear seats, seat orientation, front seat presence, doors and console' : 'complete cabin architecture and both front seat assemblies; dashboard close-ups cannot replace a supplied cabin overview'), req('cabin_evidence', rear ? COCKPIT : ['interior-rear'], 'other visible cabin surfaces only', false)] };
  }
  if (target === 'wheel_detail') return { target, budget: 3, wheel: true, requirements: [req('wheel_original', ['wheel', 'wheel-detail', 'rim', ...FRONT, 'side', 'side-right'], 'wheel mounting and surrounding body')] };
  if (target === 'exterior_detail') {
    const back = /TAIL|REAR/.test(k);
    const visibleOverview = /HEADLIGHT|TAILLIGHT|GRILLE|PANEL/.test(k);
    const local = /HEADLIGHT/.test(k) ? ['headlight', 'headlight-detail'] : /TAIL/.test(k) ? ['taillight', 'taillight-detail'] : /GRILLE|PANEL/.test(k) ? ['frontpanel', 'grille', 'front-panel'] : [k.replace(/^(?:MACH|WOMO|MOTO|VAN)_DET_/, '').toLowerCase().replace(/_/g, '-')];
    return { target, budget: 3, wheel: false, requirements: [req('local_detail_original', [...local, ...(visibleOverview ? back ? REAR : FRONT : [])], 'local part outline, texture and adjacent photographed structure'), req('geometry_evidence', back ? REAR : FRONT, 'part position on photographed body', false)] };
  }
  if (target === 'composite' && /INTERIOR/.test(k)) return { target, budget: 4, wheel: false, requirements: [req('cabin_original', COCKPIT, 'full front cabin, driver and passenger seats; dashboard and console cells'), req('rear_cabin_original', ['interior-rear','rear-seats'], 'rear seat cell'), req('interior_detail_original', ['steering', 'steering-wheel', 'dashboard'], 'steering detail cell only; never replaces the seat-bearing cabin original', false)] };
  if (target === 'composite') return { target, budget: 6, wheel: true, requirements: [req('front_original', FRONT, 'front identity'), req('side_original', ['side', 'side-left'], 'left body identity'), req('rear_original', REAR, 'rear identity')] };
  const right = /RIGHT/.test(k) || k === 'CI_VOLVO_SIDE', rear = /REAR/.test(k), side = /SIDE/.test(k);
  const flank = right ? ['side-right', 'side-right-full', 'truck-cab-side-right'] : ['side', 'side-left', 'truck-cab-side-left'];
  if (side) return { target, budget: 4, wheel: true, requirements: [req('physical_side_original', flank, `${right ? 'RIGHT' : 'LEFT'} physical flank and asymmetric equipment`), req('front_evidence', FRONT, 'front transition', false), req('rear_evidence', REAR, 'rear transition', false)] };
  if (rear) return { target, budget: 5, wheel: true, requirements: [req('rear_original', right ? ['34rear-right', ...REAR] : ['34rear', ...REAR], 'rear fascia and attached equipment'), req('physical_side_original', flank, `${right ? 'RIGHT' : 'LEFT'} flank`, /34/.test(k)), req('paint_evidence', FRONT, 'series paint hue and finish only; never front geometry in a rear view', false)] };
  return { target, budget: 5, wheel: true, requirements: [req('front_original', right ? ['34front-right', ...FRONT] : FRONT, 'complete connected front fascia and body generation'), req('front_detail_evidence', ['frontpanel', 'grille', 'headlight', ...FRONT], 'panel, headlamp signature, sensors and bumper transitions', false), req('geometry_evidence', flank, 'silhouette and physical side geometry', false)] };
}


export function v3Policy(key: string, category?: string, editSlot?: string): V3Policy {
  const view = v3ViewForJob(editSlot ?? key);
  if (view) return { target: 'exterior', budget: 5, wheel: true, requirements: view.requiredOriginalRoles.map(r => req(`${r.surface}_original`, r.slots, `ONLY physical ${r.surface} surface geometry and identity`)) };
  const base = v3BasePolicy(key, category, editSlot);
  if (base.target === 'composite') {
    if (key === 'GRID_INTERIOR_4') return { target: 'composite', budget: 4, wheel: false, requirements: [
      req('cabin_original', ['interior-front','cockpit','cabin','truck-cab-interior'], 'complete seat-bearing front cabin; dashboard and attached console cells'),
      req('rear_cabin_original', ['interior-rear','rear-seats'], 'rear seat cell'),
      req('interior_detail_original', ['steering','steering-wheel'], 'steering cell; controls never prove absence of a seat'),
    ] };
    if (key === 'GRID_EXTERIOR_4') return { target:'composite',budget:5,wheel:true,requirements:[req('front_original',FRONT_ROLES,'front geometry for front-left cell'),req('left_original',LEFT,'physical LEFT geometry for all left-facing cells'),req('rear_original',REAR_ROLES,'rear geometry for rear-left and head-on rear cells')] };
    // A composite without per-cell contracts cannot bypass side authority.
    throw new Error(`NB21 v3: Kein expliziter Zellenvertrag für ${key}; Job blockiert.`);
  }
  // No generic exterior fallback can synthesize an unspecified or uncovered flank.
  if (!editSlot && base.target === 'exterior' && !/(?:^|_)(?:FRONT|REAR)$/.test(key.toUpperCase())) throw new Error(`NB21 v3: Kein expliziter View-Contract für ${key}.`);
  if (!editSlot && base.target === 'exterior') return { ...base, requirements: [req(/REAR$/.test(key) ? 'rear_original' : 'front_original', /REAR$/.test(key) ? REAR_ROLES : FRONT_ROLES, 'head-on evidenced surface only')] };
  // Other target-specific policies are independent frozen V3 definitions above.
  // Close-ups never imply a missing driver seat or cabin architecture.
  if (base.target === 'interior_cabin' && !/REAR|SEAT|FOND|LIVING|KITCHEN|BATH|BED|SLEEPER/.test(key)) base.requirements[0].slots = ['interior-front','cockpit','cabin','truck-cab-interior'];
  return base;
}
export function resolveV3Evidence(args: { jobKey: string; category?: string; editSlot?: string; sources: V3Reference[]; lightingProfile: V3LightingProfile; retryReason?: V3RetryReason }): V3EvidencePlan {
  const p = v3Policy(args.jobKey, args.category, args.editSlot), view = v3ViewForJob(args.editSlot ?? args.jobKey);
  if (args.retryReason && !V3_RETRY_REASONS.includes(args.retryReason)) throw new Error('NB21 v3: Unbekannter Retry-Grund.');
  const ids = new Set<string>();
  for (const s of args.sources) {
    if (!s.sourceId || !s.sourceRole || ids.has(s.sourceId)) throw new Error('NB21 v3: Doppelte/fehlende Quellenidentität.');
    ids.add(s.sourceId);
  }
  const originals = args.sources.filter(s => s.sourceType === 'original' && s.image).sort((a,b) => a.sourceId.localeCompare(b.sourceId));
  const entries: V3Entry[] = [], references: V3Reference[] = [], surfaceAuthority: Record<string,string[]> = {};
  const add = (s: V3Reference, role: string, authority: string) => {
    entries.push({ sourceId:s.sourceId, sourceRole:s.sourceRole, sourceType:s.sourceType, assetId:s.assetId, role, authorityTier:s.sourceType === 'original' ? 'A' : s.sourceType === 'immutable asset' ? 'B' : 'C', authority }); references.push(s);
  };
  for (const r of p.requirements) {
    const hit = r.slots.flatMap(slot => originals.filter(s => normalizeV3Role(s.sourceRole) === slot))[0];
    if (!hit && r.required) throw new Error(`NB21 v3: Originalbeleg fehlt (${r.role}); Job blockiert.`);
    if (hit) {
      const surface = view?.requiredOriginalRoles.find(s => `${s.surface}_original` === r.role)?.surface ?? ({front_original:'front',rear_original:'rear',left_original:'left',right_original:'right'}[r.role] ?? r.role);
      surfaceAuthority[surface] = [hit.sourceId];
      if (!entries.some(e => e.sourceId === hit.sourceId)) add(hit, r.role, r.authority);
    }
  }
  const interior = p.target.startsWith('interior') || (p.target === 'composite' && /INTERIOR/.test(args.jobKey));
  const assets = args.sources.filter(s => s.sourceType === 'immutable asset' && s.image && ['wheel','plate','manufacturer-logo','dealer-logo','scene-logo'].includes(normalizeV3Role(s.sourceRole)) && !(normalizeV3Role(s.sourceRole) === 'wheel' && !p.wheel) && !(normalizeV3Role(s.sourceRole) === 'plate' && (interior || p.target === 'cargo_area'))).sort((a,b) => a.sourceId.localeCompare(b.sourceId));
  const budget = Math.min(8, p.budget + assets.length);
  for (const s of assets) { if (entries.length >= budget - 1) throw new Error('NB21 v3: Assetbudget überschritten.'); add(s,normalizeV3Role(s.sourceRole),`immutable ${normalizeV3Role(s.sourceRole)} pixels ONLY in this domain`); }
  const context = args.sources.filter(s => s.sourceType === 'generated context' && normalizeV3Role(s.sourceRole) === 'environment' && s.image).sort((a,b) => a.sourceId.localeCompare(b.sourceId))[0];
  if (context && entries.length < budget) add(context,'presentation_context','environment and presentation only; NO geometry, identity or lighting authority');
  return { manifest: { version:'nb21-v3', jobKey:args.jobKey, mode:args.editSlot ? 'edit' : 'view_synthesis', ...(args.editSlot ? { editSlot: args.editSlot } : {}), target:p.target, budget, entries, ...(view ? { viewContract:view, requestedPhysicalSide:view.physicalSide } : {}), visibleSurfaces:view?.visibleSurfaces ?? Object.keys(surfaceAuthority), surfaceAuthority, lightingProfile:args.lightingProfile, ...(args.retryReason ? { retryReason:args.retryReason } : {}) }, references };
}
export function wireV3Evidence(plan: V3EvidencePlan): V3WireReference[] {
  return plan.references.map((s,i) => { const entry = plan.manifest.entries[i]; if (!entry || entry.sourceId !== s.sourceId) throw new Error('NB21 v3: Bildreihenfolge widerspricht Manifest.'); return s.fileUri?.uri ? { ...entry,transport:'file_uri',fileUri:s.fileUri } : { ...entry,transport:'inline',imageBase64:s.image }; });
}
export async function validateV3Wire(manifest: V3Manifest, refs: V3WireReference[]) {
  if (!manifest || manifest.version !== 'nb21-v3' || !Array.isArray(refs) || !refs.length || refs.length > 8 || !Array.isArray(manifest.entries) || manifest.entries.length !== refs.length || !['edit','view_synthesis'].includes(manifest.mode)) throw new Error('NB21 v3: Ungültiges Manifest.');
  await validateV3LightingProfile(manifest.lightingProfile);
  if (manifest.mode === 'edit' && !manifest.editSlot) throw new Error('NB21 v3: Edit-Slot fehlt.');
  for (const [i,r] of refs.entries()) {
    if (['sourceId','sourceRole','sourceType','assetId','role','authorityTier','authority'].some(k => (manifest.entries[i] as unknown as Record<string,unknown>)[k] !== (r as unknown as Record<string,unknown>)[k])) throw new Error('NB21 v3: Manifest/Bildidentität ungleich.');
    if (r.transport === 'file_uri' ? !r.fileUri?.uri || !r.fileUri.mimeType : r.transport === 'inline' ? !r.imageBase64 : true) throw new Error('NB21 v3: Bildtransport fehlt oder ist unzulässig.');
  }
  const canonical = resolveV3Evidence({jobKey:manifest.jobKey, editSlot:manifest.mode === 'edit' ? manifest.editSlot : undefined, lightingProfile:manifest.lightingProfile, retryReason:manifest.retryReason, sources:refs.map(r => ({...r,image:'available'}))}).manifest;
  if (stableV3Json(canonical) !== stableV3Json(manifest)) throw new Error('NB21 v3: Manifest widerspricht dem autoritativen View-/Evidenzvertrag.');
}
function stableV3Json(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableV3Json).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stableV3Json(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function v3ResultMetadata(manifest: V3Manifest) {
  return { viewContract:manifest.viewContract ?? null, requestedPhysicalSide:manifest.requestedPhysicalSide ?? null, visibleSurfaces:manifest.visibleSurfaces, authoritativeOriginalSourceIds:manifest.surfaceAuthority, lightingProfile:manifest.lightingProfile, renderProfileVersion:manifest.lightingProfile.version, lightingProfileHash:manifest.lightingProfile.hash, retryReason:manifest.retryReason ?? null };
}
