/**
 * LKW-Workflow-Konfiguration (Schritt 1–3) inkl. dynamischer Slot-Auflösung.
 *
 * Alles hier ist datengetrieben. Neue Konfigurationen oder Aufbauarten werden
 * durch Ergänzen dieser Listen aktiviert – ohne UI- oder Pipeline-Änderungen.
 */
import type {
  CaptureSlot,
  CargoStateKey,
  SubjectScopeKey,
  TruckBodyTypeKey,
  TruckConfigurationKey,
  TruckWorkflowSelection,
} from './vehicle-class-types';

// ── Schritt 1: Konfiguration ────────────────────────────────────────────────

export interface TruckConfigurationOption {
  key: TruckConfigurationKey;
  label: string;
  description: string;
  /** Sketch-ID (technische Strichzeichnung). */
  sketch: string;
  subjectScope: SubjectScopeKey;
  /** Fahrerhaus/Zugmaschine vorhanden? */
  hasCab: boolean;
  /** Fest verbauter Aufbau auf dem Motorwagen? */
  hasRigidBody: boolean;
  /** Auflieger (Sattelanhänger) vorhanden? */
  hasSemiTrailer: boolean;
  /** Gezogener Anhänger vorhanden? */
  hasDrawbarTrailer: boolean;
  /** Schritt 2 (Aufbauart) anzeigen? */
  requiresBodyType: boolean;
}

export const TRUCK_CONFIGURATIONS: TruckConfigurationOption[] = [
  {
    key: 'tractor_unit',
    label: 'Zugmaschine',
    description: 'Ohne Auflieger oder Anhänger',
    sketch: 'tractor_unit',
    subjectScope: 'tractor_unit_only',
    hasCab: true,
    hasRigidBody: false,
    hasSemiTrailer: false,
    hasDrawbarTrailer: false,
    requiresBodyType: false,
  },
  {
    key: 'rigid_truck',
    label: 'LKW mit festem Aufbau',
    description: 'Aufbau fest mit dem Fahrzeug verbunden',
    sketch: 'rigid_truck',
    subjectScope: 'rigid_truck_complete',
    hasCab: true,
    hasRigidBody: true,
    hasSemiTrailer: false,
    hasDrawbarTrailer: false,
    requiresBodyType: true,
  },
  {
    key: 'rigid_truck_with_trailer',
    label: 'LKW mit festem Aufbau und Anhänger',
    description: 'Motorwagen mit zusätzlichem Anhänger',
    sketch: 'rigid_truck_with_trailer',
    subjectScope: 'rigid_truck_and_trailer_complete',
    hasCab: true,
    hasRigidBody: true,
    hasSemiTrailer: false,
    hasDrawbarTrailer: true,
    requiresBodyType: true,
  },
  {
    key: 'semi_truck',
    label: 'Sattelzug mit Auflieger',
    description: 'Zugmaschine mit Auflieger',
    sketch: 'semi_truck',
    subjectScope: 'tractor_and_semi_trailer_complete',
    hasCab: true,
    hasRigidBody: false,
    hasSemiTrailer: true,
    hasDrawbarTrailer: false,
    requiresBodyType: true,
  },
  {
    key: 'semi_truck_with_trailer',
    label: 'Sattelzug mit Auflieger und Anhänger',
    description: 'Sattelzug mit zusätzlichem Anhänger',
    sketch: 'semi_truck_with_trailer',
    subjectScope: 'complete_multi_part_combination',
    hasCab: true,
    hasRigidBody: false,
    hasSemiTrailer: true,
    hasDrawbarTrailer: true,
    requiresBodyType: true,
  },
  {
    key: 'trailer_only',
    label: 'Nur Anhänger / Auflieger',
    description: 'Separat fotografieren',
    sketch: 'trailer_only',
    subjectScope: 'trailer_or_semi_trailer_only',
    hasCab: false,
    hasRigidBody: false,
    hasSemiTrailer: true,
    hasDrawbarTrailer: false,
    requiresBodyType: true,
  },
];

export function getTruckConfiguration(
  key: TruckConfigurationKey | null | undefined,
): TruckConfigurationOption | null {
  return TRUCK_CONFIGURATIONS.find((c) => c.key === key) ?? null;
}

// ── Schritt 2: Aufbau- / Anhängerart ────────────────────────────────────────

export interface TruckBodyTypeOption {
  key: TruckBodyTypeKey;
  label: string;
  description: string;
  sketch: string;
  /** Ist ein Ladebereich grundsätzlich einsehbar/fotografierbar? */
  cargoAreaPhotographable: boolean;
}

