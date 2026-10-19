/**
 * Nano Banana 2.1 – Perspektiv-Spezifikationen.
 *
 * - Pkw-Kernjobs aus PIPELINE_JOBS und die Pkw-Remaster-Slots sind HANDGESCHRIEBEN
 *   (source: 'explicit').
 * - CI-Jobs sowie Transporter-, Reisemobil-, Motorrad- und Maschinenjobs/-slots
 *   werden deterministisch aus den bestehenden 2.0-Perspektivtexten in die
 *   2.1-Struktur überführt (source: 'derived'). Die 2.0-Texte werden nur GELESEN.
 * - Admin-Overrides der 2.0-Jobs werden bewusst nicht berücksichtigt.
 */
import { ALL_PIPELINE_JOBS, type PipelineJob } from '@/lib/pipeline-jobs';
import { TRUCK_PERSPECTIVE_PROMPTS } from '@/prompts/remaster/truck';
import { MOTORCYCLE_PERSPECTIVE_PROMPTS } from '@/prompts/remaster/motorcycle';
import { MOTORHOME_PERSPECTIVE_PROMPTS } from '@/prompts/remaster/motorhome';
import { VAN_PERSPECTIVE_PROMPTS } from '@/prompts/remaster/van';
import { MACHINERY_PERSPECTIVE_PROMPTS } from '@/prompts/remaster/machinery';

export type Nb21Kind = 'exterior' | 'interior' | 'detail' | 'composite';
export type Nb21Side = 'LEFT' | 'RIGHT';

export interface Nb21PerspectiveSpec {
  key: string;
  kind: Nb21Kind;
  /** Kurze Beschreibung der Zielansicht. */
  view: string;
  /** Physische Fahrzeugflanke, die sichtbar sein muss. */
  physicalSide?: Nb21Side;
  /** true = exakte Seitenansicht (90°) → Richtung im Bild ist verbindlich. */
  profile?: boolean;
  lock: string[];
  camera: string[];
  detailChecks?: string[];
  environmentHints?: string[];
  lightingHints?: string[];
  source: 'explicit' | 'derived';
}

/** Verbindliche Richtungsregel je Flanke (identisch zur 2.0-Konvention). */
export function nb21SideDirectionLines(side: Nb21Side, profile: boolean): string[] {
  const opposite = side === 'LEFT' ? 'RIGHT' : 'LEFT';
  const lines = [
    `PHYSICAL SIDE: the vehicle's physical ${side} flank faces the camera. The ${opposite} flank is not visible${profile ? '' : ' or only foreshortened'}.`,
  ];
  if (profile) {
    lines.push(
      side === 'LEFT'
        ? 'IMAGE DIRECTION: front/hood/headlights point to IMAGE LEFT; rear/trunk/taillights point to IMAGE RIGHT.'
        : 'IMAGE DIRECTION: front/hood/headlights point to IMAGE RIGHT; rear/trunk/taillights point to IMAGE LEFT.',
    );
  }
  lines.push('Never mirror or flip the image or any vehicle part. A mirrored vehicle is a failed output.');
  return lines;
}

const FULL_VEHICLE = 'Full vehicle in frame, uncropped, minimum 5% padding on all edges.';
const ATTACHED_DETAIL = 'The detail stays attached to the vehicle: surrounding bodywork must remain visible. Never isolate the part as a standalone object.';

