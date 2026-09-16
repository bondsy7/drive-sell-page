/**
 * Reisemobil-/Freizeitfahrzeug-Bildpipeline.
 *
 * STRIKTE TRENNUNG ZU PKW / LKW / ZWEIRAD:
 * Eigenständige Job- und Prompt-Konfiguration. Überschreibt NICHTS aus
 * `pipeline-jobs.ts` oder `pipeline-jobs-motorcycle.ts`. Wird die
 * Fahrzeugklasse 'motorhome' gewählt, ersetzt diese Liste die Pkw-Jobliste.
 *
 * Abgedeckte Aufbauten: Teilintegriert, Alkoven, Vollintegriert,
 * Kastenwagen (Campervan), Wohnwagen (Anhänger).
 */

import type { PipelineJob } from './pipeline-jobs';
import type { MotorhomeBodyTypeKey } from '@/config/vehicle-class-types';

const LOGO_LINE = '{{LOGO_LINE}}';

/** Gilt für jede Reisemobil-Aufnahme. */
const RV_SHOT_RULES = `RV_RULES: The subject is a recreational vehicle (motorhome, camper van or caravan exactly as shown in the reference). It stands level and stable on its wheels; jacks, steps, awnings and pop-top roofs stay exactly in the state of the reference. No people, no pets, no camping props. Because of the large body volume, keep the camera far enough back and the lens corrected so vertical body sides stay parallel and the roofline is never cropped.`;

const RV_INTERIOR_RULES = `RV_INTERIOR_RULES: The habitation interior is empty, clean and ready for handover — no people, no food, no dishes, no towels, no personal belongings, no clutter. Furniture positions, upholstery fabric and pattern, wood decor, worktops, locker fronts, handles, blinds and light fittings must match the reference exactly. Never invent equipment, appliances, screens, logos or decorative items. Lens corrected so vertical furniture edges stay vertical.`;

/** Jobs, die ein Fahrerhaus voraussetzen (entfallen beim Wohnwagen). */
export const MOTORHOME_CAB_ONLY_JOBS = ['WOMO_INT_COCKPIT'] as const;
/** Jobs, die es nur beim Wohnwagen gibt. */
export const MOTORHOME_CARAVAN_ONLY_JOBS = ['WOMO_DET_DRAWBAR'] as const;

