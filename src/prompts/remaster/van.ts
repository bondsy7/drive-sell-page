/**
 * Transporter-/Nutzfahrzeug-Prompt-Modul (bis 3,5 t).
 *
 * STRIKTE TRENNUNG: Diese Blöcke gelten AUSSCHLIESSLICH für vehicleClass
 * 'van'. Keine Pkw-, Lkw-, Zweirad- oder Reisemobil-Annahmen, und es wird
 * keine bestehende Klassenkonfiguration überschrieben.
 *
 * Abgedeckt: Kastenwagen, Hochdachkombi, Kombi/Bus-Version, Doppelkabine,
 * Pritsche/Plane und Koffer-/Kühlaufbau auf Transporter-Fahrgestell.
 */

export const VAN_PROMPT_PROFILE = 'van' as const;

export const VAN_SUBJECT_LOCK = `LIGHT COMMERCIAL VAN SUBJECT LOCK — the subject of every image is a LIGHT COMMERCIAL VEHICLE (transporter up to 3.5 t):
1. The subject is a panel van, high-roof van, crew van, combi/passenger van, double cab, dropside/curtainside or box/refrigerated body on a van chassis — exactly the variant shown in the reference.
2. Determine roof height, wheelbase, overhang and body length ONLY from the reference. Never stretch a short wheelbase into a long one, never raise a normal roof into a high roof and never shorten a long body.
3. Preserve the exact glazing concept: number and position of side windows, glazed or fully panelled rear doors, glazed or blind sliding door, bulkhead window.
4. Preserve the door concept: sliding door side(s), hinged rear barn doors versus tailgate, their opening angle, and any step, grab handle or footboard.
5. Preserve body add-ons exactly: roof rack or roof rails, roof beacon, ladder, rear step, tow bar, side protection strips, mud flaps, rear parking sensors, reversing camera, plywood lining, shelving where visible.
6. Commercial reality stays intact: steel wheels with hub caps stay steel wheels, plastic bumpers stay unpainted if unpainted, and workhorse proportions are never restyled into a passenger car or an SUV.
VERIFICATION: If the output could be mistaken for a passenger car, an MPV, a motorhome or a heavy truck, the image is invalid.`;

export const VAN_IDENTITY_LOCK = `LIGHT COMMERCIAL VAN IDENTITY LOCK — the output must be the SAME physical vehicle as the reference:
1. Preserve the silhouette: roof height and roof curvature, body length, wheelbase, front and rear overhang, ride height and the exact window line.
2. Preserve the front end as one connected assembly: grille pattern, badge position, headlight housings and complete LED/halogen signature, fog lights, bumper openings, sensors and camera positions.
3. Preserve the rear: barn door split or tailgate, hinge and handle positions, light unit shape and lens pattern, bumper step, number plate recess, reversing sensors.
4. Preserve wheels: rim type (steel with cover or alloy), exact spoke or cover geometry, tyre profile, single or twin rear wheels.
5. Preserve every livery element exactly as referenced — company lettering, signwriting, decals, fleet numbers, adhesive films, colour splits — or keep the body plain if it is plain. Never invent a company logo, phone number or web address.
6. Preserve existing wear honestly: the vehicle is professionally cleaned, but dents, scratches, kerbed rims and body repairs are never removed, smoothed or restyled.
7. Preserve the cargo area exactly: floor and wall lining, lashing eyes, shelving, partition/bulkhead, load height, side door aperture.
VERIFICATION: If any of the above differs from the reference, the image is invalid.`;

