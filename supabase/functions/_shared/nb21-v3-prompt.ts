import { v3RelightingContract } from './nb21-v3-lighting.ts';
import { type V3Manifest } from './nb21-v3-contract.ts';
import { buildV2SubjectClassLock, type V2SubjectClass } from './nb21-v2-class.ts';
import { brandingAssetScope } from './branding-asset-scope.ts';
export const V3_NO_INVENTION = 'Use ONLY the reference image. Do NOT invent colors, badges, wheels, interior trim, stitching, or UI elements. Every visible attribute MUST match the reference exactly. Do NOT fall back on generic model knowledge. No unsupported part, contour, trim, lamp signature, mirror, door line, glazing, cabin or cargo element. Tier A originals define geometry/identity; Tier B assets define ONLY their named domain. Brand/model knowledge is NEVER authority. Generated context/remasters define presentation/environment ONLY. Insufficient evidence blocks the job, never completes missing details generatively.';
export function v3ViewPrompt(m: V3Manifest): string {
  const v = m.viewContract;
  if (!v) return `Target=${m.target}; evidenced surfaces=${m.visibleSurfaces.join(', ')}. Show ONLY supported surfaces; never infer hidden surfaces from model knowledge. ${m.mode === 'edit' ? 'Retain the exact original camera and framing.' : 'Use the target-specific evidenced view only.'}`;
  const direction = v.key.startsWith('side-') ? `Perpendicular profile. Front points to IMAGE ${v.physicalSide === 'left' ? 'LEFT' : 'RIGHT'}; rear points to IMAGE ${v.physicalSide === 'left' ? 'RIGHT' : 'LEFT'}.` : `Camera ${v.key.includes('front') ? 'in FRONT of' : 'BEHIND'} and on physical ${v.physicalSide.toUpperCase()} side, 30–40 degrees off the longitudinal axis.`;
  return `VIEW_CONTRACT=${v.key}; physicalSide=${v.physicalSide}. Visible surfaces ONLY: ${v.visibleSurfaces.join(' + ')}. ${direction} The opposite flank must not be presented as the requested side. Surface authority=${JSON.stringify(m.surfaceAuthority)}. NEVER mirror, flip or substitute an opposite-side original. Uncovered surfaces cannot be reconstructed from brand/model knowledge. ${m.mode === 'edit' ? 'Preserve original camera; only relight/allowed surfaces.' : ''}`;
}
export function enforceV3ServerPrompt(prompt: string, manifest: V3Manifest, ctx?: V2SubjectClass | null): string {
  // Rebuild authority, class, view, lighting and priority from validated data, not client prose.
  const sections: Record<number,string> = {
    2: manifest.entries.map((e,i) => `IMAGE ${i+1}: ${e.role}; source=${e.sourceType}; slot=${e.sourceRole}; Tier ${e.authorityTier}; authority=${e.authority}.`).join('\n'),
    4: `${buildV2SubjectClassLock(ctx).replace(/NB21_V2/g,'NB21_V3')}\n${V3_NO_INVENTION}\nPreserve physically complete separate seats, backrests, headrests, doors, pillars and roof with their natural occlusion. Physical completeness does NOT require every assembly to be visible in one photograph. Seats outside the camera field remain present; never remove, merge or make them transparent to reveal controls. Never cut away doors, pillars or roof to pack more information into frame. Flat/open photographed consoles stay flat; no invented lever, pin or bulge.`,
    5: v3ViewPrompt(manifest), 7: v3RelightingContract(manifest.lightingProfile),
    9: `Original evidence and scoped asset evidence > allowed surface change > presentation. No aesthetic rule authorizes identity, physical-side, geometry, equipment or intrinsic paint changes. Missing evidence blocks output. No automatic QA or harmonization pass.\n${brandingAssetScope(manifest.entries.filter(e => e.sourceType === 'immutable asset').map(e => e.role))}`, 
  };
  let out = prompt;
  for (const [n,body] of Object.entries(sections)) out = out.replace(new RegExp(`(### SECTION ${n}/9: [^\\n]+\\n)[\\s\\S]*?(?=\\n\\n### SECTION |$)`), (_,header:string) => `${header}${body}`);
  return out;
}
