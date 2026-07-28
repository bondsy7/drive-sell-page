/**
 * Zentrale, erweiterbare Fahrzeugklassen-Registry.
 *
 * Aktiv sind AUSSCHLIESSLICH `car` und `truck`. Alle weiteren Keys existieren
 * nur als typisierte Erweiterungspunkte, damit neue Fahrzeuggruppen später
 * durch Registrieren eines Profils ergänzt werden können – ohne Umbau von
 * ImageCaptureGrid, PipelineRunner, PipelineContext, Remaster-Edge-Function
 * oder Galerie.
 *
 * Regeln:
 * - Komponenten dürfen NIE auf eine Fahrzeugklasse verzweigen, sondern lösen
 *   immer ein Profil auf.
 * - Fehlende/unbekannte vehicleClass fällt IMMER auf 'car' zurück
 *   (Rückwärtskompatibilität für alle Altdaten).
 */
import type {
  ActiveVehicleClassKey,
  VehicleClassKey,
  VehicleClassProfile,
} from './vehicle-class-types';
import { CAR_PROFILE } from './profiles/car-profile';
import { TRUCK_PROFILE } from './profiles/truck-profile';

export * from './vehicle-class-types';

export const ACTIVE_VEHICLE_CLASSES: ActiveVehicleClassKey[] = ['car', 'truck'];

const REGISTRY: Partial<Record<VehicleClassKey, VehicleClassProfile>> = {
  car: CAR_PROFILE,
  truck: TRUCK_PROFILE,
};

export function isActiveVehicleClass(key: unknown): key is ActiveVehicleClassKey {
  return typeof key === 'string' && (ACTIVE_VEHICLE_CLASSES as string[]).includes(key);
}

/** Missing / unknown / inactive class always resolves to 'car'. */
export function resolveVehicleClass(value: unknown): ActiveVehicleClassKey {
  return isActiveVehicleClass(value) ? value : 'car';
}

export function getVehicleClassProfile(value: unknown): VehicleClassProfile {
  return REGISTRY[resolveVehicleClass(value)] as VehicleClassProfile;
}

export function getActiveProfiles(): VehicleClassProfile[] {
  return ACTIVE_VEHICLE_CLASSES.map((k) => REGISTRY[k] as VehicleClassProfile);
}
