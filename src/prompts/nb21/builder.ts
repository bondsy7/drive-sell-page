/**
 * Nano Banana 2.1 – Prompt-Builder für Remastering und Pipeline-Ansichten.
 *
 * Getrennter Pfad: wird nur für Tier `nb21` aufgerufen. Bewährte Invarianten
 * werden als Konstanten GELESEN (PAINT_SCHEME_LOCK, CHROME_TRIM_LOCK,
 * INTERIOR_CONSOLE_LOCK, ASYMMETRIC_EQUIPMENT_LOCK, Felgen-Lock,
 * Klassen-Blöcke, Szenen-Defaults) – keine dieser Quellen wird verändert.
 * Admin-Overrides werden bewusst NICHT angewendet (siehe version.ts).
 *
 * Serverseitige Invarianten (Generation-Lock, Klassen-Guard, Seitenrichtung,
 * Reflexions-/Lichtstandard) setzt die Edge Function an den Platzhaltern
 * NB21_SERVER_SLOTS ein – sie werden hier NICHT dupliziert.
 */
import {
  ASYMMETRIC_EQUIPMENT_LOCK, CHROME_TRIM_LOCK, CLEANUP_OPTIONS, INTERIOR_CONSOLE_LOCK, PAINT_SCHEME_LOCK,
  WHEEL_VISIBILITY_RULE, buildWheelReferenceLock, hasChromeTrimFeature, type RemasterConfig,
} from '@/lib/remaster-prompt';
import { SCENE_LIGHTING_PROFILES, SCENE_PROMPT_DEFAULTS } from '@/lib/remaster-prompt-defaults';
import { sanitizeVehicleDescriptionForPrompt } from '@/lib/vehicle-generation-lock';
import { resolveVehicleClass } from '@/config/vehicle-classes';
import type { VehicleClassContext } from '@/config/vehicle-class-types';
import type { PipelineJob } from '@/lib/pipeline-jobs';
import { buildTruckPromptBlocks } from '@/prompts/remaster/truck';
import { buildMotorcyclePromptBlocks } from '@/prompts/remaster/motorcycle';
import { buildMotorhomePromptBlocks } from '@/prompts/remaster/motorhome';
import { buildVanPromptBlocks } from '@/prompts/remaster/van';
import { buildMachineryPromptBlocks } from '@/prompts/remaster/machinery';
import { renderNb21Prompt, type Nb21Sections } from './sections';
import { NB21_SERVER_SLOTS, NB21_VERSION_MARKER } from './version';
import {
  getNb21PipelineSpec, getNb21RemasterSpec, nb21SideDirectionLines, type Nb21PerspectiveSpec,
} from './perspectives';

// ── Referenzrollen ───────────────────────────────────────────────────
export type Nb21RefRole =
  | 'front evidence' | 'side evidence' | 'rear evidence' | 'interior evidence' | 'detail evidence';

