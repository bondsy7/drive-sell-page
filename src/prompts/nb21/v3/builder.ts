import { renderNb21Prompt } from '../sections';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import { SCENE_PROMPT_DEFAULTS } from '@/lib/remaster-prompt-defaults';
import { type V3Manifest } from '../../../../supabase/functions/_shared/nb21-v3-contract';
import { enforceV3ServerPrompt } from '../../../../supabase/functions/_shared/nb21-v3-prompt';
import { v3RelightingContract, type V3LightingProfile } from '../../../../supabase/functions/_shared/nb21-v3-lighting';
import type { V2SubjectClass } from '../../../../supabase/functions/_shared/nb21-v2-class';
export const NB21_V3_VERSION = 'nb21-v3' as const;
/** V2 current/default stays untouched; V3 is opt-in. */
export function buildNb21V3Prompt(args: { manifest: V3Manifest; config: RemasterConfig; correction?: string; classContext?: V2SubjectClass | null }): string {
  const {manifest:m,config:c} = args;
  const interior = m.target.startsWith('interior') || (m.target === 'composite' && /INTERIOR/.test(m.jobKey));
  const task = m.jobKey === 'GRID_INTERIOR_4' ? 'Exactly four separate photographs, 2×2 grid. Top-left full driver dashboard WITH physical front seats using cabin_original; top-right connected console using cabin_original; bottom-left rear seats using rear_cabin_original; bottom-right steering detail using interior_detail_original. Never erase seats to reveal controls.' : m.jobKey === 'GRID_EXTERIOR_4' ? 'Exactly four separate photographs in a 2×2 grid. Top-left: 3/4 front LEFT, front_original + left_original. Top-right: physical LEFT side profile, left_original. Bottom-left: 3/4 rear LEFT, rear_original + left_original. Bottom-right: head-on rear, rear_original. NO right-side cell; no mirroring or unsupported visible surface. Same run lighting in every cell.' : `Target ${m.jobKey}; semantic type ${m.target}. ${m.mode === 'edit' ? 'Retain original camera, geometry and framing; no view synthesis.' : 'Evidence-driven requested view synthesis.'}`;
  return enforceV3ServerPrompt(renderNb21Prompt({
    'MAIN TASK': ['PROMPT_VERSION: nb21-v3',task],
    'REFERENCE ROLES': ['Server-enforced evidence roles.'],
    'ALLOWED CHANGES': [`Environment=${c.scene}; cleanup=${(c.cleanupItems ?? []).join(', ') || 'none'}; plate=${interior ? 'unchanged/not visible' : c.licensePlate}${c.customPlateText ? `; plate text=${JSON.stringify(c.customPlateText)}` : ''}.`, c.changeColor ? `Explicit paint change=${c.colorHex ?? 'requested colour'}; preserve scheme boundaries.` : 'Intrinsic photographed paint colour/finish unchanged.', args.correction ? `Manual correction=${args.correction}; subject to validated evidence and view contract.` : 'No additional changes.', m.retryReason ? `MANUAL_RETRY_REASON=${m.retryReason}; correct only within the evidence contract.` : 'No image QA or second pass requested.'],
    'VEHICLE IDENTITY LOCK': ['Server-enforced original identity.'], 'PERSPECTIVE LOCK': ['Server-enforced view contract.'],
    'ENVIRONMENT': [`${SCENE_PROMPT_DEFAULTS[c.scene] ?? 'Use supplied environment only.'} CI styling affects environment, never vehicle colour or lighting profile. Supplied current logo/plate/wheel assets are authoritative only in their named domain. No invented signage. Use supplied scene-logo once for DEKRA if present.`],
    'LIGHTING / PHYSICAL INTEGRATION': ['Server-enforced run lighting profile.'],
    'CAMERA / OUTPUT': ['Professional landscape 4:3 photograph; full subject for full views, attached context for details. No crop-driven completion of unsupported geometry.'],
    'FINAL PRIORITY CONSTRAINT': ['Server-enforced evidence priority.'],
  }),m,args.classContext);
}
/** Prepared only: no dispatcher/UI automatically invokes this or adds a paid pass. */
export function buildNb21V3HarmonizeOnlyPrompt(profile: V3LightingProfile): string {
  return `HARMONIZE_ONLY_DISABLED_BY_DEFAULT\nAdjust ONLY exposure, white balance, contrast and reflection intensity. Pixel-registered camera/framing; no geometry, perspective, equipment, intrinsic colour, texture or detail changes. Do not remove/add any part.\n${v3RelightingContract(profile)}`;
}
