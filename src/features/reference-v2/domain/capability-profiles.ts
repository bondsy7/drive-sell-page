import type { VehicleClassV2 } from "./vehicle-classes";
import type { PerspectiveId } from "./perspectives/types";
import { ALL_PERSPECTIVE_SPECS } from "./perspectives/registry";

/**
 * Reference V2 — Vehicle Class Capability Profiles (Phase 0).
 *
 * CapabilityProfiles erlauben spaeter pro Fahrzeugklasse zusaetzliche
 * Perspektiven (z. B. LKW: Sattelkupplung, Motorrad: Tank/Cockpit) oder
 * Ausschluesse, OHNE die Standardregistry umzuschreiben.
 * Phase 0 liefert bewusst nur neutrale Default-Profile.
 */
export interface CapabilityProfile {
  readonly vehicleClass: VehicleClassV2;
  readonly version: number;
  /** Zusaetzlich freigeschaltete Perspektiven fuer diese Klasse. */
  readonly addedPerspectiveIds: readonly PerspectiveId[];
  /** Fuer diese Klasse gesperrte Perspektiven (ueberschreibt Registry). */
  readonly removedPerspectiveIds: readonly PerspectiveId[];
  readonly notes?: string;
}

export const DEFAULT_CAPABILITY_PROFILES: Readonly<
  Record<VehicleClassV2, CapabilityProfile>
> = {
  car: {
    vehicleClass: "car",
    version: 1,
    addedPerspectiveIds: [],
    removedPerspectiveIds: [],
  },
  van: {
    vehicleClass: "van",
    version: 1,
    addedPerspectiveIds: [],
    removedPerspectiveIds: [],
  },
  motorhome: {
    vehicleClass: "motorhome",
    version: 1,
    addedPerspectiveIds: [],
    removedPerspectiveIds: [],
  },
  truck: {
    vehicleClass: "truck",
    version: 1,
    addedPerspectiveIds: [],
    removedPerspectiveIds: [],
    notes:
      "Spaetere Phasen: zusaetzliche Specs (z. B. Sattelkupplung, Aufbau) via addedPerspectiveIds.",
  },
  motorcycle: {
    vehicleClass: "motorcycle",
    version: 1,
    addedPerspectiveIds: [],
    removedPerspectiveIds: [],
    notes:
      "Spaetere Phasen: eigene Cockpit-/Tank-/Einzelrad-Specs via addedPerspectiveIds.",
  },
  trailer: {
    vehicleClass: "trailer",
    version: 1,
    addedPerspectiveIds: [],
    removedPerspectiveIds: [],
  },
};

/**
 * Liefert die effektiv verfuegbaren Perspective-IDs fuer eine Fahrzeugklasse:
 * Registry-Basis (applicableVehicleClasses) + Profil-Ergaenzungen − Sperren.
 */
export function resolvePerspectiveIdsForClass(
  vehicleClass: VehicleClassV2,
  profile?: CapabilityProfile,
): readonly PerspectiveId[] {
  const effectiveProfile = profile ?? DEFAULT_CAPABILITY_PROFILES[vehicleClass];
  const base = ALL_PERSPECTIVE_SPECS.filter((s) =>
    s.applicableVehicleClasses.includes(vehicleClass),
  ).map((s) => s.id);
  const withAdded = [
    ...new Set<PerspectiveId>([...base, ...effectiveProfile.addedPerspectiveIds]),
  ];
  const removed = new Set<PerspectiveId>(effectiveProfile.removedPerspectiveIds);
  return withAdded.filter((id) => !removed.has(id));
}
