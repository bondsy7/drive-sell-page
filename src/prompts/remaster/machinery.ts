/**
 * Land- & Baumaschinen-Prompt-Modul.
 *
 * STRIKTE TRENNUNG: Diese Blöcke gelten AUSSCHLIESSLICH für vehicleClass
 * 'machinery'. Keine Pkw-, Lkw-, Zweirad-, Reisemobil- oder Transporter-
 * Annahmen. Es wird keine bestehende Klassenkonfiguration überschrieben.
 *
 * Abgedeckt: Traktoren, Teleskoplader, Radlader, Bagger (Ketten/Mobil),
 * Dumper, Walzen, Mähdrescher, Anbaugeräte und vergleichbare Maschinen.
 */

export const MACHINERY_PROMPT_PROFILE = 'machinery' as const;

export const MACHINERY_SUBJECT_LOCK = `AGRICULTURAL / CONSTRUCTION MACHINE SUBJECT LOCK — the subject of every image is a WORKING MACHINE, never a road car:
1. The machine type is taken ONLY from the reference: tractor, telehandler, wheel loader, crawler or wheeled excavator, dumper, roller, combine harvester, skid steer or comparable machine — including its exact attachment (bucket, fork, blade, boom, loader arm, three-point linkage, PTO).
2. Running gear is reproduced exactly as referenced: steel tracks with track shoes, idlers, sprockets and rollers stay tracks; tyres stay tyres with their exact tread lug pattern, rim colour, dual wheels or ballast weights.
3. Machine geometry is fixed: boom, dipper arm, mast, counterweight, cab position, exhaust stack, ROPS/FOPS structure, mirrors, steps, handrails, work lights, beacons and hydraulic lines are reproduced with all hoses, fittings and cylinders visible in the reference.
4. Working posture stays exactly as referenced: boom angle, bucket position, blade height, outrigger and stabiliser state, mast extension, loader arm height. Never park the machine in a different pose.
5. Attachments are never added, removed or exchanged. A machine without a bucket stays without a bucket.
6. Safety and technical markings (warning stickers, load charts, hydraulic labels, type plates, operating-hour or serial plates) stay in place, legible and unchanged in wording and position.
VERIFICATION: If the output could be mistaken for a truck, a van, a passenger car or a toy/render model, the image is invalid.`;

export const MACHINERY_IDENTITY_LOCK = `MACHINE IDENTITY LOCK — the output must be the SAME physical machine as the reference:
1. Preserve the silhouette: chassis length, track or wheelbase width, cab shape and glazing, roof height, counterweight contour, boom and arm proportions.
2. Preserve the exact paint scheme and colour split of the machine, including the contrasting colour of rims, boom, chassis, guards, handrails and attachment.
3. Preserve all lettering exactly as photographed: model designation, series numbers, operating-weight markings, safety decals, dealer decals, fleet numbers. Never invent brand names, model numbers, load charts or new decals.
4. Preserve real condition honestly: this is used machinery. Paint chips, scratches, rust spots, welding seams, repaired panels, worn bucket teeth, polished wear edges, hydraulic staining and worn tracks or tyres stay visible and truthful.
5. Preserve the cab exterior exactly: door and window layout, wiper arrangement, mirrors, work light count and position, beacon, aerials, air filter housing, exhaust and grille pattern.
6. Preserve hydraulics: cylinder count, rod extension, hose routing, quick couplers and any visible leakage marks.
VERIFICATION: If any of the above differs from the reference, the image is invalid.`;

export const MACHINERY_INTERIOR_LOCK = `MACHINE CAB INTERIOR RULES:
1. The cab is shown EMPTY: no operator, no hands, no jackets, no bottles, no tools, no paperwork, no phone.
2. Reproduce the exact control layout: joysticks, levers, pedals, steering wheel or steering levers, armrest consoles, switch panels, monitor/display, gauges and their icons.
3. Displays and gauges stay plausible and neutral. Never invent operating-hour readings, menus, warning messages, brand interfaces or telematics screens that are absent from the reference.
4. Reproduce the seat exactly: suspension seat type, upholstery material, pattern, armrests, belt and visible wear.
5. Reproduce cab glazing, roof hatch, sun blind, floor mat, pedal wear and grab handles exactly as referenced.
6. Lighting is even and neutral; the view through the glazing stays bright and free of fabricated scenery.`;

