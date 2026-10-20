import { renderNb21Prompt } from '../sections';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import type { V2Manifest } from '../../../../supabase/functions/_shared/nb21-v2-contract';
import { SCENE_PROMPT_DEFAULTS } from '@/lib/remaster-prompt-defaults';

export const NB21_V2_VERSION = 'nb21-v2' as const;
export const NB21_CURRENT_VERSION = NB21_V2_VERSION;
export function resolveNb21Version(ctx?: { promptVersion?: string; modelTier?: string } | null): 'nb21-v1' | 'nb21-v2' | undefined {
  if (ctx?.promptVersion) {
    if (ctx.promptVersion !== 'nb21-v1' && ctx.promptVersion !== 'nb21-v2') throw new Error('NB21: Unbekannte gespeicherte Promptversion.');
    if (ctx.modelTier && ctx.modelTier !== 'nb21') throw new Error('NB21: Version und Modellstufe widersprechen sich.');
    return ctx.promptVersion;
  }
  // Historical test runs with no version remain V1, NEVER upgrade implicitly.
  return ctx?.modelTier === 'nb21' ? 'nb21-v1' : undefined;
}

/** Critical contracts are handwritten and independent of legacy 2.0 text. */
export function v2LocalContract(key: string, target: V2Manifest['target']): string[] {
  const k = key.toUpperCase();
  if (target === 'cargo_area') return ['Cargo original determines the photographed cover position, floor level, carpet, backrest divisions, hooks and side lining. Rear evidence determines hatch, lamps and body around the opening. Do not invent flaps, covers or seat splits.'];
  if (/STEERING/.test(k)) return ['Copy the exact rim, spokes, hub, button islands and BOTH stalk silhouettes from interior originals. Preserve photographed selector markings and position.'];
  if (/CLUSTER/.test(k)) return ['Copy the instrument housing, screen outline, arrangement, visible glyphs and relationship to the steering wheel from the assigned cockpit originals.'];
  if (/SCREEN|MBUX/.test(k)) return ['Copy the central display outline, mount, photographed screen content, surrounding vents and controls. Brand presentation never supplies a replacement interface.'];
  if (/REAR_SEAT|INT_REAR/.test(k)) return ['Copy rear seat orientation, divisions, upholstery and door panels from rear-cabin original. Preserve the original front-seat presence and console silhouette; do not remove a seat.'];
  if (/DASHBOARD|INT_CENTER|INTERIOR|COCKPIT/.test(k)) return ['Copy the connected dashboard, vents, displays, steering wheel, controls and console architecture from cockpit originals.'];
  if (/HEADLIGHT/.test(k)) return ['Compare 7 photographed features: outline, LED signature, reflectors, bezel, height, outer edge and inner edge. Keep the lamp attached to its original adjacent bodywork.'];
  if (/TAILLIGHT/.test(k)) return ['Copy lamp outline, internal segments, LED signature, housing material, panel seams and attached rear bodywork from rear originals.'];
  if (target === 'wheel_detail') return ['Copy spoke count and shape, split pattern, finish, concavity, centre cap, bolt layout and tyre proportions from the dedicated wheel asset if present, otherwise wheel-visible original. Keep it mounted.'];
  if (/GRILLE|PANEL/.test(k)) return ['Copy the actual grille OR closed front panel: connected outline, texture, badge, sensors and seams. Never turn a closed panel into a remembered radiator grille.'];
  if (/ELEVATED_FRONT/.test(k)) return ['Raise the camera to a modest elevated front viewpoint. Copy the entire connected front panel, both headlamp signatures, hood edge, bumper and body proportions from front originals; changing camera height never changes generation.'];
  if (/(?:^|_)FRONT$/.test(k)) return ['Head-on centred front view. Copy connected panel/grille, headlamps, hood, bumper and badge from front originals as one assembly.'];
  if (target.startsWith('interior')) return ['Copy only photographed cabin surfaces, equipment and architectural relationships from interior originals.'];
  return ['Reconstruct the requested camera view from assigned originals only; maintain photographed body proportions, paint scheme, badges, windows, mirrors and asymmetric attached equipment.'];
}

