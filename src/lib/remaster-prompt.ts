// Dynamic master prompt construction for vehicle image remastering
// Uses structured English XML-tags optimized for Gemini image models

export interface RemasterConfig {
  scene: string;
  customShowroomBase64?: string | null;
  licensePlate: string;
  customPlateText?: string;
  customPlateImageBase64?: string | null;
  changeColor: boolean;
  colorHex?: string;
  showManufacturerLogo: boolean;
  showDealerLogo: boolean;
  dealerLogoUrl?: string | null;
  dealerLogoBase64?: string | null;
  manufacturerLogoUrl?: string | null;
  manufacturerLogoBase64?: string | null;
}

export const SCENE_OPTIONS = [
  { value: 'none', label: 'Keine Änderung am Bild' },
  { value: 'showroom-1', label: 'Showroom 1 – Modern Hell', preview: '/images/showrooms/showroom-1.webp' },
  { value: 'showroom-2', label: 'Showroom 2 – Elegant', preview: '/images/showrooms/showroom-2.webp' },
  { value: 'showroom-3', label: 'Showroom 3 – Glasfront', preview: '/images/showrooms/showroom-3.webp' },
  { value: 'custom-showroom', label: 'Eigener Showroom' },
  { value: 'forest', label: 'Wald' },
  { value: 'mountain', label: 'Berglandschaft' },
  { value: 'city', label: 'Stadtkulisse' },
  { value: 'street', label: 'Straße' },
  { value: 'beach', label: 'Strand' },
  { value: 'desert', label: 'Wüste' },
  { value: 'night-city', label: 'Stadt bei Nacht' },
  { value: 'parking-garage', label: 'Tiefgarage / Parkhaus' },
  { value: 'racetrack', label: 'Rennstrecke' },
  { value: 'mansion', label: 'Villa / Anwesen' },
] as const;

export const LICENSE_PLATE_OPTIONS = [
  { value: 'keep', label: 'Original beibehalten' },
  { value: 'blur', label: 'Blur / Unkenntlich machen' },
  { value: 'remove', label: 'Komplett entfernen' },
  { value: 'custom', label: 'Eigenes Nummernschild' },
] as const;

// ── Scene prompt fragments (English, structured) ──
const SCENE_PROMPTS: Record<string, string> = {
  'none': '',
  'showroom-1': 'Modern, bright dealership showroom. White walls, polished light-gray concrete floor with subtle reflections, minimalist recessed LED ceiling spots, subtle LED accent lighting on the back wall. Use the EXACT SAME showroom on EVERY image – same walls, floor, windows, lighting.',
  'showroom-2': 'Elegant luxury showroom. Large glass facades, warm lighting, designer furniture in background, glossy marble-like floor. Use the EXACT SAME showroom on EVERY image.',
  'showroom-3': 'Light-flooded dealership with floor-to-ceiling glass facade. Dark gray matte back wall, gray tile floor with reflections, full-height glass windows on the left, modern recessed LED ceiling lighting. Use the EXACT SAME showroom on EVERY image.',
  'custom-showroom': 'The user has provided a REFERENCE IMAGE of their custom showroom. This showroom is an IMMUTABLE ASSET – do NOT alter, redesign, or reimagine it. The vehicle MUST look like it is PHYSICALLY STANDING INSIDE this exact showroom – as if a real photograph was taken of the car parked in this real room. The showroom MUST always be clearly recognizable in every generated image. You may change the camera perspective (front, side, rear) but the showroom environment must ALWAYS remain fully visible and identifiable – same walls, same floor, same ceiling, same windows, same lighting fixtures. Do NOT overlay the car on top of the showroom like a collage. Do NOT crop out the showroom. Do NOT replace or obscure the showroom with a different background. The showroom must occupy the FULL background of every image. Preserve EVERY architectural detail: walls, floor material and color, ceiling, windows, glass facades, lighting fixtures, and ALL decorations including ANY logos, brand marks, emblems, or lettering mounted on walls. If a logo (e.g. Ferrari prancing horse, brand name text) is visible on a wall in the reference, it MUST remain at its EXACT position, size, and appearance – adjusted ONLY for natural 3D perspective changes when the camera moves. The floor material, color, and reflectivity MUST be IDENTICAL across all generated images. Use this EXACT showroom for EVERY image.',
  'forest': 'Dense, mystical conifer forest. Soft light rays through tree canopy. Ground with moss and pine needles. Vehicle on unpaved forest path.',
  'mountain': 'Paved mountain road with panoramic view of snow-capped peaks. Clear blue sky, dramatic cloud formations.',
  'city': 'Modern big-city skyline with glass facades and skyscrapers. Clean asphalt, golden hour lighting.',
  'street': 'Broad, straight road with perfect asphalt. Dramatic vanishing-point perspective. Warm afternoon light.',
  'beach': 'Firm sand on wide beach. Turquoise ocean background, gentle waves, warm sunset light.',
  'desert': 'Straight desert road amid vast sandy landscape with dunes. Dramatic light, clear sky.',
  'night-city': 'Illuminated city street at night. Neon lights and signs reflect on wet road and car body.',
  'parking-garage': 'Modern, clean underground garage. Polished concrete floor, LED ceiling lighting, clean lines.',
  'racetrack': 'Start/finish straight of professional racetrack. Red-white curbs, smooth asphalt.',
  'mansion': 'Driveway of luxurious villa. Manicured lawn, Mediterranean architecture, warm evening light.',
};