export const MACHINERY_NEGATIVE_CONSTRAINTS = `MACHINERY-SPECIFIC PROHIBITIONS:
- Do NOT convert tracks into wheels or wheels into tracks, and never change the number of axles, wheels, track rollers or track shoes.
- Do NOT add, remove or swap attachments, buckets, forks, blades, booms, weights, ballast or three-point implements.
- Do NOT change the working pose: boom, arm, bucket, mast, blade, outriggers and loader arms stay exactly as referenced.
- Do NOT remove or restyle safety decals, warning stickers, load charts, type plates, serial or PIN plates.
- Do NOT invent manufacturer branding, model badges, operating hours or dealer lettering.
- Do NOT add operators, workers, site scenery, soil, gravel piles, construction activity, fields or crops that are absent in the reference.
- Do NOT generate car, van, truck, motorcycle or motorhome motifs (boot lid, rear bench, sliding door, habitation door, fifth wheel).
- Do NOT restyle the machine into a concept or toy render: it stays an industrial, photoreal, used working machine.`;

/**
 * Zustands-Regel. "Aufräumen" ist für Maschinen bewusst abschaltbar,
 * weil der reale Arbeitszustand oft Teil der Fahrzeugdokumentation ist.
 */
export const MACHINERY_TIDY_ON = `MACHINE PREPARATION — TIDY-UP ENABLED:
- Present the machine as professionally washed and prepared for sale: loose dirt, mud crusts, dust films, grass residue, wet soil on tracks/tyres and smeared glass are cleaned away.
- Remove only loose, non-permanent contamination and loose site debris directly on or beside the machine. Nothing that belongs to the machine may disappear.
- Permanent condition stays truthful: scratches, paint chips, rust, repairs, wear on bucket teeth, polished steel edges, track and tyre wear, hydraulic staining and decals all remain visible.`;

export const MACHINERY_TIDY_OFF = `MACHINE PREPARATION — TIDY-UP DISABLED (AS-IS DOCUMENTATION):
- Reproduce the machine exactly in the condition photographed. Dirt, mud, dust, soil on tracks and tyres, grease, oil films, dusty glass and stained paint stay exactly where they are, with the same amount and distribution.
- Do NOT clean, wash, polish, retouch or brighten any surface. Do NOT remove dust from the cab glazing or mud from the undercarriage.
- Do NOT tidy the surroundings of the machine either: loose parts and site traces visible in the reference stay in place.
- The only permitted improvement is photographic quality: lighting, sharpness, colour accuracy and background — never the machine's condition.`;

