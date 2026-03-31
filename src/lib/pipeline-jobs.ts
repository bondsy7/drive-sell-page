/**
 * Image Generation Pipeline – individual, grid/composite, and CI brand jobs.
 * Each job can produce one or more images (outputCount).
 * 
 * All prompts use structured English XML-tags optimized for Gemini image models.
 * Logo references are injected at RUNTIME only when the user has selected logos.
 * The placeholder {{LOGO_LINE}} is replaced dynamically in PipelineContext.
 */

export interface PipelineJob {
  key: string;
  label: string;
  labelDe: string;
  /** The raw perspective/composition instruction (showroom, logo, plate are injected at runtime) */
  prompt: string;
  /** For multi-image jobs: additional prompts that produce extra images */
  extraPrompts?: string[];
  /** Whether this job is selected by default */
  defaultSelected: boolean;
  /** Category for grouping in UI */
  category: 'hero' | 'exterior' | 'interior' | 'detail' | 'composite' | 'ci';
  /** How many images this job produces (default 1) */
  outputCount?: number;
  /** For CI jobs: which brand this applies to (lowercase). If set, only shown for that brand. */
  brand?: string;
}

// ═══════════════════════════════════════════════════════════════════
// IDENTITY LOCK – prepended to every pipeline prompt at runtime
// Structured XML format for better model comprehension
// ═══════════════════════════════════════════════════════════════════
const IDENTITY_LOCK = `<IDENTITY_LOCK>
Study ALL provided reference photos and detail images with extreme care before generating.
PAINT: Reproduce the EXACT paint color, shade, metallic/matte finish. Do NOT shift, tint, saturate, desaturate, lighten, or darken.
WHEELS: EXACT rim design – spoke count, shape, concavity, finish. Hub cap with brand logo. EXACT tire profile. NEVER crop any wheel.
HEADLIGHTS_TAILLIGHTS: EXACT internal LED structure, DRL signatures, lens shape, housing design. NEVER crop or alter.
GRILLE_BADGES: EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
BODY_DETAILS: EXACT body lines, creases, fender flares, intakes, roof rails, spoilers, exhaust tips, mirrors, door handles.
MATERIALS: Match exact finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute.
</IDENTITY_LOCK>

<VEHICLE_SCALE_LOCK>
The vehicle MUST occupy the SAME proportion of the image frame in EVERY generated image.
For full-body exterior shots: vehicle should fill approximately 70-80% of the image width.
The apparent SIZE of the vehicle must remain CONSISTENT across all perspectives – same car, same scale.
Do NOT make the vehicle larger or smaller between different camera angles.
</VEHICLE_SCALE_LOCK>

<PERSPECTIVE_ACCURACY>
The output MUST show EXACTLY the camera angle specified in the prompt.
"3/4 front left" = camera at front-left. "3/4 front right" = camera at front-right.
"Direct front" = perfectly centered head-on. "Side profile left" = camera faces driver side.
NEVER mirror or flip the perspective. Left is left, right is right.
</PERSPECTIVE_ACCURACY>

<STRICT_NEGATIVE_CONSTRAINTS>
UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Simplify complex details (multi-spoke rims keep all spokes, LED arrays keep all elements)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Carry over reflections from original environment – render ALL reflections new
- Rotate, flip, or mirror the image
- Crop the vehicle at image edges – full car visible for full-body shots
- Add ANY logo, brand mark, or wall decoration UNLESS a logo image is explicitly provided as a reference asset
</STRICT_NEGATIVE_CONSTRAINTS>

<REFLECTIONS_LIGHTING>
ALL reflections on paint, glass, chrome, windows must match the TARGET scene.
Shadows consistent with scene light sources. Floor reflections show vehicle in new environment.
</REFLECTIONS_LIGHTING>`;

// ═══════════════════════════════════════════════════════════════════
// INTERIOR RULES – appended ONLY to interior pipeline prompts
// ═══════════════════════════════════════════════════════════════════
const INTERIOR_RULES = `<INTERIOR_RULES>
THIS IS AN INTERIOR SHOT – the following rules are ABSOLUTE:

1. EXACT COMPOSITION: Output MUST have EXACT SAME framing, camera angle, perspective as reference. Do NOT rotate, flip, mirror, zoom, or re-frame.

2. ZERO INVENTION: Do NOT add ANY element not in original (no new buttons, screens, trim, ambient lighting). Do NOT remove ANY permanent vehicle element. Do NOT change ANY material. EVERY detail matters: tachometer, screen UI, stitching, seat perforation, air vents, gear selector, cup holders, USB ports – ALL must match EXACTLY.

3. CLEANUP ONLY: Remove items NOT belonging to vehicle: trash, bags, papers, plastic covers, dust, dirt, personal belongings, hands/feet. Clean surfaces to showroom-ready condition.

4. LIGHTING AND WINDOW VIEW: Improve to bright, even, professional lighting. The view through ALL windows MUST show the SELECTED showroom/scene environment (visible THROUGH glass naturally, matching the scene chosen for exterior shots). Do NOT show a random outdoor scene or street – use the SAME environment as the exterior images. Do NOT alter glass transparency.

5. STRUCTURAL INTEGRITY: Roof, ALL pillars (A/B/C), headliner, door panels, sun visors, rearview mirror FULLY visible and UNCUT.

6. FORBIDDEN: Generating exterior view, changing camera angle, adding/modifying design, cutting roof/doors/pillars, inventing details.
</INTERIOR_RULES>`;

