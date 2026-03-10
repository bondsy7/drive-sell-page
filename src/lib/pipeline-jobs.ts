/**
 * Image Generation Pipeline – individual perspective jobs for full 360° coverage.
 * Each job produces a single image (no grids).
 */

export interface PipelineJob {
  key: string;
  label: string;
  labelDe: string;
  /** The raw perspective/composition instruction (showroom, logo, plate are injected at runtime) */
  prompt: string;
  /** Whether this job is selected by default */
  defaultSelected: boolean;
  /** Category for grouping in UI */
  category: 'hero' | 'exterior' | 'interior' | 'detail';
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
];

/** Group jobs by category for UI display */
export const PIPELINE_CATEGORIES = [
  { key: 'hero', labelDe: 'Hero' },
  { key: 'exterior', labelDe: 'Exterieur' },
  { key: 'interior', labelDe: 'Interieur' },
  { key: 'detail', labelDe: 'Detail-Aufnahmen' },
] as const;
