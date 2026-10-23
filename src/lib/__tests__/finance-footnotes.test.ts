import { describe, it, expect } from 'vitest';
import { buildFinanceFootnotes, financeExample } from '@/lib/finance-footnotes';
import { DEFAULT_LIVE_INVENTORY, type LiveVehicle } from '@/lib/live-inventory';

const v = (id: string, priceEur: number | null, monthlyRate: number | null = null): LiveVehicle => ({ externalVehicleId: id, brand: 'Kia', model: 'EV4', variant: null, year: null, used: false, thumbnail: null, priceEur, monthlyRate, mileage: null });
const cfg = { ...DEFAULT_LIVE_INVENTORY, enabled: true, cardDesign: { preset: 'jacobs' as const, detailUrlTemplate: '' } };

describe('finance footnotes', () => {
  it('EV4 37.890 € example', () => {
    const e = financeExample(37890);
    expect(e.downPayment).toBe(7578); expect(e.netLoan).toBe(30312); expect(e.finalInstallment).toBe(15156); expect(e.rate).toBe(431.52);
  });
  it('numbers each rate vehicle in order, skips vehicles without price', () => {
    const n = buildFinanceFootnotes([v('a', 37890), v('b', null), v('c', 20000)], cfg);
    expect(n.map(x => [x.vehicleId, x.number])).toEqual([['a', 1], ['c', 2]]);
  });
  it('Auto3 rate without details is marked incomplete', () => {
    expect(buildFinanceFootnotes([v('a', 30000, 259)], cfg)[0].complete).toBe(false);
  });
});
