import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import { fetchLiveInventory, LIVE_INVENTORY_TIMEOUT_MS } from '@/lib/live-inventory-fetch';

/** A platform-killed request answers as plain text, not as JSON. */
const httpError = (status: number, body: string) => ({
  name: 'FunctionsHttpError',
  message: `Edge function returned ${status}: ${body}`,
  context: {
    status,
    json: async () => { throw new SyntaxError('Unexpected token E in JSON'); },
    text: async () => body,
  },
});

const IDLE_TIMEOUT_BODY = 'Error, {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit (150s) reached"}';

describe('Live-Bestand laden', () => {
  beforeEach(() => invoke.mockReset());

  it('wartet begrenzt und meldet einen Hinweis statt abzurstürzen', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(504, IDLE_TIMEOUT_BODY) });
    const res = await fetchLiveInventory();
    expect(res.items).toEqual([]);
    expect(res.inventoryUrl).toBe('');
    expect(res.error).toBe('Der Live-Bestand konnte nicht geladen werden.');
  });

  it('ruft die Bestandsfunktion mit einer Wartezeit unter der Plattformgrenze auf', async () => {
    invoke.mockResolvedValue({ data: { items: [], tenantUrl: '' }, error: null });
    await fetchLiveInventory();
    const [fn, options] = invoke.mock.calls[0] as [string, { body: { action: string }; timeout: number }];
    expect(fn).toBe('auto3-inventory');
    expect(options.body.action).toBe('live_list');
    expect(options.timeout).toBe(LIVE_INVENTORY_TIMEOUT_MS);
    expect(options.timeout).toBeGreaterThan(0);
    expect(options.timeout).toBeLessThan(150_000);
  });

  it('gibt eine Vorgabe der Funktion wörtlich weiter', async () => {
    invoke.mockResolvedValue({
      data: { error: 'Auto3-Bestand ist für dieses Konto nicht freigeschaltet.', code: 'forbidden' },
      error: null,
    });
    const res = await fetchLiveInventory();
    expect(res.error).toBe('Auto3-Bestand ist für dieses Konto nicht freigeschaltet.');
    expect(res.items).toEqual([]);
  });

  it('übergibt Fahrzeuge und Bestands-URL', async () => {
    invoke.mockResolvedValue({
      data: {
        items: [{ externalVehicleId: '7', brand: 'Škoda', model: 'Peaq', variant: null, year: 2025, used: true, thumbnail: null, priceEur: 51500, monthlyRate: null, fuelType: 'HYBRID_BENZIN' }],
        tenantUrl: 'https://jacobs.indicar.de',
      },
      error: null,
    });
    const res = await fetchLiveInventory();
    expect(res.error).toBeUndefined();
    expect(res.items.map((v) => v.externalVehicleId)).toEqual(['7']);
    expect(res.inventoryUrl).toBe('https://jacobs.indicar.de');
  });
});