// ── Handgeschriebene Pkw-Pipeline-Specs ─────────────────────────────
const CAR_PIPELINE_SPECS: Nb21PerspectiveSpec[] = [
  { key: 'MASTER_IMAGE', kind: 'exterior', source: 'explicit', view: 'front-left 3/4 hero view', physicalSide: 'LEFT',
    lock: ['Show the front fascia and the LEFT flank together, camera 30-40° left of the front centre axis.'],
    camera: ['Eye level.', FULL_VEHICLE] },
  { key: 'EXT_FRONT', kind: 'exterior', source: 'explicit', view: 'direct head-on front view',
    lock: ['Camera exactly on the front centre axis (0°), perfectly symmetrical.',
      'Copy the complete front only from the closest front-visible reference: grille or closed panel outline and texture, sensors, hood edge, bumper openings, headlight housings and full LED signatures as one connected assembly.'],
    camera: ['Eye level; both headlights and the centre badge centred.', 'Full vehicle width in frame.'] },
  { key: 'EXT_REAR', kind: 'exterior', source: 'explicit', view: 'direct rear view',
    lock: ['Camera exactly on the rear centre axis, symmetrical.', 'Taillights, exhaust outlets, rear badge and model lettering exactly as in the rear evidence. A tow bar present in the references stays mounted.'],
    camera: ['Eye level.', 'Full vehicle width in frame.'] },
  { key: 'EXT_SIDE_LEFT', kind: 'exterior', source: 'explicit', view: 'perfect LEFT side profile', physicalSide: 'LEFT', profile: true,
    lock: ['Camera exactly perpendicular (90°) to the LEFT flank.',
      'Use the exact LEFT-side reference as primary authority: roofline, glasshouse, pillars, shoulder crease, door cuts, handles, sill/cladding, wheel arches, front-fender shape and lamp terminations.'],
    camera: ['Ground-to-waist-level horizon; both LEFT wheels completely visible and perfectly round.', FULL_VEHICLE] },
  { key: 'EXT_SIDE_RIGHT', kind: 'exterior', source: 'explicit', view: 'perfect RIGHT side profile', physicalSide: 'RIGHT', profile: true,
    lock: ['Camera exactly perpendicular (90°) to the RIGHT flank.',
      'Build the RIGHT flank only from vehicle references. If no dedicated right-side photo exists, combine side geometry with front and rear evidence; never treat the left-side photo as right-side evidence and never pixel-mirror it.'],
    camera: ['Both RIGHT wheels completely visible and perfectly round.', FULL_VEHICLE] },
  { key: 'EXT_34_FRONT_RIGHT', kind: 'exterior', source: 'explicit', view: 'front-right 3/4 view', physicalSide: 'RIGHT',
    lock: ['Camera 30-40° to the RIGHT of the front centre axis. This is not a left-side view.', 'Right headlight, right fender and right front wheel prominent.'],
    camera: ['Eye level.', FULL_VEHICLE] },
  { key: 'EXT_34_REAR_LEFT', kind: 'exterior', source: 'explicit', view: 'rear-left 3/4 view', physicalSide: 'LEFT',
    lock: ['Camera behind and to the LEFT, 30-40° off the rear centre axis. LEFT taillight, LEFT rear wheel and LEFT rear fender closest to the camera.', 'Never show a right-rear quarter. A tow bar present in the references stays mounted.'],
    camera: ['Eye level.', FULL_VEHICLE] },
  { key: 'EXT_34_REAR_RIGHT', kind: 'exterior', source: 'explicit', view: 'rear-right 3/4 view', physicalSide: 'RIGHT',
    lock: ['Camera behind and to the RIGHT, 30-40° off the rear centre axis. RIGHT taillight, RIGHT rear wheel and RIGHT rear fender closest to the camera.', 'Never show a left-rear quarter. A tow bar present in the references stays mounted.'],
    camera: ['Eye level.', FULL_VEHICLE] },
  { key: 'EXT_LOW_ANGLE', kind: 'exterior', source: 'explicit', view: 'low-angle front hero shot',
    lock: ['Camera 20-30 cm above the ground looking slightly upward at bumper, grille and hood.', 'Perspective may change; proportions and geometry of the vehicle may not.'],
    camera: ['Full front bumper and wheels visible, no cropping.'] },
  { key: 'EXT_ELEVATED_FRONT', kind: 'exterior', source: 'explicit', view: 'elevated front 3/4 view',
    lock: ['Camera 2-3 m above the ground looking down at hood, windshield and roof.', 'Roof surface, roof rails, sunroof or antenna only as evidenced in the references; if the roof is not visible in any reference, keep it plain and conservative.'],
    camera: [FULL_VEHICLE] },
  { key: 'INT_DASHBOARD', kind: 'interior', source: 'explicit', view: "driver's seat POV of the dashboard",
    lock: ['Eye level from the driver head position: steering wheel, instrument cluster, full dashboard, centre console.',
      'STEERING WHEEL: exact rim outline, spoke count and angles, centre hub, button islands, stalks and paddles from the front-interior evidence.',
      'Steering wheel stays on the side shown in the reference. Never rotate or flip the cabin.'],
    camera: ['Complete roof line, A-pillars and headliner visible and uncut.'] },
  { key: 'INT_REAR_SEATS', kind: 'interior', source: 'explicit', view: 'rear seats seen from between the front headrests',
    lock: ['Camera between the front headrests looking backward, slightly elevated.', 'Upholstery material, stitching, armrest, rear vents and amenities exactly as in the rear-interior evidence.'],
    camera: ['Full rear cabin visible, no cropping.'] },
  { key: 'INT_WIDE_CABIN', kind: 'interior', source: 'explicit', view: 'wide cabin overview from the rear seat area',
    lock: ['Wide angle from the centre of the rear seat area looking forward: full dashboard span, both front seats, centre console, windshield.', 'Exact interior layout from the interior evidence.'],
    camera: ['Roof, pillars and headliner uncut.'] },
  { key: 'DET_HEADLIGHT', kind: 'detail', source: 'explicit', view: 'front headlight in vehicle context',
    lock: ['Close-up 10-20° from perpendicular; headlight fills 50-60% of the frame.', ATTACHED_DETAIL],
    detailChecks: ['LED module/projector count identical.', 'DRL signature (shape, curves, segments) identical.', 'Lens and housing outline identical.',
      'Internal layout of projectors, reflectors and LED strips identical.', 'Chrome/dark accents identical.', 'Reflector geometry and finish identical.',
      'Turn-signal position identical.', 'Adjacent hood edge, grille edge and bumper seam copied together with the lamp.', 'No older/pre-facelift or halogen layout.'],
    camera: ['Show hood line, fender edge and part of the bumper.'] },
  { key: 'DET_TAILLIGHT', kind: 'detail', source: 'explicit', view: 'rear taillight in vehicle context',
    lock: ['Close-up; taillight fills 50-60% of the frame.', ATTACHED_DETAIL],
    detailChecks: ['LED segment count and arrangement identical.', 'Light signature and light guides identical.', 'Lens colour (clear/smoked/red) and housing identical.', 'No part of the taillight cropped.'],
    camera: ['Show rear quarter panel, trunk edge and part of the rear bumper.'] },
  { key: 'DET_WHEEL', kind: 'detail', source: 'explicit', view: 'front wheel in vehicle context',
    lock: ['Low angle at wheel height, slightly angled.', ATTACHED_DETAIL],
    detailChecks: ['Spoke count identical (count before drawing).', 'Spoke geometry, thickness and concavity identical.', 'Finish and every colour identical.',
      'Centre cap identical.', 'Brake caliper colour as visible.', 'Tyre sidewall proportions unchanged.', 'All visible wheels show the same rim.'],
    camera: ['Show wheel arch, fender, lower sill and part of the bumper.'] },
  { key: 'DET_GRILLE', kind: 'detail', source: 'explicit', view: 'front grille and badge in vehicle context',
    lock: ['Close-up; grille fills 50-60% of the frame.', ATTACHED_DETAIL],
    detailChecks: ['Mesh/slat count, spacing and angle identical.', 'Finish (chrome/gloss black/matte/body colour) identical — never swap chrome and black.',
      'Badge silhouette, material, colour and position identical.', 'Model lettering font, size and position identical.', 'Surrounding paint identical.'],
    camera: ['Show hood line, headlight edges and bumper section.'] },
  { key: 'GRID_EXTERIOR_4', kind: 'composite', source: 'explicit', view: 'exterior 2x2 grid',
    lock: ['Top-left: front-LEFT 3/4. Top-right: LEFT side profile (front to IMAGE LEFT). Bottom-left: rear-LEFT 3/4. Bottom-right: direct rear.',
      'Every cell shows the identical vehicle at the same size; side-specific equipment stays on its physical flank in every cell.'],
    camera: ['Thin white dividers.', 'Full vehicle in every cell.'] },
  { key: 'GRID_INTERIOR_4', kind: 'composite', source: 'explicit', view: 'interior 2x2 grid',
    lock: ['Top-left: dashboard from driver seat. Top-right: centre console close-up. Bottom-left: rear seats from front. Bottom-right: steering wheel close-up.',
      'Every cell shows the identical interior; console lock applies in every cell. Never rotate or flip a cell.'],
    camera: ['Thin white dividers.'] },
  { key: 'GRID_SOCIAL_MEDIA', kind: 'composite', source: 'explicit', view: 'social media collage',
    lock: ['One large front-LEFT 3/4 hero at 60% of the canvas on the left; three smaller stacked on the right: LEFT side profile, dashboard, wheel detail.',
      'Every tile shows the identical vehicle.'],
    camera: ['Thin dividers, clean modern layout.'] },
];

