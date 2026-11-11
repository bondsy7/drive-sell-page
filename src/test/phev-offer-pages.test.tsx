import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Auto3Editor from '@/components/template-editors/Auto3Editor';
import type { VehicleData } from '@/types/vehicle';

vi.mock('@/components/CO2LabelSelector', () => ({
  default: () => <div data-testid="co2-label" />,
}));

function phevOffer(): VehicleData {
  return {
    category: 'Barkauf',
    vehicle: {
      brand: 'Test', model: 'PHEV', variant: '', year: 2026, color: '', fuelType: 'Plug-in-Hybrid',
      transmission: 'Automatik', power: '100 kW', features: [],
    },
    finance: {
      monthlyRate: '', downPayment: '', duration: '', totalPrice: '40.000 €', annualMileage: '',
      specialPayment: '', residualValue: '', interestRate: '',
    },
    dealer: {
      name: '', address: '', postalCode: '', city: '', phone: '', email: '', website: '', taxId: '', logoUrl: '',
      facebookUrl: '', instagramUrl: '', xUrl: '', tiktokUrl: '', youtubeUrl: '', whatsappNumber: '',
      leasingBank: '', leasingLegalText: '', financingBank: '', financingLegalText: '', defaultLegalText: '',
    },
    consumption: {
      origin: '', mileage: '', displacement: '', power: '100 kW', driveType: 'Plug-in-Hybrid', fuelType: 'Plug-in-Hybrid',
      consumptionCombined: '1,2 l/100 km', co2Emissions: '27 g/km', co2Class: 'B', consumptionCity: '',
      consumptionSuburban: '', consumptionRural: '', consumptionHighway: '', energyCostPerYear: '', fuelPrice: '',
      co2CostMedium: '', co2CostLow: '', co2CostHigh: '', vehicleTax: '', isPluginHybrid: true,
      co2EmissionsDischarged: '171 g/km', co2ClassDischarged: 'F', consumptionCombinedDischarged: '8,4 l/100 km',
      electricRange: '62 km', consumptionElectric: '18,2 kWh/100 km', hsnTsn: '', electricMotorPower: '',
      electricMotorTorque: '', gearboxType: '', topSpeed: '', acceleration: '', curbWeight: '', grossWeight: '',
      warranty: '', paintColor: '',
    },
  } as VehicleData;
}

describe('PHEV-Werte in Auto3-Angeboten', () => {
  it('zeigt den Entladungsverbrauch und speichert seine manuelle Korrektur', () => {
    const data = phevOffer();
    const updateConsumption = vi.fn();
    render(
      <Auto3Editor
        data={data}
        consumption={data.consumption}
        imageBase64={null}
        galleryImages={[]}
        allImages={[]}
        isBuyCategory
        category={data.category}
        updateVehicle={vi.fn()}
        updateFinance={vi.fn()}
        updateDealer={vi.fn()}
        updateConsumption={updateConsumption}
        updatePower={vi.fn()}
        updateFuelType={vi.fn()}
        onDataChange={vi.fn()}
        recalculateRate={vi.fn()}
        calculateCosts={vi.fn()}
        costCalculating={false}
        costMissingFields={[]}
        addFeature={vi.fn()}
        updateFeature={vi.fn()}
        removeFeature={vi.fn()}
        vinLookup={null}
      />,
    );

    fireEvent.click(screen.getByText('8,4 l/100 km'));
    const input = screen.getByDisplayValue('8,4');
    fireEvent.change(input, { target: { value: '9,1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(updateConsumption).toHaveBeenCalledWith('consumptionCombinedDischarged', '9,1 l/100 km');
    expect(screen.getByText('171 g/km')).toBeTruthy();
  });
});
