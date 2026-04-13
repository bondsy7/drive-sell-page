/**
 * Default prompt blocks for the remaster system.
 * Each block can be overridden via Admin > Prompt-Verwaltung (key: remaster_<blockName>).
 * These are used by buildMasterPrompt() in remaster-prompt.ts.
 */

export const REMASTER_PROMPT_BLOCKS: Record<string, { key: string; label: string; description: string; prompt: string }> = {
  base_instruction: {
    key: 'remaster_base_instruction',
    label: 'Basis-Anweisung',
    description: 'Einleitender Prompt mit Rollenanweisung und Output-Format (4:3).',
    prompt: `You are a top-tier professional automotive commercial photographer and retoucher.
TASK: Remaster the provided reference vehicle photo into a flawless, dealership-quality promotional image.

<OUTPUT_FORMAT>
ASPECT RATIO: The output image MUST be in 4:3 (landscape) format. Width-to-height ratio = 4:3 exactly.
This applies to EVERY generated image without exception.
</OUTPUT_FORMAT>`,
  },

  identity_lock: {
    key: 'remaster_identity_lock',
    label: 'Identity Lock (Fahrzeug-Treue)',
    description: 'Sichert die exakte Reproduktion von Lack, Felgen, Lichtern, Grill und Karosseriedetails.',
    prompt: `WHEELS: EXACT rim design – spoke count, shape, concavity, finish (polished/matte/bi-color/diamond-cut). Hub cap with brand logo. EXACT tire profile. NEVER crop any wheel at image edges.
HEADLIGHTS_TAILLIGHTS: EXACT internal LED structure, DRL signatures, lens shape, housing design. NEVER crop or alter.
GRILLE_BADGES: EXACT grille mesh pattern, badge shape, material, model designation in exact position, size, font.
BODY_DETAILS: EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirror shapes, door handles.
MATERIALS: Match exact finishes – chrome vs. gloss black vs. matte vs. satin. Do NOT substitute.`,
  },

  vehicle_scale_lock: {
    key: 'remaster_vehicle_scale_lock',
    label: 'Vehicle Scale Lock (Größe & Position)',
    description: 'Regeln für konsistente Fahrzeuggröße (40-50% Bildbreite), Zentrierung, Bodenkontakt und Anti-Weißrand.',
    prompt: `ABSOLUTE SCALE AND POSITION RULES – ZERO DEVIATION BETWEEN IMAGES:
1. CONSISTENT SIZE: The vehicle MUST occupy EXACTLY 40-50% of the image WIDTH in EVERY full-body exterior shot. NOT more, NOT less. The vehicle should appear as if photographed from a moderate distance – NOT filling the frame.
2. VERTICAL CENTER: The vehicle's vertical center (wheel-to-roof midpoint) MUST be at approximately 55% from the top of the image.
3. HORIZONTAL CENTER: The vehicle's center of mass MUST be horizontally centered (50% ± 5%) for symmetric views. For 3/4 views, shift up to 10% toward the camera side.
4. GROUND PLANE: ALL four wheels MUST sit on the SAME ground plane. The floor line MUST be at approximately 72-78% from the top.
5. NO VARIATION: The vehicle must appear the EXACT same physical size across ALL perspectives – front, side, rear, 3/4.
6. BREATHING ROOM: Maintain at least 15% padding between vehicle and image edge on all sides. The scene/showroom MUST be generously visible around the car.
7. PERSPECTIVE CONSISTENCY: Even when camera angle changes, the apparent size must remain constant. Wide-angle distortion is FORBIDDEN.
8. FULL BLEED: The generated image MUST fill the ENTIRE canvas edge-to-edge. There must be ZERO white borders, ZERO blank margins, ZERO unfilled edges. The background/scene MUST extend to every pixel of the image boundary.
9. DEPTH PLACEMENT: The vehicle should appear to be standing a few meters INSIDE the scene – NOT pressed against the camera. There should be visible floor/ground BETWEEN the camera and the front of the vehicle, creating natural depth.`,
  },

  anti_cropping: {
    key: 'remaster_anti_cropping',
    label: 'Anti-Cropping',
    description: 'Verhindert das Abschneiden des Fahrzeugs an Bildkanten.',
    prompt: `The vehicle MUST be FULLY visible – NO part cut off at image edges.
ALL headlights, taillights, and wheels COMPLETELY visible.
Maintain minimum 5% free space between vehicle edge and image border on all sides.`,
  },

  scene_lighting_exterior: {
    key: 'remaster_scene_lighting_exterior',
    label: 'Scene & Lighting (Exterieur)',
    description: 'Licht, Reflexionen und Schatten für Außenaufnahmen. Hier liegt oft das Realismus-Problem!',
    prompt: `REFLECTIONS: Completely re-render ALL vehicle body reflections to match the NEW scene. Remove ALL original reflections from previous environment. The paint must reflect showroom walls, ceiling lights, floor – NOT remnants of original location.
SHADOWS: Generate realistic, SUBTLE ground shadows and ambient occlusion beneath the vehicle. Shadows must be SOFT and NATURAL – not harsh, overly dark, or exaggerated. Tires MUST make realistic contact with floor surface. Shadow direction matches scene lighting. NO floating or hovering.
LIGHTING: Use NATURAL, realistic lighting that matches the scene. Avoid overly dramatic, HDR-style, or artificially enhanced lighting. The goal is PHOTOREALISM – the image should look like a real photograph, not a CGI render. Light should be soft, diffused, and even – matching how a real showroom or location would look.`,
  },

  scene_lighting_interior: {
    key: 'remaster_scene_lighting_interior',
    label: 'Scene & Lighting (Interieur)',
    description: 'Beleuchtung und Fensteransicht für Innenraumaufnahmen.',
    prompt: `WINDOW VIEW (CRITICAL): The selected showroom or scene MUST be clearly visible THROUGH ALL vehicle windows (windshield, side windows, rear window). The showroom architecture, floor, walls, ceiling, and any logos MUST be recognizable through the glass. Do NOT show darkness, random outdoor scenes, or generic backgrounds through windows.
REFLECTIONS: Re-render all glass reflections to match the showroom/scene visible through windows. Interior surfaces (dashboard, trim) should subtly reflect the showroom environment.
LIGHTING: Bright, even, professional interior lighting that matches the showroom's light sources. Improve existing lighting to showroom quality. Light coming through windows should match the showroom's ambient lighting.`,
  },

  custom_showroom_instruction: {
    key: 'remaster_custom_showroom',
    label: 'Eigener Showroom (Integration)',
    description: 'Anweisungen für die Integration des Fahrzeugs in einen benutzerdefinierten Showroom. Hier die Realismus-Regeln anpassen!',
    prompt: `MUTUAL ADAPTATION (CRITICAL):
- This is NOT a simple background swap. You must RE-RENDER the ENTIRE scene as one cohesive photograph – as if a REAL photographer took a REAL photo of this car parked inside this exact showroom.
- PHOTOREALISM IS THE GOAL: The result must be INDISTINGUISHABLE from a real photograph. No CGI look, no artificial lighting, no exaggerated reflections.
- The showroom provides the ENVIRONMENT and LIGHTING. The vehicle must be LIT BY the showroom's actual light sources – matching their direction, color temperature, and intensity.
- The vehicle must CAST SOFT, REALISTIC SHADOWS onto the showroom floor – not overly dark or sharp. Real showroom lighting creates DIFFUSED shadows.
- The showroom floor must show a SUBTLE REFLECTION of the vehicle (if the floor is reflective in the reference) – not mirror-perfect, but natural.
- The vehicle must be PROPORTIONALLY CORRECT relative to the showroom architecture. Compare vehicle height to door frames, windows, ceiling. A sedan is ~1.4m tall, an SUV ~1.7m.
- VEHICLE SIZE IN SHOWROOM: The vehicle MUST appear SMALL relative to the showroom – as if standing several meters AWAY from the camera, DEEP INSIDE the showroom. The car should occupy only 40-50% of the image width. There must be GENEROUS visible floor space in front of and around the vehicle. The showroom architecture (ceiling, walls, windows) must DOMINATE the image composition – the vehicle is an element WITHIN the space, not filling it.
- The camera perspective of the showroom must MATCH the camera perspective of the vehicle shot.
- ALL architectural details, wall logos, branding, furniture MUST remain in their EXACT positions.
- Do NOT overlay or collage. The room MUST be fully visible and recognizable.
- ZERO WHITE BORDERS: The showroom MUST fill the ENTIRE image canvas. Every pixel of every edge MUST show showroom content (walls, floor, ceiling, windows). There must be ABSOLUTELY NO white margins, blank areas, or unfilled edges anywhere in the output.`,
  },

  negative_constraints: {
    key: 'remaster_negative_constraints',
    label: 'Negative Constraints (Verbote)',
    description: 'Strikte Verbote: keine Halluzinationen, keine Proportionsänderungen, keine Personen etc.',
    prompt: `UNDER NO CIRCUMSTANCES SHALL YOU:
- Invent or hallucinate details not in reference photos
- Use generic model-year defaults, brand stereotypes, training-memory assumptions, catalog imagery, or any imagined internet/external reference to fill missing details
- Simplify complex details (multi-spoke rims keep all spokes, LED arrays keep all elements)
- Change vehicle proportions, ride height, or stance
- Add aftermarket parts, humans, animals, or moving objects
- Show other vehicles in background or reflections
- Rotate, flip, or mirror the image
- Carry over reflections from original environment
- Add ANY logo, brand mark, or wall decoration UNLESS a logo image is explicitly provided as a reference asset
- Create overly dramatic, HDR-style, or artificially enhanced lighting – aim for NATURAL photorealism`,
  },

  interior_rules: {
    key: 'remaster_interior_rules',
    label: 'Interior Rules (Innenraum)',
    description: 'Regeln für Innenraumaufnahmen: keine Änderungen, nur Cleanup.',
    prompt: `THIS IS AN INTERIOR SHOT – the following rules are ABSOLUTE and NON-NEGOTIABLE:

1. EXACT COMPOSITION PRESERVATION:
- Output MUST have the EXACT SAME framing, camera angle, and perspective as the reference.
- Do NOT rotate, flip, mirror, zoom, re-frame, or crop differently.

2. ZERO INVENTION / ZERO MODIFICATION:
- Do NOT add ANY element not in the original (no new buttons, screens, trim, ambient lighting).
- Do NOT remove ANY permanent vehicle element (seats, buttons, screens, speakers, vents, pedals).
- Do NOT change ANY material (leather stays leather, alcantara stays alcantara, piano black stays piano black).
- Do NOT change ANY visible color, hue, shade, stitching color, perforation pattern, wood grain, carbon weave, metal finish, screen UI, icon, button legend, warning label, embossing, or inscription.
- If a specific area is not clearly visible in the reference, extend ONLY from immediately adjacent visible surfaces with the most conservative continuation possible. Never guess a different trim line or colorway.
- Additional interior detail photos are AUTHORITATIVE SOURCE MATERIAL and override any text instruction if there is a conflict.

3. CLEANUP ONLY (the ONLY changes allowed):
- Remove items NOT belonging to vehicle: trash, bags, papers, plastic covers, dust, dirt, personal belongings.
- Remove temporary WARNING stickers (keep permanent vehicle labels).
- Clean all surfaces to showroom-ready condition.

4. LIGHTING ENHANCEMENT ONLY:
- Improve to bright, even, professional lighting.
- Do NOT alter glass transparency or window tint.
- Lighting may improve visibility, but it must NEVER re-interpret the actual upholstery or trim color.

5. STRUCTURAL INTEGRITY:
- Roof, ALL pillars (A/B/C), headliner, door panels, sun visors, rearview mirror MUST remain FULLY visible and UNCUT.`,
  },

  license_plate_remove: {
    key: 'remaster_license_plate_remove',
    label: 'Nummernschild Entfernung',
    description: 'Prompt für die vollständige Entfernung des Nummernschilds.',
    prompt: `MANDATORY LICENSE PLATE REMOVAL (ZERO TOLERANCE – NON-NEGOTIABLE):
1. COMPLETELY REMOVE the license plate from the vehicle. The plate, ALL text, numbers, seals, EU badges, and the mounting bracket MUST be GONE.
2. The area where the plate was mounted MUST be seamlessly filled with matching body paint, bumper material, or grille texture – as if NO plate was EVER mounted.
3. Do NOT leave a blank rectangle. Do NOT leave a white/gray placeholder. Do NOT leave any trace of the plate.
4. This applies to FRONT and REAR plates – remove ALL visible plates on the vehicle.
5. VERIFICATION: Before finalizing, check that NO license plate or mounting bracket remnant is visible ANYWHERE on the vehicle.`,
  },

  license_plate_blur: {
    key: 'remaster_license_plate_blur',
    label: 'Nummernschild Blur',
    description: 'Prompt für die Unkenntlichmachung des Nummernschilds.',
    prompt: `MANDATORY: Blur/pixelate the license plate so ALL characters are completely unreadable.
The plate shape may remain visible but NO text, numbers, seals, or EU badges may be legible.
This is NON-NEGOTIABLE – check your output before finalizing.`,
  },
};

// Scene descriptions – also admin-editable
export const SCENE_PROMPT_DEFAULTS: Record<string, string> = {
  'showroom-1': 'Modern, bright dealership showroom. White walls, polished light-gray concrete floor with subtle reflections, minimalist recessed LED ceiling spots, subtle LED accent lighting on the back wall.',
  'showroom-2': 'Elegant luxury showroom. Large glass facades, warm lighting, designer furniture in background, glossy marble-like floor.',
  'showroom-3': 'Light-flooded dealership with floor-to-ceiling glass facade. Dark gray matte back wall, gray tile floor with reflections, full-height glass windows on the left, modern recessed LED ceiling lighting.',
  'custom-showroom': 'The user has provided a REFERENCE IMAGE of their custom showroom. The vehicle MUST look like it is PHYSICALLY STANDING INSIDE this exact showroom.',
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
