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
    prompt: `<DETAIL_FIDELITY_PROTOCOL>
CRITICAL – EVERY VEHICLE DETAIL MUST BE PIXEL-ACCURATE TO THE REFERENCE IMAGES:

GRILLE (HIGHEST PRIORITY):
- Count the EXACT number of slats, bars, or mesh elements in the reference photo grille.
- Reproduce the EXACT pattern: vertical bars, horizontal bars, honeycomb, diamond, dot-matrix, or mesh – whatever the reference shows.
- The grille shape, outline, and proportions MUST match the reference EXACTLY. Do NOT use a generic brand grille from memory.
- Chrome vs. gloss black vs. matte vs. body-colored surrounds: match the reference EXACTLY.
- Any integrated sensors, cameras, or active shutters visible in the reference MUST appear in the output.
- FORBIDDEN: Do NOT substitute the grille design with a different model year, trim level, or facelift version. The reference image is the ONLY truth.

HEADLIGHTS & TAILLIGHTS:
- Reproduce the EXACT internal LED module layout: count individual LED elements, DRL strip routing, turn signal positions.
- Lens shape, housing contour, and reflector geometry MUST match reference pixel-for-pixel.
- Light signatures (C-shape, L-shape, Thor's Hammer, etc.) are UNIQUE identifiers – reproduce EXACTLY as shown.
- FORBIDDEN: Do NOT use a different generation or facelift headlight design.

WHEELS:
- EXACT rim design – count spokes, reproduce spoke shape, concavity, finish (polished/matte/bi-color/diamond-cut).
- Hub cap with brand logo in correct orientation. EXACT tire sidewall profile.
- NEVER crop any wheel at image edges.

BADGES & EMBLEMS:
- Front badge: EXACT shape, size, material, and mounting position from reference.
- Model designation text: EXACT font, size, spacing, and position on the vehicle.
- Any trim badges (e.g., "Inscription", "R-Design", "AMG", "M Sport") MUST match reference.

BODY DETAILS:
- EXACT body lines, creases, fender flares, air intakes, roof rails, spoilers, exhaust tips, mirror shapes, door handles.
- Window trim, B-pillar finish, roof antenna style – ALL from reference images ONLY.

MATERIALS:
- Match exact finishes – chrome vs. gloss black vs. matte vs. satin vs. brushed aluminum. Do NOT substitute any material.
- If the reference shows chrome window trim, the output MUST show chrome window trim – not black or body-colored.

VERIFICATION CHECKLIST (apply before finalizing):
1. Does the grille pattern EXACTLY match the reference? Count the bars/elements.
2. Do the headlight LED signatures EXACTLY match? Compare shapes.
3. Are all badges in the correct position with correct text?
4. Do wheel spoke count and design match?
5. Are all material finishes (chrome/black/matte) correct?
If ANY check fails, regenerate that detail from the reference image.
</DETAIL_FIDELITY_PROTOCOL>`,
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
- ZERO WHITE BORDERS: The showroom MUST fill the ENTIRE image canvas. Every pixel of every edge MUST show showroom content (walls, floor, ceiling, windows). There must be ABSOLUTELY NO white margins, blank areas, or unfilled edges anywhere in the output.

ENVIRONMENT REPLACEMENT (NON-NEGOTIABLE):
- The original environment from the reference photo (old showroom, old studio, old backdrop, dealer banner strip, abbinder bar, slogan footer, URL line, watermark, advertising overlay) MUST be FULLY DISCARDED.
- Replace it ENTIRELY with the provided custom showroom. ZERO trace of the previous backdrop or any text/graphic overlay may survive — not on the floor, not on walls, not as a faint shadow, not on the vehicle.
- Only the vehicle itself is reused from the reference. Everything else comes from the custom showroom asset.

