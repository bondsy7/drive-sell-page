/**
 * Reisemobil-/Freizeitfahrzeug-Prompt-Modul.
 *
 * STRIKTE TRENNUNG: Diese Blöcke gelten AUSSCHLIESSLICH für vehicleClass
 * 'motorhome'. Sie enthalten keine Pkw-, Lkw- oder Zweirad-Annahmen und
 * überschreiben keine bestehende Klasse.
 *
 * Abgedeckte Aufbauten: Teilintegriert, Alkoven, Vollintegriert,
 * Kastenwagen (Campervan) und Wohnwagen (Anhänger ohne Fahrerhaus).
 */

import type { MotorhomeBodyTypeKey } from '@/config/vehicle-class-types';

export const MOTORHOME_PROMPT_PROFILE = 'motorhome' as const;

export const MOTORHOME_SUBJECT_LOCK = `RECREATIONAL VEHICLE SUBJECT LOCK — the subject of every image is a LEISURE / RECREATIONAL VEHICLE:
1. The subject is a motorhome, camper van or towed caravan with a habitation body: habitation door, habitation windows (often acrylic/hopper windows with integrated blinds), roof fittings (air conditioner, roof lights/skylights, satellite dome, solar panels), external service flaps and a rear garage or storage locker where present.
2. Identify the body TYPE strictly from the reference images and keep it: semi-integrated (separate cab with overcab hump-free roofline), alcove/overcab (sleeping alcove above the cab), fully integrated (no donor cab visible, full-width panoramic windscreen), camper van / panel van conversion (van silhouette, sliding side door) or caravan/travel trailer (NO cab, NO engine, drawbar with coupling head, jockey wheel, corner steadies).
3. TYPE-DEPENDENT PARTS: render only parts that exist on the referenced type.
   - Caravan: drawbar/A-frame with coupling head, jockey wheel, corner steadies, gas locker — NO cab, NO windscreen wipers, NO headlights of a driving cab, NO engine.
   - Motorhome / camper van: donor cab with windscreen, cab doors, mirrors, headlights and number plate exactly as referenced.
4. Preserve the exact number, position and shape of habitation windows, doors, flaps, awning, roof units, ladders and rear lights.
VERIFICATION: If the output could be mistaken for a passenger car, a box truck or a different recreational body type than the reference, the image is invalid.`;

export const MOTORHOME_IDENTITY_LOCK = `RECREATIONAL VEHICLE IDENTITY LOCK — the output must be the SAME physical vehicle as the reference:
1. Preserve the overall body length, height, overhang, roofline (flat / alcove / pop-top / high-roof) and the exact silhouette.
2. Preserve every exterior graphic, decal stripe, lettering, model badge, colour split and material transition (GRP panel, aluminium sheeting, painted cab) exactly as referenced — never redesign or simplify graphics.
3. Preserve the axle count and wheel position (single axle, twin axle, twin rear wheels), rim design, tyre profile and wheel arch trims.
4. Preserve habitation door position and side, step type, awning brand box and its mounting side, service flaps, gas locker, external sockets, water filler and rear ladder.
5. Preserve roof equipment: air conditioner, skylights/heki, solar panels, antenna, satellite dome — never add or remove any.
6. Preserve the interior layout exactly: furniture positions, seating group shape, kitchen block, bathroom cell, bed type (fixed bed, twin beds, drop-down bed, dinette conversion), upholstery fabric, wood decor, worktop material and every visible fitting.
7. NO CLASS DRIFT: never turn one body type into another (caravan → motorhome, semi-integrated → alcove) and never attach a second vehicle, trailer or tow car unless present in the reference.
VERIFICATION: If any of the above differs from the reference, the image is invalid.`;

export const MOTORHOME_INTERIOR_LOCK = `RECREATIONAL VEHICLE INTERIOR RULES:
1. The habitation interior must be shown EMPTY, clean and ready for handover: no people, no pets, no food, no dishes, no bedding clutter, no towels, no personal belongings, no cables, no bags, no rubbish.
2. Beds are neatly made with the referenced mattress/cover only — never add decorative pillows, blankets or throws that are absent in the reference.
3. Kitchen: reproduce the exact hob type and burner count, sink and tap shape, worktop material, splash-back, fridge front, drawer/locker fronts and handles. Never invent appliances, coffee machines or built-in ovens.
4. Bathroom: reproduce the exact toilet type and position, shower area, basin, mirror, cabinet fronts, wall panelling and fittings. Never invent a separate shower cabin or a second basin.
5. Living area: reproduce the seating group geometry (L-shape, face-to-face dinette, side sofa), upholstery fabric, pattern and stitching, table shape and mount, window blinds/flyscreens, overhead lockers, wall and ceiling panel colour and every light fitting.
6. Lighting is soft, even and warm; window views are bright and neutral, never a fabricated landscape scene with people or activity.
7. Every measurement, texture and colour comes from the reference photos only.`;

