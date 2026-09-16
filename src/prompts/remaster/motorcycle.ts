/**
 * Zweirad-Prompt-Modul (Motorrad als primärer Anwendungsfall).
 *
 * STRIKTE TRENNUNG: Diese Blöcke gelten AUSSCHLIESSLICH für vehicleClass
 * 'motorcycle'. Sie enthalten keine Pkw- oder Lkw-Annahmen (Karosserie,
 * Türen, Kofferraum, Dachhimmel, Fahrerhaus, Kühlergrill, Rücksitzbank).
 *
 * Abgedeckte Fahrzeugarten: Motorrad (primär), E-Motorrad, Roller/Scooter,
 * Moped, E-Bike/Pedelec und vergleichbare Zweiräder.
 */

export const MOTORCYCLE_PROMPT_PROFILE = 'motorcycle' as const;

/** Grundsatz: Das Motiv ist IMMER ein Zweirad, niemals ein Auto. */
export const TWO_WHEELER_SUBJECT_LOCK = `TWO-WHEELER SUBJECT LOCK — the subject of every image is a TWO-WHEELED vehicle:
1. The subject has exactly TWO wheels in line (front and rear), a handlebar, a saddle/seat and an open structure. It has NO doors, NO roof, NO windshield wipers, NO cabin, NO rear bench, NO radiator grille, NO trunk.
2. Identify the two-wheeler TYPE strictly from the reference images and keep it: motorcycle (naked / sport / tourer / cruiser / adventure / enduro), electric motorcycle, scooter/moped (step-through frame, floorboard, body panels), e-bike/pedelec (pedals, crank, chainring, battery in frame or rack) or bicycle.
3. TYPE-DEPENDENT PARTS: only render parts that actually exist on the referenced type.
   - Combustion motorcycle/moped: fuel tank, engine with visible cylinders, exhaust/silencer.
   - Electric motorcycle/scooter: battery/motor housing instead of a combustion engine, NO exhaust, NO fuel filler cap unless visible in the reference.
   - E-bike/pedelec/bicycle: pedals, crank, chainring, derailleur/hub, battery pack — NO fuel tank, NO engine, NO exhaust, NO license plate unless present in the reference.
   - Scooter: step-through frame, floorboard, underseat storage lid, small wheels — NO motorcycle-style straddle tank.
4. Never add, remove or invent a part that contradicts the referenced type.
VERIFICATION: If the output could be mistaken for a car, a trike, a quad or a different two-wheeler type than the reference, the image is invalid.`;

export const MOTORCYCLE_IDENTITY_LOCK = `TWO-WHEELER IDENTITY LOCK — the output must be the SAME physical vehicle as the reference:
1. Preserve the exact frame type, tank/body-panel shape, fairing type (naked / half fairing / full fairing / tourer / step-through scooter body), seat unit and tail geometry.
2. Preserve the drive unit exactly as referenced: combustion engine with its visible cylinder layout, exhaust routing and silencer shape, OR electric motor/battery housing; chain, belt, shaft or bicycle drivetrain.
3. Preserve fork type (telescopic / USD / suspension fork), swingarm, single- vs. dual-sided swingarm, suspension components and brake discs/calipers or drum brakes.
4. Preserve handlebar type, grips, levers, mirrors, windscreen, headlight and taillight geometry, indicators, cockpit/display unit and license plate holder.
5. Preserve rim design, spoke count, tyre profile and any OEM badges/lettering exactly.
6. NO CLASS DRIFT: never turn the two-wheeler into a different model family (naked → sportbike, scooter → cruiser, e-bike → motorcycle) and never add a car, trike, sidecar or trailer element.
VERIFICATION: If any of the above differs from the reference, the image is invalid.`;

export const MOTORCYCLE_NEGATIVE_CONSTRAINTS = `TWO-WHEELER-SPECIFIC PROHIBITIONS:
- Do NOT add a rider, helmet, luggage, top case, panniers or accessories that are absent in the reference.
- Do NOT remove present accessories (crash bars, top case mount, screen, basket, child seat) if they ARE in the reference.
- Do NOT invent stickers, race numbers, decals or sponsor graphics.
- Do NOT change the stance: keep the original side stand / center stand position exactly. The vehicle must stand stable and physically plausible, never floating or leaning without support.
- Do NOT generate car or truck parts (doors, bumpers, roof, radiator grille, rear bench, cabin, windshield wipers) and no second vehicle in the frame.
- Do NOT add a fuel tank, exhaust or combustion engine to an electric two-wheeler or e-bike, and do NOT add pedals to a motorcycle.`;

/**
 * Perspektiv-Prompts für die Zweirad-Aufnahmeslots.
 * Links/Rechts sind IMMER fahrzeugrelativ (Sicht des Fahrers), nie Betrachterseite.
 */