LOGO CONSISTENCY LOCK:
- The provided logo asset is the SINGLE SOURCE OF TRUTH for any logo on the wall.
- The logo MUST look ABSOLUTELY IDENTICAL across every generated image: same colors, same shape, same proportions, same position, same size, same rendering style.
- Do NOT recolor, restyle, re-letter, mirror, rotate, animate, or "improve" the logo. PIXEL-FOR-PIXEL only.`,
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
- Create overly dramatic, HDR-style, or artificially enhanced lighting – aim for NATURAL photorealism

SOURCE IMAGE OVERLAY REMOVAL (ZERO TOLERANCE — APPLIES EVEN IF VISIBLE IN REFERENCE):
The reference photo may contain dealer banners, abbinder bars, slogans (e.g. "AUTOS KAUFT MAN BEI ..."), URLs, watermarks, footer strips, advertising overlays, price tags, sticker prints on the body, or studio backdrops with branding.
- ALL of these MUST be COMPLETELY REMOVED from the output. They MUST NOT appear in the new image — not as text, not as a strip, not as a faint trace, not on the floor, not on the wall, not on the vehicle body.
- The original studio / showroom / backdrop visible in the reference is REPLACED ENTIRELY by the SELECTED showroom or scene. Zero pixel of the original environment may remain.
- Only the VEHICLE itself is carried over from the reference — never its environment, never any overlay graphic, never any text artifact.
- If the reference shows a logo on a wall, ignore it; only logos explicitly provided as separate reference assets are allowed.`,
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
  'showroom-1': 'Modern, bright dealership showroom. WALLS: Clean white painted walls with subtle warm-white LED strip accent along the top edge. FLOOR: Polished light-gray concrete with a very subtle sheen/reflection – consistent across every image. CEILING: Flat white ceiling with evenly spaced recessed LED downlights. No furniture, no decorations except brand logos if provided. This EXACT room must appear IDENTICAL in every single image.',
  'showroom-2': 'Elegant luxury showroom. WALLS: Warm beige/champagne textured panels with indirect warm lighting from concealed cove lights. FLOOR: High-gloss cream-colored marble tiles with subtle veining – consistent pattern and reflectivity in every image. CEILING: Coffered ceiling with warm recessed spotlights. Designer furniture subtly visible in far background. This EXACT room must appear IDENTICAL in every single image.',
  'showroom-3': 'Light-flooded dealership with floor-to-ceiling glass facade. WALLS: Dark charcoal-gray matte back wall, glass windows on the left side spanning floor to ceiling. FLOOR: Large-format dark gray stone tiles with moderate reflectivity – consistent tile pattern and reflection intensity in every image. CEILING: White with linear recessed LED strip lighting running parallel. This EXACT room must appear IDENTICAL in every single image.',
  'custom-showroom': 'The user has provided a REFERENCE IMAGE of their custom showroom. The vehicle MUST look like it is PHYSICALLY STANDING INSIDE this exact showroom. FLOOR, WALLS, CEILING, and ALL ARCHITECTURAL DETAILS must be reproduced PIXEL-FOR-PIXEL from the reference in EVERY image.',
  'forest': 'Dense, mystical conifer forest. GROUND: Dark brown forest floor covered with moss, fallen pine needles, and small twigs – same ground texture in every image. Trees: Tall conifers with consistent bark texture. LIGHTING: Soft golden light rays filtering through canopy at ~30° angle. Same forest, same ground, same trees in every image.',
  'mountain': 'Paved mountain road. GROUND: Dark gray smooth asphalt road with faded white lane markings. BACKGROUND: Snow-capped mountain peaks against clear blue sky with scattered white clouds. Same mountain range, same road surface in every image.',
  'city': 'Modern city skyline. GROUND: Clean dark asphalt with subtle road texture. BACKGROUND: Glass-facade skyscrapers in warm golden-hour light. Same skyline, same road surface in every image.',
  'street': 'Broad, straight road. GROUND: Fresh dark-gray asphalt with clean lane markings, slight heat shimmer. Vanishing-point perspective. Warm afternoon light from the right. Same road surface in every image.',
  'beach': 'Wide beach setting. GROUND: Firm packed wet sand with a slight golden-tan color and subtle tire-safe texture. BACKGROUND: Turquoise ocean with gentle waves, warm sunset sky. Same sand color and ocean in every image.',
  'desert': 'Desert highway. GROUND: Straight dark asphalt road cutting through sandy terrain with scattered low scrub. BACKGROUND: Vast sandy dunes under clear blue sky with dramatic warm light. Same desert landscape in every image.',
  'night-city': 'City street at night. GROUND: Wet dark asphalt reflecting neon signs and streetlights with colorful puddle reflections. BACKGROUND: Illuminated storefronts and neon signs. Same wet asphalt and neon environment in every image.',
  'parking-garage': 'Modern underground parking garage. GROUND: Polished light-gray concrete floor with painted parking lines and subtle oil stains for realism – consistent floor in every image. WALLS: Clean concrete with painted section numbers. CEILING: Exposed concrete with evenly spaced LED tube lights. Same garage in every image.',
  'racetrack': 'Professional racetrack straight. GROUND: Smooth dark racing asphalt with rubber marks and red-white curbs on the left. BACKGROUND: Grandstands, catch fencing, clear sky. Same track surface in every image.',
  'mansion': 'Villa driveway. GROUND: Interlocking gray-beige stone pavers in herringbone pattern – consistent pattern in every image. BACKGROUND: Mediterranean stone villa with manicured hedges, warm evening light. Same driveway and villa in every image.',
};

