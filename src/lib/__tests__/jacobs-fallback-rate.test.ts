import { describe, expect, it } from 'vitest';
import { jacobsFallbackMonthlyRate, jacobsMonthlyRate, type LiveVehicle } from '@/lib/live-inventory';

describe('Jacobs fallback rate', () => {
  it('matches the website for the Kia EV4 at 37.890 €', () => {
    expect(jacobsFallbackMonthlyRate(37890)).toBeCloseTo(431.5, 0);
    expect(jacobsMonthlyRate({ priceEur: 37890, monthlyRate: null } as LiveVehicle)).toBe(432);
  });
  it('keeps the Auto3 rate when present', () => {
    expect(jacobsMonthlyRate({ priceEur: 37890, monthlyRate: 259 } as LiveVehicle)).toBe(259);
  });
  it('shows no rate without a price', () => {
    expect(jacobsMonthlyRate({ priceEur: null, monthlyRate: null } as LiveVehicle)).toBeNull();
  });
});
