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
  /** Optional list of body cleanup items to strip (Schriftzüge, Logos, Schilder, Sticker, …) */
  cleanupItems?: string[];
  /** Optional vision-pre-scan inventory of non-OEM branding on this specific image */
  detectedBranding?: import('./detect-branding').DetectedBrandingItem[];
}

/** Bereinigungs-Optionen für Fahrzeug-Karosserie (z.B. LKW-Spedition entfernen) */
export const CLEANUP_OPTIONS = [
  {
    value: 'lettering',
    label: 'Schriftzüge',
    prompt: 'ALL painted, printed, vinyl or magnetic lettering, company names, slogans, taglines, URLs, phone numbers, e-mails, and any other text on the vehicle body (doors, side panels, rear, cab front, wind deflectors, tailgate, tarpaulin, box body, trailer walls, wheel arches). Remove them fully and reconstruct the underlying body paint, panel, tarpaulin or trim texture seamlessly.',
  },
  {
    value: 'logos',
    label: 'Logos / Firmenlogos',
    prompt: 'ALL company logos, brand marks of the operator/fleet (NOT the vehicle manufacturer badge), transport-company emblems, association logos, sponsor logos on any body surface. Remove them fully and reconstruct the underlying paint or panel material seamlessly. Keep only the original vehicle-manufacturer emblem and model badge.',
  },
  {
    value: 'signs',
    label: 'Schilder',
    prompt: 'ALL attached signs, name plates, warning boards, hazard plaques, ADR plates, operator plates, route boards, destination signs, magnetic signs, screwed-on identification boards on the body. Remove them and rebuild the mounting surface flush with the surrounding body.',
  },
  {
    value: 'stickers',
    label: 'Sticker / Aufkleber',
    prompt: 'ALL stickers, decals, adhesive graphics, foil wraps of the fleet operator, promotional decals, partial wraps, colored side stripes that were added post-factory. Remove them and reconstruct clean OEM paint. (Keep small mandatory legal stickers such as TÜV/HU inspection dots on the plate area only if the plate is kept.)',
  },
  {
    value: 'banners',
    label: 'Werbebanner / Planen-Werbung',
    prompt: 'ALL advertising banners, printed tarpaulins/curtainsides with company graphics, tarp-mounted logos, side-curtain prints on trucks/trailers. Replace printed tarps with a clean, neutral, single-color factory tarpaulin in a subtle neutral tone that matches the vehicle, without ANY text or graphics.',
  },
  {
    value: 'external-accessories',
    label: 'Externe Anbauteile',
    prompt: 'ALL non-OEM external accessories that carry branding: flag poles, pennant holders, roof-mounted light bars with company names, extra antennas with logos, magnetic taxi/rental/company signs. Keep OEM antennas, OEM mirrors, and OEM lights untouched.',
  },
  {
    value: 'trailer',
    label: 'Auflieger / Anhänger entfernen',
    prompt: 'REMOVE the complete detachable trailer / semi-trailer / drawbar trailer. Preserve the powered tractor unit (Zugmaschine) exactly and show it uncoupled, alone. Follow the dedicated TRACTOR_TRAILER_SEPARATION block exactly.',
  },
] as const;

