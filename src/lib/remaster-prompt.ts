// Dynamic master prompt construction for vehicle image remastering
// Uses structured English XML-tags optimized for Gemini image models
// Prompt blocks are admin-editable via Admin > Prompt-Verwaltung

import { supabase } from '@/integrations/supabase/client';
import { REMASTER_PROMPT_BLOCKS, SCENE_PROMPT_DEFAULTS, SCENE_LIGHTING_PROFILES } from './remaster-prompt-defaults';

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

// ── Admin prompt overrides cache ──
let _cachedOverrides: Record<string, string> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function fetchPromptOverrides(): Promise<Record<string, string>> {
  if (_cachedOverrides && Date.now() - _cacheTime < CACHE_TTL) return _cachedOverrides;
  try {
    const { data } = await supabase
      .from('admin_settings' as any)
      .select('value')
      .eq('key', 'ai_prompts')
      .single();
    _cachedOverrides = ((data as any)?.value as Record<string, string>) || {};
    _cacheTime = Date.now();
    return _cachedOverrides;
  } catch {
    return {};
  }
}

/** Get a prompt block – admin override if set, otherwise default */
function getBlock(overrides: Record<string, string>, blockName: string): string {
  const block = REMASTER_PROMPT_BLOCKS[blockName];
  if (!block) return '';
  const override = overrides[block.key];
  if (override && override.trim() && override.trim().toLowerCase() !== 'default') return override;
  return block.prompt;
}

/** Get a scene description – admin override if set, otherwise default */
function getScenePrompt(overrides: Record<string, string>, sceneKey: string): string {
  const overrideKey = `remaster_scene_${sceneKey}`;
  const override = overrides[overrideKey];
  if (override && override.trim() && override.trim().toLowerCase() !== 'default') return override;
  return SCENE_PROMPT_DEFAULTS[sceneKey] || '';
}

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
PRESERVATION_PRIORITY: Dashboard layout, steering wheel shape, upholstery colors, trim finishes, button legends, screen content, icons, and all visible inscriptions MUST match the reference images exactly.
FORBIDDEN: Do NOT crop roof. Do NOT shoot from above without roof. Do NOT generate an exterior view.
WINDOW_VIEW: The selected showroom/scene MUST be visible THROUGH the windshield – NOT a random outdoor scene.
</CURRENT_PERSPECTIVE>`,

  'interior-rear': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Interior - Driver Seat POV Looking Backward
CAMERA_ANGLE: From driver seat position, looking at rear seats, headrests, and rear bench.
STRUCTURAL_INTEGRITY: Complete roof, ALL B/C pillars, headliner, and rear window MUST be FULLY visible and UNCUT.
PRESERVATION_PRIORITY: Rear bench shape, upholstery color, stitching, perforation, seatbelt colors, trim materials, speaker grilles, and all visible inscriptions MUST match the reference images exactly.
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

const REFERENCE_TRUTH_PROTOCOL = `REFERENCE IMAGES ARE THE ONLY SOURCE OF TRUTH.
- Use ONLY the provided vehicle photos, detail shots, and immutable assets. Do NOT rely on generic brand/model knowledge, training-memory defaults, catalog imagery, or any imagined external source.
- Every visible attribute must match the reference images exactly: color, material, texture, stitching, perforation, trim finish, icons, labels, inscriptions, screen UI, geometry, seams, wear patterns, and proportions.
- Additional detail photos OVERRIDE text instructions whenever there is any conflict.
- If a region is not visible, extend ONLY from immediately adjacent visible evidence with the most conservative continuation possible.
- Never invent a new interior color, upholstery variant, trim insert, ambient light color, badge, text, button legend, or equipment line.`;

/**
 * Build the master prompt from admin-editable blocks.
 * @param config - Remaster configuration
 * @param overrides - Admin prompt overrides (fetched via fetchPromptOverrides)
 * @param vehicleDescription - Optional vehicle description text
 * @param slotKey - Optional perspective slot key
 */
export function buildMasterPrompt(
  config: RemasterConfig,
  vehicleDescription?: string,
  slotKey?: string,
  overrides: Record<string, string> = {},
): string {
  const parts: string[] = [];
  const interior = isInteriorSlot(slotKey);

  // ── Base instruction ──
  parts.push(getBlock(overrides, 'base_instruction'));
  parts.push(`<REFERENCE_TRUTH_PROTOCOL>