/**
 * Per-scene CINEMATIC lighting profiles.
 * Each profile RE-RENDERS reflections, shadows and key/fill light to match the
 * specific architecture/environment – so the hero shot feels cinematic but
 * still PHOTOREALISTIC. If a scene is missing here, the generic
 * `scene_lighting_exterior` block is used as fallback.
 *
 * Each profile must define: KEY_LIGHT (direction, colour temperature, intensity),
 * FILL_LIGHT (bounce/ambient), SHADOW (softness, length, opacity, direction),
 * REFLECTIONS (what the paint and chrome must mirror), MOOD (cinematic intent).
 */
export const SCENE_LIGHTING_PROFILES: Record<string, string> = {
  'showroom-1': `CINEMATIC LIGHTING – Modern Bright Showroom:
KEY_LIGHT: Cool neutral white (5500–6000 K) overhead recessed LED downlights, slightly forward of the vehicle, casting soft directional light onto the hood and roof.
FILL_LIGHT: Bright white-wall bounce wraps around the body for low-contrast, balanced exposure. NO hot spots, NO blown highlights.
SHADOW: Soft, diffused contact shadow directly beneath the vehicle (low opacity 35–45 %), short footprint, edges feathered. Subtle ambient occlusion in wheel wells and underbody. NO multiple harsh shadows.
REFLECTIONS: Paint and chrome MUST mirror the white walls, the LED ceiling strip, and the polished light-gray concrete – with crisp but soft horizon lines on the body. Floor shows a faint, low-contrast mirror reflection of the lower body and tires (≈15–20 % opacity).
MOOD: Clean, modern, magazine-grade studio look – cinematic clarity, photorealistic, NO HDR, NO over-saturation, NO dramatic contrast.`,

  'showroom-2': `CINEMATIC LIGHTING – Elegant Luxury Showroom:
KEY_LIGHT: Warm tungsten/halogen tone (3000–3200 K) from concealed cove lighting and recessed spots, raking gently from above and slightly behind the vehicle.
FILL_LIGHT: Warm beige/champagne wall bounce produces a soft golden ambient wrap on shadow side. Subtle rim light along the upper body edge from cove lights.
SHADOW: Long, very soft, warm-tinted ground shadow trailing slightly forward (low opacity 30–40 %). Shadows feather into the marble. Ambient occlusion under sills and bumpers is gentle.
REFLECTIONS: Paint mirrors warm beige walls and ceiling cove highlights. Cream marble floor produces an elegant, polished reflection of the lower body (≈25–35 % opacity) with the marble veining still faintly visible through it.
MOOD: High-end automotive editorial – warm, refined, jewellery-like. Cinematic but restrained, NEVER orange-cast, NEVER over-exposed.`,

  'showroom-3': `CINEMATIC LIGHTING – Glass-Facade Daylight Showroom:
KEY_LIGHT: Strong, cool natural daylight (6500 K) from the floor-to-ceiling glass facade on the LEFT, acting as a giant softbox. Linear LED strips on the ceiling add a secondary cool fill from above.
FILL_LIGHT: Dark charcoal back wall absorbs light – the right/shadow side of the vehicle is noticeably darker than the window-lit side, producing a clear cinematic chiaroscuro.
SHADOW: A pronounced but SOFT directional shadow falls to the RIGHT of the vehicle (away from the windows), elongated and feathered, opacity 45–55 %. Tires anchor cleanly to the dark stone floor.
REFLECTIONS: Window-side panels mirror the bright glass facade and a hint of skyline silhouette; shadow-side panels mirror the dark charcoal wall. Dark stone floor shows a moderate reflection (≈30 % opacity).
MOOD: Architectural, contemporary, gallery-cinematic – strong directional light, deep but controlled shadows, photorealistic, NEVER muddy, NEVER flat.`,

  'custom-showroom': `CINEMATIC LIGHTING – Custom Showroom Match:
ANALYSE the provided custom-showroom reference image and EXTRACT its real lighting:
- KEY_LIGHT direction, colour temperature and intensity (window light? ceiling spots? cove lighting?)
- FILL_LIGHT colour from the dominant wall/ceiling bounce
- Floor reflectivity and tone
Then RE-RENDER the vehicle as if photographed under EXACTLY those lights:
SHADOW: Cast a soft, realistic ground shadow whose direction, length and softness match the extracted key light. Opacity 35–50 %, feathered edges, subtle ambient occlusion under the body.
REFLECTIONS: Paint and chrome MUST mirror the actual walls, ceiling, windows and floor of the custom showroom – not a generic studio. The window-/light-side body panels are clearly brighter than the shadow-side panels.
MOOD: Cinematic but PHOTOREALISTIC – the car must look like it was physically photographed inside that exact room during the same shoot, NOT pasted in.`,

  'forest': `CINEMATIC LIGHTING – Forest Golden Hour:
KEY_LIGHT: Warm low-angle golden light (3500–4000 K) breaking through the canopy at ~30°, producing soft god-rays and a warm rim along the upper body edge.
FILL_LIGHT: Cool greenish ambient bounce from foliage on the shadow side – subtle, never tinting the paint unrealistically.
SHADOW: Dappled, soft, organically shaped shadows from leaves and branches across the ground and lightly across the lower body. Main contact shadow under the vehicle is soft, opacity 40–55 %.
REFLECTIONS: Paint mirrors trees, sky patches and warm sun streaks. Subtle dust haze in the light beams.
MOOD: Cinematic, atmospheric, slightly hazy – like a high-end car commercial, NEVER over-saturated.`,

  'mountain': `CINEMATIC LIGHTING – Alpine Daylight:
KEY_LIGHT: Crisp high-altitude sunlight (5800–6200 K) from upper-left, very directional, slightly cool.
FILL_LIGHT: Bright sky-dome bounce on shadow side keeps panels readable; cool blue ambient.
SHADOW: Sharp but clean ground shadow to the lower-right, opacity 50–60 %, hard-feathered edges – matching real high-altitude sunlight.
REFLECTIONS: Paint mirrors the snow-capped peaks and the deep blue sky with a clear horizon line on the body.
MOOD: Epic, cinematic, crystal-clear – hero-shot energy, photorealistic, NEVER washed out.`,

  'city': `CINEMATIC LIGHTING – Urban Golden Hour:
KEY_LIGHT: Warm low sun (3200–3600 K) from one side, producing a strong warm rim on the body edge facing the sun.
FILL_LIGHT: Cool sky bounce on the opposite side; subtle warm bounce from glass facades.
SHADOW: Long, soft, warm-tinted shadow stretched across the asphalt opposite the sun, opacity 45–55 %.
REFLECTIONS: Paint mirrors the glowing glass skyscrapers and the warm sky. Faint window-grid reflections on the side panels.
MOOD: Cinematic urban hero shot – warm, premium, slightly filmic, NEVER orange-overcooked.`,

  'street': `CINEMATIC LIGHTING – Open Road Afternoon:
KEY_LIGHT: Warm afternoon sun (4000 K) from the right, raking along the body.
FILL_LIGHT: Soft sky bounce on the shaded side keeps detail visible.
SHADOW: Clean directional shadow to the left of the vehicle on the asphalt, opacity 50 %, soft edges.
REFLECTIONS: Paint mirrors road, sky and a faint horizon line.
MOOD: Cinematic travel-shot – realistic, warm, balanced, NEVER flat.`,

  'beach': `CINEMATIC LIGHTING – Beach Sunset:
KEY_LIGHT: Warm low sunset (2800–3200 K) from one side, producing a strong amber rim on the upper body.
FILL_LIGHT: Cool turquoise ambient bounce from the ocean on the opposite side.
SHADOW: Long soft shadow on wet sand, opacity 40–50 %, slightly elongated.
REFLECTIONS: Paint mirrors the warm sky gradient, the ocean horizon line and faint cloud highlights. Wet sand under the tires shows a subtle mirror reflection.
MOOD: Cinematic, romantic, premium – glowing but PHOTOREALISTIC, NEVER cartoonish.`,

  'desert': `CINEMATIC LIGHTING – Desert Hard Light:
KEY_LIGHT: Strong overhead-to-side sun (5200 K), very directional.
FILL_LIGHT: Warm sand bounce from below adds a subtle golden glow on the lower body.
SHADOW: Crisp, well-defined shadow on the asphalt, opacity 55–65 %, slightly elongated.
REFLECTIONS: Paint mirrors the open sky, distant dunes and the road. Clear horizon line on the body sides.
MOOD: Cinematic, vast, hero-grade – sharp, clean, photorealistic.`,

  'night-city': `CINEMATIC LIGHTING – Neon Night:
KEY_LIGHT: Mixed neon practicals (magenta, cyan, warm amber) from storefronts and signs, plus cool sodium streetlights from above.
FILL_LIGHT: Coloured bounce from wet asphalt and signage; the body picks up gradient neon reflections along its sides.
SHADOW: Soft, multi-directional shadows from competing light sources, low opacity 30–40 %, blending into wet asphalt reflections.
REFLECTIONS: Paint and wet asphalt strongly mirror the neon signs in vivid streaks. Headlights/taillights add controlled local glow on nearby surfaces – NEVER overblown.
MOOD: Cinematic, cyberpunk-tinged but REAL – like a Blade Runner-style automotive shot, photorealistic, NEVER cartoon.`,

  'parking-garage': `CINEMATIC LIGHTING – Concrete Garage:
KEY_LIGHT: Cool LED tubes (5000 K) from above, evenly spaced, producing soft repeating highlights along the roof and hood.
FILL_LIGHT: Concrete walls bounce a neutral gray ambient – low contrast, slightly moody.
SHADOW: Soft contact shadow directly beneath the vehicle, opacity 40–50 %. Subtle additional shadow bands from ceiling fixtures.
REFLECTIONS: Paint mirrors the polished concrete floor and the row of ceiling lights as repeating soft highlights along the bodyline.
MOOD: Cinematic, industrial, moody but clean – like a premium car-launch indoor shot, photorealistic.`,

  'racetrack': `CINEMATIC LIGHTING – Track Daylight:
KEY_LIGHT: Bright neutral daylight (5500 K), slightly side-lit to emphasise the bodyline.
FILL_LIGHT: Asphalt bounce and sky-dome ambient.
SHADOW: Crisp side shadow on the track, opacity 50–60 %, sharp but feathered.
REFLECTIONS: Paint mirrors the curbs, grandstands silhouette and the open sky.
MOOD: Cinematic motorsport hero shot – sharp, energetic, photorealistic.`,

  'mansion': `CINEMATIC LIGHTING – Villa Evening:
KEY_LIGHT: Warm late-evening sun (3000–3400 K) from a low angle, raking across the stone pavers.
FILL_LIGHT: Warm wall bounce from the villa facade on the shadow side.
SHADOW: Long soft warm shadow stretched across the herringbone pavers, opacity 40–50 %.
REFLECTIONS: Paint mirrors the villa facade, hedges and warm sky.
MOOD: Cinematic luxury lifestyle – elegant, glowing, premium, photorealistic.`,
};