// ── Handgeschriebene Pkw-Remaster-Slots ─────────────────────────────
const CAR_REMASTER_SPECS: Nb21PerspectiveSpec[] = [
  { key: 'car:34front', kind: 'exterior', source: 'explicit', view: 'front 3/4 view as photographed',
    lock: ['Keep the exact camera angle of the main photo (front 3/4). Do not rotate the vehicle or change which flank is visible.', 'Both wheels on the visible flank fully in frame.'],
    camera: [FULL_VEHICLE] },
  { key: 'car:side', kind: 'exterior', source: 'explicit', view: 'LEFT side profile as photographed', physicalSide: 'LEFT', profile: true,
    lock: ['Keep the perpendicular (90°) side camera of the main photo.', 'Both wheels completely visible and perfectly round.'],
    camera: [FULL_VEHICLE] },
  { key: 'car:rear', kind: 'exterior', source: 'explicit', view: 'direct rear view as photographed',
    lock: ['Keep the centred rear camera of the main photo.', 'Taillights, exhaust outlets, rear badge and model lettering exactly as photographed; a tow bar stays mounted.'],
    camera: ['Full vehicle width in frame.'] },
  { key: 'car:interior-front', kind: 'interior', source: 'explicit', view: 'front cabin seen from the rear seat',
    lock: ['Keep the camera of the main photo looking forward at dashboard, steering wheel and windshield.',
      'Roof closed with a solid opaque headliner unless the photo clearly shows a glass roof; never add a panoramic roof.'],
    camera: ['Complete roof, all A/B pillars, headliner and rear-view mirror visible and uncut.'] },
  { key: 'car:interior-rear', kind: 'interior', source: 'explicit', view: 'rear cabin as photographed',
    lock: ['Keep the camera of the main photo looking at the rear seats.', 'Upholstery, stitching, armrest and amenities exactly as photographed.'],
    camera: ['Roof, pillars and headliner uncut.'] },
];

