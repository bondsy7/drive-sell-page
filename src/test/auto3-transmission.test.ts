import { describe, expect, it } from 'vitest';
import { auto3TransmissionLabel } from '../../supabase/functions/_shared/auto3-transmission';

describe('Auto3-Getriebeangabe', () => {
  it('zeigt automatic=true als Automatik', () => {
    expect(auto3TransmissionLabel({ vehicleModel: { automatic: true } })).toBe('Automatik');
  });

  it('zeigt automatic=false als Schaltgetriebe', () => {
    expect(auto3TransmissionLabel({ vehicleModel: { automatic: false } })).toBe('Schaltgetriebe');
  });

  it('nutzt die technische Getriebeangabe, wenn das Boolean fehlt', () => {
    expect(auto3TransmissionLabel({ technicalData: { Getriebeart: 'Schaltgetriebe' } })).toBe('Schaltgetriebe');
    expect(auto3TransmissionLabel({ technicalData: { Getriebe: 'automatic' } })).toBe('Automatik');
  });

  it('erfindet ohne Auto3-Angabe kein Getriebe', () => {
    expect(auto3TransmissionLabel({ vehicleModel: {} })).toBeNull();
  });
});
