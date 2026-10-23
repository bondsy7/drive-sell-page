import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_INVENTORY,
  matchesLiveFilter,
  resolveLiveVehicles,
  type LiveInventoryConfig,
  type LiveVehicle,
} from '@/lib/live-inventory';

const car = (id: string, brand: string, model: string, used: boolean | null, priceEur: number | null = null): LiveVehicle => ({
  externalVehicleId: id,
  brand,
  model,
  variant: `${model} Trend`,
  year: 2023,
  used,
  thumbnail: `https://example.test/${id}.jpg`,
  priceEur,
  monthlyRate: null,
  mileage: used ? 30000 : 0,
});

const STOCK: LiveVehicle[] = [
  car('1', 'Skoda', 'Karoq', true, 25390),
  car('2', 'Skoda', 'Kamiq', false, 28990),
  car('3', 'Skoda', 'Karoq', true, 18490),
  car('4', 'VW', 'Golf', true, 21990),
];

const cfg = (patch: Partial<LiveInventoryConfig>): LiveInventoryConfig => ({ ...DEFAULT_LIVE_INVENTORY, ...patch });

describe('Live-Fahrzeuge block', () => {
  it('zeigt nichts, wenn der Block ausgeschaltet ist', () => {
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: false, brand: 'Skoda' }))).toEqual([]);
  });

  it('filtert im Automatikmodus nach Marke, Modell und Zustand', () => {
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, brand: 'Skoda' })).map(v => v.externalVehicleId))
      .toEqual(['1', '2', '3']);
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, brand: 'Skoda', model: 'Karoq' })).map(v => v.externalVehicleId))
      .toEqual(['1', '3']);
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, brand: 'Skoda', condition: 'new' })).map(v => v.externalVehicleId))
      .toEqual(['2']);
  });

  it('begrenzt die Automatikauswahl auf die eingestellte Höchstzahl', () => {
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, brand: 'Skoda', maxItems: 2 })).map(v => v.externalVehicleId))
      .toEqual(['1', '2']);
  });

  it('nimmt im Einzelmodus genau die angehakten Fahrzeuge in Bestandsreihenfolge', () => {
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, mode: 'manual', brand: 'Skoda', selectedIds: ['4', '2'] })).map(v => v.externalVehicleId))
      .toEqual(['2', '4']);
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, mode: 'manual', selectedIds: ['4', '2'] })).map(v => v.externalVehicleId))
      .toEqual(['2', '4']);
  });

  it('ignoriert Fahrzeuge, die nicht mehr im Bestand sind', () => {
    expect(resolveLiveVehicles(STOCK, cfg({ enabled: true, mode: 'manual', selectedIds: ['2', 'verkauft'] })).map(v => v.externalVehicleId))
      .toEqual(['2']);
  });

  it('prüft Marke und Modell ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    expect(matchesLiveFilter(car('9', 'ŠKODA', 'KAROQ', true), cfg({ brand: 'Škoda', model: 'karoq' }))).toBe(false);
    expect(matchesLiveFilter(car('9', 'Skoda', 'Karoq', true), cfg({ brand: 'skoda', model: 'KAROQ' }))).toBe(true);
  });
});
