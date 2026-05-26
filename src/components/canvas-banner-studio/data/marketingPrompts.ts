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
    id: "showroom-neon-streaks",
    label: "Showroom Neon Streaks",
    description: "Premium-Dunkelshowroom mit dramatischen Neon-Lichtspuren und Spiegelungen.",
    prompt:
      "Place the exact same vehicle in a premium dark showroom environment. Dramatic neon light streaks in cyan and magenta sweep across the glossy floor, reflecting off the car's paint. Volumetric fog catches the neon beams. Ultra-modern automotive exhibition look, 8k, photorealistic.",
  },
  {
    id: "popstyle-neon",
    label: "Popstyle Neon",
    description: "Knalliger Pop-Art-Retro-Look mit Neonfarben und grafischem Hintergrund.",
    prompt:
      "Re-stage the exact same vehicle in a bold pop-art inspired scene. Vibrant neon pink, electric blue and lime green background with halftone dot patterns. Retro-futuristic 1980s poster aesthetic mixed with modern automotive photography. High contrast, saturated colors, graphic design composition.",
  },
  {
    id: "deal-car-tower",
    label: "Deal Car Tower",
    description: "Modernes Hochhaus als dramatische urbane Kulisse, Executive-Dealership-Stil.",
    prompt:
      "Place the exact same vehicle in front of a sleek modern glass skyscraper tower at dusk. The building's illuminated windows create a dramatic geometric backdrop. Professional automotive dealership photography, urban corporate setting, sharp reflections on the car's surface, premium executive feel.",
  },
  {
    id: "lifestyle-alpineescape",
    label: "Lifestyle Alpine Escape",
    description: "Freiheits- und Abenteuer-Lifestyle in den Alpen bei Sonnenaufgang.",
    prompt:
      "Place the exact same vehicle on a winding alpine mountain pass at sunrise. Fresh snow-capped peaks, crystal clear turquoise mountain lake in the background, golden morning light. Freedom and adventure lifestyle photography, cinematic wide angle, inviting travel atmosphere.",
  },
  {
    id: "peminere-imited",
    label: "Peminere Imited",
    description: "Exklusive Limited-Edition-Präsentation mit Goldakzenten und Museum-Spotlight.",
    prompt:
      "Place the exact same vehicle in an exclusive limited-edition presentation setting. Matte black backdrop with subtle gold accents, museum-quality spotlighting, velvet rope barriers barely visible. Ultra-premium product launch photography, meticulous attention to detail, aspirational luxury aesthetic.",
  },
  {
    id: "german-city-neon",
    label: "German City Neon",
    description: "Deutscher Stadtplatz bei Golden Hour mit Cyberpunk-Neon-Akzenten.",
    prompt:
      "An 8k resolution, professionally photographed automotive commercial image for a high-impact, engaging social media banner, featuring the exact car from the provided image in its precise front three-quarter pose, now centrally positioned on a clean, sun-drenched historic city square in Germany, a random big city in Germany, like Berlin or near details of classic European architecture like Gendarmenmarkt, Frankfurt, Hamburg harbor, Munich etc. The entire city environment is bright and joyful, bathed in clear, natural daylight from a recent Golden Hour, with details of the historic buildings invitingly clear and not dark or gloomy, conveying pure joy and making the viewer want to step in. The car boasts a flawless, immaculate glossy finish that brilliantly catches and reflects natural sunlight. Integrating a stylized, engaging cyberpunk advertising flair, elegant, glowing primary color neon light trails and secondary color laser lines intricately wrap around the vehicle, weaving through complex abstract floating geometric shapes. The entire composition has advanced raytracing reflections on the car paint texture and razor-sharp focus, making the vehicle feel incredibly premium and central under the bright daylight. All text, words, letters, typography, people, license plate details, and blurry elements are completely absent from the clean advertising canvas, ensuring a pure, click-worthy visual experience.",
  },
];

export function getMarketingPromptById(id: string): MarketingPromptPreset | undefined {
  return MARKETING_PROMPTS.find((p) => p.id === id);
}