export const MOTORCYCLE_PERSPECTIVE_PROMPTS: Record<string, string> = {
  '34front': `SHOT_TYPE: Exterior - Front 3/4 Hero View (two-wheeler)
CAMERA_ANGLE: Eye-level to slightly above wheel height, 30-45° off the front center axis.
FRAMING: Front wheel, fork, headlight, tank/front body panel and one full flank visible. Complete two-wheeler in frame with minimum 5% padding on all edges. Side stand / center stand support must stay visible and plausible.`,

  'side-left': `SHOT_TYPE: Exterior - Perfect LEFT Side Profile (two-wheeler)
CAMERA_ANGLE: Exactly perpendicular (90°) to the vehicle's LEFT flank, camera at wheel-hub height.
CRITICAL DIRECTION: LEFT is the rider's left-hand side (side stand / gear-shift side on most motorcycles). The FRONT wheel MUST point to the RIGHT edge of the image, the REAR wheel to the LEFT edge. Do NOT mirror or flip a right-side image.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette from front wheel to tail in frame.
SIDE_IDENTITY_LOCK: Reproduce exactly the components that belong to this side (side stand, gear lever, sprocket/chain run, exhaust routing on this side, engine cover shape). Never copy the opposite flank.`,

  'side-right': `SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (two-wheeler)
CAMERA_ANGLE: Exactly perpendicular (90°) to the vehicle's RIGHT flank, camera at wheel-hub height.
CRITICAL DIRECTION: RIGHT is the rider's right-hand side (rear-brake pedal side on most motorcycles). The FRONT wheel MUST point to the LEFT edge of the image, the REAR wheel to the RIGHT edge. This MUST be the mirrored viewing direction of the left side profile, but NEVER a flipped copy of it.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette from front wheel to tail in frame.
SIDE_IDENTITY_LOCK: Reproduce exactly the components that belong to this side (brake pedal, silencer/exhaust outlet if routed right, brake disc and caliper, engine cover shape). Never copy the opposite flank.`,

  'rear': `SHOT_TYPE: Exterior - Direct Rear View (two-wheeler)
CAMERA_ANGLE: Eye-level, perfectly centered on the rear axis.
FRAMING: Taillight, rear wheel, silencer(s) if present, license plate holder and tail unit symmetrically framed.`,

  'cockpit': `SHOT_TYPE: Detail - Rider Cockpit / Saddle View (two-wheeler)
CAMERA_ANGLE: Rider's point of view from just above the saddle, looking forward and slightly down onto handlebar, instrument cluster/display and the front of the seat.
FRAMING: Handlebar with grips, levers, switchgear, mirrors, instrument cluster or TFT display, ignition area, tank top / front body panel and the front part of the saddle are visible.
PRESERVATION_PRIORITY: Instrument layout (analogue dials vs. TFT/LCD), switch count and position, grip and lever shape, mirror stalks, key slot and any display content MUST match the reference. Seat cover material, texture, stitching and colour MUST match exactly. Never invent gauges, screens, buttons or stitching patterns. No rider, no hands, no helmet in frame.`,

  // Rückwärtskompatible Alt-Slots (frühere Motorrad-Slots)
  'side': `SHOT_TYPE: Exterior - Perfect LEFT Side Profile (two-wheeler)
CAMERA_ANGLE: Exactly perpendicular (90°) to the vehicle's LEFT flank, camera at wheel-hub height.
FRAMING: Both wheels COMPLETELY visible and perfectly round (zero distortion). Entire silhouette from front wheel to tail in frame.`,

  'moto-seat-front': `SHOT_TYPE: Detail - Rider Seat / Saddle (two-wheeler)
CAMERA_ANGLE: Elevated three-quarter view onto the rider saddle, roughly 45° from above and slightly from the side.
FRAMING: The rider seat fills the frame with visible surrounding context (tank rear edge / body panel, frame, seat lock area).
PRESERVATION_PRIORITY: Seat cover material, texture, stitching, seams, colour and any embossed logo MUST match the reference exactly. Never invent new stitching patterns or badges.`,

  'moto-seat-rear': `SHOT_TYPE: Detail - Pillion Seat (two-wheeler)
CAMERA_ANGLE: Elevated three-quarter view onto the pillion/passenger seat, roughly 45° from above and slightly from the side.
FRAMING: The pillion seat, grab rails/straps and tail unit are visible.
PRESERVATION_PRIORITY: Seat cover material, texture, stitching, colour, grab rail shape and mounting hardware MUST match the reference exactly. If the reference has NO pillion seat (single-seat cowl), reproduce the cowl and do NOT invent a seat.`,
};

export function buildMotorcyclePromptBlocks(): string[] {
  return [
    `<TWO_WHEELER_SUBJECT_LOCK>\n${TWO_WHEELER_SUBJECT_LOCK}\n</TWO_WHEELER_SUBJECT_LOCK>`,
    `<MOTORCYCLE_IDENTITY_LOCK>\n${MOTORCYCLE_IDENTITY_LOCK}\n</MOTORCYCLE_IDENTITY_LOCK>`,
    `<MOTORCYCLE_NEGATIVE_CONSTRAINTS>\n${MOTORCYCLE_NEGATIVE_CONSTRAINTS}\n</MOTORCYCLE_NEGATIVE_CONSTRAINTS>`,
  ];
}
