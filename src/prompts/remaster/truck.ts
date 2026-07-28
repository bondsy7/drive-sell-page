/**
 * LKW-Prompt-Module.
 *
 * STRIKTE TRENNUNG: Diese Blöcke werden AUSSCHLIESSLICH für vehicleClass
 * 'truck' erzeugt und dürfen niemals in einen Pkw-Prompt gelangen.
 * Umgekehrt enthalten sie keinerlei Pkw-Annahmen (Kofferraum, Rücksitzbank,
 * Limousinen-Proportionen, Pkw-Scheinwerfergrafik).
 */
import type {
  CargoStateKey,
  SubjectScopeKey,
  TruckBodyTypeKey,
  TruckConfigurationKey,
} from '@/config/vehicle-class-types';

export const TRUCK_IDENTITY_LOCK = `COMMERCIAL VEHICLE IDENTITY LOCK — the output must be the SAME physical truck as the reference, not a generic truck:
1. CAB TYPE: Preserve the exact cab family (day cab / sleeper cab / high-roof / low-entry / crew cab). Do NOT extend, shorten, raise or lower the cab.
2. CAB GEOMETRY: Preserve windshield rake, roof height, roof spoiler/deflector shape, step count, door cut lines, grille pattern, bumper segmentation and headlamp housing geometry exactly as in the reference.
3. AXLE COUNT & LAYOUT: Count every axle on every unit in the reference and reproduce the SAME number, the SAME spacing, the SAME lifted/steered axles and the SAME single vs. twin tire configuration. Never add or drop an axle.
4. CHASSIS: Preserve frame height, fuel/AdBlue tank position and size, battery box, exhaust stack routing, air tanks, catwalk and underrun protection.
5. WHEELS: Preserve rim type (steel vs. alloy), hub cover style, number of bolts and tire profile.
6. OEM BADGES: Preserve the manufacturer emblem and OEM model lettering exactly (e.g. Actros, TGX, FH, XF, S-Series). Do NOT restyle them.
7. NO CLASS DRIFT: Do not turn a truck into a van, a bus, an RV or a pickup. Do not make it look like a passenger car in any proportion.
VERIFICATION: If any of the above differs from the reference, the image is invalid.`;

export const TRUCK_NEGATIVE_CONSTRAINTS = `TRUCK-SPECIFIC PROHIBITIONS:
- Do NOT invent aerodynamic kits, chassis fairings, side skirts, roof spoilers, light bars, bull bars, chrome accessories or air horns that are absent in the reference.
- Do NOT remove such parts if they ARE present in the reference.
- Do NOT change the mirror system: classic glass mirrors stay glass mirrors, camera-monitor systems (MirrorCam / OptiView / CMS) stay camera arms. Never convert one into the other, never add both.
- Do NOT add cargo, pallets, straps, tarps, load or people that are not in the reference.
- Do NOT alter, invent or beautify company lettering, fleet numbers or operator branding unless a cleanup option explicitly requests removal.
- Do NOT apply passenger-car styling cues (low sporty stance, car-like body lines, lowered suspension).`;

// ── Subject scope (verbindlicher Bildinhalt) ────────────────────────────────

const SUBJECT_SCOPE_RULES: Record<SubjectScopeKey, string> = {
  car_complete: 'Show the complete passenger vehicle.',
  tractor_unit_only:
    'The subject is a SOLO TRACTOR UNIT. The output must show the tractor unit ONLY — cab plus powered chassis with its fifth wheel. There must be NO semi-trailer, NO drawbar trailer, NO cargo body, NO ramps, NO loading decks, NO trailer shadow and NO trailer fragment anywhere in the frame.',
  rigid_truck_complete:
    'The subject is a RIGID TRUCK. The output must show the cab AND its permanently mounted body on the same chassis, complete and uncut. There must be NO additional drawbar trailer and NO semi-trailer in the frame.',
  rigid_truck_and_trailer_complete:
    'The subject is a RIGID TRUCK WITH A DRAWBAR TRAILER. The output must show BOTH units, complete, coupled and in their original order. Neither unit may be omitted, shortened or cropped.',
  tractor_and_semi_trailer_complete:
    'The subject is a SEMI-TRUCK COMBINATION. The output must show the tractor unit AND the coupled semi-trailer, complete and uncut, in their original coupling geometry.',
  complete_multi_part_combination:
    'The subject is a MULTI-PART COMBINATION. Every unit visible in the reference (tractor, semi-trailer, additional trailer) must appear in the output, complete, in the same order and with the same coupling points.',
  trailer_or_semi_trailer_only:
    'The subject is a TRAILER / SEMI-TRAILER WITHOUT a towing vehicle. The output must show the towed unit ONLY. Do NOT invent, add or hint at a tractor unit, a cab or a towing vehicle. Support legs, kingpin and drawbar stay exactly as in the reference.',
};

