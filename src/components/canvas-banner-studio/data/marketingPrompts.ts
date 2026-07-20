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
  {
    id: "highclass-showroom-dark",
    label: "Highclass Showroom Dark",
    description: "Dunkler Premium-Showroom mit dramatischen Deckenlichtern und Glanzboden – Vollton-Akzentwand in CI-Primärfarbe.",
    prompt:
      "Place the exact same vehicle – identical model, color, wheels, badges and license plate area – inside an ultra-premium dark architectural car showroom. Polished glossy dark floor with soft mirror reflections of the car. Long linear LED ceiling light strips create dramatic streaks across the ceiling and floor. Modern minimal architecture with large angular wall surfaces; one prominent solid-color accent wall using the brand primary color as a clean flat fill (no gradient, no pattern, no text). Warm rim light on the car body, cinematic depth, subtle volumetric haze. 8k high-end automotive commercial photography, razor-sharp focus, photoreal. Absolutely no text, no typography, no added logos, no buttons, no UI elements, no people, no price tags – clean empty canvas for later overlay.",
  },
  {
    id: "highclass-showroom-bright",
    label: "Highclass Showroom Bright",
    description: "Heller, cleaner Premium-Showroom, viel Weißraum, spiegelnder Boden – ruhige Vollton-Rückwand in CI-Primärfarbe.",
    prompt:
      "Place the exact same vehicle – identical model, color, wheels, badges and license plate area – inside a bright, clean, minimalist high-end car showroom. Soft diffuse daylight from large overhead light coves, polished light grey floor with subtle mirror reflection of the car. Pure white architectural surfaces with one large flat solid-color back wall painted in the brand primary color as a uniform fill (no gradient, no texture, no graphics, no text). Generous negative space around the vehicle, editorial automotive magazine composition, photoreal, 8k, razor-sharp focus, premium calm atmosphere. Absolutely no text, no typography, no added logos, no buttons, no UI, no people, no price tags – completely empty advertising canvas ready for overlay.",
  },
  {
    id: "highclass-aerial-countryroad",
    label: "Highclass Aerial Countryroad",
    description: "Aufnahme von oben: Auto fährt highclass über eine Landstraße – cineastisch, dezente CI-Primärfarbe im Himmel möglich.",
    prompt:
      "Place the exact same vehicle – identical model, color, wheels, badges and license plate area – captured from a high aerial top-down perspective (drone shot, slight 15–25 degree tilt) driving along a scenic empty countryside road. Smooth dark asphalt with crisp lane markings curving gently through green rolling fields and soft tree lines. Cinematic golden-hour or clean overcast lighting, subtle motion blur on the road surface only (car remains tack sharp), long soft shadow of the car on the asphalt. Optional atmospheric color grading using the brand primary color as a tonal tint in the sky or distant horizon (still natural, never cartoonish). Ultra-premium automotive commercial look, photoreal, 8k, razor-sharp focus on the vehicle. Absolutely no text, no typography, no added logos, no buttons, no UI, no people, no other vehicles, no road signs with text – completely empty advertising canvas ready for overlay.",
  },
  {
    id: "dealer-lot",
    label: "Fahrzeugplatz",
    description: "Leerer Händler-Fahrzeugplatz mit Betonpflaster vor moderner Lagerhalle – ideal für PKW und LKW.",
    prompt:
      "Place the exact same vehicle – identical make, model, color, wheels, badges and license plate area – on an empty dealership vehicle lot in front of a modern industrial warehouse hall. GROUND: wide flat lot of light gray-beige interlocking concrete pavers in a subtle diagonal H-pattern, clean and dry, no puddles, no road markings. BACKGROUND: a long single-story warehouse with a light gray metal panel facade, a darker anthracite-gray vertical section with tall narrow windows on the right side, a horizontal band of small dark rectangular clerestory windows above four to five closed anthracite sectional roll-up gates aligned in a row; a group of green deciduous trees behind a low black metal fence on the far left; smooth soft blue sky. LIGHTING: soft cool daylight from the upper front-left, one clean feathered contact shadow under the vehicle. Photoreal 8k automotive commercial photography, razor-sharp focus on the vehicle. STRICT: absolutely NO other cars, NO trucks, NO trailers, NO people, NO signage, NO added logos, NO text, NO typography, NO UI, NO cones, NO pallets – completely empty advertising canvas ready for overlay.",
  },
];

export function getMarketingPromptById(id: string): MarketingPromptPreset | undefined {
  return MARKETING_PROMPTS.find((p) => p.id === id);
}
