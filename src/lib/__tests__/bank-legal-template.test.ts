import { describe, it, expect } from 'vitest';
import { bankTemplate, resolveBankPlaceholders, needsCreditWarning, missingCreditFields } from '@/lib/bank-legal-template';

const base: any = { category: 'Finanzierung', customerType: 'private', finance: { monthlyRate: '299', downPayment: '3000', duration: '48', totalPrice: '34900', annualMileage: '', specialPayment: '', residualValue: '', interestRate: '5,99', nominalInterestRate: '5,83', totalAmount: '36250', netLoanAmount: '31900' } };

describe('bank legal templates', () => {
  it('fills offer values into the financing template', () => {
    const t = resolveBankPlaceholders(bankTemplate('financing').replace('[Anschrift der Bank eintragen]', 'Ring 1, 65428 Rüsselsheim'), base, 'Leasys S.p.A.');
    expect(t).toContain('der Leasys S.p.A., Ring 1, 65428 Rüsselsheim');
    expect(t).toContain('Vertragslaufzeit: 48 Monate');
    expect(t).toContain('299,00 €');
    expect(t).toContain('effektiver Jahreszins: 5,99 %');
    expect(t).not.toContain('Schlussrate');
    expect(t).not.toMatch(/\{|\[/);
  });
  it('warning only for consumer financing', () => {
    expect(needsCreditWarning(base)).toBe(true);
    expect(needsCreditWarning({ ...base, customerType: 'business' })).toBe(false);
    expect(needsCreditWarning({ ...base, category: 'Leasing' })).toBe(false);
    expect(needsCreditWarning({ ...base, category: 'Kauf' })).toBe(false);
  });
  it('reports missing credit values', () => {
    expect(missingCreditFields({ ...base, finance: { ...base.finance, netLoanAmount: '', totalPrice: '' } })).toEqual(['Nettodarlehensbetrag']);
  });
});