export function buildTruckSubjectScopeBlock(scope: SubjectScopeKey | null | undefined): string {
  const rule = scope ? SUBJECT_SCOPE_RULES[scope] : null;
  if (!rule) return '';
  return `BINDING SUBJECT SCOPE — this defines exactly WHAT must be in the output image:
${rule}

ENFORCEMENT:
- The subject scope outranks composition, aesthetics and framing preferences.
- Never add a unit that the scope excludes, never omit a unit that the scope requires.
- After removing or excluding a unit, rebuild the background continuously and recompute the contact shadow of the remaining subject only.
- Re-frame the remaining subject so it fills the frame naturally, without cropping and without distorting proportions.`;
}

// ── Aufbauart ───────────────────────────────────────────────────────────────

const BODY_TYPE_RULES: Record<TruckBodyTypeKey, string> = {
  box_closed:
    'CLOSED BOX / CURTAIN BODY: Preserve panel type (rigid panel, curtain tarpaulin, refrigerated box), rib spacing, roof edge, rear door type (swing doors vs. roller shutter), rear frame, bumper and any tail lift exactly as in the reference. Do NOT convert a curtain-sider into a hard box or vice versa.',
  platform_open:
    'OPEN PLATFORM / FLATBED: Preserve deck height, side board height and material, stake pockets, deck surface material and any headboard. Do NOT enclose the platform and do NOT add a tarpaulin or box body.',
  tipper:
    'TIPPER: Preserve the tipping body shape, wall height, tailgate hinge type, reinforcement ribs and hydraulic cylinder position. The body must remain in the SAME lowered/raised position as in the reference.',
  tank: 'TANK / SILO: Preserve barrel diameter, number of compartments, manhole covers, walkway, ladder position, discharge piping and hazard placard placement. Do NOT change the barrel cross-section.',
  low_loader:
    'LOW LOADER: Preserve the stepped deck geometry, gooseneck shape, ramp type and position, axle group and any extension. Do NOT flatten the deck.',
  vehicle_transport:
    'VEHICLE TRANSPORTER: Preserve every loading deck, ramp, hydraulic mast and rail, including structures overhanging the cab roof. Do NOT reduce the number of decks and do NOT add vehicles onto the decks.',
  unknown:
    'UNCLASSIFIED BODY: The body type could not be classified. Reproduce the body EXACTLY as seen in the reference and do not normalize it towards any common body type.',
};

export function buildTruckBodyTypeBlock(bodyType: TruckBodyTypeKey | null | undefined): string {
  const rule = bodyType ? BODY_TYPE_RULES[bodyType] : null;
  if (!rule) return '';
  return `BODY / TRAILER TYPE LOCK:
${rule}
The body type is user-confirmed metadata. Do NOT reinterpret it from the image.`;
}

// ── Ladebereich ─────────────────────────────────────────────────────────────

const CARGO_STATE_RULES: Record<CargoStateKey, string> = {
  empty:
    'CARGO AREA IS EMPTY: The load area is empty and must stay empty. Clean the deck/floor surface (dirt, debris, loose straps, pallets left behind) but do NOT add any cargo, boxes, vehicles or props.',
  loaded_accessible:
    'CARGO AREA IS LOADED: Cargo is present in the reference and must be preserved in position, quantity and appearance. Do NOT remove, rearrange, duplicate or beautify the load. Do NOT add cargo.',
  not_accessible:
    'CARGO AREA IS NOT VISIBLE: The load compartment is closed or not accessible. Keep it closed. Do NOT open doors, do NOT reveal, invent or render any interior of the load compartment.',
  not_applicable:
    'NO CARGO AREA: This subject has no photographable load area. Do not invent one.',
};

