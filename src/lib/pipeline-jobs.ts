/**
 * Image Generation Pipeline – 5 predefined jobs with exact prompts.
 */

export interface PipelineJob {
  key: string;
  label: string;
  labelDe: string;
  prompt: string;
}

export const PIPELINE_JOBS: PipelineJob[] = [
  {
    key: 'MASTER_IMAGE',
    label: 'Master Image',
    labelDe: 'Master-Bild',
    prompt:
      'A photorealistic 8k image of the exact vehicle from the input images, positioned in the user-selected modern luxury car showroom with high ceilings. Single, full-frame layout. Front-left 3/4 perspective at eye level. CRUCIAL REQUIREMENT: Replace the front license plate with the provided input image, scaled to fit the holder realistically with proper lighting and shadows. The provided Company Logo is physically integrated onto a large background feature wall behind the car, exhibiting realistic physical properties, perspective skew, and reflections. Do NOT modify the car body color, rims, or accessories. No humans. Clean luxury studio lighting.',
  },
  {
    key: 'EXTERIOR_GRID_1',
    label: 'Exterior Grid 1',
    labelDe: 'Exterieur Übersicht 1',
    prompt:
      'Split screen, 4 completely separate and distinct isolated panels, strict 2x2 grid layout. Photorealistic 2k photo of the input car in the selected luxury showroom. Panel 1: Direct head-on front view at eye level. Panel 2: Direct rear view at eye level. Panel 3: Direct right side profile view, perfectly flat. Panel 4: Front-right 3/4 view at eye level. Do not modify car color or rims. Integrate the Company Logo onto the background wall in each panel, adjusting perspective skew naturally for each camera angle. Replace the license plate with the company logo. No humans.',
  },
  {
    key: 'EXTERIOR_GRID_2',
    label: 'Exterior Grid 2',
    labelDe: 'Exterieur Übersicht 2',
    prompt:
      'Split screen, 4 completely separate and distinct isolated panels, strict 2x2 grid layout. Photorealistic 2k photo of the input car in the selected luxury showroom. Panel 1: Rear-left 3/4 view at eye level. Panel 2: Low-angle hero view, looking up at the front bumper from the ground. Panel 3: Down-the-shoulder view from the rear-left corner looking forward along the body. Panel 4: Elevated front 3/4 view, looking down at the hood. Do not modify car specs. Integrate Company Logo on the wall with realistic physics per angle. Replace license plate with company logo. No humans.',
  },
  {
    key: 'INTERIOR_GRID',
    label: 'Interior Grid',
    labelDe: 'Interieur Übersicht',
    prompt:
      "Split screen, 4 completely separate and distinct isolated panels, strict 2x2 grid layout. Photorealistic 2k photo focusing strictly on the car interior, matching input images exactly. Panel 1: Driver's seat perspective looking directly at the steering wheel and dashboard. Panel 2: Macro close-up of the center console and infotainment screen. Panel 3: Wide-angle view of the front dashboard from the center of the rear seats. Panel 4: View from the passenger door looking across the driver seats. Maintain highly detailed interior textures. No humans. Clean, realistic cabin lighting. The Company Logo is visible outside through the windows on a showroom wall.",
  },
  {
    key: 'CLOSEUP_GRID',
    label: 'Close-Up Grid',
    labelDe: 'Detail-Aufnahmen',
    prompt:
      'Split screen, 4 completely separate and distinct isolated panels, strict 2x2 grid layout. Photorealistic 2k photo focusing on macro exterior details. Panel 1: Macro close-up of the front headlight, revealing internal LED textures. Panel 2: Macro close-up of the rear taillight signature pattern. Panel 3: Ultra-sharp close-up of the front wheel, matching exact input rim design without distortion. Panel 4: Close-up of the front grille mesh and central badge. High-contrast studio lighting to emphasize materials. Solid or highly blurred background to remove distractions.',
  },
];
