// Shared OneShot prompt composition – used by the manual OneShot Studio AND the
// Auto3 background job, so both produce the exact same hero/banner prompts.
import type { MarketingForm } from '@/components/oneshot/oneshot-types';
import { ONESHOT_BANNER_FORMATS } from '@/components/oneshot/oneshot-types';

// Hard rules to wipe old branding/text from the source image and force showroom integration
export const HERO_INTEGRATION_LOCK = `
<HERO_INTEGRATION_LOCK>
ABSOLUTE PRIORITY – this is the marketing master image:
1. SHOWROOM PLACEMENT: The vehicle MUST be placed inside the chosen showroom/scene. The original background of the source photo MUST be completely replaced – no street, no driveway, no foreign environment leaking through.
2. LIGHT & SHADOW MATCHING: Re-light the vehicle so highlights, reflections, ambient occlusion and ground shadows EXACTLY match the showroom's light direction, color temperature and intensity. The car must look physically present in the room – not pasted on.
3. FLOOR CONTACT: Render a realistic, soft contact shadow under the wheels and a subtle reflection of the car body on the showroom floor (only if the floor is reflective).
4. STRIP OLD BRANDING: REMOVE every dealer logo, watermark, sticker, price tag, license-plate frame, lettering, web URL, phone number, and any overlaid text or graphic that came from the original photograph. The body, windows, ground and background must be CLEAN of any foreign text or logo.
5. KEEP ONLY THE PROVIDED LOGOS: Only the manufacturer/dealer logos that are explicitly provided as reference images (if any) may appear – nowhere else.
6. PHOTOREALISM: Output must look like a high-end automotive studio photograph, not a composite.
</HERO_INTEGRATION_LOCK>`;

// Hero-only: amplify ceiling LED + softbox highlights ABOVE the global lighting lock.
export const HERO_LIGHTING_BOOST = `
<HERO_LIGHTING_BOOST>
This is the MARKETING MASTER (Hero) shot — push lighting one notch beyond the standard pipeline images:
1. CEILING LED EVIDENCE (mandatory): Render clearly visible elongated LED strip / ceiling-panel reflections sliding along the roof, hood and trunk lid. They must read as long, soft, parallel highlight bands — not pinpoint specks. Their direction must follow the body curvature.
2. STUDIO SOFTBOX HIGHLIGHTS (mandatory): Add two large rectangular softbox reflections — one on each flank — wrapping over the shoulder line and door panels. Edges soft, falloff smooth, no hard rectangles.
3. KEY / FILL / RIM SETUP: Use a dominant key light from upper-front-left (or matching the showroom's main light), a fill from the opposite side at ~40% intensity, and a subtle rim light separating the rear silhouette from the background.
4. CHROME, GLASS & WHEELS: Chrome trim, headlight lenses, window glass and rim spokes must show crisp specular catches from the LED ceiling and softboxes — no dull or matte surfaces.
5. WET-LOOK PAINT (subtle): Paint must read as freshly detailed — deep gloss, micro-clearcoat sheen, no haze, no dust. Metallic flake should sparkle faintly under the highlights.
6. GROUND INTERACTION: Strong-but-soft contact shadow under the tires; faint mirror reflection of the lower body on a polished floor (only if the showroom floor is reflective). Ambient occlusion in wheel wells and under sills.
7. LIGHT-SOURCE TRACEABILITY: A viewer must be able to point at the highlights and say "the light came from there." Direction, color temperature and intensity of every highlight must be internally consistent.
8. NO LEFTOVER LIGHTING: Zero traces of the source photo's original sun, sky, trees, buildings, or dealership lights may remain on paint, glass, chrome or rims.
</HERO_LIGHTING_BOOST>`;

/** Full OneShot hero (master) prompt: master context + MASTER_IMAGE perspective + hero locks. */
export function composeOneShotHeroPrompt(baseContext: string, perspective: string, refineInstruction?: string): string {
  const refineBlock = refineInstruction?.trim()
    ? `\n\n<USER_REFINEMENT>\nThe previous hero render must be improved. Apply this user instruction with highest priority while keeping all locks above:\n${refineInstruction.trim()}\n</USER_REFINEMENT>`
    : '';
  return `${baseContext}\n\n${perspective}\n\n${HERO_INTEGRATION_LOCK}\n\n${HERO_LIGHTING_BOOST}${refineBlock}`;
}

