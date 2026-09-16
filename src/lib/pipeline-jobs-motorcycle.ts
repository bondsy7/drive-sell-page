/**
 * Zweirad-Bildgenerierungs-Pipeline (Motorrad als primärer Anwendungsfall).
 *
 * STRIKTE TRENNUNG ZUR PKW-PIPELINE:
 * Diese Datei ist eine eigenständige Job-/Prompt-Konfiguration. Sie überschreibt
 * NICHTS aus `pipeline-jobs.ts` (Pkw/Lkw). Wird die Fahrzeugklasse 'motorcycle'
 * gewählt, ersetzt diese Liste die Pkw-Jobliste vollständig.
 *
 * Keine Pkw-Motive: kein Kühlergrill, keine Kabinen-Übersicht, keine
 * Rücksitzbank, kein Armaturenbrett, keine Türen/Motorhaube/Kofferraum.
 *
 * Abgedeckte Fahrzeugarten: Motorrad (primär), E-Motorrad, Roller/Scooter,
 * Moped, E-Bike/Pedelec.
 */

import type { PipelineJob } from './pipeline-jobs';

const LOGO_LINE = '{{LOGO_LINE}}';

/** Gilt für jede Zweirad-Aufnahme: Standfestigkeit und Typtreue. */
const TWO_WHEELER_SHOT_RULES = `TWO_WHEELER_RULES: The subject is a two-wheeled vehicle (motorcycle, e-motorcycle, scooter/moped or e-bike as shown in the reference). It must stand stable and physically plausible on its side stand or center stand exactly as in the reference — never floating, never leaning unsupported. No rider, no helmet, no hands. Only render parts that exist on the referenced type (no fuel tank, exhaust or combustion engine on electric two-wheelers or e-bikes; no pedals on a motorcycle).`;

