/**
 * Section-specific AI scene prompt templates for landing-page generation.
 * All prompts follow the Reference Truth Protocol: the model MUST use the
 * reference vehicle image and not hallucinate colors, badges, wheels, or trim.
 */

export type LandingSceneKey =
  | 'hero'
  | 'design'
  | 'interior'
  | 'performance'
  | 'gallery'
  | 'specs'
  | 'cta'
  | 'generic';

interface SceneTemplate {
  key: LandingSceneKey;
  aspect: '16:9' | '4:3' | '3:2' | '21:9' | '1:1';
  scene: string;
}

const REFERENCE_TRUTH =
  'Use ONLY the reference image. Do NOT invent colors, badges, wheels, interior trim, stitching, or UI elements. Every visible attribute MUST match the reference exactly. Do NOT fall back on generic model knowledge. No text, no watermarks, no logos overlaid on the image.';

const SCENES: Record<LandingSceneKey, SceneTemplate> = {
  hero: {
    key: 'hero',
    aspect: '16:9',
    scene:
      'Cinematic wide 3/4 front-left hero shot in a soft dusk light, clean architectural background with subtle gradient sky, wet asphalt reflection, low camera angle, editorial magazine feel.',
  },
  design: {
    key: 'design',
    aspect: '4:3',
    scene:
      'Editorial side profile in a minimalist concrete studio, single soft key light from the top-left, deep shadow floor, product-shot precision, no distractions.',
  },
  interior: {
    key: 'interior',
    aspect: '4:3',
    scene:
      'Empty interior from the driver-door perspective, dashboard and steering wheel in focus, ambient LED accent lighting, no people, no clutter, clean and pristine.',
  },
  performance: {
    key: 'performance',
    aspect: '16:9',
    scene:
      'Dynamic motion shot on an alpine mountain road at golden hour, slight motion blur on the background, sharp car body, high contrast, sense of speed.',
  },
  gallery: {
    key: 'gallery',
    aspect: '3:2',
    scene:
      '3/4 rear-right angle in a modern showroom with polished floor, warm ambient light, subtle rim light on the silhouette, editorial and premium.',
  },
  specs: {
    key: 'specs',
    aspect: '3:2',
    scene:
      'Close-up detail shot of a signature exterior feature (grille, headlight, wheel), shallow depth of field, dramatic side light, industrial-design aesthetic.',
  },
  cta: {
    key: 'cta',
    aspect: '21:9',
    scene:
      'Wide cinematic banner shot with the car centered, dramatic dusk sky, single strong backlight, negative space on the left for typography.',
  },
  generic: {
    key: 'generic',
    aspect: '3:2',
    scene:
      'Clean editorial automotive photograph in a neutral premium environment, soft studio lighting, no distractions.',
  },
};

/** Pick the best scene for a given landing-page section. */
export function pickScene(sectionId: string, sectionType?: string, headline?: string): SceneTemplate {
  if (sectionId === 'hero') return SCENES.hero;
  const h = (headline || '').toLowerCase();
  if (/interieur|innen|cockpit|innenraum/.test(h)) return SCENES.interior;
  if (/performance|fahrleistung|leistung|motor|dynamik/.test(h)) return SCENES.performance;
  if (/design|exterior|exterieur|äußer|aussen/.test(h)) return SCENES.design;
  if (sectionType === 'cta') return SCENES.cta;
  if (sectionType === 'gallery') return SCENES.gallery;
  if (sectionType === 'specs') return SCENES.specs;
  return SCENES.generic;
}

/** Build a full AI prompt for a section, given vehicle context. */
export function buildScenePrompt(params: {
  brand: string;
  model: string;
  variant?: string;
  color?: string;
  sectionId: string;
  sectionType?: string;
  headline?: string;
  extra?: string;
}): { prompt: string; aspect: string; sceneKey: LandingSceneKey } {
  const scene = pickScene(params.sectionId, params.sectionType, params.headline);
  const vehicle = [params.brand, params.model, params.variant].filter(Boolean).join(' ');
  const colorPart = params.color ? ` in ${params.color}` : '';
  const prompt = [
    `Professional automotive marketing photograph of a ${vehicle}${colorPart}.`,
    scene.scene,
    params.extra || '',
    REFERENCE_TRUTH,
    `Output aspect ratio ${scene.aspect}.`,
  ]
    .filter(Boolean)
    .join(' ');
  return { prompt, aspect: scene.aspect, sceneKey: scene.key };
}
