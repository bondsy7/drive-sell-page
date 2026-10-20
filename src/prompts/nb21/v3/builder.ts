import { renderNb21Prompt } from '../sections';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import { SCENE_PROMPT_DEFAULTS } from '@/lib/remaster-prompt-defaults';
import { type V3Manifest } from '../../../../supabase/functions/_shared/nb21-v3-contract';
import { enforceV3ServerPrompt } from '../../../../supabase/functions/_shared/nb21-v3-prompt';
import { v3RelightingContract, type V3LightingProfile } from '../../../../supabase/functions/_shared/nb21-v3-lighting';
import type { V2SubjectClass } from '../../../../supabase/functions/_shared/nb21-v2-class';
import { v2LocalContract } from '../v2/builder';
export const NB21_V3_VERSION = 'nb21-v3' as const;

/**
 * Per-job shot contract (camera position, framing, subject). Server-enforced sections
 * (roles, identity, view contract, lighting, priority) are rebuilt on the server; this
 * shot description lives in MAIN TASK and CAMERA / OUTPUT, which the server keeps.
 * Without it the model improvises camera and crop (observed: wrong interior viewpoints,
 * cluster instead of centre screen, cut roof/seats).
 */
const V3_CABIN_CAMERA: Array<[RegExp, string]> = [
  [/SCREEN|MBUX/, 'CAMERA: centred on the central display; the display is the main subject and fully visible, with the surrounding dashboard/console attached. Not the instrument cluster or steering wheel as main subject.'],
  [/CLUSTER/, 'CAMERA: behind the steering wheel at driver eye level; instrument display and wheel fully visible.'],
  [/STEERING/, 'CAMERA: from the driver seat position; complete steering wheel and both stalks fully in frame.'],
  [/REAR_SEAT|INT_REAR/, 'CAMERA: from the front of the cabin between the front seats, looking straight rearward at the complete rear bench (all seat positions, headrests, belts and side door panels visible), roof lining in frame.'],
  [/PASSENGER/, 'CAMERA: at the open front passenger door at seat height, looking across the passenger seat to the dashboard and driver side; complete passenger seat in frame.'],
  [/INT_CENTER|DASHBOARD|COCKPIT/, 'CAMERA: centred between/behind the front seats at shoulder height looking forward; complete dashboard, centre console and both front seat assemblies in frame, roof lining visible.'],
  [/DRIVER/, 'CAMERA: at the open driver door at seat height; complete driver seat, steering wheel and dashboard in frame.'],
  [/BOOT|TRUNK|CARGO/, 'CAMERA: behind the vehicle centred on the open tailgate; complete cargo opening, floor and surrounding rear body in frame.'],
];
export function v3ShotContract(jobKey: string, target: V3Manifest['target']): string[] {
  const k = jobKey.toUpperCase();
  const viewpoint = k.replace(/^CI_[A-Z]+_/, '').replace(/_/g, ' ');
  const camera = V3_CABIN_CAMERA.find(([re]) => re.test(k))?.[1];
  return [`Requested viewpoint=${viewpoint}; CI names describe presentation only, never equipment.`, ...(camera ? [camera] : []), ...v2LocalContract(k, target as never)];
}

export function v3Framing(m: V3Manifest): string {
  const k = m.jobKey.toUpperCase();
  const interior = m.target.startsWith('interior') || (m.target === 'composite' && /INTERIOR/.test(k));
  if (m.mode === 'edit') return 'Landscape 4:3. Keep the exact original camera position, focal length and framing; do not zoom in, crop tighter or extrapolate beyond the reference frame.';
  if (m.target.includes('detail')) return 'Photographic local close-up of ONLY the requested part, centred and fully inside the frame with enough attached surrounding context to read its position. Landscape 4:3. Never substitute a neighbouring part (e.g. instrument cluster for centre screen).';
  if (interior) return 'Landscape 4:3 cabin photograph at the camera position named in MAIN TASK, eye level, moderate wide-angle comparable to the cabin originals. Keep roof lining, pillars, headrests and complete seat assemblies inside the frame; no tighter crop than the cabin originals, no door-opening or rear-door viewpoint unless requested. Never cut seats or roof at the frame edge.';
  return 'Landscape 4:3 full-vehicle photograph: the complete vehicle including bumpers, mirrors, roof and all wheels fully inside the frame with clear margin (about 8–12 % of frame width on each side); never touch or cut the frame edge. Consistent vehicle scale across the series. No crop-driven completion of unsupported geometry.';
}

