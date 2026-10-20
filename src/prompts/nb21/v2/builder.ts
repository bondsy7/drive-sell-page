import { renderNb21Prompt } from '../sections';
import type { RemasterConfig } from '@/lib/remaster-prompt';
import type { V2Manifest } from '../../../../supabase/functions/_shared/nb21-v2-contract';
import { SCENE_PROMPT_DEFAULTS } from '@/lib/remaster-prompt-defaults';
import { buildV2SubjectClassLock, type V2SubjectClass } from '../../../../supabase/functions/_shared/nb21-v2-class';

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
  if (k === 'GRID_INTERIOR_4') return ['COMPOSITE LAYOUT: Exactly four separate photographs in a 2 by 2 grid, never one wide cabin photograph. Top-left: full dashboard from the driver position using cabin_original. Top-right: attached centre console close-up using cabin_original. Bottom-left: rear seat view using rear_cabin_original. Bottom-right: steering wheel close-up using interior_detail_original when supplied, otherwise the visible wheel in cabin_original. Thin dividers; identical cabin materials and one exposure across all four cells. Front seats remain complete physical assemblies in every cell where they intersect the camera view; no seat deletion to reveal controls.'];
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

export function buildNb21V2Prompt(args: { manifest: V2Manifest; config: RemasterConfig; correction?: string; vehicleClass?: string; classContext?: V2SubjectClass | null }): string {
  const m = args.manifest, c = args.config;
  if (!m.entries.length || !m.entries.some(e => e.authorityTier === 'A')) throw new Error('NB21 v2: Originalautorität fehlt.');
  const key = m.jobKey.toUpperCase();
  const side = /RIGHT/.test(key) || key === 'CI_VOLVO_SIDE' ? 'RIGHT' : /LEFT|SIDE|34_FRONT|34_REAR|MASTER_IMAGE/.test(key) ? 'LEFT' : null;
  const local = m.mode === 'edit' ? ['Retain photographed geometry, equipment, intrinsic colours and material identity of the exact source slot; no synthesized viewpoint or replacement body. Exposure, white balance, shading and scene-dependent reflections follow the series lighting contract, not the original capture brightness.'] : v2LocalContract(key, m.target);
  const interior = m.target.startsWith('interior') || (m.target === 'composite' && /INTERIOR/.test(key));
  const paintIndex = m.entries.findIndex(e => e.role === 'paint_evidence');
  const mode = m.mode === 'edit'
    ? 'EDIT CONTRACT: retain the source camera, perspective, framing and photographed vehicle geometry, equipment and material identity. Do not rebuild the vehicle. Edit only explicitly allowed surfaces, environment and scene-dependent illumination; original exposure is not a pixel-preservation requirement.'
    : `VIEW SYNTHESIS CONTRACT: target ${m.jobKey}, semantic type ${m.target}. Construct the new camera view only from the assigned visual evidence; generated context cannot supply missing vehicle features.`;
  const ciPresentation: Record<string,string> = {
    VOLVO: 'Minimalist frosted glass showroom, dark reflective resin floor. Use the same neutral series lighting as non-CI views; CI never changes paint hue, exposure or white balance.',
    BMW: 'Clean white/grey studio; key light front-left, soft right fill; polished floor.',
    MERCEDES: 'Restrained premium showroom presentation with controlled soft highlights.',
    AUDI: 'Clean contemporary architectural showroom presentation and crisp controlled lighting.',
    VW: 'Bright straightforward dealership presentation with soft even light.',
    PORSCHE: 'Minimal editorial studio presentation with controlled directional highlights.',
  };
  const ci = key.match(/^CI_([A-Z]+)_/)?.[1];
  return renderNb21Prompt({
    'MAIN TASK': ['PROMPT_VERSION: nb21-v2', mode],
    'REFERENCE ROLES': m.entries.map((e, i) => `IMAGE ${i + 1}: ${e.role}; source=${e.sourceType}; slot=${e.sourceRole}; Tier ${e.authorityTier}; authority=${e.authority}.`),
    'ALLOWED CHANGES': [
      `Environment=${c.scene}; cleanup=${(c.cleanupItems ?? []).join(', ') || 'none'}; plate=${interior ? 'unchanged/not in view' : c.licensePlate}${c.customPlateText ? `; requested plate text=${JSON.stringify(c.customPlateText)}` : ''}.`,
      c.changeColor ? `Explicit paint change permitted: ${c.colorHex ?? 'requested colour'}. Preserve the photographed paint-scheme boundaries.` : 'Photographed paint colours and scheme unchanged.',
      args.correction ? `Requested correction, subject to original evidence: ${args.correction}` : 'No additional vehicle transformations.',
    ],
    'VEHICLE IDENTITY LOCK': [
      buildV2SubjectClassLock(args.classContext ?? { vehicleClass: args.vehicleClass }),
      'Use ONLY the reference image. Do NOT invent colors, badges, wheels, interior trim, stitching, or UI elements. Every visible attribute MUST match the reference exactly. Do NOT fall back on generic model knowledge.',
      ...local,
      ...(paintIndex >= 0 && !c.changeColor ? [`SERIES PAINT AUTHORITY: IMAGE ${paintIndex + 1} defines intrinsic paint hue and finish across this series. The rear original controls rear geometry, not a new paint colour. Ignore bright/dark capture shading; never turn warm metallic paint into cool grey/silver because of the showroom or a CI label.`] : []),
      ...(interior ? [
        'If the original console is flat/open and no selector protrudes, it stays entirely flat: no new lever, pin, bulge or control. Keep genuine photographed controls. Empty cabin, no persons/trash; do not cut pillars or roof in cabin views.',
        'SEAT GEOMETRY LOCK: Preserve every photographed seat as a separate complete physical assembly: cushion, backrest, headrest, bolsters, seams and attachment points. Keep the original seat count, orientation, proportions and occlusion. Never flatten, fold, stretch, merge, duplicate or remove a seat/backrest to expose the dashboard or brighten the cabin. A foreground backrest stays a backrest, never becomes a broad slab joined to the armrest or centre console. Never make doors, pillars, roof or seats transparent or cut them away for visibility. In edit mode, preserve exactly the original camera and framing; do not substitute a centred dashboard view for the photographed driver-seat view.',
        'FRONT SEAT PRESENCE: A dashboard or steering close-up supplies controls only, never evidence that a driver seat is absent. Keep driver and passenger cushions, backrests and headrests wherever physically in frame. If a seat obstructs the requested view, move the camera within the real cabin rather than erase, flatten or cut away the seat.',
      ] : []),
    ],
    'PERSPECTIVE LOCK': [m.mode === 'edit' ? 'Exactly the original camera and physical side.' : `Requested viewpoint=${m.jobKey.replace(/^CI_[A-Z]+_/, '').replace(/_/g, ' ')}; CI names describe presentation only, never equipment.`, side ? `Physical ${side} side; never mirror. ${/SIDE/.test(key) ? `Front points to IMAGE ${side}; rear to IMAGE ${side === 'LEFT' ? 'RIGHT' : 'LEFT'}.` : 'Three-quarter camera offset 30–40 degrees.'}` : 'No mirroring of vehicle or asymmetric parts.'],
    'ENVIRONMENT': [`Scene=${c.scene}. ${SCENE_PROMPT_DEFAULTS[c.scene] ?? 'Use the explicitly supplied environment reference.'} ${ci ? ciPresentation[ci] ?? '' : ''} Presentation context supplies environment only; logos and plate assets are authoritative only in their own domain. Environment never changes vehicle identity.`, c.scene === 'dealer-lot-dekra' ? 'Use supplied scene-logo pixels once on the hall; no invented or repeated signage.' : '', c.showManufacturerLogo || c.showDealerLogo ? 'Use supplied current logo assets only; never invent missing logos.' : 'Do not invent wall branding.'],
    'LIGHTING / PHYSICAL INTEGRATION': [
      c.scene === 'keep' || c.scene === 'none' ? 'Keep the photographed environment and physical light-source positions; exposure and white balance are normalized, not copied from each original.' : 'Lighting and environment reflections belong to the chosen scene; retain surface shape and materials. Plausible contact shadows and light direction.',
      'SERIES EXPOSURE LOCK: Use one consistent exposure, neutral white balance, light colour temperature and tonal response across every exterior, interior and detail image of this vehicle series. Different exposure, sunlight patches, camera auto-exposure or colour casts in original references are capture artefacts, not identity evidence: never reproduce their brightness differences. Match the chosen scene/presentation lighting across views; maintain fixed physical light-source positions while the camera changes, with natural viewpoint-dependent shadows and reflections. Balance cabin fill so seats and controls remain readable without blown highlights, crushed shadows or random warm/cool shifts. Preserve the actual paint, upholstery colours, material finishes, texture and geometry; exposure normalization never authorizes recolouring or changing equipment. Do not brighten by removing the roof, pillars or seats.',
      'SERIES LIGHTING BASELINE: Neutral 5500 K white balance, one fixed soft key and balanced fill, consistent midtone exposure and highlight roll-off for every view and every grid cell. CI brand presentation and coloured glass affect the background only; suppress their colour spill on vehicle paint and upholstery. Do not match the auto-exposure of individual source photos. Do not create a darker right-side series or a cooler rear series. Interior fill may reveal existing surfaces but never bleach upholstery or remove physical occluders.',
    ],
    'CAMERA / OUTPUT': [m.target.includes('detail') ? 'Photographic local close-up; part remains attached with enough surrounding context. Landscape 4:3.' : 'Professional landscape 4:3 image. Full subject only when the requested view is a full view; do not extrapolate a cropped reference in edit mode.'],
    'FINAL PRIORITY CONSTRAINT': ['Original Evidence > target-specific local detail evidence (immutable assets only in their domain) > explicitly allowed change > environment > light/aesthetics. If aesthetic or environment requirements conflict with vehicle fidelity, vehicle fidelity wins. Generated context is NEVER vehicle identity authority.'],
  });
}