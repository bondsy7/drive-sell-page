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

export const PIPELINE_JOBS: PipelineJob[] = [
  // ── Hero ──
  {
    key: 'MASTER_IMAGE',
    label: 'Master Image',
    labelDe: 'Master-Bild',
    defaultSelected: true,
    category: 'hero',
    prompt:
      'Create a single photorealistic 8K image of the EXACT vehicle from the provided reference photos. Position the car in the PROVIDED SHOWROOM environment. Camera: Front-left 3/4 perspective at eye level, full-frame layout. The Company Logo MUST be physically integrated onto a large background feature wall behind the car with realistic 3D properties, perspective skew and reflections. Do NOT modify the car body color, rims, or accessories. No humans. Clean luxury studio lighting with realistic floor reflections.',
  },
  // ── Exterior individual perspectives ──
  {
    key: 'EXT_FRONT',
    label: 'Front View',
    labelDe: 'Frontansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Direct head-on front view at eye level, centered in frame. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Realistic floor reflections and showroom lighting. No humans.',
  },
  {
    key: 'EXT_REAR',
    label: 'Rear View',
    labelDe: 'Heckansicht',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Direct rear view at eye level, centered in frame showing taillights, exhaust, and rear badge. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Realistic shadows and lighting. No humans.',
  },
  {
    key: 'EXT_SIDE_LEFT',
    label: 'Left Side',
    labelDe: 'Linke Seite',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Perfect left side profile view, completely flat/perpendicular to the car body. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Highlight body lines and wheel design. No humans.',
  },
  {
    key: 'EXT_SIDE_RIGHT',
    label: 'Right Side',
    labelDe: 'Rechte Seite',
    defaultSelected: false,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Perfect right side profile view, completely flat/perpendicular to the car body. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is visible on the background wall. Highlight body lines and wheel design. No humans.',
  },
  {
    key: 'EXT_34_FRONT_RIGHT',
    label: '3/4 Front Right',
    labelDe: '3/4 Vorne Rechts',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Front-right 3/4 perspective at eye level. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the background wall with correct perspective. Realistic lighting and reflections. No humans.',
  },
  {
    key: 'EXT_34_REAR_LEFT',
    label: '3/4 Rear Left',
    labelDe: '3/4 Hinten Links',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Rear-left 3/4 perspective at eye level showing the rear quarter and side. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the wall behind. Dramatic lighting emphasizing body contours. No humans.',
  },
  {
    key: 'EXT_34_REAR_RIGHT',
    label: '3/4 Rear Right',
    labelDe: '3/4 Hinten Rechts',
    defaultSelected: false,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Rear-right 3/4 perspective at eye level. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the wall with correct perspective. Smooth showroom lighting. No humans.',
  },
  {
    key: 'EXT_LOW_ANGLE',
    label: 'Low Angle Hero',
    labelDe: 'Low-Angle Hero',
    defaultSelected: true,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Low-angle hero shot from the ground level looking up at the front bumper and grille. Place the car in the PROVIDED SHOWROOM environment. Dramatic perspective making the car look powerful and imposing. The Company Logo visible on the background wall. No humans.',
  },
  {
    key: 'EXT_ELEVATED_FRONT',
    label: 'Elevated Front',
    labelDe: 'Erhöhte Frontansicht',
    defaultSelected: false,
    category: 'exterior',
    prompt:
      'Create a single photorealistic image of the EXACT vehicle from the reference photos. Elevated front 3/4 view looking down at the hood and windshield from above. Place the car in the PROVIDED SHOWROOM environment. The Company Logo is on the wall. Bird-eye perspective showing roof and bonnet lines. No humans.',
  },
  // ── Interior ──
  {
    key: 'INT_DASHBOARD',
    label: 'Dashboard',
    labelDe: 'Armaturenbrett',
    defaultSelected: true,
    category: 'interior',
    prompt:
      "Create a single photorealistic image of the EXACT vehicle interior from the reference photos. Driver's seat perspective looking at the steering wheel and full dashboard. Maintain every interior detail exactly as in reference. Bright, even professional lighting. CRITICAL: Do NOT rotate or flip the perspective. The Company Logo is subtly visible through the windshield on the showroom wall outside. No humans.",
  },
  {
    key: 'INT_CENTER_CONSOLE',
    label: 'Center Console',
    labelDe: 'Mittelkonsole',
    defaultSelected: true,
    category: 'interior',
    prompt:
      'Create a single photorealistic macro close-up of the center console and infotainment screen of the EXACT vehicle from the reference photos. Show gear selector, controls, and screen in sharp detail. Professional interior lighting. Do NOT change any interior element. No humans.',
  },
  {
    key: 'INT_REAR_SEATS',
    label: 'Rear Seats',
    labelDe: 'Rücksitzbank',
    defaultSelected: false,
    category: 'interior',
    prompt:
      'Create a single photorealistic image from the front looking back at the rear seats of the EXACT vehicle from the reference photos. Show legroom, seat materials, and rear amenities. Clean professional lighting. Do NOT rotate or change perspective. No humans.',
  },
  {
    key: 'INT_WIDE_CABIN',
    label: 'Wide Cabin View',
    labelDe: 'Kabinen-Übersicht',
    defaultSelected: false,
    category: 'interior',
    prompt:
      'Create a single photorealistic wide-angle view of the full front cabin from the center of the rear seats of the EXACT vehicle. Show the entire dashboard, both front seats, and windshield. Maintain exact interior details. The Company Logo is visible through the windshield on the showroom wall. Professional even lighting. No humans.',
  },
  // ── Details ──
  {
    key: 'DET_HEADLIGHT',
    label: 'Headlight',
    labelDe: 'Scheinwerfer',
    defaultSelected: true,
    category: 'detail',
    prompt:
      'Create a single photorealistic macro close-up of the front headlight of the EXACT vehicle from the reference photos. Reveal internal LED textures, DRL signatures, and lens details. High-contrast studio lighting. Solid or highly blurred showroom background. No humans.',
  },
  {
    key: 'DET_TAILLIGHT',
    label: 'Taillight',
    labelDe: 'Rücklicht',
    defaultSelected: true,
    category: 'detail',
    prompt:
      'Create a single photorealistic macro close-up of the rear taillight signature pattern of the EXACT vehicle from the reference photos. Show LED elements and light design in detail. High-contrast studio lighting against blurred showroom background. No humans.',
  },
  {
    key: 'DET_WHEEL',
    label: 'Wheel / Rim',
    labelDe: 'Felge',
    defaultSelected: true,
    category: 'detail',
    prompt:
      'Create a single photorealistic ultra-sharp close-up of the front wheel of the EXACT vehicle from the reference photos. Match the exact rim design without distortion. Show tire profile and brake caliper if visible. High-contrast studio lighting. Blurred showroom background. No humans.',
  },
  {
    key: 'DET_GRILLE',
    label: 'Grille / Badge',
    labelDe: 'Kühlergrill & Emblem',
    defaultSelected: false,
    category: 'detail',
    prompt:
      'Create a single photorealistic close-up of the front grille mesh and central badge of the EXACT vehicle from the reference photos. Show chrome/material textures in detail. High-contrast studio lighting emphasizing materials. Blurred showroom background. No humans.',
  },
  // ── Composite / Grid Images ──
  {
    key: 'GRID_EXTERIOR_4',
    label: 'Exterior Grid (4 views)',
    labelDe: 'Exterieur-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt:
      'Create a photorealistic 2x2 image grid of the EXACT vehicle from the reference photos. Top-left: front 3/4 view. Top-right: direct side profile. Bottom-left: rear 3/4 view. Bottom-right: direct rear view. All in the same PROVIDED SHOWROOM environment with consistent lighting. Each cell shows the complete car. Thin white divider between cells. Company Logo visible on the showroom wall. No humans.',
  },
  {
    key: 'GRID_HIGHLIGHTS_6',
    label: 'Highlights Grid (6 views)',
    labelDe: 'Highlight-Grid (6 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt:
      'Create a photorealistic 3x2 image grid of the EXACT vehicle from the reference photos. Row 1: front 3/4 hero shot | side profile | rear 3/4 view. Row 2: headlight close-up | dashboard interior | wheel/rim close-up. All images in the same PROVIDED SHOWROOM with consistent lighting. Thin white dividers between cells. Company Logo on background wall. No humans.',
  },
  {
    key: 'GRID_INTERIOR_4',
    label: 'Interior Grid (4 views)',
    labelDe: 'Interieur-Grid (4 Ansichten)',
    defaultSelected: false,
    category: 'composite',
    prompt:
      'Create a photorealistic 2x2 image grid of the EXACT vehicle interior from the reference photos. Top-left: full dashboard from driver seat. Top-right: center console close-up with infotainment. Bottom-left: rear seats from front. Bottom-right: steering wheel close-up. Consistent professional interior lighting. Thin white dividers. Do NOT rotate or flip any perspective. No humans.',
  },
  {
    key: 'GRID_SOCIAL_MEDIA',
    label: 'Social Media Collage',
    labelDe: 'Social-Media-Collage',
    defaultSelected: false,
    category: 'composite',
    prompt:
      'Create a single photorealistic social-media-ready collage of the EXACT vehicle from the reference photos. One large hero image (front 3/4) taking 60% of the canvas on the left, with 3 smaller images stacked vertically on the right: side profile, interior dashboard, and wheel detail. PROVIDED SHOWROOM environment. Company Logo watermark. Modern, clean layout. No humans.',
  },

  // ══════════════════════════════════════════════
  // ── CI / Corporate Identity Brand Pipelines ──
  // ══════════════════════════════════════════════
  // These are brand-specific jobs that automatically appear when the
  // detected brand matches. Each CI job generates multiple images
  // (outputCount > 1) following manufacturer photography guidelines.

  // ══════════════════════════════════════════════
  // ── BMW CI (individual jobs) ──
  // ══════════════════════════════════════════════
  { key: 'CI_BMW_34_FRONT', label: 'BMW CI – 3/4 Front', labelDe: 'BMW CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity photography: Front 3/4 view at eye level with the BMW kidney grille clearly visible and centered. Clean white/grey studio background. BMW corporate lighting setup with strong key light from front-left.' },
  { key: 'CI_BMW_SIDE', label: 'BMW CI – Side Profile', labelDe: 'BMW CI – Seite', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity photography: Direct side profile, perfectly flat/perpendicular. Wheels at 20° angle showing BMW logo on center caps. Clean white/grey studio background.' },
  { key: 'CI_BMW_34_REAR', label: 'BMW CI – 3/4 Rear', labelDe: 'BMW CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity photography: Rear 3/4 view showing the BMW roundel badge, exhaust outlets, and rear light bar. Clean white/grey studio background.' },
  { key: 'CI_BMW_REAR', label: 'BMW CI – Rear', labelDe: 'BMW CI – Heck', defaultSelected: true, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity photography: Direct rear view, centered, showing full width of taillights, exhaust, and rear badge. Clean white/grey studio background.' },
  { key: 'CI_BMW_GRILLE', label: 'BMW CI – Grille Detail', labelDe: 'BMW CI – Kühlergrill', defaultSelected: false, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity detail photography: Close-up of the BMW kidney grille with angel-eye/adaptive LED headlights. Emphasize the BMW roundel badge. High-contrast studio lighting on clean background.' },
  { key: 'CI_BMW_INTERIOR', label: 'BMW CI – Interior', labelDe: 'BMW CI – Innenraum', defaultSelected: false, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity detail photography: Dashboard and iDrive infotainment system from driver perspective. Show BMW curved display and ambient lighting. Professional interior lighting.' },
  { key: 'CI_BMW_WHEEL', label: 'BMW CI – Wheel', labelDe: 'BMW CI – Felge', defaultSelected: false, category: 'ci', brand: 'bmw', prompt: 'BMW Corporate Identity detail photography: Wheel and M-Sport brake caliper close-up. Show exact rim design and BMW center cap. Studio lighting with blurred background.' },

  // ── Mercedes-Benz CI (individual jobs) ──
  { key: 'CI_MERCEDES_34_FRONT', label: 'Mercedes CI – 3/4 Front', labelDe: 'Mercedes CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity photography: Front 3/4 view emphasizing the star emblem and radiator grille. Elegant studio with subtle gradient background. Mercedes signature lighting: soft, even, premium.' },
  { key: 'CI_MERCEDES_SIDE', label: 'Mercedes CI – Side', labelDe: 'Mercedes CI – Seite', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity photography: Side profile showing the full body silhouette and chrome details. Subtle gradient studio background.' },
  { key: 'CI_MERCEDES_34_REAR', label: 'Mercedes CI – 3/4 Rear', labelDe: 'Mercedes CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity photography: Rear 3/4 view highlighting the LED light strip, star badge, and exhaust. Elegant studio.' },
  { key: 'CI_MERCEDES_FRONT', label: 'Mercedes CI – Front', labelDe: 'Mercedes CI – Front', defaultSelected: true, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity photography: Direct front view, perfectly centered, showcasing the three-pointed star and grille design. Even studio lighting.' },
  { key: 'CI_MERCEDES_MBUX', label: 'Mercedes CI – MBUX', labelDe: 'Mercedes CI – MBUX', defaultSelected: false, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity detail: MBUX hyperscreen/infotainment close-up from driver seat. Show digital cockpit and ambient lighting. Premium interior photography.' },
  { key: 'CI_MERCEDES_GRILLE', label: 'Mercedes CI – Grille', labelDe: 'Mercedes CI – Kühlergrill', defaultSelected: false, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity detail: Front grille and star emblem macro shot. Show chrome textures and LED headlight internals. Studio lighting.' },
  { key: 'CI_MERCEDES_WHEEL', label: 'Mercedes CI – Wheel', labelDe: 'Mercedes CI – Felge', defaultSelected: false, category: 'ci', brand: 'mercedes', prompt: 'Mercedes-Benz Corporate Identity detail: Wheel with AMG/standard rim design and brake caliper. Star center cap visible. Studio lighting.' },

  // ── Audi CI (individual jobs) ──
  { key: 'CI_AUDI_34_FRONT', label: 'Audi CI – 3/4 Front', labelDe: 'Audi CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'audi', prompt: 'Audi Corporate Identity photography: Front 3/4 view with Singleframe grille and four rings emblem clearly visible. Audi-signature clean, bright studio with minimal shadows.' },
  { key: 'CI_AUDI_SIDE', label: 'Audi CI – Side', labelDe: 'Audi CI – Seite', defaultSelected: true, category: 'ci', brand: 'audi', prompt: 'Audi Corporate Identity photography: Perfect side profile highlighting Audi design DNA with Tornado line. Clean bright studio.' },
  { key: 'CI_AUDI_34_REAR', label: 'Audi CI – 3/4 Rear', labelDe: 'Audi CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'audi', prompt: 'Audi Corporate Identity photography: Rear 3/4 view showing connected LED light strip and Audi four rings badge. Clean studio.' },
  { key: 'CI_AUDI_REAR', label: 'Audi CI – Rear', labelDe: 'Audi CI – Heck', defaultSelected: true, category: 'ci', brand: 'audi', prompt: 'Audi Corporate Identity photography: Direct rear view centered on the full-width LED light bar and Audi lettering. Bright studio background.' },

  // ── Volkswagen CI (individual jobs) ──
  { key: 'CI_VW_34_FRONT', label: 'VW CI – 3/4 Front', labelDe: 'VW CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: 'Volkswagen Corporate Identity photography: Front 3/4 view with VW logo and IQ.Light LED headlights prominent. Clean, modern white studio. Friendly, approachable lighting setup.' },
  { key: 'CI_VW_SIDE', label: 'VW CI – Side', labelDe: 'VW CI – Seite', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: 'Volkswagen Corporate Identity photography: Side profile showing clean body lines and wheel design. Modern white studio.' },
  { key: 'CI_VW_34_REAR', label: 'VW CI – 3/4 Rear', labelDe: 'VW CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: 'Volkswagen Corporate Identity photography: Rear 3/4 view with VW logo, taillights, and lettering visible. White studio.' },
  { key: 'CI_VW_FRONT', label: 'VW CI – Front', labelDe: 'VW CI – Front', defaultSelected: true, category: 'ci', brand: 'volkswagen', prompt: 'Volkswagen Corporate Identity photography: Direct front view centered on VW badge and light signature. White studio.' },

  // ── Porsche CI (individual jobs) ──
  { key: 'CI_PORSCHE_34_FRONT', label: 'Porsche CI – 3/4 Front', labelDe: 'Porsche CI – 3/4 Front', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: 'Porsche Corporate Identity photography: Front 3/4 view emphasizing the iconic silhouette, headlight design, and Porsche crest. Dark dramatic studio with controlled highlights.' },
  { key: 'CI_PORSCHE_SIDE', label: 'Porsche CI – Side', labelDe: 'Porsche CI – Seite', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: 'Porsche Corporate Identity photography: Side profile capturing the sports car proportions. Dark dramatic studio with rim focus.' },
  { key: 'CI_PORSCHE_34_REAR', label: 'Porsche CI – 3/4 Rear', labelDe: 'Porsche CI – 3/4 Heck', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: 'Porsche Corporate Identity photography: Rear 3/4 view showing the rear light bar, PORSCHE lettering, and exhaust. Dramatic lighting.' },
  { key: 'CI_PORSCHE_LOW', label: 'Porsche CI – Low Angle', labelDe: 'Porsche CI – Low-Angle', defaultSelected: true, category: 'ci', brand: 'porsche', prompt: 'Porsche Corporate Identity photography: Low-angle front view emphasizing power and stance. Dark studio, dramatic key light.' },

  // ══════════════════════════════════════════════
  // ── Volvo CI (individual jobs) ──
  // ══════════════════════════════════════════════
  // Standard Views (7)
  { key: 'CI_VOLVO_34_FRONT_LEFT', label: 'Volvo CI – 3/4 Front Left', labelDe: 'Volvo CI – 3/4 Front Links', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 front, facing left. Environment: minimalist, high-tech showroom with highly reflective dark polished resin floor. Background: large seamless frosted glass panels subtly illuminated from behind with soft diffused cool-white gradient light, creating infinite depth. No extraneous objects, humans, or other vehicles. License plates blank and body-colored. Strict Detail Preservation: Replicate exact headlight internal structure, DRL signatures, front grille shape/mesh/texture, wheel spoke pattern, body contours, trim, color and rims with absolute precision. No simplification. Interior subtly visible through windows. Composition: clean, centered, premium magazine quality.' },
  { key: 'CI_VOLVO_34_FRONT_RIGHT', label: 'Volvo CI – 3/4 Front Right', labelDe: 'Volvo CI – 3/4 Front Rechts', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 front, facing right. Environment: minimalist high-tech showroom with highly reflective dark polished resin floor and seamless frosted glass panels with soft cool-white gradient light. No humans, no other vehicles. License plates blank. Replicate exact headlight DRL signatures, grille mesh, wheel design, body lines with microscopic accuracy. No color/rim modifications. Premium magazine composition.' },
  { key: 'CI_VOLVO_34_REAR_LEFT', label: 'Volvo CI – 3/4 Rear Left', labelDe: 'Volvo CI – 3/4 Heck Links', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 rear, facing left. Environment: minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels with cool-white gradient. No humans. Replicate exact tail light internal structure, LED signatures, wheel design, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.' },
  { key: 'CI_VOLVO_34_REAR_RIGHT', label: 'Volvo CI – 3/4 Rear Right', labelDe: 'Volvo CI – 3/4 Heck Rechts', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of 3/4 rear, facing right. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact tail lights, wheels, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.' },
  { key: 'CI_VOLVO_SIDE', label: 'Volvo CI – Side', labelDe: 'Volvo CI – Seite', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of flat passenger side facing right. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact headlights, grille, wheel design, body lines with microscopic accuracy. No color/rim modifications. Premium magazine composition.' },
  { key: 'CI_VOLVO_FRONT', label: 'Volvo CI – Front', labelDe: 'Volvo CI – Front', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of flat front. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact headlight DRL signatures, grille mesh pattern, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.' },
  { key: 'CI_VOLVO_REAR', label: 'Volvo CI – Rear', labelDe: 'Volvo CI – Heck', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle from the reference photos, from the perspective of flat rear. Environment: minimalist high-tech showroom with reflective dark resin floor and frosted glass panels. No humans. Replicate exact tail light internal structure, LED signatures, rear badges, body contours with microscopic accuracy. No color/rim modifications. Premium magazine composition.' },

  // Interior (5)
  { key: 'CI_VOLVO_INT_PASSENGER', label: 'Volvo CI – Interior Passenger', labelDe: 'Volvo CI – Innenraum Beifahrer', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior from reference images. Front Interior Shot from Front Passenger Side: Looking from open front passenger door towards dashboard, center console, steering wheel, and driver seat. Showroom visible through windows (frosted glass, dark resin floor). Replicate exact leather grain texture, stitching, trim materials (open-pore wood, metal mesh). Replicate exact button layout, infotainment UI, instrument cluster, gear selector. LHD configuration. Focus: full dashboard span, center vertical screen, passenger-side trim, steering wheel, center console gear selector. Premium magazine quality.' },
  { key: 'CI_VOLVO_INT_CENTER', label: 'Volvo CI – Interior Center', labelDe: 'Volvo CI – Innenraum Mitte', defaultSelected: true, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Front Interior Shot: Looking from between front seats towards driver console and passenger dashboard. Showroom visible through windows. Replicate exact leather grain, stitching, trim materials, button layouts, UI screens, gear selector with microscopic accuracy. LHD configuration. Focus: driver door panel button array, steering wheel controls, instrument cluster, pedals, view across to passenger side. Premium quality.' },
  { key: 'CI_VOLVO_INT_REAR', label: 'Volvo CI – Rear Seats', labelDe: 'Volvo CI – Rücksitze', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Rear Interior Shot: Looking from open rear passenger door towards rear seats, legroom, and rear center console. Showroom visible through windows. Replicate exact seat material, stitching, rear center console/armrest controls (climate, heated seats), rear air vents. LHD configuration. Focus: second-row seating layout, floor mat texture. Premium quality.' },
  { key: 'CI_VOLVO_INT_BOOT', label: 'Volvo CI – Open Boot', labelDe: 'Volvo CI – Kofferraum', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle. Boot Open Rear Shot: Straight-on exterior view with tailgate fully open, looking into cargo space. Showroom environment with reflective dark resin floor and frosted glass panels. Replicate exact cargo floor texture, sidewalls, load-bearing lip, cargo net hooks, rear-seat release handles. Surrounding exterior panels and taillights perfectly matched. Premium quality.' },
  { key: 'CI_VOLVO_INT_STEERING', label: 'Volvo CI – Steering Wheel', labelDe: 'Volvo CI – Lenkrad', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Close-Up Steering Shot: Tight macro-style shot of steering wheel, central horn pad, and surrounding stalks. Complete steering wheel visible. Exterior showroom visible through windshield. Replicate exact steering wheel hub texture (leather/plastic/metal), precise button iconography on left/right spokes (media, cruise control, voice assistant), paddle shifters if present. Center logo perfectly legible. LHD configuration. Premium quality.' },

  // Detail (3)
  { key: 'CI_VOLVO_DET_CLUSTER', label: 'Volvo CI – Instrument Cluster', labelDe: 'Volvo CI – Instrumenten-Display', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Closeup Driver Infotainment Screen (Instrument Cluster): Tight macro-style shot of digital screen/cluster behind steering wheel. Replicate exact UI layout including digital gauges (speedometer, tachometer/power meter), central information display, warning light placements. All text and iconography sharp and legible. Surrounding cluster bezel material detailed. LHD configuration. Premium quality.' },
  { key: 'CI_VOLVO_DET_SCREEN', label: 'Volvo CI – Center Screen', labelDe: 'Volvo CI – Zentraldisplay', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle interior. Closeup Center Infotainment Screen: Tight macro-style shot of main dashboard central screen and surrounding controls. Replicate exact screen orientation (portrait/vertical), bezel design, precise UI layout with app icons, climate overlay, navigation. Surrounding air vents, physical buttons, dash material texture in sharp focus. LHD configuration. Premium quality.' },
  { key: 'CI_VOLVO_DET_WHEEL', label: 'Volvo CI – Wheel Detail', labelDe: 'Volvo CI – Felge Detail', defaultSelected: false, category: 'ci', brand: 'volvo', prompt: 'Generate a high-resolution, ultra-detailed professional automotive photograph of the EXACT vehicle. Macro Close-up of Wheel, Alloy Rim, and Surrounding Fender. Environment: minimalist high-tech showroom with reflective dark polished resin floor and frosted glass panels. Replicate exact multi-spoke alloy wheel design, spoke pattern, concavity, lug nut configuration, center cap, metallic/machined finish with absolute precision. Accurately reproduce visible brake calipers, rotor pattern. Replicate tire profile, sidewall texture. Surrounding fender body contours and paint color perfectly matched. Depth of field keeps rim sharp, wheel well falls to shadow. Premium detail shot quality.' },
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
 * Returns all CI jobs for the detected brand.
 */
export function detectBrandFromDescription(description: string, vehicleBrand?: string): string | null {
  // Priority 1: explicit brand from VIN lookup or vehicle data
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
    // If no match in map, return the raw brand as-is (for logo matching)
    return brandLower;
  }

  // Priority 2: fallback to description text
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
 * For CI multi-prompt jobs, overrides use keys like 'pipeline_CI_BMW_STANDARD_0', 'pipeline_CI_BMW_STANDARD_1', etc.
 */
export function applyPromptOverrides(jobs: PipelineJob[], overrides: Record<string, string>): PipelineJob[] {
  return jobs.map(job => {
    const mainKey = `pipeline_${job.key}`;
    const mainOverride = overrides[mainKey];

    // For multi-prompt CI jobs, check individual overrides
    const extraPrompts = job.extraPrompts ? [...job.extraPrompts] : undefined;
    if (extraPrompts) {
      for (let i = 0; i < extraPrompts.length; i++) {
        const subKey = `pipeline_${job.key}_${i + 1}`;
        if (overrides[subKey] && overrides[subKey].trim()) {
          extraPrompts[i] = overrides[subKey];
        }
      }
    }

    // Check main prompt override (index 0 for CI jobs)
    const ciMainKey = `pipeline_${job.key}_0`;
    const prompt = (overrides[ciMainKey]?.trim() || mainOverride?.trim()) ? (overrides[ciMainKey]?.trim() || mainOverride) : job.prompt;

    return { ...job, prompt, extraPrompts };
  });
}