export const MOTORCYCLE_PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'MOTO_MASTER_IMAGE',
    referenceNeeds: ['wheel'],
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 Hero View (two-wheeler master image)
CAMERA_ANGLE: Slightly above wheel-hub height, 30-40° off the front center axis toward the vehicle's LEFT side, looking at the front-left quarter.
FRAMING: Complete two-wheeler visible with no cropping — front wheel, fork, headlight, tank/front panel, engine or motor unit, saddle and tail. Minimum 5% padding on all edges.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Clean studio lighting with soft overhead key light, fill light and realistic polished floor reflections matching the selected showroom.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Exterieur ──
  {
    key: 'MOTO_EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Head-On Front View (two-wheeler)
CAMERA_ANGLE: Headlight height, exactly 0° center axis. Perfectly symmetrical.
FRAMING: Headlight unit, front fork legs, front fender/mudguard, front wheel and tyre, handlebar ends with mirrors and, if present, windscreen and front indicators. Full width of the handlebar in frame.
IDENTITY_PRIORITY: Reproduce the exact headlight housing and light signature, fork type and finish, front fender shape, brake discs/calipers and front rim design from the reference. There is NO radiator grille and NO car front — do not invent one.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Balanced showroom lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Seitenansicht links',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect LEFT Side Profile (two-wheeler)
CAMERA_ANGLE: Exactly perpendicular (90°) to the vehicle's LEFT flank, camera at wheel-hub height.
CRITICAL DIRECTION: LEFT is the rider's left-hand side (side stand and, on most motorcycles, the gear lever and the chain/sprocket run). The FRONT wheel MUST point to the RIGHT edge of the image, the REAR wheel to the LEFT edge. Do NOT mirror or flip a right-side view.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette from front wheel to tail in frame, minimum 5% padding.
SIDE_IDENTITY_LOCK: Copy the components belonging to this flank exactly — side stand, gear lever, engine/motor cover shape, frame tubes, swingarm, chain or belt run, exhaust routing if it runs on this side, tank/panel graphics.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting that highlights the frame and body lines.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Seitenansicht rechts',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (two-wheeler)
CAMERA_ANGLE: Exactly perpendicular (90°) to the vehicle's RIGHT flank, camera at wheel-hub height.
CRITICAL DIRECTION: RIGHT is the rider's right-hand side (rear brake pedal and, on most motorcycles, the silencer outlet). The FRONT wheel MUST point to the LEFT edge of the image, the REAR wheel to the RIGHT edge. This is the OPPOSITE viewing direction of the left side profile — but it must be a genuinely different view, NEVER a mirrored copy of the left side image.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette from front wheel to tail in frame, minimum 5% padding.
SIDE_IDENTITY_LOCK: Copy the components belonging to this flank exactly — brake pedal, silencer/exhaust outlet, brake disc and caliper, engine or motor cover shape, frame and swingarm on this side.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Clean studio lighting emphasizing the silhouette.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Rear View (two-wheeler)
CAMERA_ANGLE: Taillight height, perfectly centered on the rear axis.
FRAMING: Taillight, tail unit, rear indicators, license plate holder, rear wheel and tyre, silencer(s) if present, rear seat/cowl and grab rails symmetrically framed.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Shadows consistent with the showroom lighting.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_EXT_34_FRONT_RIGHT',
    label: '3/4 Front Right',
    labelDe: '3/4 Vorne Rechts',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front-Right 3/4 View (two-wheeler)
CAMERA_ANGLE: Eye-level to slightly above wheel height, 30-40° off the front center axis toward the vehicle's RIGHT side.
FRAMING: Headlight, right fork leg, front wheel, right flank of tank/body panel and the right side of the engine or motor unit are prominent. Complete vehicle in frame.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Realistic lighting and floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_EXT_34_REAR_LEFT',
    label: '3/4 Rear Left',
    labelDe: '3/4 Hinten Links',
    referenceNeeds: ['wheel'],
    defaultSelected: true,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Rear-Left 3/4 View (two-wheeler)
CAMERA_ANGLE: Eye-level, camera BEHIND and to the LEFT, roughly 30-40° off the rear center axis.
FRAMING: Tail unit, taillight, rear wheel and the LEFT flank (chain/sprocket side on most motorcycles) are the dominant elements. Complete vehicle in frame with no cropping.
CRITICAL DIRECTION: The viewer sees the rear and the LEFT flank. Do NOT produce a rear-right view and do NOT mirror.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Dramatic lighting emphasizing tail unit and rear wheel.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_EXT_LOW_ANGLE',
    label: 'Low Angle Hero',
    labelDe: 'Low-Angle Hero',
    referenceNeeds: ['wheel'],
    defaultSelected: false,
    category: 'exterior',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Low Angle Hero Shot (two-wheeler)
CAMERA_ANGLE: Ground level (15-25 cm above the floor), looking slightly upward at the front wheel, fork and headlight from a front-left 3/4 position.
FRAMING: Front wheel and tail must stay fully inside the frame — no cropping of wheels or handlebar.
${TWO_WHEELER_SHOT_RULES}
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Dramatic studio lighting with strong highlights on tank, fork and frame.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Detail-Aufnahmen (Zweirad) ──
  {
    key: 'MOTO_DET_HEADLIGHT',
    label: 'Headlight',
    labelDe: 'Scheinwerfer',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Headlight in Two-Wheeler Context
CAMERA_ANGLE: Close-up, 10-20° off perpendicular, showing the headlight unit together with the surrounding parts (fork crown, front fender edge, fairing or headlight bracket, indicator).
FOCUS_ELEMENTS: Exact housing outline, lens shape, LED/DRL signature, projector count and arrangement, reflector geometry, position light strips and any chrome or dark accents — reproduced 1:1 from the reference.
FORBIDDEN: Do NOT substitute a generic or car headlight, do NOT simplify multi-element units, do NOT invent LED patterns. The headlight MUST stay mounted on the vehicle — no isolated object shot.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: High-contrast studio lighting revealing the internal structure. Showroom environment visible in the background.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_DET_TAILLIGHT',
    label: 'Taillight',
    labelDe: 'Rücklicht',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Taillight in Two-Wheeler Context
CAMERA_ANGLE: Close-up from behind and slightly above, showing the taillight together with the tail unit, rear indicators and license plate holder.
FOCUS_ELEMENTS: Exact LED arrangement, lens geometry and tint (clear/smoked/red), housing shape, mounting and the tail fairing edges around it — reproduced 1:1 from the reference.
FORBIDDEN: Do NOT isolate the taillight, do NOT invent light signatures, do NOT use a car taillight design.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: High-contrast studio lighting revealing internal textures. Showroom environment visible in the background.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_DET_WHEEL',
    referenceNeeds: ['wheel'],
    label: 'Wheel / Rim',
    labelDe: 'Felge / Rad',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Front Wheel in Two-Wheeler Context
CAMERA_ANGLE: Low, close-up at wheel-hub height, slightly angled so rim, tyre, brake disc, caliper, fork leg and fender edge are visible.
FOCUS_ELEMENTS: EXACT rim type (cast wheel with exact spoke count and geometry, or wire-spoked wheel with exact spoke count and lacing pattern), rim finish and colour, hub, brake disc type (solid/wavy/drilled, single or double), caliper shape and colour, tyre profile and sidewall.
DEDICATED WHEEL REFERENCE (ABSOLUTE PRIORITY): If a dedicated wheel reference image is provided, it is the ONLY authoritative source for this wheel. Reproduce it 1:1 and never replace it with a generic or catalogue wheel.
CRITICAL: The wheel MUST stay mounted on the vehicle with fork/swingarm and bodywork visible — no standalone wheel shot. Front and rear wheel design must stay consistent with the reference.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: Dramatic low lighting emphasizing rim geometry. Showroom environment in the background.
{{LOGO_LINE}}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_DET_COCKPIT',
    label: 'Cockpit / Handlebar',
    labelDe: 'Cockpit / Lenker & Display',
    defaultSelected: true,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Cockpit, Handlebar and Instruments (two-wheeler)
CAMERA_ANGLE: Rider's point of view from just above the saddle, looking forward and slightly down onto the handlebar and instruments.
FOCUS_ELEMENTS: Handlebar shape, grips, brake and clutch levers, switchgear and button layout, mirrors and stalks, ignition/key area, instrument cluster — analogue dials, LCD or TFT display exactly as in the reference — plus the top of the tank or front panel.
FORBIDDEN: No steering wheel, no car dashboard, no rider, no hands, no helmet. Do NOT invent gauges, menu screens, warning lights or buttons that are not in the reference.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: Soft, even light that keeps the display readable and free of blown-out reflections. Showroom environment visible in the background.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_DET_SEAT',
    label: 'Seat / Saddle',
    labelDe: 'Sitzbank / Sattel',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Seat / Saddle (two-wheeler)
CAMERA_ANGLE: Elevated three-quarter view onto the seat, roughly 45° from above and slightly from the side.
FOCUS_ELEMENTS: Seat cover material and texture, seams and stitching, step or dual-seat shape, grab rails or straps, tail unit edges and seat lock area.
RULES: Reproduce material, colour, stitching and any embossed lettering exactly. If the reference shows a single-seat cowl instead of a pillion seat, reproduce the cowl and do NOT invent a seat.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: Soft directional light that reveals the surface texture. Showroom environment in the background.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_DET_TANK_BADGE',
    label: 'Tank / Badge',
    labelDe: 'Tank / Markenemblem',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Tank or Front Body Panel with Badge (two-wheeler)
CAMERA_ANGLE: Close-up at a slight angle onto the fuel tank (motorcycle/moped) or the corresponding front body panel / frame area carrying the brand badge (scooter, electric two-wheeler, e-bike).
FOCUS_ELEMENTS: Exact tank or panel shape and knee recesses, paint colour and finish, decals or stripes, filler cap design where present, and the brand badge or lettering in exact shape, material, colour and position.
TYPE RULE: If the referenced vehicle has NO fuel tank (electric motorcycle, scooter, e-bike), photograph the equivalent branded panel or frame area instead — never invent a fuel tank or filler cap.
FORBIDDEN: Do NOT invent, restyle or relocate badges, lettering or decals.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: High-contrast studio lighting emphasizing paint finish and badge material.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_DET_ENGINE',
    label: 'Engine / Drive',
    labelDe: 'Motor / Antrieb',
    defaultSelected: false,
    category: 'detail',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Engine or Drive Unit (two-wheeler)
CAMERA_ANGLE: Close-up from the side at engine height, showing the drive unit together with the frame tubes, exhaust headers or motor cables and the swingarm pivot area.
FOCUS_ELEMENTS: Exact engine layout and cylinder count with fin pattern and covers, OR the electric motor / battery housing, OR the e-bike mid-drive with crank, chainring and battery — whichever the reference actually shows. Include the chain, belt or shaft drive, sprocket, radiator if present, and exhaust header routing.
TYPE RULE: Never add a combustion engine or exhaust to an electric two-wheeler, and never replace a visible combustion engine with a motor housing.
${TWO_WHEELER_SHOT_RULES}
LIGHTING: Directional studio light emphasizing metal surfaces, casting textures and finishes.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Grid / Composites ──
  {
    key: 'MOTO_GRID_EXTERIOR_4',
    referenceNeeds: ['wheel'],
    label: 'Exterior Grid (4 views)',
    labelDe: 'Exterieur-Grid (4 Ansichten)',
    defaultSelected: true,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Two-Wheeler Exterior 2×2 Grid
LAYOUT: Top-left: front-left 3/4 view. Top-right: perfect LEFT side profile (front wheel pointing right). Bottom-left: perfect RIGHT side profile (front wheel pointing left). Bottom-right: direct rear view.
RULES: All 4 cells show the COMPLETE, IDENTICAL two-wheeler in the SAME PROVIDED SHOWROOM with consistent lighting and the vehicle at the SAME SIZE in every cell. Thin white dividers. No cropped wheels or handlebars. The two side views must be genuinely different sides, never a mirrored duplicate. ${LOGO_LINE}
${TWO_WHEELER_SHOT_RULES}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_GRID_DETAIL_4',
    referenceNeeds: ['wheel'],
    label: 'Detail Grid (4 views)',
    labelDe: 'Detail-Grid (4 Ansichten)',
    defaultSelected: true,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Two-Wheeler Detail 2×2 Grid
LAYOUT: Top-left: cockpit with handlebar and instruments. Top-right: headlight close-up. Bottom-left: front wheel and brake. Bottom-right: seat/saddle with tail unit.
RULES: All cells show the SAME physical vehicle with consistent professional lighting and the same showroom background. Thin white dividers. No steering wheel, no car interior, no rider. Every detail reproduced exactly from the reference.
${TWO_WHEELER_SHOT_RULES}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'MOTO_GRID_SOCIAL_MEDIA',
    referenceNeeds: ['wheel'],
    label: 'Social Media Collage',
    labelDe: 'Social-Media-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt: `<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Two-Wheeler Social Media Collage
LAYOUT: One large hero (front-left 3/4) filling 60% of the canvas on the left. Three smaller images stacked on the right: left side profile, cockpit with instruments, front wheel detail.
RULES: All images show the IDENTICAL vehicle in the PROVIDED SHOWROOM. Modern, clean layout with thin dividers. Vehicle at the same size in comparable cells. ${LOGO_LINE}
${TWO_WHEELER_SHOT_RULES}
</CURRENT_PIPELINE_SHOT>`,
  },
];

/** Reine Lookup-Hilfe (Galerie-Sortierung, Label-Zuordnung). */
export const MOTORCYCLE_PIPELINE_JOB_KEYS = MOTORCYCLE_PIPELINE_JOBS.map(j => j.key);
