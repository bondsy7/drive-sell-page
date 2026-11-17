import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EditableField from '@/components/EditableField';
import { formatMonthlyRate } from '@/lib/finance-utils';
import { generateHTML } from '@/lib/templates';
import type { TemplateId } from '@/types/template';
import type { VehicleData } from '@/types/vehicle';

function monthlyOffer(monthlyRate: string): VehicleData {
  return {
    category: 'Leasing',
    customerType: 'private',
    vehicle: {
      brand: 'Kia', model: 'EV4', variant: '', year: 2026, color: '', fuelType: 'Elektro',
      transmission: 'Automatik', power: '150 kW', features: [],
    },
    finance: {
      monthlyRate, downPayment: '', duration: '36 Monate', totalPrice: '34.669,20 €', annualMileage: '10.000 km',
      specialPayment: '0,00 €', residualValue: '', interestRate: '',
    },
    dealer: {
      name: '', address: '', postalCode: '', city: '', phone: '', email: '', website: '', taxId: '', logoUrl: '',
      facebookUrl: '', instagramUrl: '', xUrl: '', tiktokUrl: '', youtubeUrl: '', whatsappNumber: '',
      leasingBank: '', leasingLegalText: '', financingBank: '', financingLegalText: '', defaultLegalText: '',
    },
    consumption: {},
  } as VehicleData;
}

describe('Einheitliche Monatsraten', () => {
  it.each([
    ['249,00', '249,00 €/mtl.'],
    ['1.249,00', '1.249,00 €/mtl.'],
    ['249,00 €', '249,00 €/mtl.'],
    ['249,00 EUR', '249,00 €/mtl.'],
    ['249,00 mtl.', '249,00 €/mtl.'],
    ['249,00 €/mtl.', '249,00 €/mtl.'],
    ['249,00 €/mtl./mtl.', '249,00 €/mtl.'],
    ['269,- €', '269,00 €/mtl.'],
  ])('normalisiert %s zu %s', (input, expected) => {
    expect(formatMonthlyRate(input)).toBe(expected);
  });

  it('lässt Nutzer nur die Zahl bearbeiten und ergänzt €/mtl. automatisch', () => {
    const onChange = vi.fn();
    render(<EditableField value="249,00 €/mtl." suffix="€/mtl." onChange={onChange} />);

    fireEvent.click(screen.getByText('249,00 €/mtl.'));
    const input = screen.getByDisplayValue('249,00');
    fireEvent.change(input, { target: { value: '1.249,00' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('1.249,00 €/mtl.');
  });

  it.each<TemplateId>(['autohaus', 'modern', 'klassisch', 'minimalist', 'auto3'])(
    'zeigt in der %s-Angebotsseite genau ein €/mtl. ohne doppelten Zusatz',
    (templateId) => {
      const html = generateHTML(templateId, monthlyOffer('249,00 €/mtl./mtl.'), null);
      const text = html.replace(/<[^>]+>/g, '');

      expect(text).toContain('249,00 €/mtl.');
      expect(text).not.toMatch(/249,00 €\/mtl\.\s*\/?mtl\./);
      expect(text).toContain('34.669,20 €');
    },
  );
});