export const VAN_INTERIOR_LOCK = `LIGHT COMMERCIAL VAN INTERIOR RULES:
1. Cab and cargo area are shown EMPTY, clean and ready for handover: no people, no hands, no tools, no boxes, no pallets, no packaging, no cables, no rubbish, no personal items on the dashboard.
2. Cab: reproduce the exact dashboard layout, instrument cluster, infotainment screen size and frame, air vents, switch panel, gear lever or shift position, handbrake type, steering wheel rim, spoke count and button islands.
3. Reproduce the exact seat configuration: single seat versus double bench, headrest count and shape, upholstery fabric, pattern and stitching, armrests, seat wear.
4. Reproduce the bulkhead exactly: solid, half-height, glazed or absent — never add or remove a partition.
5. Cargo area: reproduce the floor covering, wall and door lining, lashing rails and eyes, wheel arch covers, interior lighting, tie-down points and any shelving or racking exactly as referenced. Never invent equipment or cargo.
6. Screen and cluster content is neutral and plausible — never invent brand interfaces, navigation maps, warning lights or messages that are absent from the reference.
7. Lighting is even and neutral; window views stay bright and free of fabricated scenery.`;

export const VAN_NEGATIVE_CONSTRAINTS = `LIGHT-COMMERCIAL-VEHICLE-SPECIFIC PROHIBITIONS:
- Do NOT add or remove roof racks, beacons, ladders, tow bars, side steps, mud flaps, aerials, antennas or rear cameras.
- Do NOT change the door concept: barn doors never become a tailgate, a single sliding door never becomes a pair, a blind panel never becomes a window.
- Do NOT open a door, flap or bonnet that is closed in the reference, and never close one that is open.
- Do NOT invent company branding, signwriting, advertising films, fleet numbers or licence-plate content.
- Do NOT load the vehicle: no cargo, pallets, tools, shelving, bikes or straps that are absent in the reference.
- Do NOT generate passenger-car motifs (rear bench beauty shot, boot lid, panoramic roof), motorhome motifs (habitation door, awning, living area) or heavy-truck motifs (fifth wheel, tipper, semi trailer).
- Do NOT lower, widen, restyle or sportify the vehicle, and never replace steel wheels with alloys.`;

