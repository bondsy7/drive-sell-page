import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_INVENTORY,
  matchesLiveFilter,
  resolveLiveVehicles,
  resolveProfileCardDesign,
  liveVehicleHref,
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
  const settings = { liveVehicleCardDesign: { preset: 'jacobs' } };
  it.each(['edin.ljevo@wirsindjacobs.de', 'p.erhard@autoactiva.de', 'd.bonds@autoactiva.de'])('verwendet gespeichertes Jacobs-Design für %s', email => {
    expect(resolveProfileCardDesign(email, settings)?.preset).toBe('jacobs');
  });
  it('ändert keine anderen Profile', () => {
    expect(resolveProfileCardDesign('other@example.de', settings)).toBeUndefined();
    expect(resolveProfileCardDesign('p.erhard@autoactiva.de', {})).toBeUndefined();
  });
  it('verlinkt das Fahrzeug über seine interne Nummer, nicht über die Auto3-ID', () => {
    expect(liveVehicleHref({ ...car('10076', 'Skoda', 'Peaq', true), internalNumber: 'WM-006603' }, resolveProfileCardDesign('p.erhard@autoactiva.de', settings)))
      .toBe('https://www.wir-sind-jacobs.de/fahrzeuge-details/?intern-nummer=WM-006603');
  });
  it('codiert interne Nummern und erfindet bei fehlender Nummer keinen Fahrzeuglink', () => {
    const design = resolveProfileCardDesign('p.erhard@autoactiva.de', settings);
    expect(liveVehicleHref({ ...car('10076', 'Skoda', 'Peaq', true), internalNumber: 'WM / 1&2' }, design)).toBe('https://www.wir-sind-jacobs.de/fahrzeuge-details/?intern-nummer=WM%20%2F%201%262');
    expect(liveVehicleHref(car('10076', 'Skoda', 'Peaq', true), design, 'https://jacobs.indicar.de')).toBeUndefined();
  });
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
    expect(matchesLiveFilter(car('9', 'ŠKODA', 'KAROQ', true), cfg({ brand: 'Škoda', model: 'karoq' }))).toBe(true);
    expect(matchesLiveFilter(car('9', 'Skoda', 'Karoq', true), cfg({ brand: 'skoda', model: 'KAROQ' }))).toBe(true);
    expect(matchesLiveFilter(car('9', 'Skoda', 'Karoq', true), cfg({ brand: 'Škoda' }))).toBe(false);
  });
});
