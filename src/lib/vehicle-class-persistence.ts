import type { VehicleData } from '@/types/vehicle';

/**
 * Fahrzeugart-Felder, die bei JEDEM Neuaufbau der Fahrzeugdaten erhalten
 * bleiben müssen. Gehen sie verloren, speichert das Fahrzeug still als Pkw
 * und Lkw/Wohnmobil/Motorrad laufen mit Pkw-Perspektiven und -Prompts.
 */
export function preserveVehicleClassFields(vd: Partial<VehicleData> | null | undefined) {
  return {
    vehicleClass: vd?.vehicleClass,
    motorhomeBodyType: vd?.motorhomeBodyType ?? null,
    truckConfiguration: vd?.truckConfiguration ?? null,
    truckBodyType: vd?.truckBodyType ?? null,
    cargoState: vd?.cargoState ?? null,
    subjectScope: vd?.subjectScope ?? null,
  };
}