/** Perspektiv-Prompts für die Transporter-Aufnahmeslots. */
export const VAN_PERSPECTIVE_PROMPTS: Record<string, string> = {
  '34front': `SHOT_TYPE: Exterior - Front 3/4 Hero View (light commercial van)
CAMERA_ANGLE: Slightly below the window line, 30-40° off the front centre axis, lens levelled so the tall vertical body sides stay parallel (no keystone distortion).
FRAMING: Complete vehicle from front face to rear corner, full roofline and both front wheels visible. Minimum 6% padding on all edges because of the high body volume.
IDENTITY_PRIORITY: Grille and badge, headlight signature, bumper openings, mirror arms, roof height, window line and body length must match the reference exactly.`,

  front: `SHOT_TYPE: Exterior - Direct Head-On Front View (light commercial van)
CAMERA_ANGLE: Headlight height, exactly 0° centre axis, perfectly symmetrical.
FRAMING: Full width front — bonnet, windscreen with wipers, both mirror arms, grille, headlights, fog lights, bumper, number plate recess, front skirt and the full roof edge.
IDENTITY_PRIORITY: Reproduce the grille slat pattern, badge position, complete light signature and sensor placement as one connected assembly. Never borrow a front end from another model generation.`,

  'side-left': `SHOT_TYPE: Exterior - Perfect LEFT Side Profile (light commercial van)
CAMERA_ANGLE: Exactly perpendicular (90°) to the LEFT flank, camera at half body height, far enough back that the long body shows no wide-angle bulge.
CRITICAL DIRECTION: LEFT is the vehicle's own left-hand side (driver side in left-hand-drive markets). The FRONT of the vehicle MUST point to the RIGHT edge of the image. Never mirror or flip a right-side image.
FRAMING: Full length in frame, both wheels completely visible and perfectly round, roofline and side skirt uncropped.
SIDE_IDENTITY_LOCK: Reproduce only what belongs to this flank — sliding door or plain panel, window or blind panel, fuel filler, side protection strip, decals, wheel arch trims.`,

  'side-right': `SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (light commercial van)
CAMERA_ANGLE: Exactly perpendicular (90°) to the RIGHT flank, camera at half body height, no wide-angle distortion.
CRITICAL DIRECTION: RIGHT is the vehicle's own right-hand side (kerb side in left-hand-drive markets). The FRONT of the vehicle MUST point to the LEFT edge of the image. This is the opposite viewing direction of the left profile, NEVER a mirrored copy.
FRAMING: Full length in frame, both wheels completely visible and perfectly round, roofline and side skirt uncropped.
SIDE_IDENTITY_LOCK: Reproduce only what belongs to this flank — sliding door with its handle and rail, side window or blind panel, step, decals, side protection strip.`,

  rear: `SHOT_TYPE: Exterior - Direct Rear View (light commercial van)
CAMERA_ANGLE: Half body height, perfectly centred on the rear axis, symmetrical.
FRAMING: Complete rear — barn doors or tailgate with their exact split line, door handles and hinges, glazing or blind panels, third brake light, rear lights, bumper with step, number plate recess, sensors and roof edge.
IDENTITY_PRIORITY: Door concept, hinge and handle positions, light unit shape and lens pattern and all badges must match the reference exactly. Doors stay closed unless open in the reference.`,

  cockpit: `SHOT_TYPE: Interior - Cab / Driver Workplace (light commercial van)
CAMERA_ANGLE: From the rear of the cab looking forward, slightly above seat-back height, lens corrected so vertical pillars stay vertical.
FRAMING: Steering wheel, full dashboard, instrument cluster, infotainment screen, centre console with gear lever, both cab seats (single seat and/or double bench as referenced), door panels, windscreen and bulkhead edge.
PRESERVATION_PRIORITY: Dashboard layout, screen size and frame, switch positions, seat configuration and upholstery must match the reference exactly. No people, no hands, no clutter.`,

  cargo: `SHOT_TYPE: Interior - Cargo Compartment Through the Open Rear Doors (light commercial van)
CAMERA_ANGLE: Standing centred behind the vehicle at chest height, looking straight into the load space through the opened rear doors.
FRAMING: Both rear doors in their referenced opening angle, load floor, side walls, wheel arch covers, roof lining, bulkhead at the far end, lashing rails and interior light.
PRESERVATION_PRIORITY: Floor and wall lining material, lashing eyes, shelving or racking, load height and door lining must match the reference exactly. The load space is completely EMPTY — never add cargo, tools or packaging.`,

  'sliding-door': `SHOT_TYPE: Detail - Open Sliding Side Door and Loading Aperture (light commercial van)
CAMERA_ANGLE: Perpendicular to the flank at chest height, centred on the door aperture.
FRAMING: Sliding door in its referenced open position, the full aperture with its seal and rail, load floor edge, step, side wall lining and the visible part of the cargo area.
PRESERVATION_PRIORITY: Door side, rail position, aperture width, lining material and step design exactly as referenced. Never move the door to the opposite flank and never invent a second sliding door.`,
};

/** Innenraum-Slots dieser Klasse (klassenlokal – verändert keine andere Klasse). */
export const VAN_INTERIOR_SLOT_KEYS = new Set(['cockpit', 'cargo', 'sliding-door']);

export function isVanInteriorSlot(slotKey?: string): boolean {
  return !!slotKey && VAN_INTERIOR_SLOT_KEYS.has(slotKey);
}

export function buildVanPromptBlocks(interior = false): string[] {
  const blocks = [
    `<VAN_SUBJECT_LOCK>\n${VAN_SUBJECT_LOCK}\n</VAN_SUBJECT_LOCK>`,
    `<VAN_IDENTITY_LOCK>\n${VAN_IDENTITY_LOCK}\n</VAN_IDENTITY_LOCK>`,
  ];
  if (interior) {
    blocks.push(`<VAN_INTERIOR_LOCK>\n${VAN_INTERIOR_LOCK}\n</VAN_INTERIOR_LOCK>`);
  }
  blocks.push(`<VAN_NEGATIVE_CONSTRAINTS>\n${VAN_NEGATIVE_CONSTRAINTS}\n</VAN_NEGATIVE_CONSTRAINTS>`);
  return blocks;
}