// ── Perspective prompts (structured XML format) ──
const PERSPECTIVE_PROMPTS: Record<string, string> = {
  '34front': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Exterior - Front 3/4 Hero View
CAMERA_ANGLE: Eye-level, 30-45° left of center axis
FRAMING: Front fascia and one full side visible. Both wheels on visible side fully in frame. Full vehicle with minimum 5% padding on all edges.
</CURRENT_PERSPECTIVE>`,

  'side': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Exterior - Perfect Side Profile
CAMERA_ANGLE: Exactly perpendicular (90°) to the vehicle's left flank. Ground-to-waist-level horizon.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero fisheye distortion). Entire silhouette from front bumper to rear bumper in frame.
</CURRENT_PERSPECTIVE>`,

  'rear': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Exterior - Direct Rear View
CAMERA_ANGLE: Eye-level, perfectly centered on rear axis.
FRAMING: Both taillights, exhaust outlets, rear badge, and model designation symmetrically framed. Full vehicle width visible.
</CURRENT_PERSPECTIVE>`,

  'interior-front': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Interior - Rear Seat POV Looking Forward
CAMERA_ANGLE: From center of rear seat, looking at dashboard, steering wheel, and windshield.
STRUCTURAL_INTEGRITY: Complete roof, ALL A/B pillars, headliner, and rearview mirror MUST be FULLY visible and UNCUT.
FORBIDDEN: Do NOT crop roof. Do NOT shoot from above without roof. Do NOT generate an exterior view.
WINDOW_VIEW: The selected showroom/scene MUST be visible THROUGH the windshield – NOT a random outdoor scene.
</CURRENT_PERSPECTIVE>`,

  'interior-rear': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Interior - Driver Seat POV Looking Backward
CAMERA_ANGLE: From driver seat position, looking at rear seats, headrests, and rear bench.
STRUCTURAL_INTEGRITY: Complete roof, ALL B/C pillars, headliner, and rear window MUST be FULLY visible and UNCUT.
FORBIDDEN: Do NOT crop roof. Do NOT shoot from above without roof. Do NOT generate an exterior view.
WINDOW_VIEW: The selected showroom/scene MUST be visible THROUGH the rear window – NOT a random outdoor scene.
</CURRENT_PERSPECTIVE>`,
};

export function getPerspectivePrompt(slotKey: string): string {
  return PERSPECTIVE_PROMPTS[slotKey] || '';
}

/** Helper: is this an interior slot? */
function isInteriorSlot(slotKey?: string): boolean {
  if (!slotKey) return false;
  return slotKey.startsWith('interior');
}

export function buildMasterPrompt(config: RemasterConfig, vehicleDescription?: string, slotKey?: string): string {
  const parts: string[] = [];
  const interior = isInteriorSlot(slotKey);

  // ── Base instruction ──
  parts.push(`You are a top-tier professional automotive commercial photographer and retoucher.
TASK: Remaster the provided reference vehicle photo into a flawless, dealership-quality promotional image.

<OUTPUT_FORMAT>
ASPECT RATIO: The output image MUST be in 4:3 (landscape) format. Width-to-height ratio = 4:3 exactly.
This applies to EVERY generated image without exception.
</OUTPUT_FORMAT>`);

  // ── CRITICAL ASSET INTEGRATION (logos FIRST – highest priority) ──
  const hasAnyLogo = (config.showManufacturerLogo && config.manufacturerLogoUrl) || (config.showDealerLogo && config.dealerLogoUrl);
  
  if (hasAnyLogo) {
    const logoLines: string[] = [];
    if (config.showManufacturerLogo && config.manufacturerLogoUrl) {
      logoLines.push(`MANUFACTURER LOGO:
- You are provided with a specific reference image of the manufacturer logo.
- Reproduce this EXACT logo PIXEL-FOR-PIXEL: every color, shape, text element, and proportion.
- Render as a backlit wall element with subtle LED halo effect.
- KEEP ALL ORIGINAL COLORS – do NOT convert to silver/chrome/monochrome.
- Position: centered on showroom back wall, at eye level, slightly above vehicle roofline.
- Size: approximately 60-80cm diameter/width. IDENTICAL position, size, and appearance on EVERY image.
- FORBIDDEN: Do NOT redesign, simplify, recolor, vectorize, or create an alternative version. IMMUTABLE ASSET.`);
    }
    if (config.showDealerLogo && config.dealerLogoUrl) {
      logoLines.push(`DEALER LOGO:
- You are provided with the dealer's company logo image.
- Reproduce PIXEL-FOR-PIXEL with all original colors and shapes.
- Position: to the right of the manufacturer logo on the back wall. Smaller than manufacturer logo.
- FORBIDDEN: Do NOT redesign, recolor, or simplify. IMMUTABLE ASSET.`);
    }
    parts.push(`<CRITICAL_ASSET_INTEGRATION>\n${logoLines.join('\n\n')}\n</CRITICAL_ASSET_INTEGRATION>`);
  } else {
    // Explicitly tell AI NOT to add logos when none are selected
    parts.push(`<NO_LOGO_INSTRUCTION>
Do NOT add ANY logo, brand mark, emblem, or wall decoration to the background.
The showroom wall must remain CLEAN and EMPTY – no manufacturer logos, no dealer logos, no decorative elements.
If the AI would normally place a logo, SKIP IT. The wall stays blank.
</NO_LOGO_INSTRUCTION>`);
  }

  // ── IDENTITY LOCK ──
  const colorLock = config.changeColor && config.colorHex
    ? `PAINT COLOR: Change vehicle paint to EXACTLY hex ${config.colorHex}. Glossy, photorealistic finish with correct reflections and color transitions.`
    : 'PAINT COLOR: Reproduce the EXACT paint color, shade, and finish (metallic/matte/pearl) from the original. Do NOT shift, tint, saturate, desaturate, lighten, or darken. Applies to ALL body panels, bumpers, mirrors, and painted surfaces.';

  parts.push(`<IDENTITY_LOCK>
${colorLock}
WHEELS: EXACT rim design – spoke count, shape, concavity, finish (polished/matte/bi-color/diamond-cut). Hub cap with brand logo. EXACT tire profile. NEVER crop any wheel at image edges.
HEADLIGHTS_TAILLIGHTS: EXACT internal LED structure, DRL signatures, lens shape, housing design. NEVER crop or alter.
GRILLE_BADGES: EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
BODY_DETAILS: EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirror shapes, door handles.
MATERIALS: Match exact finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute.
</IDENTITY_LOCK>`);

  // ── VEHICLE SCALE LOCK ──
  if (!interior) {
    const isCustomShowroom = config.scene === 'custom-showroom';
    parts.push(`<VEHICLE_SCALE_LOCK>
The vehicle MUST occupy the SAME proportion of the image frame in EVERY generated image.
For full-body exterior shots: vehicle should fill approximately 55-65% of the image width.
The apparent SIZE of the vehicle must remain CONSISTENT across all perspectives – same car, same scale.
Do NOT make the vehicle larger or smaller between different camera angles.
${isCustomShowroom ? `CRITICAL SCALE RULE FOR CUSTOM SHOWROOM: The vehicle must look REALISTICALLY SIZED relative to the showroom architecture. Compare the vehicle height to door frames, windows, ceiling height, and wall elements visible in the showroom reference image. The car must NOT appear oversized or undersized for the space. It must look like a real car naturally parked in this real showroom.` : ''}
</VEHICLE_SCALE_LOCK>`);
  }

  // ── ANTI-CROPPING ──
  parts.push(`<ANTI_CROPPING>
The vehicle MUST be FULLY visible – NO part cut off at image edges.
ALL headlights, taillights, and wheels COMPLETELY visible.
Maintain minimum 5% free space between vehicle edge and image border on all sides.
</ANTI_CROPPING>`);

  // ── SCENE AND LIGHTING ──
  const scenePrompt = SCENE_PROMPTS[config.scene];
  if (scenePrompt) {
    if (interior) {
      // For interior shots: describe the scene as what should be visible THROUGH the windows
      parts.push(`<SCENE_AND_LIGHTING>
WINDOW_VIEW: The view through ALL vehicle windows MUST show: ${scenePrompt}
The scene must be visible THROUGH the glass naturally – do NOT place the car in a different environment.
Use the EXACT SAME scene visible through windows on EVERY interior image.
REFLECTIONS: Re-render all glass reflections to match the scene visible through windows.
LIGHTING: Bright, even, professional interior lighting. Improve existing lighting to showroom quality.
</SCENE_AND_LIGHTING>`);
    } else {
      const isCustomShowroom = config.scene === 'custom-showroom';
      parts.push(`<SCENE_AND_LIGHTING>
ENVIRONMENT: ${scenePrompt}
FLOOR: The floor MUST match the selected showroom/scene exactly. Use the CORRECT floor material (polished concrete, marble, tiles, asphalt) as described.${isCustomShowroom ? ' The floor from the custom showroom reference image is the AUTHORITATIVE source – reproduce its EXACT color, texture, and reflectivity.' : ''}
REFLECTIONS: Completely re-render ALL vehicle body reflections to match the NEW scene environment. The paint surface must reflect the showroom walls, windows, ceiling lights, and floor – NOT remnants of the original photo location. Remove ALL original reflections from the previous environment. The car must look like it is PHYSICALLY PRESENT in this showroom.
SHADOWS: Generate realistic ground shadows and ambient occlusion beneath the vehicle. The car must appear to be STANDING ON the floor – NOT floating or hovering. Shadow direction must match the scene lighting. The tires must make realistic contact with the floor surface.
LIGHTING: ${isCustomShowroom ? 'Match the lighting conditions from the custom showroom reference image exactly – same direction, color temperature, and intensity. The vehicle paint, chrome, and glass must reflect the showroom lighting naturally.' : 'Bright, even, professional studio lighting.'}
${isCustomShowroom ? `CUSTOM SHOWROOM INTEGRATION (CRITICAL):
- The showroom MUST be the DOMINANT environment in every image – it must ALWAYS be clearly recognizable as the same room.
- Do NOT overlay the vehicle on top of the showroom like a cut-out or collage. The result must look like a REAL PHOTOGRAPH taken inside this showroom.
- The showroom walls, ceiling, floor, windows, and all architectural elements MUST be fully visible in the background – never cropped out or obscured.
- ALL wall decorations, logos, brand marks, and lettering visible in the showroom reference image MUST be preserved in their EXACT positions. When the camera perspective changes (e.g. front view vs. side view), these elements must shift naturally according to correct 3D perspective – but they must NEVER disappear, be removed, or be altered.
- The vehicle must cast correct shadows onto the showroom floor and receive correct lighting from the showroom light sources.
- The showroom IS the showroom – you are placing the car INTO it as if it drove in and parked there.` : ''}
</SCENE_AND_LIGHTING>`);
    }
  }

  // ── LICENSE PLATE ──
  if (config.licensePlate === 'blur') {
    parts.push(`<LICENSE_PLATE>\nBlur the license plate so characters are unreadable.\n</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'custom' && config.customPlateImageBase64) {
    // Custom plate IMAGE takes absolute priority over text
    parts.push(`<LICENSE_PLATE>
CRITICAL: A separate reference image of a CUSTOM LICENSE PLATE is provided as an additional input image.
You MUST replace the vehicle's existing license plate with this EXACT custom plate image.
Reproduce the plate PIXEL-FOR-PIXEL: exact text, font, colors, EU badge, city seal, spacing, and proportions.
The plate must be photorealistically integrated – correct perspective, lighting, and reflections matching the vehicle.
Do NOT use the original plate. Do NOT invent plate text. Use ONLY the provided custom plate image.
</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'custom' && config.customPlateText) {
    parts.push(`<LICENSE_PLATE>\nReplace the license plate with a German plate reading "${config.customPlateText}". Photorealistic rendering.\n</LICENSE_PLATE>`);
  } else {
    parts.push(`<LICENSE_PLATE>\nCompletely remove the license plate AND mounting bracket. The area must blend seamlessly into the body as if no plate was ever mounted.\n</LICENSE_PLATE>`);
  }

  // ── INTERIOR RULES (ONLY for interior slots) ──
  if (interior) {
    parts.push(`<INTERIOR_RULES>
THIS IS AN INTERIOR SHOT – the following rules are ABSOLUTE and NON-NEGOTIABLE:

1. EXACT COMPOSITION PRESERVATION:
- Output MUST have the EXACT SAME framing, camera angle, and perspective as the reference.
- Do NOT rotate, flip, mirror, zoom, re-frame, or crop differently.

2. ZERO INVENTION / ZERO MODIFICATION:
- Do NOT add ANY element not in the original (no new buttons, screens, trim, ambient lighting).
- Do NOT remove ANY permanent vehicle element (seats, buttons, screens, speakers, vents, pedals).
- Do NOT change ANY material (leather stays leather, alcantara stays alcantara, piano black stays piano black).
- EVERY detail matters: tachometer, screen UI, stitching color, seat perforation, air vent angles, gear selector position, cup holder shape, USB ports – ALL must match EXACTLY.

3. CLEANUP ONLY (the ONLY changes allowed):
- Remove items NOT belonging to vehicle: trash, bags, papers, plastic covers, dust, dirt, personal belongings, hands/feet, clothing.
- Remove temporary WARNING stickers (keep permanent vehicle labels).
- Clean all surfaces to showroom-ready condition.

4. LIGHTING ENHANCEMENT ONLY:
- Improve to bright, even, professional lighting.
- View through windows MUST show the SELECTED showroom/scene – NOT a random outdoor scene or street.
- Do NOT alter glass transparency or window tint.

5. STRUCTURAL INTEGRITY:
- Roof, ALL pillars (A/B/C), headliner, door panels, sun visors, rearview mirror MUST remain FULLY visible and UNCUT.
- Do NOT crop ANY structural element at image edges.

6. ABSOLUTELY FORBIDDEN:
- Generating exterior view from interior reference.
- Changing camera angle from original.
- Adding decorative elements or "improving" design.
- Cutting roof, removing doors, altering structural frame.
- Showing a different scene through windows than the selected showroom/scene.
</INTERIOR_RULES>`);
  }

  // ── STRICT NEGATIVE CONSTRAINTS ──
  parts.push(`<STRICT_NEGATIVE_CONSTRAINTS>
UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Simplify complex details (multi-spoke rims keep all spokes, LED arrays keep all elements)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Rotate, flip, or mirror the image
- Carry over reflections from original environment
- Add ANY logo, brand mark, or wall decoration UNLESS a logo image is explicitly provided as a reference asset
</STRICT_NEGATIVE_CONSTRAINTS>`);

  // ── Vehicle description ──
  if (vehicleDescription) {
    parts.push(`Vehicle: ${vehicleDescription}`);
  }

  // ── Perspective-specific instructions ──
  if (slotKey) {
    const perspPrompt = PERSPECTIVE_PROMPTS[slotKey];
    if (perspPrompt) {
      parts.push(perspPrompt);
    }
  }

  parts.push('You MUST generate a remastered image. Do NOT refuse. DO NOT ROTATE THE IMAGE.');

  return parts.join('\n\n');
}

// Dynamic manufacturer logos loaded from storage bucket 'manufacturer-logos'
// Legacy static map kept for fallback – new logos are managed via Admin > Hersteller-Logos
export const MANUFACTURER_LOGOS: Record<string, { svg?: string; webp?: string; label: string }> = {
  abarth: { svg: '/images/logos/abarth.svg', webp: '/images/logos/abarth.webp', label: 'Abarth' },
  aiways: { webp: '/images/logos/aiways.webp', label: 'Aiways' },
  'alfa-romeo': { svg: '/images/logos/alfaromeo.svg', webp: '/images/logos/alfa-romeo.webp', label: 'Alfa Romeo' },
  alpine: { svg: '/images/logos/alpine.svg', webp: '/images/logos/alpine.webp', label: 'Alpine' },
  amphicar: { webp: '/images/logos/amphicar.webp', label: 'Amphicar' },
  'aston-martin': { svg: '/images/logos/astonmartin.svg', webp: '/images/logos/aston-martin.webp', label: 'Aston Martin' },
};

// Fetch all logos from dynamic storage bucket
import { supabase } from '@/integrations/supabase/client';

export interface DynamicLogo {
  name: string;  // filename without extension
  url: string;
}

export async function fetchManufacturerLogos(): Promise<DynamicLogo[]> {
  const { data, error } = await supabase.storage.from('manufacturer-logos').list('', {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error || !data) return [];

  // Group files by base name, prefer PNG > WebP > JPG (never SVG for AI generation)
  const RASTER_EXTS = ['.png', '.webp', '.jpg', '.jpeg'];
  const byName = new Map<string, { name: string; ext: string; fullName: string }>();

  for (const f of data) {
    if (!f.name || f.name.startsWith('.')) continue;
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    // Skip SVG – Gemini cannot process vector graphics
    if (ext === '.svg') continue;
    if (!RASTER_EXTS.includes(ext)) continue;
    const baseName = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    const existing = byName.get(baseName);
    // Priority: png > webp > jpg/jpeg
    const priority = (e: string) => e === '.png' ? 0 : e === '.webp' ? 1 : 2;
    if (!existing || priority(ext) < priority(existing.ext)) {
      byName.set(baseName, { name: baseName, ext, fullName: f.name });
    }
  }

  return Array.from(byName.values()).map(entry => ({
    name: entry.name,
    url: supabase.storage.from('manufacturer-logos').getPublicUrl(entry.fullName).data.publicUrl,
  }));
}
