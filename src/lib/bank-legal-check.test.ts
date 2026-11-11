import { describe, it, expect } from 'vitest';
import { checkBankLegal } from './bank-legal-check';

const data: any = { category: 'Leasing', customerType: 'private', finance: { totalPrice: '30000', monthlyRate: '299', duration: '36', specialPayment: '0' } };
const banks = [{ bank_name: 'Leasys', legal_text: 'Angebot der {bank_name}, Musterstr. 1. Rate: {monatsrate}.' }];

describe('checkBankLegal', () => {
  it('flags unchanged address placeholder', () => {
    const r = checkBankLegal('Angebot der {bank_name}, [Anschrift der Bank eintragen].', 'Leasys', banks, data);
    expect(r.some(i => i.level === 'error' && i.label.includes('Anschrift'))).toBe(true);
  });
  it('accepts text identical to profile bank', () => {
    const r = checkBankLegal(banks[0].legal_text, 'Leasys', banks, data);
    expect(r.every(i => i.level === 'ok')).toBe(true);
  });
  it('warns when text deviates from profile', () => {
    const r = checkBankLegal('Angebot der {bank_name}, Andere Str. 2.', 'Leasys', banks, data);
    expect(r.some(i => i.level === 'warn' && i.label.includes('weicht'))).toBe(true);
  });
  it('flags unknown shortcodes and missing bank', () => {
    const r = checkBankLegal('Text {foo}, Str. 1.', '', banks, data);
    expect(r.filter(i => i.level === 'error').length).toBe(2);
  });
});

describe('netLoanFallback', () => {
  it('computes price minus down payment for financing', async () => {
    const { netLoanFallback } = await import('./bank-legal-template');
    expect(netLoanFallback({ category: 'Finanzierung', finance: { totalPrice: '30.000,00 €', downPayment: '5000' } } as any)).toBe('25.000,00 €');
    expect(netLoanFallback({ category: 'Leasing', finance: { totalPrice: '30000' } } as any)).toBe('');
  });
});
