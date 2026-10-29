import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

const VEHICLE_ISO = '2026-10-29T13:56:47.000Z';
const selectedColumns: string[] = [];

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
      select: (columns: string) => {
        selectedColumns.push(columns);
        return {
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({
                data: [{
                  id: 'vehicle-1',
                  brand: 'Volkswagen',
                  model: 'Golf',
                  year: 2024,
                  color: 'Alpinweiß',
                  title: 'Volkswagen Golf Life',
                  vin: 'WVGZZZ12345678901',
                  created_at: VEHICLE_ISO,
                }],
              }),
            }),
            single: () => Promise.resolve({ data: null }),
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        };
      },
    }),
  },
}));

import ManualLandingGenerator from '@/components/ManualLandingGenerator';

afterEach(() => cleanup());

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

async function renderWithVehicleList() {
  render(<ManualLandingGenerator onBack={vi.fn()} onComplete={vi.fn()} />);
  const label = await screen.findByText(/Aus bestehendem Fahrzeug übernehmen/);
  const trigger = label.parentElement?.querySelector('[role="combobox"]') as HTMLElement;
  expect(trigger).toBeTruthy();
  return trigger;
}

it('shows the vehicle creation date and time next to the vehicle name', async () => {
  const trigger = await renderWithVehicleList();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const option = await screen.findByRole('option', { name: /Volkswagen Golf Life/ });

  const local = new Date(VEHICLE_ISO);
  const date = local.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = local.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  expect(option.textContent).toContain('Volkswagen Golf Life');
  expect(option.textContent).toContain(date);
  expect(option.textContent).toContain(time);

  fireEvent.keyDown(option, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('option')).toBeNull());
});

it('reads the creation timestamp when loading the vehicle list', async () => {
  await renderWithVehicleList();
  await waitFor(() => expect(selectedColumns.join(' ')).toContain('created_at'));
});
