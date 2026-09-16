/**
 * Land- & Baumaschinen-Bildpipeline.
 *
 * STRIKTE TRENNUNG ZU PKW / LKW / ZWEIRAD / REISEMOBIL / TRANSPORTER:
 * Eigenständige Job- und Prompt-Konfiguration. Überschreibt NICHTS aus
 * `pipeline-jobs.ts` oder den anderen Klassenmodulen. Wird die Fahrzeugklasse
 * 'machinery' gewählt, ersetzt diese Liste die Pkw-Jobliste vollständig.
 */

import type { PipelineJob } from './pipeline-jobs';

const LOGO_LINE = '{{LOGO_LINE}}';

/** Gilt für jede Maschinen-Außenaufnahme. */
const MACHINERY_SHOT_RULES = `MACHINERY_RULES: The subject is an agricultural or construction machine (tractor, excavator, wheel loader, telehandler, dumper, roller, harvester or comparable) exactly as shown in the reference. Machine type, attachment, boom and bucket pose, running gear (tracks or tyres), counterweight, cab position, hydraulics, hoses, steps, handrails, work lights and all decals stay exactly as referenced. Never add or remove attachments, never change tracks into wheels or wheels into tracks, never alter the working pose. Real used condition (scratches, paint chips, rust, weld seams, worn teeth and worn tracks/tyres) stays visible and truthful. No operators, workers, site scenery, soil heaps or crops that are not in the reference. Keep the camera far enough back with a corrected lens so the tall machine stays undistorted and the boom, roof and running gear are never cropped.`;

const MACHINERY_INTERIOR_RULES = `MACHINERY_CAB_RULES: The operator cab is empty and neutral — no operator, no hands, no jackets, no bottles, no tools, no paperwork. Control layout (joysticks, levers, steering wheel or steering levers, pedals, armrest consoles, keypads, monitor and gauges), seat type, upholstery, belt, floor mat and visible wear must match the reference exactly. Displays stay plausible and neutral; never invent menus, telematics screens, warning messages or operating-hour readings. Lens corrected so cab pillars and door edges stay vertical.`;