export const TRUCK_BODY_TYPES: TruckBodyTypeOption[] = [
  {
    key: 'box_closed',
    label: 'Kofferaufbau (geschlossen)',
    description: 'Geschlossener Kasten, Plane oder Kühlkoffer.',
    sketch: 'body_box_closed',
    cargoAreaPhotographable: true,
  },
  {
    key: 'platform_open',
    label: 'Pritsche / offene Ladefläche',
    description: 'Offene Ladefläche, ggf. mit Bordwänden.',
    sketch: 'body_platform_open',
    cargoAreaPhotographable: true,
  },
  {
    key: 'tipper',
    label: 'Kipper',
    description: 'Kippmulde für Schüttgut.',
    sketch: 'body_tipper',
    cargoAreaPhotographable: true,
  },
  {
    key: 'tank',
    label: 'Tank / Silo',
    description: 'Geschlossener Tank- oder Silobehälter.',
    sketch: 'body_tank',
    cargoAreaPhotographable: false,
  },
  {
    key: 'low_loader',
    label: 'Tieflader',
    description: 'Abgesenkte Ladeebene, oft mit Rampen.',
    sketch: 'body_low_loader',
    cargoAreaPhotographable: true,
  },
  {
    key: 'vehicle_transport',
    label: 'Autotransporter',
    description: 'Mehrstöckige Ladeebenen mit Rampen.',
    sketch: 'body_vehicle_transport',
    cargoAreaPhotographable: true,
  },
  {
    key: 'unknown',
    label: 'Sonstiger / unklarer Aufbau',
    description: 'Aufbauart nicht eindeutig zuordenbar.',
    sketch: 'body_unknown',
    cargoAreaPhotographable: false,
  },
];

export function getTruckBodyType(
  key: TruckBodyTypeKey | null | undefined,
): TruckBodyTypeOption | null {
  return TRUCK_BODY_TYPES.find((b) => b.key === key) ?? null;
}

// ── Schritt 3: Ladebereich ──────────────────────────────────────────────────

export interface CargoStateOption {
  key: CargoStateKey;
  label: string;
  description: string;
  /** Ladebereich-Slot anbieten? */
  requiresCargoPhoto: boolean;
}

export const CARGO_STATES: CargoStateOption[] = [
  {
    key: 'empty',
    label: 'Leer und einsehbar',
    description: 'Ladebereich ist leer und kann fotografiert werden.',
    requiresCargoPhoto: true,
  },
  {
    key: 'loaded_accessible',
    label: 'Beladen, aber einsehbar',
    description: 'Ladung vorhanden, Ladebereich ist trotzdem fotografierbar.',
    requiresCargoPhoto: true,
  },
  {
    key: 'not_accessible',
    label: 'Nicht einsehbar / verschlossen',
    description: 'Ladebereich kann nicht fotografiert werden.',
    requiresCargoPhoto: false,
  },
];

export function getCargoState(key: CargoStateKey | null | undefined): CargoStateOption | null {
  return CARGO_STATES.find((c) => c.key === key) ?? null;
}

/** Schritt 3 wird nur gestellt, wenn eine Ladeeinheit existiert und einsehbar sein kann. */
export function needsCargoStep(selection: {
  truckConfiguration?: TruckConfigurationKey | null;
  truckBodyType?: TruckBodyTypeKey | null;
}): boolean {
  const cfg = getTruckConfiguration(selection.truckConfiguration);
  if (!cfg) return false;
  if (!cfg.hasRigidBody && !cfg.hasSemiTrailer && !cfg.hasDrawbarTrailer) return false;
  const body = getTruckBodyType(selection.truckBodyType);
  return body ? body.cargoAreaPhotographable : false;
}

export function needsBodyTypeStep(
  truckConfiguration?: TruckConfigurationKey | null,
): boolean {
  return getTruckConfiguration(truckConfiguration)?.requiresBodyType ?? false;
}

export function resolveSubjectScope(
  truckConfiguration?: TruckConfigurationKey | null,
): SubjectScopeKey | null {
  return getTruckConfiguration(truckConfiguration)?.subjectScope ?? null;
}

/** Vollständigkeit der Auswahl (Voraussetzung für den Foto-Schritt). */
export function isTruckSelectionComplete(selection: Partial<TruckWorkflowSelection>): boolean {
  const cfg = getTruckConfiguration(selection.truckConfiguration);
  if (!cfg) return false;
  if (cfg.requiresBodyType && !getTruckBodyType(selection.truckBodyType)) return false;
  if (needsCargoStep(selection) && !getCargoState(selection.cargoState)) return false;
  return true;
}

// ── Dynamische Slot-Auflösung ───────────────────────────────────────────────

const slot = (s: CaptureSlot): CaptureSlot => s;