// ═══════════════════════════════════════════════════════════════════
// LOGO PLACEHOLDER – replaced at runtime in PipelineContext
// When user has NOT selected logos, this becomes empty string.
// When user HAS selected logos, this becomes the logo instruction.
// ═══════════════════════════════════════════════════════════════════
const LOGO_LINE = '{{LOGO_LINE}}';

export const PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'MASTER_IMAGE',
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front 3/4 Hero View (Master Image)
CAMERA_ANGLE: Eye-level, 30-40° left of center axis, looking at front-left quarter.
FRAMING: Full vehicle visible with no cropping. Minimum 5% padding on all edges.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Clean luxury studio lighting with soft overhead key light, fill lights, and realistic polished floor reflections matching the selected showroom.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Exterior individual perspectives ──
  {
    key: 'EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Head-On Front View
CAMERA_ANGLE: Eye-level, exactly 0° center axis. Perfectly symmetrical.
FRAMING: Both headlights, full grille, center badge mathematically centered. Full vehicle width visible.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Balanced showroom lighting with realistic floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Direct Rear View
CAMERA_ANGLE: Eye-level, perfectly centered on rear axis.
FRAMING: Both taillights, exhaust outlets, rear badge, model designation symmetrically framed. Full width visible.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Shadows consistent with showroom lighting.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Linke Seite',
    defaultSelected: true,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect Left Side Profile
CAMERA_ANGLE: Exactly perpendicular (90°) to vehicle's left flank. Ground-to-waist-level horizon.
FRAMING: Both left-side wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette front to rear in frame.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Flat, even lighting to highlight body lines.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Rechte Seite',
    defaultSelected: false,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Perfect Right Side Profile
CAMERA_ANGLE: Exactly perpendicular (90°) to vehicle's right flank.
FRAMING: Both right-side wheels fully visible. Body lines and proportions accurately represented.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Clean studio lighting emphasizing body lines.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_34_FRONT_RIGHT',
    label: '3/4 Front Right',
    labelDe: '3/4 Vorne Rechts',
    defaultSelected: true,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Front-Right 3/4 View
CAMERA_ANGLE: Eye-level, 30-40° to the RIGHT of center axis. This is NOT a left-side view.
FRAMING: Right headlight, right fender, and right front wheel prominently visible. Full vehicle in frame.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Realistic lighting and floor reflections.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_34_REAR_LEFT',
    label: '3/4 Rear Left',
    labelDe: '3/4 Hinten Links',
    defaultSelected: true,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Rear-Left 3/4 View
CAMERA_ANGLE: Eye-level, behind and to the LEFT of the vehicle. Rear-left quarter, left taillight, left rear wheel prominent.
FRAMING: Rear bumper and exhaust visible. Full vehicle in frame.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Dramatic lighting emphasizing body contours and rear design.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_34_REAR_RIGHT',
    label: '3/4 Rear Right',
    labelDe: '3/4 Hinten Rechts',
    defaultSelected: false,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Rear-Right 3/4 View
CAMERA_ANGLE: Eye-level, behind and to the RIGHT. Rear-right quarter, right taillight, right rear wheel prominent.
FRAMING: Full vehicle in frame.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Smooth, balanced showroom lighting.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_LOW_ANGLE',
    label: 'Low Angle Hero',
    labelDe: 'Low-Angle Hero',
    defaultSelected: true,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Low Angle Hero Shot
CAMERA_ANGLE: Ground level (20-30cm above ground), looking upward at front bumper, grille, and hood. Powerful, imposing perspective.
FRAMING: Full front bumper and wheels visible – no cropping.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Dramatic perspective with studio lighting creating strong highlights on hood and body lines.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'EXT_ELEVATED_FRONT',
    label: 'Elevated Front',
    labelDe: 'Erhöhte Frontansicht',
    defaultSelected: false,
    category: 'exterior',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Exterior - Elevated Front 3/4 View
CAMERA_ANGLE: 2-3 meters above ground, looking down at hood, windshield, and roof. Bird's-eye angle.
FRAMING: Full vehicle visible from above showing roof and hood lines.
ENVIRONMENT: PROVIDED SHOWROOM. ${LOGO_LINE}
LIGHTING: Lighting from above emphasizing roof and hood lines.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Interior ──
  {
    key: 'INT_DASHBOARD',
    label: 'Dashboard',
    labelDe: 'Armaturenbrett',
    defaultSelected: true,
    category: 'interior',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Driver's Seat POV
CAMERA_ANGLE: Eye-level from driver's head position, looking at steering wheel, instrument cluster, and full dashboard.
FOCUS_ELEMENTS: Steering wheel must be perfectly circular with accurate brand badging. Dashboard, infotainment screens, center console visible.
RULES: Steering wheel on correct side (left for LHD, right for RHD) as in reference. Do NOT rotate or flip. View through windshield MUST show the selected showroom/scene environment. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'INT_CENTER_CONSOLE',
    label: 'Center Console',
    labelDe: 'Mittelkonsole',
    defaultSelected: true,
    category: 'interior',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Center Console Macro View
CAMERA_ANGLE: Elevated close-up looking down at center console, gear selector, climate controls.
FOCUS_ELEMENTS: Sharp focus on material textures (wood, carbon, piano black, leather). Knobs, buttons, stitching highly detailed. Reproduce exact button layouts and screen UI.
RULES: Shallow depth of field to draw attention to console details. View through windows MUST match the selected showroom/scene.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'INT_REAR_SEATS',
    label: 'Rear Seats',
    labelDe: 'Rücksitzbank',
    defaultSelected: false,
    category: 'interior',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Rear Seats from Front
CAMERA_ANGLE: From front headrests looking backward at rear seats.
FOCUS_ELEMENTS: Legroom, seat materials, rear center armrest, rear amenities.
RULES: Do NOT rotate or change perspective direction. View through rear window MUST show the selected showroom/scene.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'INT_WIDE_CABIN',
    label: 'Wide Cabin View',
    labelDe: 'Kabinen-Übersicht',
    defaultSelected: false,
    category: 'interior',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Interior - Wide Cabin Overview
CAMERA_ANGLE: Wide-angle from center of rear seat area looking forward.
FOCUS_ELEMENTS: Entire dashboard span, both front seats, center console, windshield.
RULES: Maintain exact interior layout from reference. View through windshield MUST show the selected showroom/scene. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Details ──
  {
    key: 'DET_HEADLIGHT',
    label: 'Headlight',
    labelDe: 'Scheinwerfer',
    defaultSelected: true,
    category: 'detail',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Front Headlight in Vehicle Context
CAMERA_ANGLE: Close-up showing the headlight assembly WITH surrounding bodywork (fender, hood edge, bumper corner). The headlight fills 50-60% of the frame but the vehicle body MUST be visible around it.
FOCUS_ELEMENTS: Pin-sharp focus on the EXACT internal LED module arrangement, DRL signature pattern, projector lens shape, reflector geometry, and housing design FROM THE PROVIDED REFERENCE PHOTOS. Every LED strip, chrome accent, and lens texture must EXACTLY match what is visible in the reference images.
CRITICAL REFERENCE RULE: If detail reference photos are provided, use them as the AUTHORITATIVE source for the headlight's internal structure. The headlight design MUST be an exact reproduction – do NOT invent, simplify, or generalize any LED element, reflector shape, or DRL pattern. Count the exact number of LED modules, match their arrangement, and reproduce the exact lens geometry.
FRAMING: The headlight MUST remain attached to the vehicle. Show the hood line, fender edge, and part of the front bumper. Do NOT isolate the headlight as a standalone object.
LIGHTING: High-contrast studio lighting revealing internal textures and reflections. Showroom environment visible in background.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'DET_TAILLIGHT',
    label: 'Taillight',
    labelDe: 'Rücklicht',
    defaultSelected: true,
    category: 'detail',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Macro Detail - Rear Taillight
CAMERA_ANGLE: Extreme close-up, filling 60-70% of frame with taillight assembly.
FOCUS_ELEMENTS: EXACT LED element arrangement, light signature, 3D internal structure, lens material (clear/smoked/red), housing design. Every LED bar and reflector from reference.
LIGHTING: High-contrast studio lighting against blurred background.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'DET_WHEEL',
    label: 'Wheel / Rim',
    labelDe: 'Felge',
    defaultSelected: true,
    category: 'detail',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Detail - Front Wheel in Context
CAMERA_ANGLE: Low angle, close-up of the FRONT wheel area. Camera positioned at wheel height, slightly angled to show the wheel, tire, fender, and part of the vehicle body.
FRAMING: The wheel and tire MUST remain attached to the vehicle. Show the wheel arch, fender, lower door sill, and part of the front bumper. The vehicle body MUST be visible — this is NOT an isolated wheel shot.
FOCUS_ELEMENTS: Rim finish (machined/matte/gloss), center brand cap, tire sidewall, brake caliper visible behind spokes, exact spoke count and shape from reference.
CRITICAL: Do NOT isolate or detach the wheel from the car. Do NOT show a standalone tire/rim. The wheel MUST be mounted on the vehicle with surrounding bodywork clearly visible.
LIGHTING: Dramatic low lighting emphasizing rim geometry. Background shows the showroom environment.
{{LOGO_LINE}}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'DET_GRILLE',
    label: 'Grille / Badge',
    labelDe: 'Kühlergrill & Emblem',
    defaultSelected: false,
    category: 'detail',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Macro Detail - Front Grille and Badge
CAMERA_ANGLE: Close-up of grille and central badge/emblem.
FOCUS_ELEMENTS: EXACT grille mesh pattern, chrome/black finish, badge shape, badge material, model designation lettering in exact font, size, position from reference.
LIGHTING: High-contrast studio lighting emphasizing material textures and chrome reflections. Blurred background.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Composite / Grid Images ──
  {
    key: 'GRID_EXTERIOR_4',
    label: 'Exterior Grid (4 views)',
    labelDe: 'Exterieur-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Exterior 2×2 Grid
LAYOUT: Top-left: front-left 3/4. Top-right: direct left side profile. Bottom-left: rear-left 3/4. Bottom-right: direct rear.
RULES: All 4 cells show COMPLETE IDENTICAL vehicle in SAME PROVIDED SHOWROOM with consistent lighting. Vehicle SAME SIZE in each cell. Thin white dividers. ${LOGO_LINE} Full car visible in each cell.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'GRID_HIGHLIGHTS_6',
    label: 'Highlights Grid (6 views)',
    labelDe: 'Highlight-Grid (6 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Highlights 3×2 Grid
LAYOUT: Row 1: front-left 3/4 hero | left side profile | rear-left 3/4. Row 2: headlight macro | dashboard interior | wheel/rim close-up.
RULES: All cells show IDENTICAL vehicle. Exterior cells use SAME PROVIDED SHOWROOM. Vehicle SAME SIZE in exterior cells. Thin white dividers. ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'GRID_INTERIOR_4',
    label: 'Interior Grid (4 views)',
    labelDe: 'Interieur-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Interior 2×2 Grid
LAYOUT: Top-left: full dashboard from driver seat. Top-right: center console close-up. Bottom-left: rear seats from front. Bottom-right: steering wheel close-up.
RULES: All cells show IDENTICAL vehicle interior. Consistent professional lighting. Thin white dividers. Do NOT rotate or flip any perspective. View through windows MUST show the selected showroom/scene.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'GRID_SOCIAL_MEDIA',
    label: 'Social Media Collage',
    labelDe: 'Social-Media-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Composite - Social Media Collage
LAYOUT: One large hero (front-left 3/4) at 60% canvas on left. 3 smaller stacked right: side profile, interior dashboard, wheel detail.
RULES: All images show IDENTICAL vehicle. PROVIDED SHOWROOM. ${LOGO_LINE} Modern, clean layout with thin dividers. Vehicle SAME SIZE in comparable cells.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ══════════════════════════════════════════════
  // ── CI / Corporate Identity Brand Pipelines ──
  // ══════════════════════════════════════════════

  // ── BMW CI ──
  {
    key: 'CI_BMW_34_FRONT', label: 'BMW CI – 3/4 Front', labelDe: 'BMW CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>
BMW Corporate Identity: Clean white/grey studio. Strong key light from front-left, soft fill from right. Polished floor with subtle reflections.
</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Front-Left 3/4 View
CAMERA_ANGLE: Eye-level, 30-40° left of center axis.
FOCUS_ELEMENTS: BMW kidney grille clearly visible and centered. Headlight design, grille slats, front bumper air intakes from reference exactly.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_BMW_SIDE', label: 'BMW CI – Side Profile', labelDe: 'BMW CI – Seite', defaultSelected: true, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>
BMW Corporate Identity: Clean white/grey studio. Even lighting highlighting Hofmeister kink and body lines.
</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Direct Left Side Profile
CAMERA_ANGLE: Perfectly perpendicular to vehicle body.
FOCUS_ELEMENTS: Both left wheels fully visible with exact rim design. BMW logo on center caps.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_BMW_34_REAR', label: 'BMW CI – 3/4 Rear', labelDe: 'BMW CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>BMW Corporate Identity: Clean white/grey studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Rear-Left 3/4 View
FOCUS_ELEMENTS: BMW roundel badge, exact taillight design, exhaust outlet shape, rear diffuser from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_BMW_REAR', label: 'BMW CI – Rear', labelDe: 'BMW CI – Heck', defaultSelected: true, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>BMW Corporate Identity: Clean white/grey studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Direct Rear View
CAMERA_ANGLE: Perfectly centered.
FOCUS_ELEMENTS: Full width taillights, exhaust config, rear badge, model designation from reference exactly.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_BMW_GRILLE', label: 'BMW CI – Grille Detail', labelDe: 'BMW CI – Kühlergrill', defaultSelected: false, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Grille and Headlight Detail
CAMERA_ANGLE: Close-up macro of kidney grille with headlights.
FOCUS_ELEMENTS: Exact grille slat pattern, surround finish, BMW roundel badge, headlight internal LED structure from reference. High-contrast studio lighting.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_BMW_INTERIOR', label: 'BMW CI – Interior', labelDe: 'BMW CI – Innenraum', defaultSelected: false, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Dashboard from Driver Perspective
FOCUS_ELEMENTS: Exact iDrive/curved display, instrument cluster, steering wheel buttons, ambient lighting from reference. Professional interior lighting. View through windows MUST show the selected showroom/scene.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_BMW_WHEEL', label: 'BMW CI – Wheel', labelDe: 'BMW CI – Felge', defaultSelected: false, category: 'ci', brand: 'bmw',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: BMW CI - Front Wheel in Context
CAMERA_ANGLE: Low angle close-up of front wheel area at wheel height.
FRAMING: Wheel and tire MUST remain attached to the vehicle. Show wheel arch, fender, lower door sill, and part of the bumper. Vehicle body MUST be visible.
FOCUS_ELEMENTS: Exact rim spoke design, finish, BMW center cap, brake caliper color/shape from reference.
CRITICAL: Do NOT isolate the wheel. It MUST be mounted on the vehicle with surrounding bodywork visible.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Mercedes-Benz CI ──
  {
    key: 'CI_MERCEDES_34_FRONT', label: 'Mercedes CI – 3/4 Front', labelDe: 'Mercedes CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>
Mercedes-Benz Corporate Identity: Elegant studio with subtle gradient background. Soft, even, premium lighting.
</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - Front-Left 3/4 View
FOCUS_ELEMENTS: Three-pointed star emblem, exact radiator grille design (diamond/louvre/Panamericana), headlight internals from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_MERCEDES_SIDE', label: 'Mercedes CI – Side', labelDe: 'Mercedes CI – Seite', defaultSelected: true, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Mercedes-Benz CI: Subtle gradient studio background.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - Direct Left Side Profile
FOCUS_ELEMENTS: Full body silhouette, chrome window surrounds, exact wheel design from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_MERCEDES_34_REAR', label: 'Mercedes CI – 3/4 Rear', labelDe: 'Mercedes CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Mercedes-Benz CI: Elegant studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - Rear-Left 3/4 View
FOCUS_ELEMENTS: Exact LED light strip design, star badge, exhaust config, rear diffuser from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_MERCEDES_FRONT', label: 'Mercedes CI – Front', labelDe: 'Mercedes CI – Front', defaultSelected: true, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Mercedes-Benz CI: Even studio lighting.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - Direct Front View
CAMERA_ANGLE: Perfectly centered.
FOCUS_ELEMENTS: Three-pointed star, exact grille design from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_MERCEDES_MBUX', label: 'Mercedes CI – MBUX', labelDe: 'Mercedes CI – MBUX', defaultSelected: false, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - MBUX/Infotainment Detail
CAMERA_ANGLE: Driver seat perspective.
FOCUS_ELEMENTS: Exact MBUX hyperscreen/infotainment, screen layout, UI design, turbine air vents, ambient lighting from reference. Premium interior photography. View through windows MUST show the selected showroom/scene.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_MERCEDES_GRILLE', label: 'Mercedes CI – Grille', labelDe: 'Mercedes CI – Kühlergrill', defaultSelected: false, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - Grille and Star Macro
FOCUS_ELEMENTS: Exact grille pattern, chrome textures, LED headlight internal structure from reference. Studio lighting.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_MERCEDES_WHEEL', label: 'Mercedes CI – Wheel', labelDe: 'Mercedes CI – Felge', defaultSelected: false, category: 'ci', brand: 'mercedes',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Mercedes CI - Front Wheel in Context
CAMERA_ANGLE: Low angle close-up of front wheel area at wheel height.
FRAMING: Wheel and tire MUST remain attached to the vehicle. Show wheel arch, fender, lower door sill. Vehicle body MUST be visible.
FOCUS_ELEMENTS: Exact AMG/standard rim design, brake caliper, star center cap from reference.
CRITICAL: Do NOT isolate the wheel. It MUST be mounted on the vehicle with surrounding bodywork visible.
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Audi CI ──
  {
    key: 'CI_AUDI_34_FRONT', label: 'Audi CI – 3/4 Front', labelDe: 'Audi CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'audi',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Audi Corporate Identity: Clean, bright studio with minimal shadows.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Audi CI - Front-Left 3/4 View
FOCUS_ELEMENTS: Exact Singleframe grille pattern, four rings emblem, headlight internals (matrix LED, DRL signature) from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_AUDI_SIDE', label: 'Audi CI – Side', labelDe: 'Audi CI – Seite', defaultSelected: true, category: 'ci', brand: 'audi',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Audi CI: Clean bright studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Audi CI - Perfect Left Side Profile
FOCUS_ELEMENTS: Exact body lines, wheel design, Audi design DNA from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_AUDI_34_REAR', label: 'Audi CI – 3/4 Rear', labelDe: 'Audi CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'audi',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Audi CI: Clean studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Audi CI - Rear-Left 3/4 View
FOCUS_ELEMENTS: Exact connected LED light strip design, four rings badge from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_AUDI_REAR', label: 'Audi CI – Rear', labelDe: 'Audi CI – Heck', defaultSelected: true, category: 'ci', brand: 'audi',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Audi CI: Bright studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Audi CI - Direct Rear View
CAMERA_ANGLE: Centered.
FOCUS_ELEMENTS: Exact full-width LED light bar, Audi lettering from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Volkswagen CI ──
  {
    key: 'CI_VW_34_FRONT', label: 'VW CI – 3/4 Front', labelDe: 'VW CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'volkswagen',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volkswagen CI: Clean, modern white studio. Friendly, approachable lighting.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: VW CI - Front-Left 3/4 View
FOCUS_ELEMENTS: Exact VW logo, IQ.Light LED headlight design from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VW_SIDE', label: 'VW CI – Side', labelDe: 'VW CI – Seite', defaultSelected: true, category: 'ci', brand: 'volkswagen',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>VW CI: Modern white studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: VW CI - Left Side Profile
FOCUS_ELEMENTS: Exact body lines, wheel design from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VW_34_REAR', label: 'VW CI – 3/4 Rear', labelDe: 'VW CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'volkswagen',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>VW CI: White studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: VW CI - Rear-Left 3/4 View
FOCUS_ELEMENTS: Exact VW logo, taillight design, model lettering from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VW_FRONT', label: 'VW CI – Front', labelDe: 'VW CI – Front', defaultSelected: true, category: 'ci', brand: 'volkswagen',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>VW CI: White studio.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: VW CI - Direct Front View
CAMERA_ANGLE: Centered.
FOCUS_ELEMENTS: Exact VW badge and light signature from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Porsche CI ──
  {
    key: 'CI_PORSCHE_34_FRONT', label: 'Porsche CI – 3/4 Front', labelDe: 'Porsche CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'porsche',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Porsche CI: Dark dramatic studio with controlled highlights on body lines.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Porsche CI - Front-Left 3/4 View
FOCUS_ELEMENTS: Exact headlight design, front bumper air intakes, Porsche crest from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_PORSCHE_SIDE', label: 'Porsche CI – Side', labelDe: 'Porsche CI – Seite', defaultSelected: true, category: 'ci', brand: 'porsche',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Porsche CI: Dark dramatic studio with rim focus.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Porsche CI - Left Side Profile
FOCUS_ELEMENTS: Exact sports car proportions, wheel design from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_PORSCHE_34_REAR', label: 'Porsche CI – 3/4 Rear', labelDe: 'Porsche CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'porsche',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Porsche CI: Dramatic lighting.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Porsche CI - Rear-Left 3/4 View
FOCUS_ELEMENTS: Exact rear light bar, PORSCHE lettering, exhaust layout from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_PORSCHE_LOW', label: 'Porsche CI – Low Angle', labelDe: 'Porsche CI – Low-Angle', defaultSelected: true, category: 'ci', brand: 'porsche',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Porsche CI: Dark studio, dramatic key light.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Porsche CI - Low-Angle Front View
CAMERA_ANGLE: Ground level looking up at front, emphasizing power and stance.
FOCUS_ELEMENTS: Exact front design from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // ── Volvo CI ──
  // Standard Views (7)
  {
    key: 'CI_VOLVO_34_FRONT_LEFT', label: 'Volvo CI – 3/4 Front Left', labelDe: 'Volvo CI – 3/4 Front Links', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>
Volvo Corporate Identity: Minimalist high-tech Scandinavian showroom. Highly reflective dark polished resin floor. Large seamless frosted glass panels illuminated from behind with soft diffused cool-white gradient light. Ultra-premium, cold, clinical magazine quality.
</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - 3/4 Front-Left View
CAMERA_ANGLE: Front-left, looking at front-left quarter.
FOCUS_ELEMENTS: Exact headlight DRL signatures ("Thor's Hammer"), front grille shape/mesh/texture, wheel spoke pattern, body contours from reference. Interior subtly visible through windows. License plates blank and body-colored.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_34_FRONT_RIGHT', label: 'Volvo CI – 3/4 Front Right', labelDe: 'Volvo CI – 3/4 Front Rechts', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist high-tech showroom, reflective dark polished resin floor, frosted glass panels with cool-white gradient.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - 3/4 Front-Right View
CAMERA_ANGLE: Front-right, looking at front-right quarter. This is NOT a left-side view.
FOCUS_ELEMENTS: Exact headlight DRL signatures, grille mesh, wheel design, body lines from reference. License plates blank.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_34_REAR_LEFT', label: 'Volvo CI – 3/4 Rear Left', labelDe: 'Volvo CI – 3/4 Heck Links', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist high-tech showroom, reflective dark polished resin floor, frosted glass panels.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - 3/4 Rear-Left View
FOCUS_ELEMENTS: Exact taillight internal structure, LED signatures, wheel design, body contours from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_34_REAR_RIGHT', label: 'Volvo CI – 3/4 Rear Right', labelDe: 'Volvo CI – 3/4 Heck Rechts', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist showroom, dark resin floor, frosted glass panels.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - 3/4 Rear-Right View
FOCUS_ELEMENTS: Exact taillights, wheels, body contours from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_SIDE', label: 'Volvo CI – Side', labelDe: 'Volvo CI – Seite', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist showroom, dark resin floor, frosted glass panels.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Right Side Profile
CAMERA_ANGLE: Flat, perpendicular to car body.
FOCUS_ELEMENTS: Exact body lines, wheel design, window trim, proportions from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_FRONT', label: 'Volvo CI – Front', labelDe: 'Volvo CI – Front', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist showroom, dark resin floor, frosted glass panels.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Direct Front View
CAMERA_ANGLE: Perfectly centered.
FOCUS_ELEMENTS: Exact headlight DRL "Thor's Hammer" design, grille mesh, Volvo Iron Mark badge from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_REAR', label: 'Volvo CI – Rear', labelDe: 'Volvo CI – Heck', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist showroom, dark resin floor, frosted glass panels.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Direct Rear View
CAMERA_ANGLE: Perfectly centered.
FOCUS_ELEMENTS: Exact taillight C-shaped LED signatures, VOLVO lettering, rear badges from reference.
ENVIRONMENT: ${LOGO_LINE}
</CURRENT_PIPELINE_SHOT>`,
  },

  // Interior (5)
  {
    key: 'CI_VOLVO_INT_PASSENGER', label: 'Volvo CI – Interior Passenger', labelDe: 'Volvo CI – Innenraum Beifahrer', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Interior from Passenger Door
CAMERA_ANGLE: From open passenger door looking toward dashboard, center console, steering wheel, driver seat.
FOCUS_ELEMENTS: Exact leather grain, stitching, trim materials (open-pore wood, metal mesh, piano black), button layout, infotainment UI, instrument cluster, gear selector from reference. LHD configuration. View through windows MUST show the Volvo CI showroom environment.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_INT_CENTER', label: 'Volvo CI – Interior Center', labelDe: 'Volvo CI – Innenraum Mitte', defaultSelected: true, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Interior Center View
CAMERA_ANGLE: Between front seats looking forward at dashboard and center console.
FOCUS_ELEMENTS: Exact materials, button arrays, steering wheel controls, instrument cluster, pedals, gear selector from reference. LHD configuration. View through windows MUST show the Volvo CI showroom environment.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_INT_REAR', label: 'Volvo CI – Rear Seats', labelDe: 'Volvo CI – Rücksitze', defaultSelected: false, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Rear Seats
CAMERA_ANGLE: From open rear passenger door looking at rear seats, legroom, rear center console.
FOCUS_ELEMENTS: Exact seat material, stitching, rear center console controls, rear air vents from reference. LHD. View through windows MUST show the Volvo CI showroom environment.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_INT_BOOT', label: 'Volvo CI – Open Boot', labelDe: 'Volvo CI – Kofferraum', defaultSelected: false, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Open Boot/Cargo
CAMERA_ANGLE: Straight-on exterior with tailgate fully open, looking into cargo space.
FOCUS_ELEMENTS: Exact cargo floor texture, sidewalls, load-bearing lip, cargo net hooks, rear-seat release handles from reference. Surrounding panels and taillights matched. Showroom environment.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_INT_STEERING', label: 'Volvo CI – Steering Wheel', labelDe: 'Volvo CI – Lenkrad', defaultSelected: false, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

${INTERIOR_RULES}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Steering Wheel Macro
CAMERA_ANGLE: Tight macro of steering wheel, central horn pad, surrounding stalks. Complete wheel visible.
FOCUS_ELEMENTS: Exact hub texture, button iconography (media, cruise, voice), paddle shifters if present, center Volvo Iron Mark from reference. LHD. View through windshield MUST show the Volvo CI showroom.
</CURRENT_PIPELINE_SHOT>`,
  },

  // Detail (3)
  {
    key: 'CI_VOLVO_DET_CLUSTER', label: 'Volvo CI – Instrument Cluster', labelDe: 'Volvo CI – Instrumenten-Display', defaultSelected: false, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Instrument Cluster Macro
CAMERA_ANGLE: Tight macro of digital instrument cluster behind steering wheel.
FOCUS_ELEMENTS: Exact UI layout, digital gauges, central display, warning light placements from reference. Text and iconography sharp. Cluster bezel material detailed. LHD.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_DET_SCREEN', label: 'Volvo CI – Center Screen', labelDe: 'Volvo CI – Zentraldisplay', defaultSelected: false, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Center Screen Macro
CAMERA_ANGLE: Tight macro of main center dashboard screen and surrounding controls.
FOCUS_ELEMENTS: Exact screen orientation (portrait/vertical for Volvo), bezel design, UI layout with app icons, climate overlay. Surrounding air vents, physical buttons, dash material from reference. LHD.
</CURRENT_PIPELINE_SHOT>`,
  },
  {
    key: 'CI_VOLVO_DET_WHEEL', label: 'Volvo CI – Wheel Detail', labelDe: 'Volvo CI – Felge Detail', defaultSelected: false, category: 'ci', brand: 'volvo',
    prompt: `${IDENTITY_LOCK}

<BRAND_ENVIRONMENT_OVERRIDE>Volvo CI: Minimalist showroom, dark resin floor, frosted glass panels.</BRAND_ENVIRONMENT_OVERRIDE>

<CURRENT_PIPELINE_SHOT>
SHOT_TYPE: Volvo CI - Front Wheel in Context
CAMERA_ANGLE: Low angle close-up of front wheel area at wheel height, showing wheel and surrounding fender.
FRAMING: Wheel and tire MUST remain attached to the vehicle. Show wheel arch, fender contours, lower body panel. Vehicle body MUST be visible.
FOCUS_ELEMENTS: Exact multi-spoke design, spoke pattern, concavity, lug nuts, center cap, metallic/machined finish from reference. Brake calipers, rotor, tire sidewall texture.
CRITICAL: Do NOT isolate the wheel. It MUST be mounted on the vehicle with surrounding bodywork visible.
</CURRENT_PIPELINE_SHOT>`,
  },
];

/** Group jobs by category for UI display */
export const PIPELINE_CATEGORIES = [
  { key: 'hero', labelDe: 'Hero' },
  { key: 'exterior', labelDe: 'Exterieur' },
  { key: 'interior', labelDe: 'Interieur' },
  { key: 'detail', labelDe: 'Detail-Aufnahmen' },
  { key: 'composite', labelDe: 'Grid / Composites' },
  { key: 'ci', labelDe: 'CI Hersteller-Guidelines' },
] as const;

/**
 * Replace the {{LOGO_LINE}} placeholder in a prompt based on whether logos are enabled.
 * When no logos are selected, the placeholder becomes an explicit "no logo" instruction.
 */
export function injectLogoPlaceholder(prompt: string, hasLogo: boolean): string {
  if (hasLogo) {
    return prompt.replace(
      /\{\{LOGO_LINE\}\}/g,
      'The provided company logo MUST be integrated on the background wall. Reproduce it PIXEL-FOR-PIXEL with all original colors. IMMUTABLE ASSET.'
    );
  }
  // Explicitly tell the AI NOT to add any logo when none is selected
  return prompt.replace(
    /\{\{LOGO_LINE\}\}/g,
    'Do NOT add any logo, brand mark, or wall decoration to the background. The wall must remain clean and empty.'
  );
}

/**
 * Detect the vehicle brand from the description and return matching CI job keys.
 */
export function detectBrandFromDescription(description: string, vehicleBrand?: string): string | null {
  if (vehicleBrand) {
    const brandLower = vehicleBrand.toLowerCase().trim();
    const brandMap: Record<string, string[]> = {
      bmw: ['bmw'],
      mercedes: ['mercedes', 'benz', 'amg'],
      audi: ['audi'],
      volkswagen: ['volkswagen', 'vw'],
      porsche: ['porsche'],
      toyota: ['toyota'],
      ford: ['ford'],
      hyundai: ['hyundai'],
      kia: ['kia'],
      renault: ['renault'],
      peugeot: ['peugeot'],
      opel: ['opel'],
      skoda: ['skoda', 'škoda'],
      seat: ['seat'],
      cupra: ['cupra'],
      volvo: ['volvo'],
      mini: ['mini'],
      fiat: ['fiat'],
      mazda: ['mazda'],
      nissan: ['nissan'],
      honda: ['honda'],
      suzuki: ['suzuki'],
      mitsubishi: ['mitsubishi'],
      citroen: ['citroen', 'citroën'],
      dacia: ['dacia'],
      tesla: ['tesla'],
      lexus: ['lexus'],
      jaguar: ['jaguar'],
      'land-rover': ['land rover', 'landrover'],
      jeep: ['jeep'],
      subaru: ['subaru'],
    };
    for (const [brand, keywords] of Object.entries(brandMap)) {
      if (keywords.some(kw => brandLower.includes(kw))) return brand;
    }
    return brandLower;
  }

  const desc = description.toLowerCase();
  const descBrandMap: Record<string, string[]> = {
    bmw: ['bmw'],
    mercedes: ['mercedes', 'benz', 'amg'],
    audi: ['audi'],
    volkswagen: ['volkswagen', 'vw ', 'vw-'],
    porsche: ['porsche'],
  };

  for (const [brand, keywords] of Object.entries(descBrandMap)) {
    if (keywords.some(kw => desc.includes(kw))) return brand;
  }
  return null;
}

/** Get the total image count a set of selected jobs will produce */
export function getTotalImageCount(selectedKeys: Set<string>): number {
  return PIPELINE_JOBS
    .filter(j => selectedKeys.has(j.key))
    .reduce((sum, j) => sum + (j.outputCount ?? 1), 0);
}

/**
 * Apply admin prompt overrides to pipeline jobs.
 * Overrides are stored in admin_settings under key 'ai_prompts' with keys like 'pipeline_MASTER_IMAGE'.
 */
export function applyPromptOverrides(jobs: PipelineJob[], overrides: Record<string, string>): PipelineJob[] {
  return jobs.map(job => {
    const mainKey = `pipeline_${job.key}`;
    const mainOverride = overrides[mainKey];

    const extraPrompts = job.extraPrompts ? [...job.extraPrompts] : undefined;
    if (extraPrompts) {
      for (let i = 0; i < extraPrompts.length; i++) {
        const subKey = `pipeline_${job.key}_${i + 1}`;
        if (overrides[subKey] && overrides[subKey].trim()) {
          extraPrompts[i] = overrides[subKey];
        }
      }
    }

    const prompt = mainOverride?.trim() ? mainOverride : job.prompt;
    return { ...job, prompt, extraPrompts };
  });
}