// ── Deterministische Überführung bestehender 2.0-Perspektivtexte ─────
const FIELD_RE = /^([A-Z][A-Z0-9_ /-]{1,40}):\s*(.*)$/;
const CAMERA_FIELDS = new Set(['CAMERA_ANGLE', 'CAMERA', 'FRAMING', 'LAYOUT']);
const ENV_FIELDS = new Set(['ENVIRONMENT', 'BACKGROUND', 'WINDOW_VIEW']);
const LIGHT_FIELDS = new Set(['LIGHTING']);

function cleanLegacyText(text: string): string {
  return text
    .replace(/\{\{LOGO_LINE\}\}/g, '')
    .replace(/<\/?CURRENT_PIPELINE_SHOT>|<\/?CURRENT_PERSPECTIVE>/g, '')
    .trim();
}

export function inferSideFromKey(key: string): { side?: Nb21Side; profile: boolean } {
  const k = key.toUpperCase().replace(/-/g, '_');
  if (/(^|_)SIDE_LEFT($|_)/.test(k)) return { side: 'LEFT', profile: true };
  if (/(^|_)SIDE_RIGHT($|_)/.test(k)) return { side: 'RIGHT', profile: true };
  if (/34.*LEFT|LEFT.*34/.test(k)) return { side: 'LEFT', profile: false };
  if (/34.*RIGHT|RIGHT.*34/.test(k)) return { side: 'RIGHT', profile: false };
  return { profile: false };
}

export function deriveNb21Spec(key: string, kind: Nb21Kind, legacyText: string, sideKey = key): Nb21PerspectiveSpec {
  const lock: string[] = [];
  const camera: string[] = [];
  const environmentHints: string[] = [];
  const lightingHints: string[] = [];
  let view = '';
  for (const raw of cleanLegacyText(legacyText).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(FIELD_RE);
    const field = m?.[1]?.trim();
    const value = (m?.[2] ?? '').trim();
    if (field === 'SHOT_TYPE') { view = value; continue; }
    if (field && CAMERA_FIELDS.has(field)) { if (value) camera.push(`${field}: ${value}`); continue; }
    if (field && ENV_FIELDS.has(field)) { if (value) environmentHints.push(value); continue; }
    if (field && LIGHT_FIELDS.has(field)) { if (value) lightingHints.push(value); continue; }
    lock.push(line);
  }
  // Einzeiler wie "CAMERA: ..." (Lkw) landen bereits in camera.
  if (!view) view = key.toLowerCase().replace(/[_:]+/g, ' ');
  const { side, profile } = inferSideFromKey(sideKey);
  if (camera.length === 0) camera.push(kind === 'detail' ? ATTACHED_DETAIL : FULL_VEHICLE);
  if (lock.length === 0) lock.push(`Reproduce the requested ${view} exactly.`);
  return { key, kind, view, physicalSide: side, profile, lock, camera, environmentHints, lightingHints, source: 'derived' };
}

