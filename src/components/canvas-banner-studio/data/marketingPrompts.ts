// Curated marketing prompts for master image generation.
// Each prompt augments the source vehicle photo with a strong, ad-worthy scene.
// Vehicle identity (model, color, license plate area) MUST stay intact – this is
// enforced again in the edge function's system instruction.

export type MarketingPromptPreset = {
  id: string;
  label: string;
  description: string;
  prompt: string;
};

export const MARKETING_PROMPTS: MarketingPromptPreset[] = [
  {
    id: "cinematic-showroom",
    label: "Cinematic Showroom",
    description: "Dunkler Studio-Hintergrund, dramatische Spotlights, Spiegelungen am Boden.",
    prompt:
      "Place the exact same vehicle in a cinematic premium showroom: deep matte-black surroundings, focused warm spotlights highlighting body lines, glossy black floor with subtle reflection, soft volumetric haze. Editorial automotive photography, 35mm, shallow depth of field.",
  },
  {
    id: "coastal-sunrise",
    label: "Küste bei Sonnenaufgang",
    description: "Warmes Morgenlicht, Küstenstraße, weicher Bokeh-Hintergrund.",
    prompt:
      "Re-place the exact same vehicle on a scenic coastal road at sunrise. Warm golden light from low sun, soft sea mist, ocean and cliffs in soft bokeh background. Cinematic ad still, photorealistic, 35mm.",
  },
  {
    id: "studio-white",
    label: "Studio – Reinweiß",
    description: "Sauberer weißer Studio-Hintergrund, weiche Schatten, Katalog-Look.",
    prompt:
      "Place the exact same vehicle in a clean white photo studio. Seamless white cyclorama, soft diffused key light, gentle contact shadow under tires. Premium automotive catalog look, ultra crisp, no extra props.",
  },
  {
    id: "urban-night",
    label: "Urban Night – Neon",
    description: "Nasse Stadtstraße, Neonreflexionen, Großstadt-Atmosphäre.",
    prompt:
      "Place the exact same vehicle on a wet urban street at night. Reflections of neon signage in the wet asphalt, blurred city lights, light rain in the air. Moody cinematic ad, anamorphic flares, photorealistic.",
  },
  {
    id: "mountain-panorama",
    label: "Bergpanorama",
    description: "Alpenkulisse, klare Bergluft, Serpentine.",
    prompt:
      "Place the exact same vehicle on a panoramic alpine mountain road with snowy peaks in the background. Crisp midday light, dramatic clouds, asphalt curve leading into the scene. Cinematic automotive ad photography.",
  },
  {
    id: "motion-blur",
    label: "Dynamic Motion",
    description: "Fahrendes Auto, Bewegungsunschärfe der Umgebung, sportlich.",
    prompt:
      "Re-render the exact same vehicle as if driving fast. Sharp vehicle, strong motion-blur on the surrounding road and background, light streaks, low panning shot perspective. Dynamic automotive ad still.",
  },
  {
    id: "luxury-garage",
    label: "Luxus Garage",
    description: "Warme Architektur, Glas, Beton, hochwertige Atmosphäre.",
    prompt:
      "Place the exact same vehicle in a modern luxury private garage: polished concrete floor, warm wood and glass walls, designer pendant lights, subtle warm rim light on the car. Architectural ad photography.",
  },
  {
    id: "editorial-magazine",
    label: "Editorial Magazin",
    description: "Magazin-Cover-Look, leicht stilisiert, klare Komposition.",
    prompt:
      "Re-stage the exact same vehicle as a magazine cover hero shot. Minimal, slightly stylized background with one strong color gradient, clean composition with negative space top-right for headline, soft directional studio light. Premium editorial automotive look.",
  },
  {
    id: "desert-golden-hour",
    label: "Wüste – Golden Hour",
    description: "Weite Wüstenlandschaft, langes Schattenspiel, warme Töne.",
    prompt:
      "Place the exact same vehicle on a smooth desert road during golden hour. Endless dunes in the background, long warm shadows, light dust haze, very low sun angle. Cinematic, photorealistic ad still.",
  },
  {
    id: "forest-road",
    label: "Waldstraße – Lichtstrahlen",
    description: "Sonnenstrahlen durch Bäume, mystische Atmosphäre.",
    prompt:
      "Place the exact same vehicle on a quiet forest road. Sun beams piercing through tall trees, soft morning mist on the ground, lush green tones. Cinematic automotive lifestyle photography.",
  },
];

export function getMarketingPromptById(id: string): MarketingPromptPreset | undefined {
  return MARKETING_PROMPTS.find((p) => p.id === id);
}
