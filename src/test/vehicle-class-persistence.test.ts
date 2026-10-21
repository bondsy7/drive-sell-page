import { describe, it, expect } from 'vitest';
import { preserveVehicleClassFields } from '@/lib/vehicle-class-persistence';
import type { VehicleData } from '@/types/vehicle';

describe('Fahrzeugart bleibt beim Neuaufbau der Fahrzeugdaten erhalten', () => {
  it('Lkw-Auswahl inkl. Konfiguration, Aufbau, Ladebereich und Bildinhalt bleibt erhalten', () => {
    const vd = {
      vehicleClass: 'truck',
      truckConfiguration: 'rigid_truck_with_trailer',
      truckBodyType: 'box_closed',
      cargoState: 'loaded_accessible',
      subjectScope: 'rigid_truck_and_trailer_complete',
    } as Partial<VehicleData>;
    const kept = preserveVehicleClassFields(vd);
    expect(kept.vehicleClass).toBe('truck');
    expect(kept.truckConfiguration).toBe('rigid_truck_with_trailer');
    expect(kept.truckBodyType).toBe('box_closed');
    expect(kept.cargoState).toBe('loaded_accessible');
    expect(kept.subjectScope).toBe('rigid_truck_and_trailer_complete');
  });

  it('Wohnmobil-Aufbautyp bleibt erhalten', () => {
    const kept = preserveVehicleClassFields({ vehicleClass: 'motorhome', motorhomeBodyType: 'alcove' } as Partial<VehicleData>);
    expect(kept.vehicleClass).toBe('motorhome');
    expect(kept.motorhomeBodyType).toBe('alcove');
  });

  it('Motorrad-Auswahl bleibt erhalten', () => {
    const kept = preserveVehicleClassFields({ vehicleClass: 'motorcycle' } as Partial<VehicleData>);
    expect(kept.vehicleClass).toBe('motorcycle');
  });

  it('ohne gespeicherte Fahrzeugart bleibt der Wert leer (Pkw-Standard für Altdaten)', () => {
    const kept = preserveVehicleClassFields({} as Partial<VehicleData>);
    expect(kept.vehicleClass).toBeUndefined();
    expect(kept.truckConfiguration).toBeNull();
  });
});