export const MOTORHOME_NEGATIVE_CONSTRAINTS = `RECREATIONAL-VEHICLE-SPECIFIC PROHIBITIONS:
- Do NOT add or remove awnings, bike racks, roof boxes, solar panels, satellite domes, ladders, step boards, spare wheel carriers or towing equipment.
- Do NOT extend an awning that is closed in the reference, and do NOT close an awning that is extended.
- Do NOT deploy levelling jacks, steps or pop-top roofs unless they are deployed in the reference.
- Do NOT add camping scenery: no chairs, tables, grills, tents, campfires, bicycles, people, pets or beach/forest props.
- Do NOT generate passenger-car motifs (radiator grille beauty shots, rear bench, boot lid) or truck motifs (cargo box, fifth wheel, tipper).
- Do NOT invent interior equipment, brand logos, control panels, display content, upholstery patterns or wood decors.
- Do NOT show an interior for a body type where it was not photographed, and never fabricate a room that is missing from the references.`;

/** Perspektiv-Prompts für die Reisemobil-Aufnahmeslots. */
export const MOTORHOME_PERSPECTIVE_PROMPTS: Record<string, string> = {
  '34front': `SHOT_TYPE: Exterior - Front 3/4 Hero View (recreational vehicle)
CAMERA_ANGLE: Slightly below body midline, 30-40° off the front centre axis, lens levelled so the vertical body sides stay parallel (no keystone distortion).
FRAMING: Complete vehicle from front face to rear corner, roof fittings and both front wheels visible. Minimum 6% padding on all edges because of the large body volume.
IDENTITY_PRIORITY: Cab or front panel shape, windscreen, alcove or roofline, habitation door side, decal graphics and roof units must match the reference exactly.`,

  'side-left': `SHOT_TYPE: Exterior - Perfect LEFT Side Profile (recreational vehicle)
CAMERA_ANGLE: Exactly perpendicular (90°) to the LEFT flank, camera at half body height, far enough back that the long body shows no wide-angle bulge.
CRITICAL DIRECTION: LEFT is the vehicle's own left-hand side (driver side in left-hand-drive markets). The FRONT of the vehicle MUST point to the RIGHT edge of the image. Never mirror or flip a right-side image.
FRAMING: Full length in frame, all wheels completely visible and perfectly round, roofline and skirt uncropped.
SIDE_IDENTITY_LOCK: Reproduce only the features that belong to this flank — window count and position, service flaps, awning box, fuel filler, decals, skirt and wheel arch trims.`,

  'side-right': `SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (recreational vehicle)
CAMERA_ANGLE: Exactly perpendicular (90°) to the RIGHT flank, camera at half body height, no wide-angle distortion.
CRITICAL DIRECTION: RIGHT is the vehicle's own right-hand side. The FRONT of the vehicle MUST point to the LEFT edge of the image. This is the opposite viewing direction of the left profile, but NEVER a mirrored copy of it.
FRAMING: Full length in frame, all wheels completely visible and perfectly round, roofline and skirt uncropped.
SIDE_IDENTITY_LOCK: Reproduce only the features that belong to this flank — habitation door and step, window layout, gas locker, external sockets, awning box, decals.`,

  'rear': `SHOT_TYPE: Exterior - Direct Rear View (recreational vehicle)
CAMERA_ANGLE: Half body height, perfectly centred on the rear axis, symmetrical.
FRAMING: Rear wall complete with rear lights, rear window, garage/storage hatch, ladder, spare wheel carrier, bumper, number plate holder and roof edge.
IDENTITY_PRIORITY: Rear light units, hatch size and position, badges and lettering must match the reference exactly.`,

  'cockpit': `SHOT_TYPE: Interior - Cab / Cockpit View (motorhome or camper van)
CAMERA_ANGLE: From the habitation area looking forward into the cab, slightly above seat-back height.
FRAMING: Steering wheel, dashboard, both cab seats (in their referenced rotation), windscreen, cab door panels and the transition to the habitation area.
PRESERVATION_PRIORITY: Dashboard layout, display content, switch positions, seat upholstery, swivel-seat state and cab blinds must match the reference exactly. No people, no hands, no clutter.`,

  'living': `SHOT_TYPE: Interior - Living / Seating Area (recreational vehicle)
CAMERA_ANGLE: Wide interior view from the entrance or rear of the habitation area at chest height, lens corrected so vertical furniture edges stay vertical.
FRAMING: Complete seating group with table, windows, overhead lockers, floor and ceiling visible for spatial context.
PRESERVATION_PRIORITY: Seating geometry, upholstery fabric and pattern, table shape, wood decor, locker fronts, blinds and light fittings exactly as referenced. Empty and clean, no personal items.`,

  'kitchen': `SHOT_TYPE: Interior - Kitchen Block (recreational vehicle)
CAMERA_ANGLE: Frontal to slightly angled view of the kitchen unit at chest height.
FRAMING: Worktop, hob, sink and tap, splash-back, fridge front, drawers and overhead lockers in frame.
PRESERVATION_PRIORITY: Hob type and burner count, sink shape, tap, worktop material, handle design and appliance fronts must match the reference exactly. Nothing on the worktop unless present in the reference.`,

  'bath': `SHOT_TYPE: Interior - Bathroom / Washroom (recreational vehicle)
CAMERA_ANGLE: From the doorway at chest height, capturing the full compact washroom without fisheye distortion.
FRAMING: Toilet, basin, mirror, cabinet, shower area, wall panelling and floor visible.
PRESERVATION_PRIORITY: Toilet type and position, basin and tap, mirror and cabinet fronts, shower fittings and panel colour exactly as referenced. Spotless, dry and empty — no towels, no toiletries.`,

  'bed': `SHOT_TYPE: Interior - Sleeping Area (recreational vehicle)
CAMERA_ANGLE: From the foot end or doorway at chest height, showing the bed and its surroundings.
FRAMING: Complete bed (fixed bed, twin beds, drop-down bed or alcove bed as referenced) with mattress, headboard area, reading lights, windows and overhead lockers.
PRESERVATION_PRIORITY: Bed type and dimensions, mattress and cover, upholstery, locker fronts and lighting must match the reference exactly. Neatly made, no clutter, no decorative extras.`,

  'garage': `SHOT_TYPE: Detail - Rear Garage / Storage Compartment (recreational vehicle)
CAMERA_ANGLE: Slightly crouched, frontal to the opened garage or storage hatch.
FRAMING: Open hatch with the storage space behind it, lashing rails/eyes, floor covering and hatch seal visible.
PRESERVATION_PRIORITY: Hatch size and shape, interior lining, fittings and any installed rails must match the reference exactly. The compartment is EMPTY — never invent stored equipment.`,
};