function kindForJob(job: PipelineJob): Nb21Kind {
  if (job.category === 'interior') return 'interior';
  if (job.category === 'detail') return 'detail';
  if (job.category === 'composite') return 'composite';
  return 'exterior';
}

function buildPipelineRegistry(): Record<string, Nb21PerspectiveSpec> {
  const reg: Record<string, Nb21PerspectiveSpec> = {};
  for (const s of CAR_PIPELINE_SPECS) reg[s.key] = s;
  for (const job of ALL_PIPELINE_JOBS) {
    if (reg[job.key]) continue;
    reg[job.key] = deriveNb21Spec(job.key, kindForJob(job), job.prompt);
  }
  return reg;
}

export const NB21_PIPELINE_SPECS: Readonly<Record<string, Nb21PerspectiveSpec>> = buildPipelineRegistry();

const INTERIOR_SLOT_RE = /interior|cockpit|cabin|controls|living|kitchen|bath|bed|garage|cargo|sliding|seat|sleeper|cab_interior|passenger_seat/;
const DETAIL_SLOT_RE = /detail|undercarriage|attachment|fifth_wheel|mirror_camera|vin/;

function buildRemasterRegistry(): Record<string, Nb21PerspectiveSpec> {
  const reg: Record<string, Nb21PerspectiveSpec> = {};
  for (const s of CAR_REMASTER_SPECS) reg[s.key] = s;
  const classes: Array<[string, Record<string, string>]> = [
    ['truck', TRUCK_PERSPECTIVE_PROMPTS],
    ['motorcycle', MOTORCYCLE_PERSPECTIVE_PROMPTS],
    ['motorhome', MOTORHOME_PERSPECTIVE_PROMPTS],
    ['van', VAN_PERSPECTIVE_PROMPTS],
    ['machinery', MACHINERY_PERSPECTIVE_PROMPTS],
  ];
  for (const [cls, prompts] of classes) {
    for (const [slot, text] of Object.entries(prompts)) {
      const kind: Nb21Kind = INTERIOR_SLOT_RE.test(slot) && !/sliding-door/.test(slot)
        ? 'interior'
        : DETAIL_SLOT_RE.test(slot) || slot === 'sliding-door' ? 'detail' : 'exterior';
      // Motorrad 'side' = linke Seite (wie 2.0).
      const sideKey = cls === 'motorcycle' && slot === 'side' ? 'side-left' : slot;
      reg[`${cls}:${slot}`] = deriveNb21Spec(`${cls}:${slot}`, kind, text, sideKey);
    }
  }
  return reg;
}

export const NB21_REMASTER_SPECS: Readonly<Record<string, Nb21PerspectiveSpec>> = buildRemasterRegistry();

export function getNb21PipelineSpec(jobKey: string): Nb21PerspectiveSpec {
  const spec = NB21_PIPELINE_SPECS[jobKey];
  if (!spec) throw new Error(`NB21: Keine 2.1-Perspektive für Pipeline-Job "${jobKey}" – keine Rückfalllösung auf 2.0.`);
  return spec;
}

/**
 * Remaster-Slot → 2.1-Spec. Slots ohne eigene Perspektivdefinition (auch in 2.0
 * ohne Perspektivblock) erhalten eine 2.1-eigene "wie fotografiert"-Spec.
 */
export function getNb21RemasterSpec(vehicleClass: string, slotKey: string): Nb21PerspectiveSpec {
  const spec = NB21_REMASTER_SPECS[`${vehicleClass}:${slotKey}`];
  if (spec) return spec;
  const kind: Nb21Kind = INTERIOR_SLOT_RE.test(slotKey) ? 'interior' : DETAIL_SLOT_RE.test(slotKey) ? 'detail' : 'exterior';
  const { side, profile } = inferSideFromKey(slotKey);
  return {
    key: `${vehicleClass}:${slotKey}`, kind, view: `${slotKey} view as photographed`, physicalSide: side, profile,
    lock: ['Keep the exact camera position, angle and visible vehicle side of the main photo.'],
    camera: [kind === 'detail' ? ATTACHED_DETAIL : FULL_VEHICLE], source: 'derived',
  };
}
