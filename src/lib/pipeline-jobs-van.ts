/**
 * Transporter-Bildpipeline (Nutzfahrzeuge bis 3,5 t).
 *
 * STRIKTE TRENNUNG ZU PKW / LKW / ZWEIRAD / REISEMOBIL:
 * Eigenständige Job- und Prompt-Konfiguration. Überschreibt NICHTS aus
 * `pipeline-jobs.ts`, `pipeline-jobs-motorcycle.ts` oder
 * `pipeline-jobs-motorhome.ts`. Wird die Fahrzeugklasse 'van' gewählt,
 * ersetzt diese Liste die Pkw-Jobliste vollständig.
 */

import type { PipelineJob } from './pipeline-jobs';

const LOGO_LINE = '{{LOGO_LINE}}';

/** Gilt für jede Transporter-Außenaufnahme. */
const VAN_SHOT_RULES = `VAN_RULES: The subject is a light commercial vehicle (panel van, high-roof van, crew van, combi, double cab, dropside or box body up to 3.5 t) exactly as shown in the reference. Roof height, wheelbase, body length, door and window concept stay exactly as referenced. All doors, flaps and the bonnet keep the open/closed state of the reference. No people, no cargo, no tools, no pallets, no advertising that is not on the reference. Because of the tall, boxy body, keep the camera far enough back with a corrected lens so vertical body sides stay parallel and the roofline is never cropped.`;

const VAN_INTERIOR_RULES = `VAN_INTERIOR_RULES: Cab and load space are empty, clean and ready for handover — no people, no hands, no tools, no boxes, no packaging, no rubbish, no personal items. Dashboard layout, screen size and frame, switch panel, seat configuration, upholstery fabric and stitching, bulkhead type, floor and wall lining, lashing rails and any shelving must match the reference exactly. Never invent equipment, racking, screens content or logos. Lens corrected so vertical pillars and door edges stay vertical.`;