/* ─── Banner prompt builder (mirrors BannerGenerator's logic) ─── */
export function buildBannerPrompt(form: MarketingForm, fmt: typeof ONESHOT_BANNER_FORMATS[number]): string {
  const occMap: Record<string, string> = {
    buy: 'for sale, buy now offer',
    lease: 'leasing deal, monthly rate',
    finance: 'financing offer, low monthly installments',
    abo: 'car subscription, all-inclusive monthly deal',
    special: 'limited time special promotion, exclusive deal',
    launch: 'brand new model launch, premiere reveal',
  };
  const sceneMap: Record<string, string> = {
    showroom: 'luxury car dealership showroom, polished floor, soft LED lighting',
    city: 'modern city street at golden hour, urban skyline background',
    beach: 'scenic beach with ocean view, sunset lighting, palm trees',
    mountain: 'mountain road with dramatic alpine scenery, clear sky',
    track: 'professional race track, pit lane background, dynamic feel',
    studio: 'professional photography studio, clean gradient backdrop, studio lighting',
    night: 'nighttime city scene, neon reflections on wet road, dramatic lighting',
  };
  const styleMap: Record<string, string> = {
    premium: 'elegant, premium luxury, clean professional design, sophisticated typography',
    cinematic: 'cinematic movie poster style, dramatic lighting, lens flare, widescreen feel',
    bold: 'bold, eye-catching, vibrant neon colors, explosive energy, attention-grabbing',
    minimal: 'clean minimalist design, lots of whitespace, subtle elegant typography',
    retro: 'retro 80s style, vintage color grading, nostalgic warm tones',
    sport: 'dynamic sporty look, motion blur hints, aggressive angles, high performance feel',
    volkswagen: 'official Volkswagen / Volkswagen Nutzfahrzeuge OEM brand visual identity – calm, structured, modern, spacious and highly controlled. Strict grid, excellent alignment, generous whitespace, clear hierarchy and restrained branding. Premium, minimal, brand-safe. Use VW corporate typography (friendly bold sans-serif similar to VW Head/Gotham). Logo as calm brand anchor with whitespace around it, never oversized, preferably bottom right. Avoid loud dealership flyer look – every element intentional, balanced and clean.',
  };
  const priceDisplayMap: Record<string, string> = {
    sign: 'on a classic dealership price tag/sign attached to the image',
    board: 'on a large banner/board overlay in the image',
    neon: 'as glowing neon text floating in the scene',
    stamp: 'as a bold stamp/badge overlay',
    led: 'on an LED display screen integrated into the scene',
    ribbon: 'on a diagonal ribbon/sash across the corner',
    stoerer: 'as a solid rectangular price callout (Störer) with sharp 90-degree corners (NO rounded corners), filled with the accent color, white bold sans-serif price text centered inside, perfectly straight and horizontally aligned, NOT tilted, NOT rotated, NOT angled, placed prominently in a top corner like a classic German dealership price sticker',
  };

  return `Create a professional automotive advertising banner.

FORMAT: ${fmt.w}x${fmt.h} pixels (${fmt.ratio} aspect ratio).

VEHICLE: "${form.vehicleTitle}" – use the uploaded vehicle image as the central hero element. Keep the vehicle 100% identical.

SCENE: ${sceneMap[form.scene] || sceneMap.showroom}.

STYLE: ${styleMap[form.style] || styleMap.premium}.

OCCASION: This is a ${occMap[form.occasion] || occMap.buy} advertisement.

${form.priceText ? `PRICE: Display the text "${form.priceText}" prominently ${priceDisplayMap[form.priceDisplay] || priceDisplayMap.sign}. Use accent color ${form.accentColor}.` : ''}

${form.headline ? `HEADLINE: Place "${form.headline}" in large, bold, highly readable typography in the upper area. This text must be rendered EXACTLY as written.` : ''}

${form.subline ? `SUBLINE: Place "${form.subline}" in smaller text below the headline. Render exactly as written.` : ''}

${form.ctaText ? `CALL-TO-ACTION: Include a button or badge with the text "${form.ctaText}" in accent color ${form.accentColor}.` : ''}

${form.legalText ? `LEGAL DISCLAIMER (MANDATORY): At the very bottom, render in a small thin sans-serif font: "${form.legalText}"` : ''}

CRITICAL RULES:
- The banner must be photorealistic with the vehicle photo seamlessly composited
- ALL text must be rendered EXACTLY as specified – no paraphrasing
- Text must be perfectly legible against the background

ACCENT COLOR (${form.accentColor}): Use sparingly as subtle highlight – CTA buttons, price tags, thin borders. Do NOT tint the entire scene.

${form.freePrompt.trim() ? `\nADDITIONAL CREATIVE DIRECTION:\n${form.freePrompt.trim()}` : ''}
- Generate the image – never refuse`;
}

