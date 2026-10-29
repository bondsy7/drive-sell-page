import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const VEHICLE_ISO = '2026-10-29T13:56:47.000Z';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => ({ balance: 999 }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(''), vi.fn()] }));
vi.mock('@/hooks/useVehicleAssets', () => ({ useVehicleAssets: () => ({ data: null }) }));
vi.mock('@/lib/vehicle-utils', () => ({ ensureVehicleAuto: async () => 'vehicle-1' }));
vi.mock('@/components/VehicleAssetPicker', () => ({ default: () => null }));
vi.mock('@/components/landing/LiveVehiclesBlock', async () => {
  const real = await import('@/lib/live-inventory');
  return { DEFAULT_LIVE_INVENTORY: real.DEFAULT_LIVE_INVENTORY, default: () => null };
});
vi.mock('@/hooks/useVehicleMakes', () => ({
  useVehicleMakes: () => ({
    makes: [{ key: 'Audi', models: [{ key: 'A3' }] }],
    logos: [],
    loading: false,
    getModelsForMake: (makeKey: string) => (makeKey === 'Audi' ? ['A3'] : []),
    getLogoForMake: () => '',
    filterMakes: (query: string) => (query ? [] : [{ key: 'Audi', models: [{ key: 'A3' }] }]),
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: { message: 'Teststopp' } })) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [{ id: 'vehicle-1', brand: 'Volkswagen', model: 'Golf', year: 2024, color: 'Alpinweiß', title: 'Volkswagen Golf Life', vin: 'WVGZZZ12345678901', created_at: VEHICLE_ISO }],
            }),
          }),
          single: () => Promise.resolve({ data: null }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  },
}));

import ManualLandingGenerator from '@/components/ManualLandingGenerator';

afterEach(() => cleanup());

it('renders the vehicle picker without opening it', async () => {
  render(<ManualLandingGenerator onBack={vi.fn()} onComplete={vi.fn()} />);
  const label = await screen.findByText(/Aus bestehendem Fahrzeug übernehmen/, {}, { timeout: 4000 });
  const trigger = label.parentElement?.querySelector('[role="combobox"]');
  console.log('TRIGGER:', trigger?.textContent);
  expect(trigger).not.toBeNull();
  fireEvent.keyDown(trigger as HTMLElement, { key: 'ArrowDown' });
  const opt = await screen.findByRole('option', { name: /Volkswagen Golf Life/ }, { timeout: 3000 });
  console.log('OPTION:', JSON.stringify(opt.textContent));
  expect(opt.textContent).toContain('2026');
});