export const MACHINERY_PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'MACH_MASTER_IMAGE',
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 Hero View (working machine master image)
CAMERA_ANGLE: Slightly below cab window height, 30-40° off the front centre axis toward the machine's LEFT side.
FRAMING: Complete machine in frame — attachment, boom, cab, counterweight and the full running gear on the ground. Minimum 8% padding on all edges.
IDENTITY_PRIORITY: Attachment and boom in the referenced pose, running gear type, colour split, decals and cab glazing exactly as in the reference.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM, scaled so the machine has clear headroom above the cab and boom. ${LOGO_LINE}
LIGHTING: Clean industrial studio lighting with a soft overhead key light, fill light and realistic floor reflections matching the selected environment.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Exterieur ──
  {
    key: 'MACH_EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Head-On Front View (working machine)
CAMERA_ANGLE: Mid-machine height, exactly 0° centre axis, symmetrical.
FRAMING: Full front — attachment or bucket cutting edge, guard plates, front work lights, radiator/grille area, windscreen with wipers, mirrors, steps and the front of the running gear.
IDENTITY_PRIORITY: Attachment shape and wear, light positions, hose routing, decals and warning markings reproduced as one connected assembly.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Balanced lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Seitenansicht links',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect LEFT Side Profile (working machine)
CAMERA_ANGLE: Exactly perpendicular (90°) to the LEFT side, camera at half machine height, sufficient distance so there is no wide-angle bulge.
CRITICAL DIRECTION: LEFT is the machine's own left-hand side. The FRONT/attachment MUST point to the RIGHT edge of the image. Never mirror or flip a right-side view.
FRAMING: Full length including attachment and counterweight, complete undercarriage or both wheels, uncropped boom and roof, minimum 8% padding.
SIDE_IDENTITY_LOCK: Copy exactly the features of this side — access steps, handrails, service flaps, hydraulic hoses, track rollers or wheel hubs, decals on this side only.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting that shows the full machine length without hotspots.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Seitenansicht rechts',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (working machine)
CAMERA_ANGLE: Exactly perpendicular (90°) to the RIGHT side, camera at half machine height, no wide-angle distortion.
CRITICAL DIRECTION: RIGHT is the machine's own right-hand side. The FRONT/attachment MUST point to the LEFT edge of the image. This is a genuinely different view, NEVER a mirrored copy of the left profile.
FRAMING: Full length including attachment and counterweight, complete undercarriage or both wheels, uncropped boom and roof, minimum 8% padding.
SIDE_IDENTITY_LOCK: Copy exactly the features of this side — engine service doors, exhaust, filter housings, toolbox, filler caps, decals on this side only.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting without hotspots on large painted surfaces.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Rear View (working machine)
CAMERA_ANGLE: Half machine height, centred on the rear axis, symmetrical.
FRAMING: Complete rear — counterweight or three-point linkage, PTO, tow hitch, rear work lights, service doors, rear window, exhaust, warning markings and the rear of the running gear.
IDENTITY_PRIORITY: Counterweight contour, linkage or drawbar, light and marking positions, plate holders and decals exactly as referenced.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Even rear lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_EXT_REAR_34',
    label: 'Rear 3/4 View',
    labelDe: '3/4 Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Rear 3/4 View (working machine)
CAMERA_ANGLE: Half machine height, 30-40° off the rear centre axis toward the machine's RIGHT side. Independently rendered view, never a mirrored or flipped front shot.
FRAMING: Counterweight/rear and one complete side visible, boom and running gear in frame, minimum 8% padding.
IDENTITY_PRIORITY: Rear structure, service doors, exhaust, side features and decals as referenced.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Soft directional lighting emphasising machine volume and steel surfaces.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_EXT_FRONT_34_RIGHT',
    label: 'Front 3/4 Right',
    labelDe: '3/4 Front rechts',
    defaultSelected: false,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 View from the RIGHT side (working machine)
CAMERA_ANGLE: Slightly below cab window height, 30-40° off the front centre axis toward the machine's RIGHT side. Independently rendered, never a mirrored left 3/4 view.
FRAMING: Front/attachment and the complete right side, full boom and running gear, minimum 8% padding.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Studio lighting matching the master image.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_EXT_LOW_ANGLE',
    label: 'Low Angle Hero',
    labelDe: 'Untersicht (Hero)',
    defaultSelected: false,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Low Angle Power Shot (working machine)
CAMERA_ANGLE: Close to ground level, 25-35° off the front axis, looking slightly up at the machine to emphasise size and stance.
FRAMING: Complete machine with attachment and boom, running gear fully on the ground, no cropping of the cab roof or boom tip.
CRITICAL: Perspective may be dramatic, but proportions, pose and all identity details stay exactly as referenced.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Dramatic but clean lighting with strong, realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Kabine ──
  {
    key: 'MACH_INT_CABIN',
    label: 'Operator Cab',
    labelDe: 'Fahrerkabine',
    defaultSelected: true,
    category: 'interior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Operator Cab Overview (working machine)
CAMERA_ANGLE: From the cab door opening, slightly above seat height, looking towards the control station and the front glazing.
FRAMING: Seat, both armrest consoles, joysticks or steering wheel, pedals, floor, monitor and switch panels in one frame.
IDENTITY_PRIORITY: Exact control layout, seat type and upholstery, display frame, switch icons, glazing and cab wear.
${MACHINERY_INTERIOR_RULES}
ENVIRONMENT: Cab interior only; the view through the glazing stays bright and neutral. ${LOGO_LINE}
LIGHTING: Even, neutral interior lighting without blown highlights on the glazing.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_DET_CONTROLS',
    label: 'Controls & Display',
    labelDe: 'Bedienstand & Display',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Operator Controls and Display (working machine)
CAMERA_ANGLE: Close, slightly angled view of the control station.
FOCUS_ELEMENTS: Joystick or lever heads with their button layout, armrest console, keypad, monitor bezel and screen, gauges and warning symbols, pedals where visible.
CRITICAL: Reproduce button legends and symbols exactly as referenced. Never invent a menu, telematics UI or operating-hour reading.
${MACHINERY_INTERIOR_RULES}
LIGHTING: Soft, even lighting, screen legible and free of glare. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Details ──
  {
    key: 'MACH_DET_UNDERCARRIAGE',
    label: 'Running Gear',
    labelDe: 'Fahrwerk / Kette',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Running Gear (working machine)
CAMERA_ANGLE: Low, close to ground level, perpendicular to the running gear.
FOCUS_ELEMENTS: Tracked machines — complete track chain, track shoes with grouser pattern, sprocket, idler, rollers and track frame. Wheeled machines — tyre tread pattern, sidewall lettering, rim type, bolt pattern and hub.
CRITICAL: Reproduce wear exactly (worn grousers, polished steel, tread depth, chipped rims). Never replace tracks with wheels or wheels with tracks.
${MACHINERY_SHOT_RULES}
LIGHTING: Directional lighting that reveals steel texture and tread depth. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_DET_ATTACHMENT',
    label: 'Attachment',
    labelDe: 'Anbaugerät / Löffel',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Attachment / Working Tool (working machine)
CAMERA_ANGLE: Close 3/4 view of the attachment in its referenced position.
FOCUS_ELEMENTS: Bucket, fork, blade or implement with cutting edge, teeth or tines, wear plates, quick coupler, pins, hydraulic cylinder and hoses.
CRITICAL: Reproduce the exact attachment from the reference including wear, weld seams and repairs. Never exchange, add or idealise it.
${MACHINERY_SHOT_RULES}
LIGHTING: Soft, even lighting showing steel texture and wear honestly. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_DET_BOOM_HYDRAULICS',
    label: 'Boom & Hydraulics',
    labelDe: 'Ausleger & Hydraulik',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Boom, Arm and Hydraulics (working machine)
CAMERA_ANGLE: Medium-close side view along the boom or loader arm.
FOCUS_ELEMENTS: Boom and dipper geometry, cylinder rods and their extension, hose routing, quick couplers, greasing points, pins and bushings, weld seams and hydraulic staining.
CRITICAL: Boom position and cylinder extension stay exactly as referenced. Never straighten, lift or lower the arm.
${MACHINERY_SHOT_RULES}
LIGHTING: Directional lighting revealing steel and chrome cylinder rods without glare. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_DET_ENGINE_BAY',
    label: 'Engine Bay',
    labelDe: 'Motorraum / Servicebereich',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Engine and Service Area (working machine)
CAMERA_ANGLE: Straight onto the service side of the machine.
FOCUS_ELEMENTS: Service doors and their opening state, engine cover, air filter housing, exhaust and aftertreatment, radiator grille, battery box, filler caps, type or serial plate where visible.
CRITICAL: Doors and covers keep the open or closed state of the reference. Never open a closed hood and never invent an engine that is not visible.
${MACHINERY_SHOT_RULES}
LIGHTING: Even technical lighting with legible plates and labels. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_DET_WORK_LIGHTS',
    label: 'Lighting & Beacon',
    labelDe: 'Arbeitsscheinwerfer & Rundumleuchte',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Work Lights and Beacon (working machine)
CAMERA_ANGLE: Close, slightly angled view of the cab roof and light mounts.
FOCUS_ELEMENTS: Work light count, type (LED bar, round, square), mounting brackets, cabling, rotating beacon, aerials and mirror arms.
CRITICAL: Reproduce exactly the number, type and position of lights in the reference. Never add or remove a lamp or beacon and never switch lights on if they are off.
${MACHINERY_SHOT_RULES}
LIGHTING: Soft, even lighting without lens flare. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_DET_TYPE_PLATE',
    label: 'Type / Serial Plate',
    labelDe: 'Typenschild / Seriennummer',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Type, Serial or PIN Plate (working machine)
CAMERA_ANGLE: Close, nearly frontal view of the plate area on the chassis or cab frame.
FOCUS_ELEMENTS: Plate frame, rivets, embossed or laser-etched characters, surrounding paint and surface condition.
CRITICAL: Reproduce ONLY the characters visible in the reference, in the exact same wording, font and position. Never invent, complete or beautify a serial, PIN or chassis number, and never add a plate that is absent.
${MACHINERY_SHOT_RULES}
LIGHTING: Soft, glare-free lighting so the plate stays legible. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Grids / Composites ──
  {
    key: 'MACH_GRID_EXTERIOR',
    label: 'Exterior Grid',
    labelDe: 'Außen-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Exterior Grid (working machine)
LAYOUT: One single image, 2x2 grid with thin neutral separator lines: top-left front 3/4, top-right left side profile, bottom-left right side profile, bottom-right rear view.
FRAMING: Each tile shows the complete machine at equal scale, identical background and identical lighting across all four tiles.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM in every tile. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_GRID_DETAILS',
    label: 'Detail Grid',
    labelDe: 'Detail-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Detail Grid (working machine)
LAYOUT: One single image, 2x2 grid with thin neutral separator lines: top-left operator cab, top-right controls and display, bottom-left running gear, bottom-right attachment.
FRAMING: Equal scale and identical lighting in all tiles; every tile reproduces its detail exactly as referenced.
${MACHINERY_INTERIOR_RULES}
${MACHINERY_SHOT_RULES}
ENVIRONMENT: Neutral, consistent background in all tiles. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MACH_SOCIAL_COLLAGE',
    label: 'Social Collage',
    labelDe: 'Social-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Social Media Collage (working machine)
LAYOUT: One single square image: large front 3/4 hero on the left, three stacked smaller tiles on the right showing side profile, operator cab and attachment detail.
FRAMING: Consistent scale, background and lighting; generous padding so no boom, roof or running gear is cropped.
CRITICAL: No text, no captions, no logos other than the provided immutable assets.
${MACHINERY_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM in every tile. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
];

/** Jobliste der Maschinenklasse. */
export function getMachineryJobs(): PipelineJob[] {
  return MACHINERY_PIPELINE_JOBS;
}
