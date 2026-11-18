import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVE_INVENTORY,
  isElectricFuel,
  jacobsFuelLabel,
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

  it('prüft Groß- und Kleinschreibung sowie bekannte Markenschreibweisen', () => {
    expect(matchesLiveFilter(car('9', 'ŠKODA', 'KAROQ', true), cfg({ brand: 'Škoda', model: 'karoq' }))).toBe(true);
    expect(matchesLiveFilter(car('9', 'Skoda', 'Karoq', true), cfg({ brand: 'skoda', model: 'KAROQ' }))).toBe(true);
    expect(matchesLiveFilter(car('9', 'Skoda', 'Karoq', true), cfg({ brand: 'Škoda' }))).toBe(true);
    expect(matchesLiveFilter(car('9', 'VW', 'Golf', true), cfg({ brand: 'Škoda' }))).toBe(false);
  });

  it('zeigt ein noch fehlendes Modell automatisch nach dem späteren Import mit Bestands-Schreibweise', () => {
    const config = cfg({ enabled: true, brand: 'DS AUTOMOBILES', model: 'DS 3 Crossback' });
    expect(resolveLiveVehicles(STOCK, config)).toEqual([]);
    const imported = car('ds-neu', 'Ds', 'DS3 Crossback', false);
    expect(resolveLiveVehicles([...STOCK, imported], config)).toEqual([imported]);
  });

  it('erkennt N°-Modelle unabhängig von der Schreibweise', () => {
    expect(matchesLiveFilter(car('ds8', 'DS', 'No8', false), cfg({ brand: 'DS Automobiles', model: 'N°8' }))).toBe(true);
  });

  it('zeigt Auto3-Kraftstoffcodes als deutsches Wort', () => {
    const fuel = (fuelType: string) => jacobsFuelLabel({ ...car('1', 'Skoda', 'Karoq', true), fuelType });
    expect(fuel('HYBRID_BENZIN')).toBe('Hybrid');
    expect(fuel('HYBRID_DIESEL')).toBe('Hybrid');
    expect(fuel('HYBRID')).toBe('Hybrid');
    expect(fuel('PLUGIN_HYBRID')).toBe('Plug-in-Hybrid');
    expect(fuel('BENZIN')).toBe('Benzin');
    expect(fuel('ELEKTRO')).toBe('Elektro');
    expect(fuel('')).toBe('—');
  });

  it('erkennt Elektro nur bei reinem Elektroantrieb', () => {
    expect(isElectricFuel({ ...car('1', 'Skoda', 'Enyaq', true), fuelType: 'ELEKTRO' })).toBe(true);
    expect(isElectricFuel({ ...car('1', 'Skoda', 'Karoq', true), fuelType: 'HYBRID_BENZIN' })).toBe(false);
  });
});