${REFERENCE_TRUTH_PROTOCOL}
</REFERENCE_TRUTH_PROTOCOL>`);

  // ── CRITICAL ASSET INTEGRATION (logos FIRST – highest priority) ──
  const hasAnyLogo = (config.showManufacturerLogo && config.manufacturerLogoUrl) || (config.showDealerLogo && config.dealerLogoUrl);
  
  if (hasAnyLogo) {
    const logoLines: string[] = [];
    if (config.showManufacturerLogo && config.manufacturerLogoUrl) {
      logoLines.push(`MANUFACTURER LOGO:
- You are provided with a specific reference image of the manufacturer logo.
- Reproduce this EXACT logo PIXEL-FOR-PIXEL: every color, shape, text element, and proportion.
- Render as a FROSTED GLASS or TRANSPARENT GLASS element mounted on the showroom wall. The logo should appear as if etched or printed onto a premium glass panel – subtle, elegant, and high-end.
- Do NOT add any glow, LED halo, backlight, neon, or illumination effect around or behind the logo. NO light emission of any kind.
- KEEP ALL ORIGINAL COLORS – do NOT convert to silver/chrome/monochrome.
- Position: centered on showroom back wall, at eye level, slightly above vehicle roofline.
- Size: approximately 60-80cm diameter/width. IDENTICAL position, size, and appearance on EVERY image.
- FORBIDDEN: Do NOT redesign, simplify, recolor, vectorize, or create an alternative version. Do NOT add glow or lighting effects. IMMUTABLE ASSET.`);
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
    parts.push(`<NO_LOGO_INSTRUCTION>
Do NOT add ANY logo, brand mark, emblem, or wall decoration to the background.
The showroom wall must remain CLEAN and EMPTY – no manufacturer logos, no dealer logos, no decorative elements.
</NO_LOGO_INSTRUCTION>`);
  }

  // ── IDENTITY LOCK ──
  const colorLock = config.changeColor && config.colorHex
    ? `<COLOR_CHANGE_MANDATE>
