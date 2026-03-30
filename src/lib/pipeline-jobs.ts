/**
 * Image Generation Pipeline – individual, grid/composite, and CI brand jobs.
 * Each job can produce one or more images (outputCount).
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
// This block is the single source of truth for detail preservation.
// ═══════════════════════════════════════════════════════════════════
const IDENTITY_LOCK = `IDENTITY LOCK (MANDATORY – applies to EVERY image):
Study ALL provided reference photos and detail images with extreme care before generating.
- PAINT COLOR: Reproduce the EXACT paint color, shade, metallic/matte finish from the reference. Do NOT shift, tint, saturate, desaturate, lighten, or darken the color under any circumstances. The hex color value of every body panel must match the original pixel-for-pixel.
- WHEELS & RIMS: Reproduce the EXACT rim design – spoke count, spoke shape, concavity, finish (polished, matte, bi-color, diamond-cut). Match the EXACT tire profile and sidewall height. NEVER crop, cut off, or partially hide any wheel at the image edge. ALL wheels visible in the reference must appear FULLY in the output.
- HEADLIGHTS & TAILLIGHTS: Reproduce the EXACT internal LED structure, DRL signatures, lens shape, and housing design from the reference photos. NEVER crop, cut off, or alter any lighting element.
- GRILLE & BADGES: Reproduce the EXACT grille mesh pattern, shape, chrome/black finish, and every badge/emblem (brand logo, model designation, trim level lettering) in their exact position, size, font, and material.
- BODY DETAILS: Reproduce EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirror shapes, door handle design, and every other exterior detail.
- INTERIOR (when visible through windows): Maintain exact seat color, dashboard layout, steering wheel design, and trim materials as seen in reference photos.
- MATERIALS & TEXTURES: Match exact material finishes – chrome vs. gloss black vs. matte vs. satin. If reference shows gloss black trim, output must show gloss black trim, not chrome.

NEGATIVE CONSTRAINTS (NEVER DO):
- Do NOT invent, add, or hallucinate any detail not present in the reference photos
- Do NOT simplify or stylize complex details (e.g., multi-spoke rims must keep all spokes)
- Do NOT change the vehicle's proportions, ride height, or stance
- Do NOT add aftermarket parts, different wheels, or body modifications not in the reference
- Do NOT show any other vehicles – not in background, not in reflections, not partially visible
- Do NOT add humans, animals, or moving objects
- Do NOT carry over reflections from the original photo's environment; render ALL reflections new for the target scene
- Do NOT crop the vehicle at image edges – the full car must be visible for full-body shots

PERSPECTIVE ACCURACY (CRITICAL):
- The output MUST show EXACTLY the camera angle/perspective specified in the prompt
- "3/4 front left" means the camera is positioned at the front-left of the vehicle looking at the front-left quarter – NOT front-right
- "3/4 front right" means the camera is positioned at the front-right looking at the front-right quarter
- "3/4 rear left" means the camera shows the rear-left quarter of the vehicle
- "Direct front" means perfectly centered head-on view of the front
- "Side profile left" means the camera faces the driver side (left-hand side for LHD vehicles)
- NEVER mirror or flip the perspective. Left is left, right is right.

LIGHTING & REFLECTIONS:
- ALL reflections on paint, glass, chrome, and windows must be rendered to match the TARGET scene
- Shadows must be consistent with the scene's light sources
- Floor reflections must show the vehicle in the new environment`;

// ═══════════════════════════════════════════════════════════════════
// INTERIOR RULES – appended to all interior pipeline prompts
// ═══════════════════════════════════════════════════════════════════
const INTERIOR_RULES = `INTERIOR-SPECIFIC RULES (ABSOLUTE MANDATORY – ZERO TOLERANCE):

1. EXACT COMPOSITION PRESERVATION (HÖCHSTE PRIORITÄT):
- THIS IS AN INTERIOR SHOT. You MUST remaster this EXACT interior image – do NOT generate an exterior view.
- The output image MUST have the EXACT SAME composition, framing, camera angle, and perspective as the reference photo.
- If the reference shows the dashboard from the driver seat → output MUST show the dashboard from the driver seat.
- If the reference shows rear seats from the front → output MUST show rear seats from the front.
- If the reference shows a door panel → output MUST show the same door panel from the same angle.
- Do NOT rotate, flip, mirror, zoom in, zoom out, or re-frame the image in ANY way.
- The pixel boundaries of the image must contain the SAME elements as the original.

2. ZERO INVENTION / ZERO MODIFICATION:
- Do NOT add ANY element not present in the original (no new buttons, no new screens, no new trim, no new ambient lighting effects).
- Do NOT remove ANY permanent vehicle element (seats, buttons, screens, speakers, trim, handles, vents, pedals, steering wheel controls).
- Do NOT change ANY material (leather stays leather, alcantara stays alcantara, piano black stays piano black, carbon stays carbon).
- Do NOT alter the instrument cluster display, infotainment screen content, or any digital readout.
- Do NOT change the steering wheel design, button layout, or any control surface.
- EVERY detail matters: tachometer needles, screen UI, stitching color, seat perforation pattern, air vent angles, gear selector position, cup holder shape, USB port positions – ALL must match the original EXACTLY.

3. CLEANUP ONLY (the ONLY changes allowed):
- Remove items that do NOT belong to the vehicle: trash, bags, papers, leaves, plastic protective covers, transport packaging, dust, dirt, personal belongings, loose items, clothing, body parts/hands/feet.
- Remove any WARNING stickers/labels that are temporary (keep permanent vehicle labels).
- Clean all surfaces: seats, floor mats, dashboard, center console must look freshly detailed.
- The cabin must look showroom-ready – as if professionally cleaned by a detailer.

4. LIGHTING ENHANCEMENT (the ONLY visual change allowed):
- Improve lighting to be bright, even, and professional – as if photographed in a showroom.
- Replace the background visible through windows with the showroom environment (visible THROUGH glass naturally).
- Do NOT alter the glass transparency or remove window tint.

5. STRUCTURAL INTEGRITY (ABSOLUTELY FORBIDDEN TO VIOLATE):
- The vehicle roof, ALL pillars (A/B/C), headliner, door panels, door cards, sun visors, rearview mirror, and ALL trim must remain FULLY visible and UNCUT.
- Do NOT crop, cut off, or hide ANY structural element at the image edges.
- If the original shows a door panel, the COMPLETE door panel must be in the output.
- If the original shows the full dashboard span, the COMPLETE dashboard must be in the output.

6. ABSOLUTELY FORBIDDEN:
- Generating an exterior view when an interior reference is provided.
- Changing the camera angle or perspective from the original.
- Adding decorative elements, changing materials, or "improving" the design.
- Cutting off the roof, removing doors, or altering the structural frame.
- Inventing details not visible in the reference photos.`;

export const PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'MASTER_IMAGE',
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Front-left 3/4 view at eye level. The camera is positioned at approximately 30-40° to the left of the car's center axis, looking at the front-left quarter. Full vehicle visible in frame with no cropping.\n\nSCENE: Place the car in the PROVIDED SHOWROOM environment. The Company Logo MUST be physically integrated onto a large background feature wall behind the car with realistic 3D properties, perspective skew, and reflections matching the scene lighting.\n\nLIGHTING: Clean luxury studio lighting with soft overhead key light, fill lights, and realistic polished floor reflections showing the vehicle's underside.`,
  },
  // ── Exterior individual perspectives ──
  {
    key: 'EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Direct head-on front view at eye level. Camera perfectly centered on the vehicle's front axis. The grille, headlights, badge, and front bumper must be symmetrically framed. Full vehicle width visible.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo visible on background wall. Realistic floor reflections and balanced showroom lighting.`,
  },
  {
    key: 'EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Direct rear view at eye level. Camera perfectly centered on the vehicle's rear axis. Taillights, exhaust outlets, rear badge, and model designation must all be clearly visible and symmetrically framed.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo visible on background wall. Realistic shadows consistent with showroom lighting.`,
  },
  {
    key: 'EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Linke Seite',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Perfect left (driver) side profile view. Camera exactly perpendicular (90°) to the car's left flank. The vehicle's body lines, wheel design, and proportions must be accurately represented. Both left-side wheels fully visible.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo visible on background wall. Highlight body lines and wheel design with clean studio lighting.`,
  },
  {
    key: 'EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Rechte Seite',
    defaultSelected: false,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Perfect right (passenger) side profile view. Camera exactly perpendicular (90°) to the car's right flank. Both right-side wheels fully visible. Body lines and proportions accurately represented.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo visible on background wall. Clean studio lighting emphasizing body lines.`,
  },
  {
    key: 'EXT_34_FRONT_RIGHT',
    label: '3/4 Front Right',
    labelDe: '3/4 Vorne Rechts',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Front-right 3/4 view at eye level. Camera positioned at approximately 30-40° to the RIGHT of the car's center axis, looking at the front-right quarter. The right headlight, right fender, and right front wheel are prominently visible. This is NOT a left-side view.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo on background wall with correct perspective matching the camera angle. Realistic lighting and floor reflections.`,
  },
  {
    key: 'EXT_34_REAR_LEFT',
    label: '3/4 Rear Left',
    labelDe: '3/4 Hinten Links',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Rear-left 3/4 view at eye level. Camera positioned behind and to the LEFT of the vehicle, showing the rear-left quarter, left taillight, and left rear wheel prominently. The rear bumper and exhaust are visible.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo on background wall behind the car. Dramatic lighting emphasizing body contours and rear design.`,
  },
  {
    key: 'EXT_34_REAR_RIGHT',
    label: '3/4 Rear Right',
    labelDe: '3/4 Hinten Rechts',
    defaultSelected: false,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Rear-right 3/4 view at eye level. Camera positioned behind and to the RIGHT of the vehicle, showing the rear-right quarter, right taillight, and right rear wheel prominently.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo on wall with correct perspective. Smooth, balanced showroom lighting.`,
  },
  {
    key: 'EXT_LOW_ANGLE',
    label: 'Low Angle Hero',
    labelDe: 'Low-Angle Hero',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Low-angle hero shot from ground level (camera approximately 20-30cm above ground). Looking upward at the front bumper, grille, and hood. The car appears powerful and imposing from this dramatic perspective. Full front bumper and wheels visible – no cropping.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo visible on background wall. Dramatic perspective with studio lighting creating strong highlights on the hood and body lines.`,
  },
  {
    key: 'EXT_ELEVATED_FRONT',
    label: 'Elevated Front',
    labelDe: 'Erhöhte Frontansicht',
    defaultSelected: false,
    category: 'exterior',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Elevated front 3/4 view from above. Camera positioned approximately 2-3 meters above ground, looking down at the hood, windshield, and roof. Shows the vehicle's top profile and front design from a bird's-eye angle.\n\nSCENE: PROVIDED SHOWROOM environment. Company Logo on background wall. Lighting from above emphasizing roof and hood lines.`,
  },
  // ── Interior ──
  {
    key: 'INT_DASHBOARD',
    label: 'Dashboard',
    labelDe: 'Armaturenbrett',
    defaultSelected: true,
    category: 'interior',
    prompt:
      `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Driver's seat perspective looking forward at the steering wheel, instrument cluster, and full dashboard. CRITICAL: Do NOT rotate or flip the perspective. The steering wheel must be on the correct side (left for LHD, right for RHD) as in the reference photos.\n\nThe Company Logo may be subtly visible through the windshield on the showroom wall outside.`,
  },
  {
    key: 'INT_CENTER_CONSOLE',
    label: 'Center Console',
    labelDe: 'Mittelkonsole',
    defaultSelected: true,
    category: 'interior',
    prompt:
      `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Macro close-up of the center console from slightly above. Show the gear selector, cup holders, armrest controls, infotainment screen, and climate controls in sharp detail. Reproduce exact button layouts, screen UI, and material textures.`,
  },
  {
    key: 'INT_REAR_SEATS',
    label: 'Rear Seats',
    labelDe: 'Rücksitzbank',
    defaultSelected: false,
    category: 'interior',
    prompt:
      `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Looking from the front headrests backward at the rear seats. Show legroom, seat materials, rear center armrest, and rear amenities. Do NOT rotate or change the perspective direction.`,
  },
  {
    key: 'INT_WIDE_CABIN',
    label: 'Wide Cabin View',
    labelDe: 'Kabinen-Übersicht',
    defaultSelected: false,
    category: 'interior',
    prompt:
      `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Wide-angle view of the full front cabin from the center of the rear seat area. Show the entire dashboard span, both front seats, center console, and windshield. The Company Logo may be visible through the windshield. Maintain exact interior layout as in reference photos.`,
  },
  // ── Details ──
  {
    key: 'DET_HEADLIGHT',
    label: 'Headlight',
    labelDe: 'Scheinwerfer',
    defaultSelected: true,
    category: 'detail',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Macro close-up of the front headlight assembly. Fill 60-70% of the frame with the headlight.\n\nDETAIL REQUIREMENTS: Reproduce the EXACT internal LED module arrangement, DRL (daytime running light) signature pattern, projector lens shape, reflector geometry, and housing material from the reference photos. Every LED strip, chrome accent, and lens texture must match precisely. Do NOT simplify the internal structure.\n\nLIGHTING: High-contrast studio lighting that reveals internal textures. Solid or highly blurred showroom background.`,
  },
  {
    key: 'DET_TAILLIGHT',
    label: 'Taillight',
    labelDe: 'Rücklicht',
    defaultSelected: true,
    category: 'detail',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Macro close-up of the rear taillight assembly. Fill 60-70% of the frame with the taillight.\n\nDETAIL REQUIREMENTS: Reproduce the EXACT LED element arrangement, light signature pattern, 3D internal structure, lens material (clear, smoked, red), and housing design from the reference photos. Every individual LED bar, animation channel, and reflector must match precisely.\n\nLIGHTING: High-contrast studio lighting against blurred showroom background.`,
  },
  {
    key: 'DET_WHEEL',
    label: 'Wheel / Rim',
    labelDe: 'Felge',
    defaultSelected: true,
    category: 'detail',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Ultra-sharp close-up of the front wheel. Fill 60-70% of frame with the wheel.\n\nDETAIL REQUIREMENTS: Reproduce the EXACT rim design from the reference photos – exact spoke count, spoke shape (Y-spoke, multi-spoke, turbine, etc.), concavity depth, finish type (polished, matte silver, gloss black, diamond-cut bi-color), center cap design with brand logo, lug nut pattern, and any colored accents. Show exact tire profile, sidewall text/branding, and brake caliper (color, shape, brand marking) if visible in reference. Do NOT substitute a different rim design.\n\nLIGHTING: High-contrast studio lighting. Blurred showroom background.`,
  },
  {
    key: 'DET_GRILLE',
    label: 'Grille / Badge',
    labelDe: 'Kühlergrill & Emblem',
    defaultSelected: false,
    category: 'detail',
    prompt:
      `${IDENTITY_LOCK}\n\nPERSPECTIVE: Close-up of the front grille and central badge/emblem.\n\nDETAIL REQUIREMENTS: Reproduce the EXACT grille mesh pattern (honeycomb, horizontal slats, diamond pattern, etc.), chrome/black finish, badge shape, badge material (chrome, colored enamel), and any model designation lettering visible on the grille surround. Match the exact font, size, and position of any text.\n\nLIGHTING: High-contrast studio lighting emphasizing material textures and chrome reflections. Blurred showroom background.`,
  },
  // ── Composite / Grid Images ──
  {
    key: 'GRID_EXTERIOR_4',
    label: 'Exterior Grid (4 views)',
    labelDe: 'Exterieur-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt:
      `${IDENTITY_LOCK}\n\nLAYOUT: Photorealistic 2×2 image grid. Top-left: front-left 3/4 view. Top-right: direct left side profile. Bottom-left: rear-left 3/4 view. Bottom-right: direct rear view.\n\nRULES: All 4 cells show the COMPLETE, IDENTICAL vehicle in the SAME PROVIDED SHOWROOM with consistent lighting and floor. Thin white divider between cells. Company Logo visible on showroom wall. Each cell must show the full car with no cropping.`,
  },
  {
    key: 'GRID_HIGHLIGHTS_6',
    label: 'Highlights Grid (6 views)',
    labelDe: 'Highlight-Grid (6 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt:
      `${IDENTITY_LOCK}\n\nLAYOUT: Photorealistic 3×2 image grid. Row 1: front-left 3/4 hero shot | left side profile | rear-left 3/4 view. Row 2: headlight macro close-up | dashboard interior | wheel/rim close-up.\n\nRULES: All cells show the IDENTICAL vehicle. Exterior cells use the SAME PROVIDED SHOWROOM with consistent lighting. Interior/detail cells use appropriate close-up framing. Thin white dividers. Company Logo on background wall.`,
  },
  {
    key: 'GRID_INTERIOR_4',
    label: 'Interior Grid (4 views)',
    labelDe: 'Interieur-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt:
      `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nLAYOUT: Photorealistic 2×2 image grid. Top-left: full dashboard from driver seat. Top-right: center console close-up with infotainment screen. Bottom-left: rear seats from front perspective. Bottom-right: steering wheel close-up.\n\nRULES: All cells show the IDENTICAL vehicle interior. Consistent professional interior lighting. Thin white dividers. Do NOT rotate or flip any perspective.`,
  },
  {
    key: 'GRID_SOCIAL_MEDIA',
    label: 'Social Media Collage',
    labelDe: 'Social-Media-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt:
      `${IDENTITY_LOCK}\n\nLAYOUT: Social-media-ready collage. One large hero image (front-left 3/4) taking 60% of the canvas on the left. 3 smaller images stacked vertically on the right: side profile, interior dashboard, and wheel detail.\n\nRULES: All images show the IDENTICAL vehicle. PROVIDED SHOWROOM environment. Company Logo watermark. Modern, clean layout with thin dividers.`,
  },

  // ══════════════════════════════════════════════
  // ── CI / Corporate Identity Brand Pipelines ──
  // ══════════════════════════════════════════════

  // ── BMW CI ──
  { key: 'CI_BMW_34_FRONT', label: 'BMW CI – 3/4 Front', labelDe: 'BMW CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\nBMW Corporate Identity photography. PERSPECTIVE: Front-left 3/4 view at eye level with the BMW kidney grille clearly visible and centered. The headlight design, kidney grille slats, and front bumper air intakes must match the reference photos exactly.\n\nSCENE: Clean white/grey studio background. BMW corporate lighting: strong key light from front-left, soft fill from right, creating defined highlights on body lines. Polished floor with subtle reflections.` },
  { key: 'CI_BMW_SIDE', label: 'BMW CI – Side Profile', labelDe: 'BMW CI – Seite', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\nBMW Corporate Identity photography. PERSPECTIVE: Direct left side profile, perfectly flat/perpendicular to the car body. Both left wheels fully visible with exact rim design from reference. BMW logo visible on center caps.\n\nSCENE: Clean white/grey studio background. Even lighting highlighting the Hofmeister kink and body lines.` },
  { key: 'CI_BMW_34_REAR', label: 'BMW CI – 3/4 Rear', labelDe: 'BMW CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\nBMW Corporate Identity photography. PERSPECTIVE: Rear-left 3/4 view showing the BMW roundel badge, exact taillight design, exhaust outlet shape and finish, and rear diffuser from reference. Clean white/grey studio.` },
  { key: 'CI_BMW_REAR', label: 'BMW CI – Rear', labelDe: 'BMW CI – Heck', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\nBMW Corporate Identity photography. PERSPECTIVE: Direct rear view, perfectly centered, showing full width of taillights, exhaust configuration, rear badge, and model designation lettering exactly as in reference. Clean white/grey studio.` },
  { key: 'CI_BMW_GRILLE', label: 'BMW CI – Grille Detail', labelDe: 'BMW CI – Kühlergrill', defaultSelected: false, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\nBMW Corporate Identity detail. Close-up of the BMW kidney grille with headlights. Reproduce exact grille slat pattern, surround finish, BMW roundel badge, and headlight internal LED structure from reference. High-contrast studio lighting.` },
  { key: 'CI_BMW_INTERIOR', label: 'BMW CI – Interior', labelDe: 'BMW CI – Innenraum', defaultSelected: false, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nBMW Corporate Identity interior. Dashboard from driver perspective showing exact iDrive/curved display, instrument cluster, steering wheel buttons, and ambient lighting from reference. Professional interior lighting.` },
  { key: 'CI_BMW_WHEEL', label: 'BMW CI – Wheel', labelDe: 'BMW CI – Felge', defaultSelected: false, category: 'ci', brand: 'bmw', prompt: `${IDENTITY_LOCK}\n\nBMW Corporate Identity detail. Wheel and brake caliper close-up. Reproduce exact rim spoke design, finish, BMW center cap, and brake caliper color/shape from reference. Studio lighting with blurred background.` },

  // ── Mercedes-Benz CI ──
  { key: 'CI_MERCEDES_34_FRONT', label: 'Mercedes CI – 3/4 Front', labelDe: 'Mercedes CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\nMercedes-Benz Corporate Identity photography. PERSPECTIVE: Front-left 3/4 view emphasizing the three-pointed star emblem and radiator grille design from reference. Reproduce exact grille pattern (diamond/louvre/Panamericana) and headlight internals.\n\nSCENE: Elegant studio with subtle gradient background. Mercedes signature lighting: soft, even, premium.` },
  { key: 'CI_MERCEDES_SIDE', label: 'Mercedes CI – Side', labelDe: 'Mercedes CI – Seite', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\nMercedes-Benz CI. Direct left side profile showing the full body silhouette, chrome window surrounds, and exact wheel design from reference. Subtle gradient studio background.` },
  { key: 'CI_MERCEDES_34_REAR', label: 'Mercedes CI – 3/4 Rear', labelDe: 'Mercedes CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\nMercedes-Benz CI. Rear-left 3/4 view highlighting the exact LED light strip design, star badge, exhaust configuration, and rear diffuser from reference. Elegant studio.` },
  { key: 'CI_MERCEDES_FRONT', label: 'Mercedes CI – Front', labelDe: 'Mercedes CI – Front', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\nMercedes-Benz CI. Direct front view, perfectly centered, showcasing the three-pointed star and exact grille design from reference. Even studio lighting.` },
  { key: 'CI_MERCEDES_MBUX', label: 'Mercedes CI – MBUX', labelDe: 'Mercedes CI – MBUX', defaultSelected: false, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nMercedes-Benz CI detail. MBUX hyperscreen/infotainment close-up from driver seat. Reproduce exact screen layout, UI design, turbine air vents, and ambient lighting from reference. Premium interior photography.` },
  { key: 'CI_MERCEDES_GRILLE', label: 'Mercedes CI – Grille', labelDe: 'Mercedes CI – Kühlergrill', defaultSelected: false, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\nMercedes-Benz CI detail. Front grille and star emblem macro shot. Reproduce exact grille pattern, chrome textures, and LED headlight internal structure from reference. Studio lighting.` },
  { key: 'CI_MERCEDES_WHEEL', label: 'Mercedes CI – Wheel', labelDe: 'Mercedes CI – Felge', defaultSelected: false, category: 'ci', brand: 'mercedes', prompt: `${IDENTITY_LOCK}\n\nMercedes-Benz CI detail. Wheel with exact AMG/standard rim design and brake caliper from reference. Star center cap visible. Studio lighting.` },

  // ── Audi CI ──
  { key: 'CI_AUDI_34_FRONT', label: 'Audi CI – 3/4 Front', labelDe: 'Audi CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'audi', prompt: `${IDENTITY_LOCK}\n\nAudi Corporate Identity photography. Front-left 3/4 view with exact Singleframe grille pattern and four rings emblem from reference. Reproduce exact headlight internals (matrix LED, DRL signature). Clean, bright studio with minimal shadows.` },
  { key: 'CI_AUDI_SIDE', label: 'Audi CI – Side', labelDe: 'Audi CI – Seite', defaultSelected: true, category: 'ci', brand: 'audi', prompt: `${IDENTITY_LOCK}\n\nAudi CI. Perfect left side profile highlighting exact body lines, wheel design, and Audi design DNA from reference. Clean bright studio.` },
  { key: 'CI_AUDI_34_REAR', label: 'Audi CI – 3/4 Rear', labelDe: 'Audi CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'audi', prompt: `${IDENTITY_LOCK}\n\nAudi CI. Rear-left 3/4 view showing exact connected LED light strip design and Audi four rings badge from reference. Clean studio.` },
  { key: 'CI_AUDI_REAR', label: 'Audi CI – Rear', labelDe: 'Audi CI – Heck', defaultSelected: true, category: 'ci', brand: 'audi', prompt: `${IDENTITY_LOCK}\n\nAudi CI. Direct rear view centered on the exact full-width LED light bar design and Audi lettering from reference. Bright studio background.` },

  // ── Volkswagen CI ──
  { key: 'CI_VW_34_FRONT', label: 'VW CI – 3/4 Front', labelDe: 'VW CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: `${IDENTITY_LOCK}\n\nVolkswagen Corporate Identity photography. Front-left 3/4 view with exact VW logo and IQ.Light LED headlight design from reference. Clean, modern white studio. Friendly, approachable lighting.` },
  { key: 'CI_VW_SIDE', label: 'VW CI – Side', labelDe: 'VW CI – Seite', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: `${IDENTITY_LOCK}\n\nVW CI. Left side profile showing exact body lines and wheel design from reference. Modern white studio.` },
  { key: 'CI_VW_34_REAR', label: 'VW CI – 3/4 Rear', labelDe: 'VW CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: `${IDENTITY_LOCK}\n\nVW CI. Rear-left 3/4 view with exact VW logo, taillight design, and model lettering from reference. White studio.` },
  { key: 'CI_VW_FRONT', label: 'VW CI – Front', labelDe: 'VW CI – Front', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: `${IDENTITY_LOCK}\n\nVW CI. Direct front view centered on exact VW badge and light signature from reference. White studio.` },

  // ── Porsche CI ──
  { key: 'CI_PORSCHE_34_FRONT', label: 'Porsche CI – 3/4 Front', labelDe: 'Porsche CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: `${IDENTITY_LOCK}\n\nPorsche Corporate Identity photography. Front-left 3/4 view emphasizing the exact headlight design, front bumper air intakes, and Porsche crest from reference. Dark dramatic studio with controlled highlights on body lines.` },
  { key: 'CI_PORSCHE_SIDE', label: 'Porsche CI – Side', labelDe: 'Porsche CI – Seite', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: `${IDENTITY_LOCK}\n\nPorsche CI. Left side profile capturing exact sports car proportions and wheel design from reference. Dark dramatic studio with rim focus.` },
  { key: 'CI_PORSCHE_34_REAR', label: 'Porsche CI – 3/4 Rear', labelDe: 'Porsche CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: `${IDENTITY_LOCK}\n\nPorsche CI. Rear-left 3/4 view showing exact rear light bar design, PORSCHE lettering, and exhaust layout from reference. Dramatic lighting.` },
  { key: 'CI_PORSCHE_LOW', label: 'Porsche CI – Low Angle', labelDe: 'Porsche CI – Low-Angle', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: `${IDENTITY_LOCK}\n\nPorsche CI. Low-angle front view emphasizing power and stance. Camera at ground level looking up at the front. Exact front design from reference. Dark studio, dramatic key light.` },

  // ── Volvo CI ──
  // Standard Views (7)
  { key: 'CI_VOLVO_34_FRONT_LEFT', label: 'Volvo CI – 3/4 Front Left', labelDe: 'Volvo CI – 3/4 Front Links', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: 3/4 front-left view. Camera at front-left of the vehicle looking at front-left quarter.\n\nENVIRONMENT: Minimalist high-tech showroom with highly reflective dark polished resin floor. Large seamless frosted glass panels illuminated from behind with soft diffused cool-white gradient light creating infinite depth. No humans, no other vehicles. License plates blank and body-colored.\n\nDETAIL: Replicate exact headlight DRL signatures, front grille shape/mesh/texture, wheel spoke pattern, body contours from reference with absolute precision. Interior subtly visible through windows. Premium magazine quality.` },
  { key: 'CI_VOLVO_34_FRONT_RIGHT', label: 'Volvo CI – 3/4 Front Right', labelDe: 'Volvo CI – 3/4 Front Rechts', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: 3/4 front-right view. Camera at front-right of the vehicle looking at front-right quarter. This is NOT a left-side view.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels with cool-white gradient. No humans. License plates blank.\n\nDETAIL: Replicate exact headlight DRL signatures, grille mesh, wheel design, body lines from reference with microscopic accuracy.` },
  { key: 'CI_VOLVO_34_REAR_LEFT', label: 'Volvo CI – 3/4 Rear Left', labelDe: 'Volvo CI – 3/4 Heck Links', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: 3/4 rear-left view. Camera behind and to the left, showing rear-left quarter.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels.\n\nDETAIL: Replicate exact taillight internal structure, LED signatures, wheel design, body contours from reference with microscopic accuracy.` },
  { key: 'CI_VOLVO_34_REAR_RIGHT', label: 'Volvo CI – 3/4 Rear Right', labelDe: 'Volvo CI – 3/4 Heck Rechts', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: 3/4 rear-right view. Camera behind and to the right, showing rear-right quarter.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark resin floor and frosted glass panels.\n\nDETAIL: Replicate exact taillights, wheels, body contours from reference with microscopic accuracy.` },
  { key: 'CI_VOLVO_SIDE', label: 'Volvo CI – Side', labelDe: 'Volvo CI – Seite', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Flat right (passenger) side profile, perpendicular to the car body.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark resin floor and frosted glass panels.\n\nDETAIL: Replicate exact body lines, wheel design, window trim, and proportions from reference with microscopic accuracy.` },
  { key: 'CI_VOLVO_FRONT', label: 'Volvo CI – Front', labelDe: 'Volvo CI – Front', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Direct flat front view, perfectly centered.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark resin floor and frosted glass panels.\n\nDETAIL: Replicate exact headlight DRL signatures, Thor's Hammer design, grille mesh pattern, Volvo Iron Mark badge, body contours from reference with microscopic accuracy.` },
  { key: 'CI_VOLVO_REAR', label: 'Volvo CI – Rear', labelDe: 'Volvo CI – Heck', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Direct flat rear view, perfectly centered.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark resin floor and frosted glass panels.\n\nDETAIL: Replicate exact taillight internal structure, LED C-shaped signatures, VOLVO lettering, rear badges, body contours from reference with microscopic accuracy.` },

  // Interior (5)
  { key: 'CI_VOLVO_INT_PASSENGER', label: 'Volvo CI – Interior Passenger', labelDe: 'Volvo CI – Innenraum Beifahrer', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Front interior from open passenger door looking toward dashboard, center console, steering wheel, and driver seat. Showroom visible through windows.\n\nDETAIL: Replicate exact leather grain texture, stitching, trim materials (open-pore wood, metal mesh, piano black), button layout, infotainment UI, instrument cluster, gear selector from reference. LHD configuration. Premium magazine quality.` },
  { key: 'CI_VOLVO_INT_CENTER', label: 'Volvo CI – Interior Center', labelDe: 'Volvo CI – Innenraum Mitte', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Between front seats looking forward at dashboard and center console. Showroom visible through windows.\n\nDETAIL: Replicate exact materials, button arrays, steering wheel controls, instrument cluster, pedals, gear selector from reference with microscopic accuracy. LHD configuration.` },
  { key: 'CI_VOLVO_INT_REAR', label: 'Volvo CI – Rear Seats', labelDe: 'Volvo CI – Rücksitze', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: From open rear passenger door looking at rear seats, legroom, and rear center console. Showroom visible through windows.\n\nDETAIL: Replicate exact seat material, stitching, rear center console controls, rear air vents from reference. LHD configuration.` },
  { key: 'CI_VOLVO_INT_BOOT', label: 'Volvo CI – Open Boot', labelDe: 'Volvo CI – Kofferraum', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Straight-on exterior view with tailgate fully open, looking into cargo space. Showroom environment.\n\nDETAIL: Replicate exact cargo floor texture, sidewalls, load-bearing lip, cargo net hooks, rear-seat release handles from reference. Surrounding exterior panels and taillights perfectly matched.` },
  { key: 'CI_VOLVO_INT_STEERING', label: 'Volvo CI – Steering Wheel', labelDe: 'Volvo CI – Lenkrad', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\n${INTERIOR_RULES}\n\nPERSPECTIVE: Tight macro shot of steering wheel, central horn pad, and surrounding stalks. Complete steering wheel visible. Showroom visible through windshield.\n\nDETAIL: Replicate exact steering wheel hub texture, button iconography on left/right spokes (media, cruise control, voice), paddle shifters if present, center Volvo Iron Mark logo from reference. LHD configuration.` },

  // Detail (3)
  { key: 'CI_VOLVO_DET_CLUSTER', label: 'Volvo CI – Instrument Cluster', labelDe: 'Volvo CI – Instrumenten-Display', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Tight macro shot of digital instrument cluster behind steering wheel.\n\nDETAIL: Replicate exact UI layout including digital gauges, central display, warning light placements from reference. All text and iconography sharp and legible. Surrounding cluster bezel material detailed. LHD configuration.` },
  { key: 'CI_VOLVO_DET_SCREEN', label: 'Volvo CI – Center Screen', labelDe: 'Volvo CI – Zentraldisplay', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Tight macro shot of main center dashboard screen and surrounding controls.\n\nDETAIL: Replicate exact screen orientation (portrait/vertical for Volvo), bezel design, UI layout with app icons, climate overlay. Surrounding air vents, physical buttons, dash material texture from reference. LHD configuration.` },
  { key: 'CI_VOLVO_DET_WHEEL', label: 'Volvo CI – Wheel Detail', labelDe: 'Volvo CI – Felge Detail', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: `${IDENTITY_LOCK}\n\nPERSPECTIVE: Macro close-up of wheel, alloy rim, and surrounding fender.\n\nENVIRONMENT: Minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels.\n\nDETAIL: Replicate exact multi-spoke alloy design, spoke pattern, concavity, lug nut configuration, center cap, metallic/machined finish from reference with absolute precision. Reproduce visible brake calipers, rotor pattern, tire sidewall texture. Surrounding fender body contours and paint color perfectly matched. Depth of field: rim sharp, wheel well falls to shadow.` },
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