export const MOTORHOME_PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'WOMO_MASTER_IMAGE',
    referenceNeeds: ['wheel'],
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 Hero View (recreational vehicle master image)
CAMERA_ANGLE: Slightly below body midline, 30-40° off the front centre axis toward the vehicle's LEFT side.
FRAMING: Complete vehicle in frame — front face, one full flank, roofline with all roof fittings, all wheels. Minimum 6% padding on all edges.
IDENTITY_PRIORITY: Body type (alcove / semi-integrated / fully integrated / van / caravan), decal graphics, window layout, habitation door side and roof equipment exactly as referenced.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM, scaled so the tall body has clear headroom above the roof. ${LOGO_LINE}
LIGHTING: Clean studio lighting with soft overhead key light, fill light and realistic polished floor reflections matching the selected showroom.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Exterieur ──
  {
    key: 'WOMO_EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Head-On Front View (recreational vehicle)
CAMERA_ANGLE: Half body height, exactly 0° centre axis, perfectly symmetrical.
FRAMING: Full front — windscreen or front mask, alcove if present, cab doors and mirrors, headlights, bumper, number plate holder, front skirt and roof edge. For a caravan: front wall, front windows, drawbar with coupling head, jockey wheel and gas locker.
IDENTITY_PRIORITY: Reproduce the exact front mask, light units, mirror shape, alcove window and decal graphics. Never invent a passenger-car grille.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Balanced showroom lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Seitenansicht links',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect LEFT Side Profile (recreational vehicle)
CAMERA_ANGLE: Exactly perpendicular (90°) to the LEFT flank, camera at half body height, sufficient distance so the long body shows no wide-angle bulge.
CRITICAL DIRECTION: LEFT is the vehicle's own left-hand side. The FRONT of the vehicle MUST point to the RIGHT edge of the image. Never mirror or flip a right-side view.
FRAMING: Full length in frame with minimum 6% padding, all wheels completely visible and perfectly round, roofline and skirt uncropped.
SIDE_IDENTITY_LOCK: Copy exactly the features of this flank — window count, size and position, service flaps, awning box, fuel filler, decals, wheel arch trims, skirt line.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting that shows the full body length without hotspots.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Seitenansicht rechts',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (recreational vehicle)
CAMERA_ANGLE: Exactly perpendicular (90°) to the RIGHT flank, camera at half body height, no wide-angle distortion.
CRITICAL DIRECTION: RIGHT is the vehicle's own right-hand side. The FRONT of the vehicle MUST point to the LEFT edge of the image. This is the opposite viewing direction of the left profile and must be a genuinely different view, NEVER a mirrored copy.
FRAMING: Full length in frame with minimum 6% padding, all wheels completely visible and perfectly round, roofline and skirt uncropped.
SIDE_IDENTITY_LOCK: Copy exactly the features of this flank — habitation door with step and window, gas locker, external sockets and water filler, awning box, decals.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting that shows the full body length without hotspots.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Rear View (recreational vehicle)
CAMERA_ANGLE: Half body height, perfectly centred on the rear axis, symmetrical.
FRAMING: Complete rear wall — rear lights, rear window, garage or storage hatch, ladder, spare wheel carrier, bumper, number plate holder, roof edge.
IDENTITY_PRIORITY: Light units, hatch position and size, badges and lettering exactly as referenced.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Even rear lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_EXT_REAR_34',
    label: 'Rear 3/4 View',
    labelDe: '3/4 Heckansicht',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Rear 3/4 View (recreational vehicle)
CAMERA_ANGLE: Half body height, 30-40° off the rear centre axis toward the vehicle's RIGHT side (habitation door side where referenced). This is an independently rendered view, never a mirrored or flipped front shot.
FRAMING: Rear wall and one full flank visible, roof fittings and rear wheels in frame, minimum 6% padding.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Soft directional lighting emphasising the body length.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_EXT_HIGH_ANGLE',
    label: 'Elevated View',
    labelDe: 'Erhöhte Ansicht',
    defaultSelected: false,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Slightly Elevated 3/4 View (recreational vehicle)
CAMERA_ANGLE: Roughly 25-35° above roof height, 35° off the front centre axis, showing the roof surface and its equipment.
FRAMING: Whole vehicle including roof: air conditioner, skylights/heki, solar panels, antenna or satellite dome, roof rails and ladder.
IDENTITY_PRIORITY: Reproduce roof equipment exactly in number, type and position. Never add or remove a roof unit.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Soft overhead lighting without blown-out highlights on the white roof.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Interieur ──
  {
    key: 'WOMO_INT_LIVING',
    label: 'Living Area',
    labelDe: 'Wohnbereich / Sitzgruppe',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Living and Seating Area (recreational vehicle)
CAMERA_ANGLE: Wide interior view at chest height from the entrance or rear of the habitation area.
FRAMING: Complete seating group with table, side windows with blinds, overhead lockers, floor covering and ceiling panel for spatial context.
FOCUS_ELEMENTS: Seating geometry (L-shape, face-to-face dinette or side sofa), upholstery fabric, pattern and stitching, table top and mount, wood decor, locker fronts and handles, light fittings.
${RV_INTERIOR_RULES}
LIGHTING: Warm, even habitation lighting with bright, neutral daylight through the windows.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_INT_KITCHEN',
    label: 'Kitchen',
    labelDe: 'Küchenzeile',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Kitchen Block (recreational vehicle)
CAMERA_ANGLE: Frontal to slightly angled view of the kitchen unit at chest height.
FRAMING: Worktop, hob, sink and tap, splash-back, fridge front, drawers and overhead lockers.
FOCUS_ELEMENTS: Exact hob type and burner count, sink shape and tap, worktop material and edge, handle design, appliance fronts and control knobs.
${RV_INTERIOR_RULES}
LIGHTING: Warm under-locker lighting plus neutral daylight; no glare on the worktop.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_INT_BATH',
    label: 'Bathroom',
    labelDe: 'Bad / Nasszelle',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Bathroom / Washroom (recreational vehicle)
CAMERA_ANGLE: From the doorway at chest height, capturing the compact washroom without fisheye distortion.
FRAMING: Toilet, basin, mirror, cabinet, shower area, wall panelling, floor.
FOCUS_ELEMENTS: Toilet type and position, basin and tap, mirror and cabinet fronts, shower head and rail, panel colour and texture.
${RV_INTERIOR_RULES} The washroom is spotless and dry — no towels, no toiletries, no water drops.
LIGHTING: Clean, bright, shadow-free lighting.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_INT_BED',
    label: 'Sleeping Area',
    labelDe: 'Schlafbereich',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Sleeping Area (recreational vehicle)
CAMERA_ANGLE: From the foot end or doorway at chest height.
FRAMING: Complete bed as referenced (fixed bed, twin beds, drop-down bed, alcove bed or converted dinette) with mattress, headboard area, reading lights, windows and overhead lockers.
FOCUS_ELEMENTS: Bed type and proportions, mattress and cover material, upholstery, locker fronts, lighting.
${RV_INTERIOR_RULES} The bed is neatly made with the referenced cover only.
LIGHTING: Warm, calm lighting with soft daylight through the window.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_INT_COCKPIT',
    label: 'Cab / Cockpit',
    labelDe: 'Fahrerhaus / Sitzgruppe vorn',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Cab / Cockpit (motorhome or camper van)
CAMERA_ANGLE: From the habitation area looking forward into the cab, slightly above seat-back height.
FRAMING: Steering wheel, dashboard, both cab seats in their referenced rotation, windscreen, cab door panels and the transition to the habitation area.
FOCUS_ELEMENTS: Dashboard layout, display and control panel content, switch positions, seat upholstery and swivel state, cab blinds.
${RV_INTERIOR_RULES} No people, no hands, no clutter on the dashboard.
LIGHTING: Neutral daylight through the windscreen, no blown-out windows.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Details ──
  {
    key: 'WOMO_DET_DOOR',
    label: 'Habitation Door',
    labelDe: 'Aufbautür / Einstieg',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Habitation Door and Entrance (recreational vehicle)
CAMERA_ANGLE: Slightly angled frontal view of the habitation door at door-handle height.
FOCUS_ELEMENTS: Door shape and frame, window with blind, handle and lock, step (fixed or electric, in its referenced state), grab handle, door surround decals.
CRITICAL: Keep the door in the open/closed state of the reference and never move it to the opposite flank.
${RV_SHOT_RULES}
LIGHTING: Soft directional showroom lighting. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_DET_AWNING',
    label: 'Awning',
    labelDe: 'Markise',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Awning and Upper Side Panel (recreational vehicle)
CAMERA_ANGLE: Slightly upward view along the flank onto the awning case.
FOCUS_ELEMENTS: Awning case shape, colour, brand lettering, mounting brackets, crank or motor fitting, and the roof edge above it.
CRITICAL: If the awning is closed in the reference, keep it closed. If no awning exists, do NOT invent one — show the plain upper side panel instead.
${RV_SHOT_RULES}
LIGHTING: Soft showroom lighting. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_DET_GARAGE',
    label: 'Rear Garage',
    labelDe: 'Heckgarage / Stauraum',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Rear Garage / Storage Compartment (recreational vehicle)
CAMERA_ANGLE: Slightly crouched, frontal to the garage or storage hatch.
FOCUS_ELEMENTS: Hatch shape and size, seal, lock, interior lining, lashing rails and eyes, floor covering, loading height.
CRITICAL: The compartment is EMPTY. Never invent bikes, boxes or equipment. Keep the hatch open only if it is open in the reference.
${RV_SHOT_RULES}
LIGHTING: Bright, even lighting into the compartment. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_DET_ROOF',
    label: 'Roof Equipment',
    labelDe: 'Dachaufbauten / Aufstelldach',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Roof Equipment (recreational vehicle)
CAMERA_ANGLE: Elevated view at roughly 45° onto the roof surface.
FOCUS_ELEMENTS: Air conditioner, skylights/heki, solar panels, antenna or satellite dome, roof rails, ladder top, pop-top roof in its referenced state.
CRITICAL: Reproduce number, type and position of all roof units exactly. Never add or remove equipment and never raise a closed pop-top.
${RV_SHOT_RULES}
LIGHTING: Soft overhead light, no blown-out white roof.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_DET_WHEEL',
    label: 'Wheel',
    labelDe: 'Rad / Felge',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Wheel and Arch (recreational vehicle)
CAMERA_ANGLE: Low, close-up at hub height, slightly angled so rim, tyre, wheel arch trim and skirt edge are visible.
FOCUS_ELEMENTS: Exact rim type (steel with trim or alloy, exact spoke geometry), finish and colour, hub cap, tyre profile and sidewall lettering, wheel arch trim.
DEDICATED WHEEL REFERENCE (ABSOLUTE PRIORITY): If a dedicated wheel reference image is provided it is the ONLY authoritative source. Reproduce it 1:1.
CRITICAL: The wheel stays mounted on the vehicle with surrounding bodywork visible — no standalone wheel shot.
${RV_SHOT_RULES}
LIGHTING: Directional low lighting emphasising rim geometry. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_DET_SERVICE',
    label: 'Service Connections',
    labelDe: 'Außenanschlüsse / Serviceklappen',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - External Service Area (recreational vehicle)
CAMERA_ANGLE: Frontal close-up of the service flaps at hip height.
FOCUS_ELEMENTS: Mains socket, fresh water filler, waste outlet, gas locker door, toilet cassette hatch, exterior light and any external shower connection.
CRITICAL: Reproduce only the flaps and connections that exist in the reference, in their exact position and order. Keep all flaps closed unless open in the reference.
${RV_SHOT_RULES}
LIGHTING: Even lighting with readable labels. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_DET_DRAWBAR',
    label: 'Drawbar & Steadies',
    labelDe: 'Deichsel & Stützen',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Drawbar, Coupling and Corner Steadies (caravan)
CAMERA_ANGLE: Low frontal three-quarter view onto the A-frame.
FOCUS_ELEMENTS: A-frame geometry, stabiliser coupling head, handbrake lever, breakaway cable, jockey wheel, gas locker lid, front stone guard and the corner steadies at the front.
CRITICAL: This shot exists only for towed caravans. Never add a tow car, a tow bar of another vehicle or a cab.
${RV_SHOT_RULES}
LIGHTING: Even lighting with clear metal detail. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Grids / Composites ──
  {
    key: 'WOMO_GRID_EXTERIOR',
    label: 'Exterior Grid',
    labelDe: 'Außen-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Exterior Grid (recreational vehicle)
LAYOUT: One single image, 2x2 grid with thin neutral separator lines: top-left front 3/4, top-right left side profile, bottom-left right side profile, bottom-right rear view.
FRAMING: Each tile shows the complete vehicle with equal scale, identical showroom background and identical lighting across all four tiles.
${RV_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM in every tile. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_GRID_INTERIOR',
    label: 'Interior Grid',
    labelDe: 'Innen-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Interior Grid (recreational vehicle)
LAYOUT: One single image, 2x2 grid with thin neutral separator lines: top-left living area, top-right kitchen, bottom-left bathroom, bottom-right sleeping area.
FRAMING: Consistent chest-height perspective, equal brightness and colour temperature in all tiles.
${RV_INTERIOR_RULES}
CRITICAL: Only show rooms that exist in the reference photos. If a room is missing, replace that tile with a second view of an existing room — never fabricate a room.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'WOMO_SOCIAL_COLLAGE',
    label: 'Social Collage',
    labelDe: 'Social-Media-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Social Media Collage (recreational vehicle)
LAYOUT: One single square image: a large hero tile with the front 3/4 exterior view on the left, and three stacked smaller tiles on the right showing living area, kitchen and sleeping area.
FRAMING: Clean neutral gutters between tiles, consistent lighting and colour grading, no text, no captions, no watermarks, no graphic badges.
${RV_SHOT_RULES}
${RV_INTERIOR_RULES}
ENVIRONMENT: PROVIDED SHOWROOM for the exterior tile. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
];

export const MOTORHOME_PIPELINE_JOB_KEYS = MOTORHOME_PIPELINE_JOBS.map((j) => j.key);

/**
 * Aufbautyp-abhängige Jobliste.
 * Wohnwagen: kein Fahrerhaus-Job, dafür Deichsel-Detail.
 * Motorisierte Aufbauten: kein Deichsel-Detail.
 */
export function getMotorhomeJobsForBodyType(
  bodyType?: MotorhomeBodyTypeKey | null,
): PipelineJob[] {
  const isCaravan = bodyType === 'caravan';
  return MOTORHOME_PIPELINE_JOBS.filter((job) => {
    if ((MOTORHOME_CAB_ONLY_JOBS as readonly string[]).includes(job.key)) return !isCaravan;
    if ((MOTORHOME_CARAVAN_ONLY_JOBS as readonly string[]).includes(job.key)) return isCaravan;
    return true;
  });
}