export function resolveTruckSlots(selection: Partial<TruckWorkflowSelection>): CaptureSlot[] {
  const cfg = getTruckConfiguration(selection.truckConfiguration);
  if (!cfg) return [];

  const slots: CaptureSlot[] = [];
  const hasTowedUnit = cfg.hasSemiTrailer || cfg.hasDrawbarTrailer;
  const unitLabel = cfg.hasSemiTrailer ? 'Auflieger' : cfg.hasDrawbarTrailer ? 'Anhänger' : 'Aufbau';

  if (cfg.hasCab) {
    slots.push(
      slot({
        key: 'truck_cab_34_front_left',
        label: '3/4 Front links (Fahrerhaus)',
        sketch: 'cab_34_front_left',
        hint: 'Fahrerhaus komplett im Bild, Kamera auf Höhe der Scheinwerfer.',
        required: true,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['cab_34_front_left', 'ext_front'],
      }),
      slot({
        key: 'truck_cab_side_left',
        label: 'Seite links',
        sketch: 'cab_side_left',
        hint: 'Rechtwinklig zur Fahrzeugseite, gesamte Länge im Bild.',
        required: true,
        aspect: '2/1',
        capture: 'environment',
        coverageTags: ['side_left', 'ext_side_left'],
      }),
      slot({
        key: 'truck_cab_front',
        label: 'Front frontal',
        sketch: 'cab_front',
        hint: 'Frontal auf Grill und Scheinwerfer.',
        required: false,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['front'],
      }),
      slot({
        key: 'truck_mirror_camera_detail',
        label: 'Spiegel / Kamerasystem',
        sketch: 'mirror_detail',
        hint: 'Nahaufnahme der A-Säule: Glasspiegel oder Kamera-Monitor-System.',
        required: true,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['mirror_system'],
      }),
      slot({
        key: 'truck_cab_interior',
        label: 'Fahrerhaus innen',
        sketch: 'cab_interior',
        hint: 'Fahrersitz, Lenkrad und Armaturenbrett.',
        required: false,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['interior_front', 'cockpit'],
      }),
    );
  }

  if (cfg.key === 'tractor_unit') {
    slots.push(
      slot({
        key: 'truck_fifth_wheel',
        label: 'Sattelplatte / Rahmen hinten',
        sketch: 'fifth_wheel',
        hint: 'Bereich hinter dem Fahrerhaus mit Sattelplatte.',
        required: true,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['fifth_wheel', 'rear'],
      }),
    );
  }

  if (cfg.hasRigidBody || hasTowedUnit) {
    slots.push(
      slot({
        key: 'truck_body_side_left',
        label: `${cfg.hasRigidBody ? 'Aufbau' : unitLabel} Seite links`,
        sketch: 'body_side_left',
        hint: 'Komplette Seitenfläche der Ladeeinheit.',
        required: true,
        aspect: '2/1',
        capture: 'environment',
        coverageTags: ['body_side_left'],
      }),
      slot({
        key: 'truck_body_rear',
        label: `${cfg.hasRigidBody ? 'Aufbau' : unitLabel} Heck`,
        sketch: 'body_rear',
        hint: 'Heck frontal, Türen/Abschluss vollständig sichtbar.',
        required: true,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['body_rear', 'rear'],
      }),
      slot({
        key: 'truck_body_34_rear_right',
        label: '3/4 Heck rechts',
        sketch: 'body_34_rear_right',
        hint: 'Schräg von hinten rechts, zeigt Heck und rechte Seite.',
        required: false,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['34_rear_right'],
      }),
    );
  }

  if (needsCargoStep(selection) && getCargoState(selection.cargoState)?.requiresCargoPhoto) {
    slots.push(
      slot({
        key: 'truck_cargo_area',
        label: 'Ladebereich',
        sketch: 'cargo_area',
        hint: 'Ladefläche bzw. Innenraum der Ladeeinheit.',
        required: true,
        aspect: '4/3',
        capture: 'environment',
        coverageTags: ['cargo_area'],
      }),
    );
  }

  slots.push(
    slot({
      key: 'truck_vin',
      label: 'VIN / Typschild',
      sketch: 'vin_plate',
      hint: 'Fahrgestellnummer oder Typschild scharf und lesbar.',
      required: false,
      aspect: '4/3',
      capture: 'environment',
      isVin: true,
      coverageTags: ['vin'],
    }),
  );

  return slots;
}

/** Pflicht-Coverage-Tags je Konfiguration (für die Source-Coverage-Validierung). */
export function resolveTruckRequiredCoverage(
  selection: Partial<TruckWorkflowSelection>,
): string[] {
  return resolveTruckSlots(selection)
    .filter((s) => s.required)
    .flatMap((s) => s.coverageTags.slice(0, 1));
}