export function buildNb21V2Prompt(args: { manifest: V2Manifest; config: RemasterConfig; correction?: string; vehicleClass?: string }): string {
  const m = args.manifest, c = args.config;
  if (!m.entries.length || !m.entries.some(e => e.authorityTier === 'A')) throw new Error('NB21 v2: Originalautorität fehlt.');
  const key = m.jobKey.toUpperCase();
  const side = /RIGHT/.test(key) ? 'RIGHT' : /LEFT|SIDE/.test(key) ? 'LEFT' : null;
  const local = m.mode === 'edit' ? ['Retain all photographed visible attributes of the exact source slot; no synthesized viewpoint or replacement body.'] : v2LocalContract(key, m.target);
  const interior = m.target.startsWith('interior') || (m.target === 'composite' && /INTERIOR/.test(key));
  const mode = m.mode === 'edit'
    ? 'EDIT CONTRACT: retain the source camera, perspective, framing and photographed vehicle pixels/geometry. Do not rebuild the vehicle. Edit only explicitly allowed surfaces and environment.'
    : `VIEW SYNTHESIS CONTRACT: target ${m.jobKey}, semantic type ${m.target}. Construct the new camera view only from the assigned visual evidence; generated context cannot supply missing vehicle features.`;
  return renderNb21Prompt({
    'MAIN TASK': ['PROMPT_VERSION: nb21-v2', mode],
    'REFERENCE ROLES': m.entries.map((e, i) => `IMAGE ${i + 1}: ${e.role}; source=${e.sourceType}; slot=${e.sourceRole}; Tier ${e.authorityTier}; authority=${e.authority}.`),
    'ALLOWED CHANGES': [
      `Environment=${c.scene}; cleanup=${(c.cleanupItems ?? []).join(', ') || 'none'}; plate=${interior ? 'unchanged/not in view' : c.licensePlate}${c.customPlateText ? `; requested plate text=${JSON.stringify(c.customPlateText)}` : ''}.`,
      c.changeColor ? `Explicit paint change permitted: ${c.colorHex ?? 'requested colour'}. Preserve the photographed paint-scheme boundaries.` : 'Photographed paint colours and scheme unchanged.',
      args.correction ? `Requested correction, subject to original evidence: ${args.correction}` : 'No additional vehicle transformations.',
    ],
    'VEHICLE IDENTITY LOCK': [
      'Use ONLY the reference image. Do NOT invent colors, badges, wheels, interior trim, stitching, or UI elements. Every visible attribute MUST match the reference exactly. Do NOT fall back on generic model knowledge.',
      ...local,
      ...(interior ? ['If the original console is flat/open and no selector protrudes, it stays entirely flat: no new lever, pin, bulge or control. Keep genuine photographed controls. Empty cabin, no persons/trash; do not cut pillars or roof in cabin views.'] : []),
      `Vehicle class scope=${args.vehicleClass ?? 'car'}; preserve only the photographed subject and its attached equipment. No rules imported from another class.`,
    ],
    'PERSPECTIVE LOCK': [m.mode === 'edit' ? 'Exactly the original camera and physical side.' : `Requested viewpoint=${m.jobKey.replace(/^CI_[A-Z]+_/, '').replace(/_/g, ' ')}; CI names describe presentation only, never equipment.`, side ? `Physical ${side} side; never mirror. ${/SIDE/.test(key) ? `Front points to IMAGE ${side}; rear to IMAGE ${side === 'LEFT' ? 'RIGHT' : 'LEFT'}.` : 'Three-quarter camera offset 30–40 degrees.'}` : 'No mirroring of vehicle or asymmetric parts.'],
    'ENVIRONMENT': [`Scene=${c.scene}. ${SCENE_PROMPT_DEFAULTS[c.scene] ?? 'Use the explicitly supplied environment reference.'} Presentation context supplies environment only; logos and plate assets are authoritative only in their own domain. Environment never changes vehicle identity.`, c.showManufacturerLogo || c.showDealerLogo ? 'Use supplied current logo assets only; never invent missing logos.' : 'Do not invent wall branding.'],
    'LIGHTING / PHYSICAL INTEGRATION': [c.scene === 'keep' || c.scene === 'none' ? 'Preserve photographed light/environment; improve clarity only.' : 'Lighting and environment reflections belong to the chosen scene; retain surface shape and materials. Plausible contact shadows and light direction.'],
    'CAMERA / OUTPUT': [m.target.includes('detail') ? 'Photographic local close-up; part remains attached with enough surrounding context. Landscape 4:3.' : 'Professional landscape 4:3 image. Full subject only when the requested view is a full view; do not extrapolate a cropped reference in edit mode.'],
    'FINAL PRIORITY CONSTRAINT': ['Original Evidence > target-specific local detail evidence (immutable assets only in their domain) > explicitly allowed change > environment > light/aesthetics. If aesthetic or environment requirements conflict with vehicle fidelity, vehicle fidelity wins. Generated context is NEVER vehicle identity authority.'],
  });
}