import { describe, it, expect } from 'vitest';
import { buildFinanceFootnotes, financeExample, findFinanceGaps } from '@/lib/finance-footnotes';
import { DEFAULT_LIVE_INVENTORY, type LiveVehicle } from '@/lib/live-inventory';

const v = (id: string, priceEur: number | null, monthlyRate: number | null = null, financing: LiveVehicle['financing'] = null): LiveVehicle => ({ externalVehicleId: id, brand: 'Kia', model: 'EV4', variant: null, year: null, used: false, thumbnail: null, priceEur, monthlyRate, mileage: null, financing });
const cfg = { ...DEFAULT_LIVE_INVENTORY, enabled: true, cardDesign: { preset: 'jacobs' as const, detailUrlTemplate: '' }, financeBank: 'Volkswagen Financial Services' };
const full = { termMonths: 48, downPayment: 5000, finalInstallment: 10000, netLoan: 25000, total: 27000, effectiveRate: 5.99, nominalRate: 5.83, bank: 'Kia Finance' };

describe('finance footnotes', () => {
  it('EV4 37.890 € example', () => {
    const e = financeExample(37890);
    expect(e.downPayment).toBe(7578); expect(e.netLoan).toBe(30312); expect(e.finalInstallment).toBe(15156); expect(e.rate).toBe(431.52);
  });
  it('numbers each rate vehicle in order, skips vehicles without price', () => {
    const n = buildFinanceFootnotes([v('a', 37890), v('b', null), v('c', 20000)], cfg);
    expect(n.map(x => [x.vehicleId, x.number])).toEqual([['a', 1], ['c', 2]]);
  });
  it('hides an Auto3 rate without full details and names what is missing', () => {
    expect(buildFinanceFootnotes([v('a', 30000, 259)], cfg)).toEqual([]);
    expect(findFinanceGaps([v('a', 30000, 259, { ...full, total: null })], cfg)[0].missing).toEqual(['Gesamtbetrag']);
  });
  it('shows an Auto3 rate with full details, Auto3 bank wins', () => {
    const [n] = buildFinanceFootnotes([v('a', 30000, 259, full)], cfg);
    expect(n.rate).toBe(259); expect(n.text).toContain('Kia Finance');
  });
  it('no bank selected → example rate hidden, bank reported missing', () => {
    const noBank = { ...cfg, financeBank: '' };
    expect(buildFinanceFootnotes([v('a', 37890)], noBank)).toEqual([]);
    expect(findFinanceGaps([v('a', 37890)], noBank)[0].missing).toEqual(['Bank']);
  });
});