PAINT COLOR CHANGE – ABSOLUTE, NON-NEGOTIABLE, APPLIES TO EVERY IMAGE:
1. Change the ENTIRE vehicle exterior paint to EXACTLY hex ${config.colorHex}.
2. This color MUST be applied to ALL body panels, bumpers, fenders, doors, hood, trunk, roof, mirrors, side skirts, rear diffuser, and ANY other painted surface – with ZERO exceptions.
3. Do NOT keep the original color on ANY part of the vehicle. The ENTIRE car must be ${config.colorHex}.
4. Do NOT mix old and new colors. Do NOT leave some panels in the original color. EVERY painted surface is ${config.colorHex}.
5. The finish must be glossy and photorealistic with correct reflections, specular highlights, and color transitions matching the new color.
6. This color change applies to ALL images in this batch – front, rear, side, 3/4, hero, low-angle – EVERY SINGLE ONE must show the vehicle in ${config.colorHex}.
7. VERIFICATION: Before finalizing, confirm that NO original paint color is visible ANYWHERE on the vehicle body.
</COLOR_CHANGE_MANDATE>`
    : 'PAINT COLOR: Reproduce the EXACT paint color, shade, and finish (metallic/matte/pearl) from the original. Do NOT shift, tint, saturate, desaturate, lighten, or darken. Applies to ALL body panels, bumpers, mirrors, and painted surfaces.';

  parts.push(`<IDENTITY_LOCK>\n${colorLock}\n${getBlock(overrides, 'identity_lock')}\n</IDENTITY_LOCK>`);

  // ── VEHICLE SCALE LOCK ──
  if (!interior) {
    const isCustomShowroom = config.scene === 'custom-showroom';
    const scaleLock = getBlock(overrides, 'vehicle_scale_lock');
    parts.push(`<VEHICLE_SCALE_LOCK>\n${scaleLock}${isCustomShowroom ? `\n8. CUSTOM SHOWROOM SCALE: The vehicle must look REALISTICALLY SIZED relative to the showroom architecture. Compare vehicle height to door frames, windows, ceiling. A standard sedan is ~1.4m tall, an SUV ~1.7m. The car must NOT appear oversized or undersized for the space.` : ''}\n</VEHICLE_SCALE_LOCK>`);
  }

  // ── ANTI-CROPPING ──
  parts.push(`<ANTI_CROPPING>\n${getBlock(overrides, 'anti_cropping')}\n</ANTI_CROPPING>`);

  // ── SCENE AND LIGHTING ──
  const scenePrompt = getScenePrompt(overrides, config.scene);
  if (scenePrompt) {
    if (interior) {
      const interiorLighting = getBlock(overrides, 'scene_lighting_interior');
      const isCustomShowroom = config.scene === 'custom-showroom';
      parts.push(`<SCENE_AND_LIGHTING>
WINDOW_VIEW (MANDATORY – NON-NEGOTIABLE):
The view through ALL vehicle windows (windshield, side windows, rear window) MUST show: ${scenePrompt}
${isCustomShowroom ? `A REFERENCE IMAGE of the custom showroom is provided as an additional input image.
The showroom architecture, walls, floor, ceiling, logos, and branding MUST be clearly recognizable THROUGH the vehicle windows.
This is the SAME showroom used for exterior shots – maintain visual consistency.` : ''}
The scene MUST be visible THROUGH the glass naturally and realistically – correct perspective, depth, and lighting.
Do NOT show a random outdoor scene, generic background, or black/dark void through the windows.
The EXACT SAME showroom/scene (same walls, same floor, same ceiling, same lighting) must be visible through windows on EVERY interior image – no variation allowed.
${interiorLighting}
</SCENE_AND_LIGHTING>`);
    } else {
      const isCustomShowroom = config.scene === 'custom-showroom';
      const exteriorLighting = getBlock(overrides, 'scene_lighting_exterior');
      parts.push(`<SCENE_AND_LIGHTING>
ENVIRONMENT: ${scenePrompt}

<ENVIRONMENT_CONSISTENCY_LOCK>
CRITICAL – ABSOLUTE CONSISTENCY ACROSS ALL IMAGES:
1. FLOOR: The floor material, color, texture, tile pattern, reflectivity, and surface finish MUST be PIXEL-IDENTICAL in EVERY image. If the floor is polished gray concrete, it is polished gray concrete in ALL images – never marble, never wood, never a different shade of gray.
2. WALLS: The wall color, material, texture, and any architectural features MUST be IDENTICAL in EVERY image. Same paint color, same panel style, same window positions.
3. CEILING: Same ceiling type, same light fixtures, same lighting positions in EVERY image.
4. LIGHTING DIRECTION: Light sources come from the SAME direction and have the SAME color temperature in EVERY image.
5. CAMERA ENVIRONMENT: When the camera angle changes (front, side, rear, 3/4), you are rotating AROUND the vehicle inside the SAME room. The room does NOT change – only the viewing angle changes.
6. FORBIDDEN VARIATION: Do NOT randomly change floor color, wall texture, lighting mood, or architectural style between images. Every image must look like it was taken in the SAME physical location during the SAME photo session.
</ENVIRONMENT_CONSISTENCY_LOCK>

