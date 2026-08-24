/**
 * Motorrad-Prompt-Modul.
 *
 * STRIKTE TRENNUNG: Diese Blöcke gelten AUSSCHLIESSLICH für vehicleClass
 * 'motorcycle'. Sie enthalten keine Pkw- oder Lkw-Annahmen (Karosserie,
 * Türen, Kofferraum, Dachhimmel, Fahrerhaus).
 */

export const MOTORCYCLE_PROMPT_PROFILE = 'motorcycle' as const;

export const MOTORCYCLE_IDENTITY_LOCK = `MOTORCYCLE IDENTITY LOCK — the output must be the SAME physical motorcycle as the reference:
1. Preserve the exact frame type, tank shape, fairing type (naked / half fairing / full fairing / tourer), seat unit and tail geometry.
2. Preserve engine type and visible cylinder layout, exhaust routing, silencer shape and position, chain/belt/shaft drive.
3. Preserve fork type (telescopic / USD), swingarm, single- vs. dual-sided swingarm, suspension components and brake discs/calipers.
4. Preserve handlebar type, mirrors, windscreen, headlight and taillight geometry, indicators and license plate holder.
5. Preserve rim design, spoke count, tire profile and any OEM badges/lettering exactly.
6. NO CLASS DRIFT: never turn the motorcycle into a different model family (naked → sportbike, scooter → cruiser) and never add a car or trailer element.
VERIFICATION: If any of the above differs from the reference, the image is invalid.`;

export const MOTORCYCLE_NEGATIVE_CONSTRAINTS = `MOTORCYCLE-SPECIFIC PROHIBITIONS:
- Do NOT add a rider, helmet, luggage, top case, panniers or accessories that are absent in the reference.
- Do NOT remove present accessories (crash bars, top case mount, screen) if they ARE in the reference.
- Do NOT invent stickers, race numbers, decals or sponsor graphics.
- Do NOT change the stance: keep the original side stand / center stand position exactly. The motorcycle must stand stable and physically plausible, never floating or leaning without support.
- Do NOT generate car parts (doors, bumpers, roof, windshield wipers) or any second vehicle in the frame.`;

/** Perspektiv-Prompts für die Motorrad-Slots. */
export const MOTORCYCLE_PERSPECTIVE_PROMPTS: Record<string, string> = {
  '34front': `SHOT_TYPE: Exterior - Front 3/4 Hero View (motorcycle)
CAMERA_ANGLE: Eye-level to slightly above wheel height, 30-45° off the front center axis.
FRAMING: Front wheel, fork, headlight, tank and one full flank visible. Complete motorcycle in frame with minimum 5% padding on all edges. Side stand / center stand support must stay visible and plausible.`,

  'side': `SHOT_TYPE: Exterior - Perfect Side Profile (motorcycle)
CAMERA_ANGLE: Exactly perpendicular (90°) to the motorcycle's flank, camera at wheel-hub height.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette from front wheel to tail in frame.`,

  'rear': `SHOT_TYPE: Exterior - Direct Rear View (motorcycle)
CAMERA_ANGLE: Eye-level, perfectly centered on the rear axis.
FRAMING: Taillight, rear wheel, silencer(s), license plate holder and tail unit symmetrically framed.`,

  'moto-seat-front': `SHOT_TYPE: Detail - Rider Seat (Fahrersitz)
CAMERA_ANGLE: Elevated three-quarter view onto the rider saddle, roughly 45° from above and slightly from the side.
FRAMING: The rider seat fills the frame with visible surrounding context (tank rear edge, frame, seat lock area).
PRESERVATION_PRIORITY: Seat cover material, texture, stitching, seams, colour and any embossed logo MUST match the reference exactly. Never invent new stitching patterns or badges.`,

  'moto-seat-rear': `SHOT_TYPE: Detail - Pillion Seat (Rücksitz)
CAMERA_ANGLE: Elevated three-quarter view onto the pillion/passenger seat, roughly 45° from above and slightly from the side.
FRAMING: The pillion seat, grab rails/straps and tail unit are visible.
PRESERVATION_PRIORITY: Seat cover material, texture, stitching, colour, grab rail shape and mounting hardware MUST match the reference exactly. If the reference has NO pillion seat (single-seat cowl), reproduce the cowl and do NOT invent a seat.`,
};

export function buildMotorcyclePromptBlocks(): string[] {
  return [
    `<MOTORCYCLE_IDENTITY_LOCK>\n${MOTORCYCLE_IDENTITY_LOCK}\n</MOTORCYCLE_IDENTITY_LOCK>`,
    `<MOTORCYCLE_NEGATIVE_CONSTRAINTS>\n${MOTORCYCLE_NEGATIVE_CONSTRAINTS}\n</MOTORCYCLE_NEGATIVE_CONSTRAINTS>`,
  ];
}