export const SCENE_OPTIONS = [
  { value: 'none', label: 'Keine Änderung am Bild', group: 'none' as const },
  { value: 'showroom-1', label: 'Showroom 1 – Modern Hell', preview: '/images/showrooms/showroom-1.webp', group: 'indoor' as const },
  { value: 'showroom-2', label: 'Showroom 2 – Elegant', preview: '/images/showrooms/showroom-2.webp', group: 'indoor' as const },
  { value: 'showroom-3', label: 'Showroom 3 – Glasfront', preview: '/images/showrooms/showroom-3.webp', group: 'indoor' as const },
  { value: 'custom-showroom', label: 'Eigener Showroom', group: 'indoor' as const },
  { value: 'parking-garage', label: 'Tiefgarage / Parkhaus', group: 'indoor' as const },
  { value: 'forest', label: 'Wald', group: 'outdoor' as const },
  { value: 'mountain', label: 'Berglandschaft', group: 'outdoor' as const },
  { value: 'city', label: 'Stadtkulisse', group: 'outdoor' as const },
  { value: 'street', label: 'Straße', group: 'outdoor' as const },
  { value: 'beach', label: 'Strand', group: 'outdoor' as const },
  { value: 'desert', label: 'Wüste', group: 'outdoor' as const },
  { value: 'night-city', label: 'Stadt bei Nacht', group: 'outdoor' as const },
  { value: 'racetrack', label: 'Rennstrecke', group: 'outdoor' as const },
  { value: 'mansion', label: 'Villa / Anwesen', group: 'outdoor' as const },
  { value: 'dealer-lot', label: 'Fahrzeugplatz', group: 'outdoor' as const },
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

/**
 * Get the CINEMATIC, scene-specific lighting profile.
 * Admin can override per scene via key `remaster_scene_lighting_<sceneKey>`.
 * Falls back to the generic exterior lighting block when no profile exists.
 */
function getSceneLightingPrompt(
  overrides: Record<string, string>,
  sceneKey: string,
  fallback: string,
): string {
  const overrideKey = `remaster_scene_lighting_${sceneKey}`;
  const override = overrides[overrideKey];
  if (override && override.trim() && override.trim().toLowerCase() !== 'default') return override;
  const profile = SCENE_LIGHTING_PROFILES[sceneKey];
  return profile ? `${profile}\n\n${fallback}` : fallback;
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
ROOF_RULE: Roof MUST be CLOSED with a SOLID, OPAQUE, DARK headliner (Dachhimmel) – NO panoramic sunroof, NO glass roof, NO sky/ceiling visible through the roof. Default to closed solid headliner if unsure.
PRESERVATION_PRIORITY: Dashboard layout, steering wheel shape, upholstery colors, trim finishes, button legends, screen content, icons, and all visible inscriptions MUST match the reference images exactly.
FORBIDDEN: Do NOT crop roof. Do NOT shoot from above without roof. Do NOT generate an exterior view. Do NOT add a panoramic/glass sunroof. Do NOT show the showroom ceiling through the car roof.
WINDOW_VIEW: The selected showroom/scene MUST be visible THROUGH the windshield – NOT a random outdoor scene.
</CURRENT_PERSPECTIVE>`,

  'interior-rear': `<CURRENT_PERSPECTIVE>
SHOT_TYPE: Interior - Driver Seat POV Looking Backward
CAMERA_ANGLE: From driver seat position, looking at rear seats, headrests, and rear bench.
STRUCTURAL_INTEGRITY: Complete roof, ALL B/C pillars, headliner, and rear window MUST be FULLY visible and UNCUT.
ROOF_RULE: Roof MUST be CLOSED with a SOLID, OPAQUE, DARK headliner (Dachhimmel) – NO panoramic sunroof, NO glass roof, NO sky/ceiling visible through the roof. Default to closed solid headliner if unsure.
PRESERVATION_PRIORITY: Rear bench shape, upholstery color, stitching, perforation, seatbelt colors, trim materials, speaker grilles, and all visible inscriptions MUST match the reference images exactly.
FORBIDDEN: Do NOT crop roof. Do NOT shoot from above without roof. Do NOT generate an exterior view. Do NOT add a panoramic/glass sunroof. Do NOT show the showroom ceiling through the car roof.
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

  // ── MIRROR & CAMERA SYSTEM LOCK (LKW / Nutzfahrzeuge: Glasspiegel vs. MirrorCam / OptiView / CMS) ──
  if (!interior) {
    parts.push(`<MIRROR_SYSTEM_LOCK>\n${getBlock(overrides, 'mirror_system_lock')}\n</MIRROR_SYSTEM_LOCK>`);
  }

  // ── VEHICLE SCALE LOCK ──
  if (!interior) {
    const isCustomShowroom = config.scene === 'custom-showroom';
    const scaleLock = getBlock(overrides, 'vehicle_scale_lock');
    parts.push(`<VEHICLE_SCALE_LOCK>\n${scaleLock}${isCustomShowroom ? `\n8. CUSTOM SHOWROOM SCALE: The vehicle must look REALISTICALLY SIZED relative to the showroom architecture. Compare vehicle height to door frames, windows, ceiling. A standard sedan is ~1.4m tall, an SUV ~1.7m. The car must NOT appear oversized or undersized for the space.` : ''}\n</VEHICLE_SCALE_LOCK>`);
  }

  // ── ANTI-CROPPING ──
  parts.push(`<ANTI_CROPPING>\n${getBlock(overrides, 'anti_cropping')}\n</ANTI_CROPPING>`);

  // ── PROFESSIONAL LIGHTING + REFLECTION PURGE (ZERO TOLERANCE for foreign reflections) ──
  parts.push(`<REFLECTION_PURGE>
ABSOLUTE ZERO-TOLERANCE RULE FOR FOREIGN REFLECTIONS — NON-NEGOTIABLE:

PROFESSIONAL AUTOMOTIVE PHOTO STANDARD:
The output must look like a real professional automotive shoot in the selected scene — not a cut-out, not a background swap, not a pasted vehicle. Re-render the vehicle, floor, shadows, glass and reflections as one physically coherent photograph.

VISIBLE LIGHT-SOURCE PROOF:
- The image must clearly show where the light comes from: ceiling LEDs, window bands, LED strips, cove lights, streetlights, sun direction, or studio softboxes depending on the selected scene.
- These NEW light sources MUST appear as natural highlights on the hood, roof, windshield, side windows, shoulder line, chrome trim, rims and glossy black surfaces.
- If the scene has ceiling lights, the hood/roof/paint MUST show soft ceiling-light streaks or shapes. If the scene has windows, glass and paint MUST show window-band reflections. If outdoors, the sun direction must explain the highlights and shadows.
- Do NOT use flat pasted lighting. Do NOT keep the original photo's highlight pattern if it does not match the new scene.

1. PURGE ALL ORIGINAL REFLECTIONS: The reference photo was taken in a DIFFERENT environment (old dealer lot, parking space, street, foreign showroom, photo booth, garage, outdoor scene). EVERY reflection on EVERY reflective surface of the vehicle from that original environment MUST be COMPLETELY ERASED and REPLACED with reflections of the NEW selected scene.

2. AFFECTED SURFACES (re-render reflections on ALL of these):
   - Paint (hood, roof, doors, fenders, trunk, bumpers, side skirts)
   - Windows and windshield (glass reflections)
   - Side mirrors (mirror glass AND mirror housing)
   - Headlight and taillight lenses
   - Chrome trim, window surrounds, grille chrome, exhaust tips
   - Wheel rims (especially polished/chrome/diamond-cut faces)
   - Any glossy black trim, piano black panels, badge surfaces
   - Sunroof / panoramic roof glass

3. FORBIDDEN REFLECTION CONTENT (must NEVER appear anywhere on the vehicle):
   - Trees, sky, clouds, sun, outdoor scenery from the original photo
   - Other cars, parked vehicles, traffic from the original location
   - Buildings, houses, dealership facades, garage doors, signs, billboards from the original
   - People, photographers, camera operators, tripods, lighting rigs from the original shoot
   - Asphalt patterns, parking lot lines, curbs, street markings from the original ground
   - Old dealer logos, banners, price tags, advertising overlays from the original environment
   - Any text, lettering, URLs, or graphics carried over from the original scene

4. ONLY ALLOWED REFLECTIONS: The vehicle's reflective surfaces may ONLY mirror the NEW selected scene — its walls, floor, ceiling, light fixtures, and (if explicitly provided) approved logos. Nothing else.

4B. NATURAL INTEGRATION: Reflections must be subtle, curved by body geometry, and physically plausible — not mirror-perfect CGI and not absent. The floor must receive a believable contact shadow and, on polished/wet floors, a faint natural reflection of the lower body and tires. Tire contact points need ambient occlusion so the vehicle is visibly grounded.

5. WINDOW TRANSPARENCY: Through the vehicle's windows the viewer must see the NEW scene only — never the original environment, never a generic outdoor view, never a black void.

6. VERIFICATION CHECKLIST (apply before finalizing):
   - Scan the hood reflection: does it show ONLY the new ceiling/lights? ✓
   - Scan the door panels: do they reflect ONLY the new walls/floor? ✓
   - Scan the windows: do they reflect ONLY the new scene? ✓
   - Scan side mirrors and chrome: zero foreign content? ✓
   - Scan wheel rims: no asphalt/old-floor reflections? ✓
   If ANY check fails, regenerate that surface from scratch using the NEW scene as the only reflection source.

THIS RULE IS HIGHER PRIORITY THAN PRESERVING THE REFERENCE — paint color and shape are preserved, but reflections are FULLY rebuilt from the new environment.
</REFLECTION_PURGE>`);

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
      const baseExteriorLighting = getBlock(overrides, 'scene_lighting_exterior');
      const exteriorLighting = getSceneLightingPrompt(overrides, config.scene, baseExteriorLighting);
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
  const plateContext = `LICENSE PLATE LOCATIONS (apply to ALL vehicle classes — cars AND trucks/vans/buses):
- PASSENGER CARS: front bumper/grille plate AND rear tailgate/bumper plate.
- TRUCKS / LORRIES: front cab plate (usually low-center on the bumper or grille), rear plate on the tailgate, box body or trailer rear door. Some trucks additionally carry a repeat plate high on the cab or on side panels — treat ALL of these as license plates.
- VANS / TRANSPORTERS: front bumper plate and rear plate on the swing door / roller shutter.
- TRAILERS / SEMI-TRAILERS: rear plate on the trailer, and any repeat plate on the trailer body.
Detect the plate by its standard rectangular shape, EU blue band, country code, and alphanumeric registration — even when partially obscured, dirty, angled, small in frame, or mounted at unusual heights.`;

  if (config.licensePlate === 'blur') {
    parts.push(`<LICENSE_PLATE>\n${plateContext}\n\n${getBlock(overrides, 'license_plate_blur')}\n</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'custom' && config.customPlateImageBase64) {
    parts.push(`<LICENSE_PLATE>
${plateContext}

CRITICAL: A separate reference image of a CUSTOM LICENSE PLATE is provided as an additional input image.
You MUST replace EVERY license plate on the vehicle (front, rear, cab, trailer — see locations above) with this EXACT custom plate image.
Reproduce the plate PIXEL-FOR-PIXEL: exact text, font, colors, EU badge, city seal, spacing, and proportions.
The plate must be photorealistically integrated on each mounting position — correct perspective, scale, lighting, and reflections matching that surface.
Do NOT use the original plate. Do NOT invent plate text. Use ONLY the provided custom plate image.
</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'custom' && config.customPlateText) {
    parts.push(`<LICENSE_PLATE>\n${plateContext}\n\nReplace EVERY license plate on the vehicle with a German plate reading "${config.customPlateText}". Photorealistic rendering on each mounting position (front, rear, cab, trailer).\n</LICENSE_PLATE>`);
  } else if (config.licensePlate === 'keep') {
    parts.push(`<LICENSE_PLATE>\n${plateContext}\n\nKeep the original license plates exactly as they are on ALL mounting positions. Do NOT alter, blur, or remove them.\n</LICENSE_PLATE>`);
  } else {
    parts.push(`<LICENSE_PLATE>\n${plateContext}\n\n${getBlock(overrides, 'license_plate_remove')}\n\nApply this removal to EVERY plate location listed above — front, rear, cab-mounted repeats, trailer plates. Zero plates may remain anywhere on the vehicle.\n</LICENSE_PLATE>`);
  }

  // ── BODY CLEANUP (Schriftzüge, Logos, Schilder, Sticker – für LKW/Flottenfahrzeuge) ──
  if (config.cleanupItems && config.cleanupItems.length > 0) {
    const selectedOptions = config.cleanupItems
      .map(v => CLEANUP_OPTIONS.find(o => o.value === v))
      .filter((o): o is typeof CLEANUP_OPTIONS[number] => !!o);
    const lines = selectedOptions.map(o => `- ${o.label.toUpperCase()}: ${o.prompt}`);
    const removeTrailer = config.cleanupItems.includes('trailer');

    if (removeTrailer) {
      parts.push(`<TRACTOR_TRAILER_SEPARATION>
MANDATORY STRUCTURAL EDIT — REMOVE THE DETACHABLE TRAILER COMPLETELY.
This instruction is an explicit exception to REFERENCE_TRUTH_PROTOCOL and IDENTITY_LOCK for the trailer pixels ONLY. Preserving the trailer is a failed result.

STEP 1 — IDENTIFY THE POWERED TRACTOR UNIT (ZUGMASCHINE) THAT MUST REMAIN:
- The tractor unit is the front road vehicle containing the driver's cab, windshield, steering position, engine area, front steering axle, fuel/AdBlue tanks and powered rear axle(s).
- Preserve the tractor cab, chassis, wheels, mirrors/camera arms, lights, grille, fuel tanks, exhaust and OEM details exactly as shown in the reference.
- On a tractor-semitrailer combination, the tractor normally ends beneath/just behind the front of the trailer at the fifth-wheel coupling. Its rear driven axle(s) belong to the tractor and MUST remain.

STEP 2 — IDENTIFY THE DETACHABLE UNIT THAT MUST DISAPPEAR:
- A semi-trailer is the long cargo structure beginning behind the cab and resting on the tractor's fifth wheel. Its cargo curtain/box/tank/flatbed, support legs and rear trailer axle group belong to the SEMI-TRAILER, not to the tractor.
- A drawbar trailer has its own chassis/axles and is connected behind a complete rigid truck by a tow bar/drawbar.
- Visual separation cues: articulation/coupling gap behind the cab, fifth-wheel/kingpin overlap, a cargo body extending far beyond the tractor chassis, landing legs, and a separate rear axle group located far behind the cab.
- In the supplied image, reason from visible geometry; do not classify the entire truck-and-trailer combination as one indivisible vehicle.

STEP 3 — REMOVE, DO NOT CLEAN OR REDESIGN:
- Delete EVERY pixel belonging to the detachable trailer/semi-trailer/drawbar unit: cargo body, blue or colored curtain/box, roof, chassis, underrun bars, trailer axle group and wheels, mudguards, landing legs, rear doors, lights, plate, cables and shadows/reflections caused by it.
- Removal starts at the kingpin/fifth-wheel coupling boundary for a semi-trailer, or at the drawbar coupling for a conventional trailer.
- Do NOT merely remove its advertising, recolor it, shorten it, make it white/neutral, turn it into a box body, or generate a replacement cargo unit.

STEP 4 — RECONSTRUCT THE NOW-VISIBLE TRACTOR AND SCENE:
- Render a physically plausible uncoupled solo tractor: visible fifth-wheel coupling plate, clean rear chassis frame, catwalk/lines where supported by the reference, tractor rear axle(s), rear lights and mudflaps.
- Reconstruct the selected scene's floor, building/background and open space continuously through the entire area formerly hidden by the trailer.
- Recalculate the tractor's contact shadow only. There must be no trailer-shaped shadow, reflection, ghost outline, cut edge, wheel, support leg or floating fragment.
- Keep the original camera angle and tractor scale; center/reframe the remaining tractor naturally if needed without cropping it.

RIGID-TRUCK SAFETY RULE:
- If there is NO articulation/coupling and the cargo body is permanently mounted on the same powered chassis as the cab, it is a rigid truck body and must remain. Remove only a separately coupled trailer behind it.

FINAL BINARY CHECK BEFORE OUTPUT:
1. Is the driver's cab and powered tractor chassis intact? YES.
2. Is the fifth wheel / uncoupled rear tractor area plausible? YES.
3. Is every part, wheel, shadow and reflection of the detachable trailer gone? YES.
If answer 3 is NO, the image is invalid: redo the removal before returning it.
</TRACTOR_TRAILER_SEPARATION>`);
    }

    // Map cleanup option value -> detected kind (keep in sync with detect-branding.ts)
    const CLEANUP_TO_KIND: Record<string, string> = {
      lettering: 'lettering',
      logos: 'logo',
      signs: 'sign',
      stickers: 'sticker',
      banners: 'banner',
      'external-accessories': 'external-accessory',
    };
    const selectedKinds = new Set(
      config.cleanupItems.map(v => CLEANUP_TO_KIND[v]).filter(Boolean),
    );

    // ── DETECTED_BRANDING inventory (authoritative removal checklist from vision pre-scan) ──
    if (config.detectedBranding && config.detectedBranding.length > 0) {
      const matching = config.detectedBranding.filter(item => selectedKinds.has(item.kind));
      if (matching.length > 0) {
        const inventoryLines = matching.map(item => {
          const bits: string[] = [];
          if (item.text) bits.push(`"${item.text}"`);
          bits.push(`— ${item.location}`);
          if (item.color) bits.push(`, ${item.color}`);
          if (item.size) bits.push(`, ${item.size}`);
          return `- [${item.kind.toUpperCase()}] ${bits.join(' ')}`;
        }).join('\n');
        const kindsWhitelist = Array.from(selectedKinds).join(', ');
        parts.push(`<DETECTED_BRANDING>
A vision pre-scan of THIS EXACT input image identified the following non-OEM elements on this vehicle. Treat this as an AUTHORITATIVE REMOVAL CHECKLIST — every item listed here MUST be gone in the output image:
${inventoryLines}

Rules for using this list:
- Remove ONLY items whose kind is in the user-selected cleanup whitelist: {${kindsWhitelist}}. Any detected item outside this whitelist stays untouched.
- The listed locations are the primary targets, but if you also spot the same kind of non-OEM element in a location the pre-scan missed, remove it too — the list is a minimum, not a maximum.
- Do NOT invent replacement text, logos or graphics on the cleaned surfaces.
</DETECTED_BRANDING>`);
      }
    }

    if (lines.length > 0) {
      const basePaintUnification = !config.changeColor ? `

<BASE_PAINT_UNIFICATION>
BODY PAINT MUST BE ONE SINGLE, UNIFORM OEM COLOR:
1. Identify the dominant OEM base paint color of the vehicle body from the largest, cleanest painted areas (roof, hood, upper doors, rear quarter panels — areas without decals).
2. Extend that EXACT paint color, shade, metallic flake pattern and finish (glossy/matte/pearl) across the ENTIRE painted body: cab, doors, side panels, wind deflectors, spoilers, side skirts, bumpers, wheel arches, fenders, tailgate, box body / trailer walls where they are painted metal.
3. Any surface area that currently shows a different color than this base — stickers, decals, wraps, side stripes, neon/yellow/red accents, camo patterns, gradient graphics, painted logos, printed tarpaulin sections, contrast panels added by the operator — MUST be OVERPAINTED with the identified base color so it becomes visually indistinguishable from the surrounding factory paint.
4. This rule is a SAFETY NET: even if an individual sticker or colored zone was not listed in DETECTED_BRANDING, if it clearly breaks the uniform OEM base color it MUST be painted over with the base color.
5. Preserve genuine OEM two-tone paint schemes ONLY when they are clearly factory (e.g. black roof on a factory two-tone, black plastic lower cladding, black window surrounds). If in doubt whether a color break is factory or operator-added, treat it as operator-added and unify with the base color.
6. WHITELIST (do NOT repaint): OEM manufacturer emblem, OEM model-name lettering, glass, lights, tires, wheels, chrome trim, black plastic cladding, mirror housings that are factory-black, grille.
7. After unification, the entire painted body must look like a single continuous, freshly-polished OEM paint job — no color patches, no ghost outlines of removed graphics, no halos, no seams.
</BASE_PAINT_UNIFICATION>` : '';

      parts.push(`<BODY_CLEANUP>
MANDATORY OPERATOR / FLEET DE-BRANDING (ZERO TOLERANCE — the vehicle must look ready for resale to a new dealer, with NO trace of the previous operator):
${lines.join('\n')}

DEFINITION OF OPERATOR BRANDING (what counts as non-OEM and MUST go):
- Any readable text you can parse as a word, company name, URL, phone number, e-mail, slogan, or tagline that is not the OEM model badge.
- Any graphic, emblem, stripe, wrap, sticker, sign, or banner that would NOT appear on official manufacturer press photos of a base <make> <model> in factory trim.
- If in doubt whether an element is OEM or operator-added, treat it as operator-added and remove it.

SYSTEMATIC SCAN PROCEDURE — check EVERY zone in this order and clean each one before you finalize the image:
front bumper & grille → hood → windshield & wind deflector → both A-pillars → roof & any roof-mounted signs/lights → both doors (upper + lower halves) → both mirrors → both B-pillars → both side panels / cargo box / tarpaulin curtains → wheel arches & mudflaps → both C-pillars & rear quarter panels → rear doors / tailgate → rear bumper → trailer walls & trailer rear (if present).

WHITELIST — keep untouched:
- OEM vehicle-manufacturer emblem (VW, MAN lion, Mercedes-Benz star, Scania griffin, DAF, Volvo iron mark, Iveco, Renault Trucks, etc.).
- OEM model-name lettering placed by the manufacturer (e.g. "Actros", "TGX", "R 500", "FH16").
- OEM type plate / VIN plate.
- Mandatory legal/safety markings integrated by the OEM (retro-reflective contour tape when factory-fitted, DOT/ECE markings).
${basePaintUnification}

RECONSTRUCTION RULES:
- After removal, seamlessly rebuild the underlying surface (paint, panel seams, rivets, trim, tarpaulin fabric weave, glass) so there is no ghosting, halo, color patch, blurred zone, or paint mismatch left behind.
- Preserve the vehicle's factory paint color, metallic flakes, panel geometry, panel gaps, and OEM emblems / model badges of the vehicle manufacturer.
- Do NOT invent new logos, new company names, new decals, or any replacement graphics. The cleaned surfaces must remain FACTORY-CLEAN and neutral.
- Apply this cleanup CONSISTENTLY on every visible side of the vehicle in this image.
</BODY_CLEANUP>`);
    }
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