export function buildTruckCargoStateBlock(cargoState: CargoStateKey | null | undefined): string {
  const rule = cargoState ? CARGO_STATE_RULES[cargoState] : null;
  if (!rule) return '';
  return `CARGO STATE LOCK:
${rule}`;
}

// ── Perspektiven (LKW-spezifisch) ───────────────────────────────────────────

export const TRUCK_PERSPECTIVE_PROMPTS: Record<string, string> = {
  truck_cab_34_front_left:
    'CAMERA: three-quarter view from the front left. Show the full front and the full left flank of the subject. Camera at roughly headlight height, no upward tilt that distorts the cab.',
  truck_cab_side_left:
    'CAMERA: strict side view from the left, perpendicular to the vehicle axis. The complete length of the subject must be inside the frame with clearance on both ends.',
  truck_cab_front:
    'CAMERA: straight frontal view. Grille, bumper, headlamps and windshield fully visible and symmetrical.',
  truck_mirror_camera_detail:
    'CAMERA: close detail of the A-pillar area showing the mirror or camera-monitor system. Reproduce the mounting arms and housings exactly; do not substitute the system type.',
  truck_cab_interior:
    'CAMERA: driver workplace from the open driver door. Steering wheel, instrument cluster, seat and dashboard fully visible. Do NOT cut the A/B-pillars or the roof line.',
  truck_fifth_wheel:
    'CAMERA: rear three-quarter of the tractor unit showing the fifth wheel plate, frame end and rear lights. No trailer.',
  truck_body_side_left:
    'CAMERA: strict side view of the load unit from the left, perpendicular to the vehicle axis, complete length in frame.',
  truck_body_rear:
    'CAMERA: straight rear view. Rear doors/tailgate, rear frame, lights and underrun protection fully visible.',
  truck_body_34_rear_right:
    'CAMERA: three-quarter view from the rear right, showing rear and right flank of the load unit.',
  truck_cargo_area:
    'CAMERA: view into the load area from the rear. Show floor, side walls and roof/opening of the load area without cutting the frame edges.',
  truck_vin:
    'CAMERA: sharp, legible close-up of the VIN / type plate. Do not restyle, re-render or invent characters — keep the plate exactly as photographed.',
};

// ── Composer ────────────────────────────────────────────────────────────────

export interface TruckPromptContext {
  truckConfiguration?: TruckConfigurationKey | null;
  truckBodyType?: TruckBodyTypeKey | null;
  cargoState?: CargoStateKey | null;
  subjectScope?: SubjectScopeKey | null;
  slotKey?: string | null;
}

/** Alle LKW-Blöcke in verbindlicher Reihenfolge, bereits XML-getaggt. */
export function buildTruckPromptBlocks(ctx: TruckPromptContext): string[] {
  const blocks: string[] = [];

  const scope = buildTruckSubjectScopeBlock(ctx.subjectScope);
  if (scope) blocks.push(`<SUBJECT_SCOPE>\n${scope}\n</SUBJECT_SCOPE>`);

  blocks.push(`<TRUCK_IDENTITY_LOCK>\n${TRUCK_IDENTITY_LOCK}\n</TRUCK_IDENTITY_LOCK>`);

  const body = buildTruckBodyTypeBlock(ctx.truckBodyType);
  if (body) blocks.push(`<TRUCK_BODY_TYPE_LOCK>\n${body}\n</TRUCK_BODY_TYPE_LOCK>`);

  const cargo = buildTruckCargoStateBlock(ctx.cargoState);
  if (cargo) blocks.push(`<TRUCK_CARGO_STATE_LOCK>\n${cargo}\n</TRUCK_CARGO_STATE_LOCK>`);

  blocks.push(
    `<TRUCK_NEGATIVE_CONSTRAINTS>\n${TRUCK_NEGATIVE_CONSTRAINTS}\n</TRUCK_NEGATIVE_CONSTRAINTS>`,
  );

  return blocks;
}