/** Kurzbeschreibung des gewählten Aufbautyps für den Prompt. */
export function describeMotorhomeBodyType(
  bodyType?: MotorhomeBodyTypeKey | null,
): string | null {
  switch (bodyType) {
    case 'semi_integrated':
      return 'BODY TYPE: Semi-integrated motorhome — donor cab with original windscreen and cab doors, habitation body built behind and above the cab, no sleeping alcove hump unless visible in the reference.';
    case 'alcove':
      return 'BODY TYPE: Alcove / overcab motorhome — a sleeping alcove sits above the donor cab. The alcove volume, its window and its exact shape must be preserved.';
    case 'fully_integrated':
      return 'BODY TYPE: Fully integrated motorhome — no donor cab sheet metal is visible; a full-width panoramic windscreen and integrated front mask define the front. Never add a van cab.';
    case 'campervan':
      return 'BODY TYPE: Camper van / panel van conversion — van silhouette with sliding side door, van windows and van rear doors. Keep the van proportions; never widen the body into a coachbuilt motorhome.';
    case 'caravan':
      return 'BODY TYPE: Caravan / travel trailer — a towed vehicle WITHOUT cab, engine or driving controls. Drawbar with coupling head, jockey wheel, corner steadies and gas locker must be present and exact. Never add a cab, windscreen wipers or a tow car.';
    default:
      return null;
  }
}

export function buildMotorhomePromptBlocks(
  bodyType?: MotorhomeBodyTypeKey | null,
  interior = false,
): string[] {
  const blocks = [
    `<MOTORHOME_SUBJECT_LOCK>\n${MOTORHOME_SUBJECT_LOCK}\n</MOTORHOME_SUBJECT_LOCK>`,
    `<MOTORHOME_IDENTITY_LOCK>\n${MOTORHOME_IDENTITY_LOCK}\n</MOTORHOME_IDENTITY_LOCK>`,
  ];
  const body = describeMotorhomeBodyType(bodyType);
  if (body) blocks.push(`<MOTORHOME_BODY_TYPE>\n${body}\n</MOTORHOME_BODY_TYPE>`);
  if (interior) {
    blocks.push(`<MOTORHOME_INTERIOR_LOCK>\n${MOTORHOME_INTERIOR_LOCK}\n</MOTORHOME_INTERIOR_LOCK>`);
  }
  blocks.push(
    `<MOTORHOME_NEGATIVE_CONSTRAINTS>\n${MOTORHOME_NEGATIVE_CONSTRAINTS}\n</MOTORHOME_NEGATIVE_CONSTRAINTS>`,
  );
  return blocks;
}