export const VAN_PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'VAN_MASTER_IMAGE',
    referenceNeeds: ['wheel'],
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 Hero View (light commercial van master image)
CAMERA_ANGLE: Slightly below the window line, 30-40° off the front centre axis toward the vehicle's LEFT side.
FRAMING: Complete vehicle in frame — front face, one full flank, full roofline, all wheels. Minimum 6% padding on all edges.
IDENTITY_PRIORITY: Roof height, body length, window and door concept, grille and light signature, rim type and any referenced livery exactly as in the reference.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM, scaled so the tall body has clear headroom above the roof. ${LOGO_LINE}
LIGHTING: Clean studio lighting with soft overhead key light, fill light and realistic polished floor reflections matching the selected showroom.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Exterieur ──
  {
    key: 'VAN_EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Head-On Front View (light commercial van)
CAMERA_ANGLE: Headlight height, exactly 0° centre axis, perfectly symmetrical.
FRAMING: Full front — bonnet, windscreen with wipers, both mirror arms, grille, headlights, fog lights, bumper, number plate recess, front skirt and full roof edge.
IDENTITY_PRIORITY: Grille slat pattern, badge position, complete light signature, sensor and camera placement reproduced as one connected assembly.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Balanced showroom lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Seitenansicht links',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect LEFT Side Profile (light commercial van)
CAMERA_ANGLE: Exactly perpendicular (90°) to the LEFT flank, camera at half body height, sufficient distance so the long body shows no wide-angle bulge.
CRITICAL DIRECTION: LEFT is the vehicle's own left-hand side (driver side in LHD markets). The FRONT of the vehicle MUST point to the RIGHT edge of the image. Never mirror or flip a right-side view.
FRAMING: Full length in frame with minimum 6% padding, both wheels completely visible and perfectly round, roofline and skirt uncropped.
SIDE_IDENTITY_LOCK: Copy exactly the features of this flank — sliding door or plain panel, window or blind panel, fuel filler, side protection strip, wheel arch trims, decals.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting that shows the full body length without hotspots on the large flat panels.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Seitenansicht rechts',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (light commercial van)
CAMERA_ANGLE: Exactly perpendicular (90°) to the RIGHT flank, camera at half body height, no wide-angle distortion.
CRITICAL DIRECTION: RIGHT is the vehicle's own right-hand side (kerb side in LHD markets). The FRONT of the vehicle MUST point to the LEFT edge of the image. This is the opposite viewing direction of the left profile and must be a genuinely different view, NEVER a mirrored copy.
FRAMING: Full length in frame with minimum 6% padding, both wheels completely visible and perfectly round, roofline and skirt uncropped.
SIDE_IDENTITY_LOCK: Copy exactly the features of this flank — sliding door with rail and handle, side window or blind panel, step, side protection strip, decals.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting that shows the full body length without hotspots on the large flat panels.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Rear View (light commercial van)
CAMERA_ANGLE: Half body height, perfectly centred on the rear axis, symmetrical.
FRAMING: Complete rear — barn doors or tailgate with their exact split line, handles, hinges, glazing or blind panels, third brake light, rear lights, bumper with step, number plate recess, sensors and roof edge.
IDENTITY_PRIORITY: Door concept, hinge and handle position, light unit shape and lens pattern and all badges exactly as referenced. Doors stay closed unless open in the reference.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Even rear lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_EXT_REAR_34',
    label: 'Rear 3/4 View',
    labelDe: '3/4 Heckansicht',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Rear 3/4 View (light commercial van)
CAMERA_ANGLE: Half body height, 30-40° off the rear centre axis toward the vehicle's RIGHT side. Independently rendered view, never a mirrored or flipped front shot.
FRAMING: Rear doors and one full flank visible, roofline and rear wheels in frame, minimum 6% padding.
IDENTITY_PRIORITY: Rear door split, light units, flank features and roof height as referenced.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Soft directional lighting emphasising the body length and load volume.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_EXT_FRONT_34_RIGHT',
    label: 'Front 3/4 Right',
    labelDe: '3/4 Front rechts',
    referenceNeeds: ['wheel'],
    defaultSelected: false,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 View from the RIGHT side (light commercial van)
CAMERA_ANGLE: Slightly below the window line, 30-40° off the front centre axis toward the vehicle's RIGHT side (kerb side with the sliding door). Independently rendered, never a mirrored left 3/4 view.
FRAMING: Front face and the complete right flank including the sliding door, full roofline, all wheels, minimum 6% padding.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Studio lighting matching the master image.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Interieur ──
  {
    key: 'VAN_INT_COCKPIT',
    label: 'Cab / Cockpit',
    labelDe: 'Fahrerkabine / Cockpit',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Cab / Driver Workplace (light commercial van)
CAMERA_ANGLE: From the rear of the cab looking forward, slightly above seat-back height.
FRAMING: Steering wheel, full dashboard, instrument cluster, infotainment screen, centre console with gear lever, both cab seats (single seat and/or double bench as referenced), door panels, windscreen and bulkhead edge.
FOCUS_ELEMENTS: Dashboard layout, screen size and frame, switch and vent positions, seat configuration, upholstery fabric and stitching, floor mat, handbrake type.
${VAN_INTERIOR_RULES}
LIGHTING: Neutral daylight through the windscreen, no blown-out windows, no glare on the screen.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_INT_CARGO',
    label: 'Cargo Area',
    labelDe: 'Laderaum',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Cargo Compartment Through the Open Rear Doors (light commercial van)
CAMERA_ANGLE: Standing centred behind the vehicle at chest height, looking straight into the load space.
FRAMING: Both rear doors in their referenced opening angle, load floor from the rear sill to the bulkhead, side walls, wheel arch covers, roof lining, lashing rails and interior light.
FOCUS_ELEMENTS: Floor and wall lining material, lashing eyes, shelving or racking, bulkhead type, load height and door lining, all exactly as referenced.
CRITICAL: The load space is completely EMPTY. Never add cargo, tools, pallets, straps or racking that is absent in the reference.
${VAN_INTERIOR_RULES}
LIGHTING: Bright, even light reaching to the bulkhead, no deep black corners.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_INT_SLIDING_DOOR',
    label: 'Side Loading Aperture',
    labelDe: 'Laderaum über Schiebetür',
    defaultSelected: false,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Load Space Through the Open Sliding Side Door (light commercial van)
CAMERA_ANGLE: Perpendicular to the flank at chest height, centred on the door aperture.
FRAMING: Sliding door in its referenced open position, full aperture with seal and rail, load floor edge, step, side wall lining and the visible part of the load space.
FOCUS_ELEMENTS: Door side, rail position, aperture width, lining material, step design.
CRITICAL: Never move the sliding door to the opposite flank and never invent a second sliding door. If the vehicle has no sliding door in the reference, show the closed flank panel instead.
${VAN_INTERIOR_RULES}
LIGHTING: Even daylight into the aperture.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Details ──
  {
    key: 'VAN_DET_REAR_DOORS',
    label: 'Rear Doors',
    labelDe: 'Hecktüren / Ladekante',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Rear Doors and Loading Edge (light commercial van)
CAMERA_ANGLE: Slightly crouched, frontal to the rear of the vehicle at bumper height.
FOCUS_ELEMENTS: Door split line or tailgate edge, hinges, handle and lock, seal, rear sill and step, loading height, bumper protection and rear light edges.
CRITICAL: Keep the doors in the open/closed state of the reference and reproduce the exact door concept (barn doors vs. tailgate, 50/50 vs. 60/40 split).
${VAN_SHOT_RULES}
LIGHTING: Soft directional showroom lighting with clear material detail. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_DET_SLIDING_DOOR',
    label: 'Sliding Door',
    labelDe: 'Schiebetür',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Sliding Side Door (light commercial van)
CAMERA_ANGLE: Perpendicular to the flank at handle height, centred on the door.
FOCUS_ELEMENTS: Door panel, window or blind panel, handle, lower and upper rails, rail cover in the flank, step, seal and the surrounding body panel.
CRITICAL: Reproduce the door on the exact flank of the reference, in its referenced open or closed state. Never invent a second door and never turn a blind panel into a window.
${VAN_SHOT_RULES}
LIGHTING: Soft directional showroom lighting. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_DET_WHEEL',
    label: 'Wheel',
    labelDe: 'Rad / Felge',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Wheel and Arch (light commercial van)
CAMERA_ANGLE: Low close-up at hub height, slightly angled so rim, tyre, wheel arch and skirt edge are visible.
FOCUS_ELEMENTS: Exact rim type (steel wheel with hub cap or alloy, exact spoke geometry), finish, tyre profile and sidewall lettering, single or twin rear wheels, wheel arch trim.
DEDICATED WHEEL REFERENCE (ABSOLUTE PRIORITY): If a dedicated wheel reference image is provided it is the ONLY authoritative source. Reproduce it 1:1 — never replace a steel wheel with an alloy.
CRITICAL: The wheel stays mounted on the vehicle with surrounding bodywork visible — no standalone wheel shot.
${VAN_SHOT_RULES}
LIGHTING: Directional low lighting emphasising rim geometry. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_DET_FRONT_LIGHT',
    label: 'Headlight',
    labelDe: 'Scheinwerfer',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Headlight and Front Corner (light commercial van)
CAMERA_ANGLE: Close three-quarter view at headlight height.
FOCUS_ELEMENTS: Complete lamp housing with its exact internal geometry, reflectors, projector units, LED daytime running signature, indicator segment, lens shape, surrounding bumper and grille edge, sensors.
CRITICAL: Reproduce the lamp internals exactly — never invent a modern LED signature for a halogen unit.
${VAN_SHOT_RULES}
LIGHTING: Soft directional light with clean reflections in the lens. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_DET_BADGE',
    label: 'Badge & Model Lettering',
    labelDe: 'Emblem & Modellschriftzug',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Manufacturer Badge and Model Lettering (light commercial van)
CAMERA_ANGLE: Close, nearly frontal view of the badge area on the grille or rear door.
FOCUS_ELEMENTS: Badge geometry, finish and mounting, model and variant lettering, load or drive designation, panel gap lines around it.
CRITICAL: Reproduce only the badges and lettering visible in the reference, in exact wording, font and position. Never invent trim names, engine badges or company signwriting.
${VAN_SHOT_RULES}
LIGHTING: Soft, even lighting with legible lettering and no glare. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Grids / Composites ──
  {
    key: 'VAN_GRID_EXTERIOR',
    label: 'Exterior Grid',
    labelDe: 'Außen-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Exterior Grid (light commercial van)
LAYOUT: One single image, 2x2 grid with thin neutral separator lines: top-left front 3/4, top-right left side profile, bottom-left right side profile, bottom-right rear view.
FRAMING: Each tile shows the complete vehicle at equal scale, identical showroom background and identical lighting across all four tiles.
${VAN_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM in every tile. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_GRID_INTERIOR',
    label: 'Interior Grid',
    labelDe: 'Innen-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Cab and Cargo Grid (light commercial van)
LAYOUT: One single image, 2x2 grid with thin neutral separator lines: top-left cab overview, top-right dashboard and screen, bottom-left cargo area through the rear doors, bottom-right side loading aperture.
FRAMING: Consistent chest-height perspective, equal brightness and colour temperature in all tiles.
${VAN_INTERIOR_RULES}
CRITICAL: Only show areas that exist in the reference photos. If an area is missing, replace that tile with a second view of an existing area — never fabricate a compartment.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'VAN_SOCIAL_COLLAGE',
    label: 'Social Collage',
    labelDe: 'Social-Media-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Social Media Collage (light commercial van)
LAYOUT: One single square image: a large hero tile with the front 3/4 exterior view on the left, and three stacked smaller tiles on the right showing the cab, the cargo area and the rear view.
FRAMING: Clean neutral gutters between tiles, consistent lighting and colour grading, no text, no captions, no watermarks, no graphic badges.
${VAN_SHOT_RULES}
${VAN_INTERIOR_RULES}
ENVIRONMENT: PROVIDED SHOWROOM for the exterior tiles. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
];

export const VAN_PIPELINE_JOB_KEYS = VAN_PIPELINE_JOBS.map((j) => j.key);

/** Aktuell keine Untertyp-Filterung – alle Transporter teilen dieselbe Jobliste. */
export function getVanJobs(): PipelineJob[] {
  return VAN_PIPELINE_JOBS;
}