/** Perspektiv-Prompts der Baumaschinen-Aufnahmeslots. */
export const MACHINERY_PERSPECTIVE_PROMPTS: Record<string, string> = {
  '34front': `SHOT_TYPE: Exterior - Front 3/4 Hero View (working machine)
CAMERA_ANGLE: Slightly below cab window height, 30-40° off the front centre axis, lens corrected so the tall machine body and cab pillars stay parallel.
FRAMING: Complete machine including attachment, boom, counterweight and the full running gear (tracks or wheels) touching the ground. Minimum 8% padding on all edges.
IDENTITY_PRIORITY: Boom and attachment geometry in the referenced working pose, cab glazing, decals, running gear type and colour split exactly as referenced.`,

  front: `SHOT_TYPE: Exterior - Direct Head-On Front View (working machine)
CAMERA_ANGLE: Mid-machine height, exactly 0° centre axis, symmetrical.
FRAMING: Full width — attachment or bucket edge, front work lights, grille or radiator area, cab windscreen with wipers, mirrors, steps and both front wheels or track fronts.
IDENTITY_PRIORITY: Attachment shape and wear, light positions, guard plates, hose routing and decals reproduced as one connected assembly.`,

  'side-left': `SHOT_TYPE: Exterior - Perfect LEFT Side Profile (working machine)
CAMERA_ANGLE: Exactly perpendicular (90°) to the LEFT side, camera at half machine height, sufficient distance to avoid wide-angle bulge.
CRITICAL DIRECTION: LEFT is the machine's own left-hand side. The FRONT/attachment MUST point to the RIGHT edge of the image. Never mirror a right-side view.
FRAMING: Full length including attachment and counterweight, complete undercarriage or both wheels, uncropped roof and boom. Minimum 8% padding.
SIDE_IDENTITY_LOCK: Reproduce this side exactly — access steps, handrails, service flaps, hydraulic hoses, track rollers or wheel hubs, decals on this side only.`,

  'side-right': `SHOT_TYPE: Exterior - Perfect RIGHT Side Profile (working machine)
CAMERA_ANGLE: Exactly perpendicular (90°) to the RIGHT side, camera at half machine height, no wide-angle distortion.
CRITICAL DIRECTION: RIGHT is the machine's own right-hand side. The FRONT/attachment MUST point to the LEFT edge of the image. This is a genuinely different view, NEVER a mirrored copy of the left profile.
FRAMING: Full length including attachment and counterweight, complete undercarriage or both wheels, uncropped roof and boom. Minimum 8% padding.
SIDE_IDENTITY_LOCK: Reproduce this side exactly — engine service doors, exhaust, filter housings, toolbox, fuel and hydraulic filler caps, decals on this side only.`,

  rear: `SHOT_TYPE: Exterior - Direct Rear View (working machine)
CAMERA_ANGLE: Half machine height, centred on the rear axis, symmetrical.
FRAMING: Complete rear — counterweight or rear linkage, tow hitch, PTO, rear work lights, service doors, rear window, exhaust, warning markings and the rear of the running gear.
IDENTITY_PRIORITY: Counterweight contour, three-point linkage or drawbar, light and marking positions, plate holders and decals exactly as referenced.`,

  cabin: `SHOT_TYPE: Interior - Operator Cab Overview (working machine)
CAMERA_ANGLE: From the cab door opening, slightly above seat height, looking towards the control station and the front glazing.
FRAMING: Seat, both armrest consoles, joysticks or steering wheel, pedals, floor, monitor and switch panels in one frame.
IDENTITY_PRIORITY: Exact control layout, seat type and upholstery, display frame, switch icons and cab wear. The cab is empty and neutral.`,

  controls: `SHOT_TYPE: Detail - Operator Controls and Display (working machine)
CAMERA_ANGLE: Close, slightly angled view of the control station.
FOCUS_ELEMENTS: Joystick or lever heads with button layout, armrest console, keypad, monitor bezel and screen, gauges and warning symbols, pedal set where visible.
CRITICAL: Reproduce button legends and symbols exactly as referenced. Never invent a menu, telematics UI or operating-hour reading.`,

  undercarriage: `SHOT_TYPE: Detail - Running Gear (working machine)
CAMERA_ANGLE: Low, close to ground level, perpendicular to the running gear.
FOCUS_ELEMENTS: For tracked machines the complete track chain, track shoes and their grouser pattern, sprocket, idler, track rollers, track guides and frame. For wheeled machines the tyre tread pattern, sidewall lettering, rim type, bolt pattern and hub.
CRITICAL: Reproduce wear exactly — worn grousers, polished steel, tread depth, chipped rims. Never replace tracks with wheels or wheels with tracks.`,

  attachment: `SHOT_TYPE: Detail - Attachment / Working Tool (working machine)
CAMERA_ANGLE: Close 3/4 view of the attachment in its referenced position.
FOCUS_ELEMENTS: Bucket, fork, blade or implement with cutting edge, teeth or tines, wear plates, quick coupler, pins, hydraulic cylinder and hoses.
CRITICAL: Reproduce the exact attachment from the reference including wear, welding seams and repairs. Never exchange, add or idealise it.`,
};

export const MACHINERY_INTERIOR_SLOT_KEYS = new Set(['cabin', 'controls']);

export function isMachineryInteriorSlot(slotKey?: string | null): boolean {
  return !!slotKey && MACHINERY_INTERIOR_SLOT_KEYS.has(slotKey);
}

/**
 * Liefert die zusammengesetzten Prompt-Blöcke der Maschinenklasse.
 * @param interior  true für Kabinen-/Bedienstand-Slots
 * @param tidyUp    true = Maschine wird gereinigt dargestellt, false = Zustand exakt wie fotografiert
 */
export function buildMachineryPromptBlocks(interior = false, tidyUp = false): string[] {
  const blocks = [
    `<MACHINERY_SUBJECT_LOCK>\n${MACHINERY_SUBJECT_LOCK}\n</MACHINERY_SUBJECT_LOCK>`,
    `<MACHINERY_IDENTITY_LOCK>\n${MACHINERY_IDENTITY_LOCK}\n</MACHINERY_IDENTITY_LOCK>`,
    `<MACHINERY_CONDITION_MODE>\n${tidyUp ? MACHINERY_TIDY_ON : MACHINERY_TIDY_OFF}\n</MACHINERY_CONDITION_MODE>`,
  ];
  if (interior) {
    blocks.push(`<MACHINERY_INTERIOR_LOCK>\n${MACHINERY_INTERIOR_LOCK}\n</MACHINERY_INTERIOR_LOCK>`);
  }
  blocks.push(`<MACHINERY_NEGATIVE_CONSTRAINTS>\n${MACHINERY_NEGATIVE_CONSTRAINTS}\n</MACHINERY_NEGATIVE_CONSTRAINTS>`);
  return blocks;
}