FLOOR: The floor MUST match the selected showroom/scene exactly.${isCustomShowroom ? ' The floor from the custom showroom reference image is the AUTHORITATIVE source – reproduce its EXACT color, texture, and reflectivity.' : ''}
${exteriorLighting}
${isCustomShowroom ? getBlock(overrides, 'custom_showroom_instruction') : ''}
</SCENE_AND_LIGHTING>`);
    }
  }

  // ── LICENSE PLATE ──
  if (config.licensePlate === 'blur') {
    parts.push(`<LICENSE_PLATE>\n${getBlock(overrides, 'license_plate_blur')}\n</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'custom' && config.customPlateImageBase64) {
    parts.push(`<LICENSE_PLATE>
CRITICAL: A separate reference image of a CUSTOM LICENSE PLATE is provided as an additional input image.
You MUST replace the vehicle's existing license plate with this EXACT custom plate image.
Reproduce the plate PIXEL-FOR-PIXEL: exact text, font, colors, EU badge, city seal, spacing, and proportions.
The plate must be photorealistically integrated – correct perspective, lighting, and reflections matching the vehicle.
Do NOT use the original plate. Do NOT invent plate text. Use ONLY the provided custom plate image.
</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'custom' && config.customPlateText) {
    parts.push(`<LICENSE_PLATE>\nReplace the license plate with a German plate reading "${config.customPlateText}". Photorealistic rendering.\n</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'keep') {
    parts.push(`<LICENSE_PLATE>\nKeep the original license plate exactly as it is. Do NOT alter, blur, or remove it.\n</LICENSE_PLATE>`);
  } else {
    parts.push(`<LICENSE_PLATE>\n${getBlock(overrides, 'license_plate_remove')}\n</LICENSE_PLATE>`);
  }

  // ── INTERIOR RULES (ONLY for interior slots) ──
  if (interior) {
    parts.push(`<INTERIOR_RULES>\n${getBlock(overrides, 'interior_rules')}\n</INTERIOR_RULES>`);
  }

  // ── STRICT NEGATIVE CONSTRAINTS ──
  parts.push(`<STRICT_NEGATIVE_CONSTRAINTS>\n${getBlock(overrides, 'negative_constraints')}\n</STRICT_NEGATIVE_CONSTRAINTS>`);

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
export const MANUFACTURER_LOGOS: Record<string, { svg?: string; webp?: string; label: string }> = {
  abarth: { svg: '/images/logos/abarth.svg', webp: '/images/logos/abarth.webp', label: 'Abarth' },
  aiways: { webp: '/images/logos/aiways.webp', label: 'Aiways' },
  'alfa-romeo': { svg: '/images/logos/alfaromeo.svg', webp: '/images/logos/alfa-romeo.webp', label: 'Alfa Romeo' },
  alpine: { svg: '/images/logos/alpine.svg', webp: '/images/logos/alpine.webp', label: 'Alpine' },
  amphicar: { webp: '/images/logos/amphicar.webp', label: 'Amphicar' },
  'aston-martin': { svg: '/images/logos/astonmartin.svg', webp: '/images/logos/aston-martin.webp', label: 'Aston Martin' },
};

export interface DynamicLogo {
  name: string;
  url: string;
}

export async function fetchManufacturerLogos(): Promise<DynamicLogo[]> {
  const { data, error } = await supabase.storage.from('manufacturer-logos').list('', {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error || !data) return [];

  const RASTER_EXTS = ['.png', '.webp', '.jpg', '.jpeg'];
  const byName = new Map<string, { name: string; ext: string; fullName: string }>();

  for (const f of data) {
    if (!f.name || f.name.startsWith('.')) continue;
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (ext === '.svg') continue;
    if (!RASTER_EXTS.includes(ext)) continue;
    const baseName = f.name.replace(/\.[^.]+$/, '').toLowerCase();
    const existing = byName.get(baseName);
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