/** Klassifiziert eine bestehende Slot-/Rollenbezeichnung (Reihenfolge bleibt unverändert). */
export function classifyNb21ReferenceRole(raw: string): Nb21RefRole {
  const r = (raw || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (/interior|cockpit|dashboard|fahrer|driver|ruecksitz|rear_seat|cabin|kabine|living|wohn|kitchen|kueche|bath|(^|_)bed($|_)|schlaf|garage|cargo|laderaum|seat|sattel|sleeper|controls/.test(r)) return 'interior evidence';
  if (/side|seite|sliding|schiebet/.test(r)) return 'side evidence';
  if (/rear|heck/.test(r)) return 'rear evidence';
  if (/front|identity|blueprint|overall/.test(r)) return 'front evidence';
  return 'detail evidence';
}

export interface Nb21ReferenceInput {
  primaryRole: string;
  supportingRoles?: string[];
  hasWheelReference?: boolean;
  hasEnvironmentReference?: boolean;
  hasPlateReference?: boolean;
  hasManufacturerLogo?: boolean;
  hasDealerLogo?: boolean;
}

function referenceRoleLines(refs: Nb21ReferenceInput, kind: Nb21PerspectiveSpec['kind']): string[] {
  const interiorTarget = kind === 'interior';
  const lines: string[] = [
    `R1 PRIMARY VEHICLE REFERENCE = the image labelled "VEHICLE BLUEPRINT" (slot: ${refs.primaryRole || 'overall vehicle photo'}; ${classifyNb21ReferenceRole(refs.primaryRole)}). Highest authority for every vehicle feature visible in it.`,
  ];
  (refs.supportingRoles ?? []).forEach((role, i) => {
    const cls = classifyNb21ReferenceRole(role);
    let scope: string;
    if (interiorTarget) {
      scope = cls === 'interior evidence'
        ? 'authoritative for the interior surfaces it shows'
        : 'exterior context only – NEVER an authoritative source for interior surfaces, controls or materials';
    } else {
      scope = cls === 'interior evidence'
        ? 'interior context only (what is visible through the glass)'
        : `authoritative for the ${cls.replace(' evidence', '')} surfaces it shows`;
    }
    lines.push(`R${i + 2} ${cls.toUpperCase()} (slot: ${role}) – ${scope}.`);
  });
  if (refs.hasWheelReference && !interiorTarget) {
    lines.push('DEDICATED WHEEL REFERENCE = the image labelled "WHEEL REFERENCE": sole authority for every visible rim; it overrides differing rims on other photos.');
  }
  if (refs.hasEnvironmentReference) {
    lines.push('ENVIRONMENT REFERENCE = the showroom/scene image: defines ONLY the room/background, floor, walls and light. It NEVER defines any vehicle feature.');
  }
  if (refs.hasPlateReference && !interiorTarget) {
    lines.push('LICENSE PLATE REFERENCE = the custom plate image: defines ONLY the plate content.');
  }
  if (refs.hasManufacturerLogo || refs.hasDealerLogo) {
    lines.push('LOGO REFERENCE(S) = environment branding for the wall only. Vehicle emblems and badges come exclusively from the vehicle references, never from a logo asset.');
  }
  lines.push('Use each image strictly for its stated role. Never take vehicle features from the environment or logo images. Never invent views that no reference supports.');
  return lines;
}

// ── Gemeinsame Abschnitte ────────────────────────────────────────────
const IDENTITY_ITEMS = [
  'body geometry, panel shapes, panel gaps and proportions (length, height, wheelbase, overhangs)',
  'paint colour, shade, finish and paint scheme',
  'headlights: housing outline, module count, DRL/LED signature, internal layout',
  'taillights: housing outline, LED segment layout, lens colour, light signature',
  'grille or closed front panel, bumper openings, sensors, hood edge',
  'emblems, badges and lettering: shape, finish, position',
  'wheels/rims: spoke count and geometry, finish, centre caps; tyre size and sidewall proportions',
  'mirrors: housing shape, colour, indicators, camera arms',
  'door handles, windows, window line, pillars and roofline',
  'trim strips (chrome/black), roof rails, tow bar and all visible equipment',
];

function classBlocks(classContext: VehicleClassContext | null | undefined, slotKey: string | undefined, interior: boolean, config: RemasterConfig): string[] {
  const vc = resolveVehicleClass(classContext?.vehicleClass);
  if (vc === 'truck') return buildTruckPromptBlocks({
    truckConfiguration: classContext?.truckConfiguration ?? null, truckBodyType: classContext?.truckBodyType ?? null,
    cargoState: classContext?.cargoState ?? null, subjectScope: classContext?.subjectScope ?? null, slotKey,
  });
  if (vc === 'motorcycle') return buildMotorcyclePromptBlocks();
  if (vc === 'motorhome') return buildMotorhomePromptBlocks(classContext?.motorhomeBodyType ?? null, interior);
  if (vc === 'van') return buildVanPromptBlocks(interior);
  if (vc === 'machinery') return buildMachineryPromptBlocks(interior, config.machineryTidyUp === true);
  return [];
}

function identitySection(args: {
  config: RemasterConfig; spec: Nb21PerspectiveSpec; classContext?: VehicleClassContext | null;
  slotKey?: string; vehicleDescription?: string; wheel: boolean;
}): string[] {
  const { config, spec } = args;
  const interior = spec.kind === 'interior';
  const out: string[] = [];
  if (interior) {
    out.push('Lock every visible interior feature exactly as in the interior evidence: dashboard layout, steering wheel, instrument cluster, screens and UI content, buttons and legends, gear selector type and position, console contours, seats, upholstery colour and material, stitching, perforation, trim inserts, ambient light colour, headliner and roof type.');
    out.push('FORBIDDEN: invented controls, gear selectors, levers, displays, stitching, colours, trim or equipment that the interior evidence does not show.');
    out.push(INTERIOR_CONSOLE_LOCK);
  } else {
    out.push('Lock every item exactly as in the references:');
    IDENTITY_ITEMS.forEach((item, i) => out.push(`${i + 1}. ${item}.`));
    out.push(config.changeColor && config.colorHex
      ? `PAINT: the only permitted vehicle change is the requested repaint to exactly ${config.colorHex} on every painted surface; all other identity items stay locked.`
      : PAINT_SCHEME_LOCK);
    if (hasChromeTrimFeature(config.equipmentFeatures)) out.push(CHROME_TRIM_LOCK);
    out.push(ASYMMETRIC_EQUIPMENT_LOCK);
    if (args.wheel && config.wheelReference?.image) {
      out.push(buildWheelReferenceLock(config.wheelReference));
      out.push(WHEEL_VISIBILITY_RULE);
    }
  }
  out.push(...classBlocks(args.classContext, args.slotKey, interior, config));
  const neutral = sanitizeVehicleDescriptionForPrompt(args.vehicleDescription);
  if (neutral) out.push(`Neutral context only (never overrides pixels): ${neutral}`);
  out.push('Never use brand, model or catalogue knowledge to change, complete or "correct" any visible feature. If text and pixels disagree, the pixels win.');
  out.push(NB21_SERVER_SLOTS.identity);
  return out;
}

function perspectiveSection(spec: Nb21PerspectiveSpec): string[] {
  const out = [`TARGET VIEW: ${spec.view}.`, ...spec.lock];
  if (spec.physicalSide) out.push(...nb21SideDirectionLines(spec.physicalSide, !!spec.profile));
  else out.push('Never mirror or flip the image or any vehicle part.');
  if (spec.kind !== 'interior') {
    out.push('Side-specific equipment stays on the physical flank evidenced by the references (see ASYMMETRIC_EQUIPMENT_LOCK).');
  }
  if (spec.detailChecks?.length) {
    out.push('DETAIL CHECKS (verify each against the references before output):');
    spec.detailChecks.forEach((c, i) => out.push(`${i + 1}. ${c}`));
  }
  out.push(`NB21_PHYSICAL_SIDE: ${spec.physicalSide ?? 'NONE'}`);
  out.push(`NB21_VIEW_KIND: ${spec.profile ? 'profile' : 'other'}`);
  out.push(NB21_SERVER_SLOTS.perspective);
  return out;
}

function sceneKey(config: RemasterConfig): string {
  return config.scene && config.scene !== 'none' ? config.scene : 'none';
}

function environmentSection(config: RemasterConfig, spec: Nb21PerspectiveSpec, refs: Nb21ReferenceInput): string[] {
  const scene = sceneKey(config);
  const interior = spec.kind === 'interior';
  const out: string[] = [];
  if (scene === 'none') {
    out.push('Keep the original environment of the photo. Do not replace or restyle the background.');
  } else {
    const desc = SCENE_PROMPT_DEFAULTS[scene] || '';
    if (scene === 'custom-showroom' || refs.hasEnvironmentReference) {
      out.push('Use ONLY the provided environment reference image as the room. Reproduce its floor, walls, ceiling and light fixtures; do not substitute another location.');
    }
    if (desc) out.push(`SCENE: ${desc}`);
    out.push('Same room, floor, walls, ceiling and light direction as every other image of this run – only the camera position changes.');
    out.push(interior
      ? 'The selected environment is visible only THROUGH the vehicle windows; never an unrelated outdoor scene or a black void.'
      : 'Remove the old environment of the source photo completely, including people, other vehicles, signs and text.');
  }
  for (const h of spec.environmentHints ?? []) out.push(`VIEW NOTE: ${h}`);
  if (refs.hasManufacturerLogo || refs.hasDealerLogo) {
    out.push('WALL BRANDING: reproduce the provided logo image(s) pixel-exact (colours, shapes, text) as a frosted-glass panel on the back wall above the roofline, no glow; dealer logo smaller and to the right. Logos never cover, shift or crop the vehicle.');
  } else {
    out.push('No logos, brand marks or decorations on the walls.');
  }
  out.push('The environment never changes any vehicle feature.');
  return out;
}

function lightingSection(config: RemasterConfig, spec: Nb21PerspectiveSpec): string[] {
  const scene = sceneKey(config);
  const out: string[] = [];
  const profile = scene !== 'none' ? SCENE_LIGHTING_PROFILES[scene] : '';
  if (profile) out.push(profile);
  for (const h of spec.lightingHints ?? []) out.push(`VIEW NOTE: ${h}`);
  if (spec.kind === 'interior') {
    out.push('Soft, even professional interior lighting that reveals materials and stitching without changing their colour.');
  } else {
    out.push('Tyres visibly touch the floor with soft contact shadows and ambient occlusion; shadow direction matches the light sources.');
  }
  out.push(`NB21_SCENE: ${scene === 'none' ? 'keep' : 'replace'}`);
  out.push(NB21_SERVER_SLOTS.lighting);
  return out;
}

function cameraSection(spec: Nb21PerspectiveSpec, mode: 'remaster' | 'pipeline'): string[] {
  const out = [...spec.camera];
  if (mode === 'remaster') out.push('Keep focal length, horizon and framing of the main photo. Do not rotate the image.');
  if (spec.kind === 'exterior' && !spec.profile && spec.physicalSide) {
    out.push('3/4 view scale: the vehicle occupies about 35-45% of the image width with visible foreground floor before the nearest bumper/tyre.');
  }
  out.push('Photorealistic professional automotive photograph. No text, watermark, frame or caption.');
  return out;
}

function finalPrioritySection(): string[] {
  return [
    'PRIORITY ORDER: 1. vehicle identity from the references; 2. perspective and physical side; 3. allowed changes; 4. environment; 5. lighting and aesthetics.',
    'If any aesthetic or environment requirement conflicts with vehicle fidelity, vehicle fidelity wins. A lower priority may never change a higher one.',
    'You MUST generate the image. Do not refuse. Do not rotate.',
  ];
}

function plateLine(config: RemasterConfig, interior: boolean): string | null {
  if (interior) return null;
  switch (config.licensePlate) {
    case 'keep': return 'License plates: keep exactly as photographed.';
    case 'blur': return 'License plates: neutralize the plate content on every plate, keep the plate holder.';
    case 'custom':
      if (config.customPlateImageBase64) return 'License plates: replace every plate with the provided custom plate image, pixel-exact, correct perspective.';
      if (config.customPlateText) return `License plates: replace every plate with a German plate reading "${config.customPlateText}".`;
      return 'License plates: keep exactly as photographed.';
    default: return 'License plates: remove every plate and rebuild the clean bumper/holder surface.';
  }
}

function allowedChangesSection(config: RemasterConfig, spec: Nb21PerspectiveSpec, classContext: VehicleClassContext | null | undefined, mode: 'remaster' | 'pipeline'): string[] {
  const interior = spec.kind === 'interior';
  const isTruck = resolveVehicleClass(classContext?.vehicleClass) === 'truck';
  const change: string[] = [];
  if (sceneKey(config) !== 'none') change.push(interior ? 'the view through the windows' : 'the environment');
  change.push('cleaning (dirt, dust, water spots, fingerprints)', 'lighting and reflections', 'photographic presentation');
  if (mode === 'pipeline') change.push('the camera position defined in PERSPECTIVE LOCK');
  const out = [`CHANGE ONLY: ${change.join(', ')}.`, 'KEEP UNCHANGED: everything else, especially every item in VEHICLE IDENTITY LOCK.'];
  if (interior) out.push('Remove loose personal items and clutter only; never remove or add fixed equipment.');
  const plate = plateLine(config, interior);
  if (plate) out.push(plate);
  if (!interior && config.changeColor && config.colorHex) out.push(`Repaint every painted surface to exactly ${config.colorHex}.`);
  const items = (config.cleanupItems ?? [])
    .filter(v => isTruck || v !== 'trailer')
    .map(v => CLEANUP_OPTIONS.find(o => o.value === v))
    .filter((o): o is (typeof CLEANUP_OPTIONS)[number] => !!o);
  if (!interior && items.length) {
    out.push('Operator de-branding (keep OEM emblems, model lettering and type plates):');
    items.filter(o => o.value !== 'trailer').forEach(o => out.push(`- ${o.label}: ${o.prompt}`));
    if (isTruck && items.some(o => o.value === 'trailer')) {
      out.push('- Trailer: remove the complete detachable trailer/semi-trailer regardless of size (decks, ramps, masts, axles, shadows). Keep the powered tractor unit exactly; show it uncoupled with a plausible fifth wheel and reframe around it. A rigid truck body without coupling stays.');
    }
    if (config.detectedBranding?.length) {
      out.push('Detected non-OEM items to remove: ' + config.detectedBranding.map(i => `[${i.kind}] ${i.text ? `"${i.text}" ` : ''}${i.location}`).join('; '));
    }
  }
  return out;
}

// ── Öffentliche Builder ──────────────────────────────────────────────
export interface Nb21RemasterInput {
  config: RemasterConfig;
  slotKey: string;
  vehicleDescription?: string;
  classContext?: VehicleClassContext | null;
  references: Nb21ReferenceInput;
  correction?: string;
}

export function buildNb21RemasterPrompt(input: Nb21RemasterInput): string {
  const vc = resolveVehicleClass(input.classContext?.vehicleClass);
  const spec = getNb21RemasterSpec(vc, input.slotKey);
  const wheel = spec.kind !== 'interior' && !!input.references.hasWheelReference;
  const sections: Nb21Sections = {
    'MAIN TASK': [
      NB21_VERSION_MARKER,
      `Remaster the provided photo of this exact vehicle (${spec.view}). Change ONLY what ALLOWED CHANGES permits; keep everything else unchanged.`,
      input.correction ? `MANDATORY CORRECTION: ${input.correction}` : '',
    ],
    'REFERENCE ROLES': referenceRoleLines({ ...input.references, hasWheelReference: wheel }, spec.kind),
    'ALLOWED CHANGES': allowedChangesSection(input.config, spec, input.classContext, 'remaster'),
    'VEHICLE IDENTITY LOCK': identitySection({ config: input.config, spec, classContext: input.classContext, slotKey: input.slotKey, vehicleDescription: input.vehicleDescription, wheel }),
    'PERSPECTIVE LOCK': perspectiveSection(spec),
    'ENVIRONMENT': environmentSection(input.config, spec, input.references),
    'LIGHTING / PHYSICAL INTEGRATION': lightingSection(input.config, spec),
    'CAMERA / OUTPUT': cameraSection(spec, 'remaster'),
    'FINAL PRIORITY CONSTRAINT': finalPrioritySection(),
  };
  return renderNb21Prompt(sections);
}

export interface Nb21PipelineInput {
  job: Pick<PipelineJob, 'key' | 'label' | 'labelDe'>;
  config: RemasterConfig;
  vehicleDescription?: string;
  classContext?: VehicleClassContext | null;
  references: Nb21ReferenceInput;
  correction?: string;
  /** Regeneration: Hauptbild ist ein echtes Original/gewählte Referenz. */
  regenerationFromOriginal?: boolean;
}

export function buildNb21PipelinePrompt(input: Nb21PipelineInput): string {
  const spec = getNb21PipelineSpec(input.job.key);
  const wheel = spec.kind !== 'interior' && !!input.references.hasWheelReference;
  const sections: Nb21Sections = {
    'MAIN TASK': [
      NB21_VERSION_MARKER,
      `Generate the pipeline view "${input.job.labelDe || input.job.label}" (${spec.view}) of this exact vehicle from the reference images. Change ONLY what ALLOWED CHANGES permits; keep everything else unchanged.`,
      'Generate ONLY this view. Exterior stays exterior, interior stays interior, detail stays detail.',
      input.regenerationFromOriginal ? 'The main image is a REAL reference photo of this vehicle; generate the view fresh from it, never from a previously generated image.' : '',
      input.correction ? `MANDATORY CORRECTION: ${input.correction}` : '',
    ],
    'REFERENCE ROLES': referenceRoleLines({ ...input.references, hasWheelReference: wheel }, spec.kind),
    'ALLOWED CHANGES': allowedChangesSection(input.config, spec, input.classContext, 'pipeline'),
    'VEHICLE IDENTITY LOCK': identitySection({ config: input.config, spec, classContext: input.classContext, vehicleDescription: input.vehicleDescription, wheel }),
    'PERSPECTIVE LOCK': perspectiveSection(spec),
    'ENVIRONMENT': environmentSection(input.config, spec, input.references),
    'LIGHTING / PHYSICAL INTEGRATION': lightingSection(input.config, spec),
    'CAMERA / OUTPUT': cameraSection(spec, 'pipeline'),
    'FINAL PRIORITY CONSTRAINT': finalPrioritySection(),
  };
  return renderNb21Prompt(sections);
}