/** V2 current/default stays untouched; V3 is opt-in. */
export function buildNb21V3Prompt(args: { manifest: V3Manifest; config: RemasterConfig; correction?: string; classContext?: V2SubjectClass | null }): string {
  const {manifest:m,config:c} = args;
  const interior = m.target.startsWith('interior') || (m.target === 'composite' && /INTERIOR/.test(m.jobKey));
  const task = m.jobKey === 'GRID_INTERIOR_4' ? 'Exactly four separate photographs, 2×2 grid. Top-left full driver dashboard WITH physical front seats using cabin_original; top-right connected console using cabin_original; bottom-left rear seats using rear_cabin_original; bottom-right steering detail using interior_detail_original. Never erase seats to reveal controls.' : m.jobKey === 'GRID_EXTERIOR_4' ? 'Exactly four separate photographs in a 2×2 grid. Top-left: 3/4 front LEFT, front_original + left_original. Top-right: physical LEFT side profile, left_original. Bottom-left: 3/4 rear LEFT, rear_original + left_original. Bottom-right: head-on rear, rear_original. NO right-side cell; no mirroring or unsupported visible surface. Same run lighting in every cell.' : `Target ${m.jobKey}; semantic type ${m.target}. ${m.mode === 'edit' ? 'Retain original camera, geometry and framing; no view synthesis.' : 'Evidence-driven requested view synthesis.'}`;
  const shot = m.mode === 'edit' || /^GRID_/.test(m.jobKey) ? [] : v3ShotContract(m.jobKey, m.target);
  const paint = m.entries.findIndex(e => e.role === 'paint_evidence');
  return enforceV3ServerPrompt(renderNb21Prompt({
    'MAIN TASK': ['PROMPT_VERSION: nb21-v3',task, ...shot, ...(paint >= 0 && !c.changeColor ? [`SERIES PAINT AUTHORITY: IMAGE ${paint + 1} defines intrinsic paint hue and finish; ignore bright/dark capture shading, never shift warm metallic paint to cool grey/silver.`] : [])],
    'REFERENCE ROLES': ['Server-enforced evidence roles.'],
    'ALLOWED CHANGES': [`Environment=${c.scene}; cleanup=${(c.cleanupItems ?? []).join(', ') || 'none'}; plate=${interior ? 'unchanged/not visible' : c.licensePlate}${c.customPlateText ? `; plate text=${JSON.stringify(c.customPlateText)}` : ''}.`, c.changeColor ? `Explicit paint change=${c.colorHex ?? 'requested colour'}; preserve scheme boundaries.` : 'Intrinsic photographed paint colour/finish unchanged.', args.correction ? `Manual correction=${args.correction}; subject to validated evidence and view contract.` : 'No additional changes.', m.retryReason ? `MANUAL_RETRY_REASON=${m.retryReason}; correct only within the evidence contract.` : 'No image QA or second pass requested.'],
    'VEHICLE IDENTITY LOCK': ['Server-enforced original identity.'], 'PERSPECTIVE LOCK': ['Server-enforced view contract.'],
    'ENVIRONMENT': [`${SCENE_PROMPT_DEFAULTS[c.scene] ?? 'Use supplied environment only.'} CI styling affects environment, never vehicle colour or lighting profile. Supplied current logo/plate/wheel assets are authoritative only in their named domain. No invented signage. Use supplied scene-logo once for DEKRA if present.`],
    'LIGHTING / PHYSICAL INTEGRATION': ['Server-enforced run lighting profile.'],
    'CAMERA / OUTPUT': [v3Framing(m)],
    'FINAL PRIORITY CONSTRAINT': ['Server-enforced evidence priority.'],
  }),m,args.classContext);
}
/** Prepared only: no dispatcher/UI automatically invokes this or adds a paid pass. */
export function buildNb21V3HarmonizeOnlyPrompt(profile: V3LightingProfile): string {
  return `HARMONIZE_ONLY_DISABLED_BY_DEFAULT\nAdjust ONLY exposure, white balance, contrast and reflection intensity. Pixel-registered camera/framing; no geometry, perspective, equipment, intrinsic colour, texture or detail changes. Do not remove/add any part.\n${v3RelightingContract(profile)}`;
}
