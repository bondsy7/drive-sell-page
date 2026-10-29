import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

const VEHICLE = {
  id: 'vehicle-1',
  brand: 'Volkswagen',
  model: 'Caddy',
  year: 2024,
  color: 'Blau',
  title: 'Volkswagen Caddy',
  vin: 'WVGZZZ12345678901',
  created_at: '2026-10-26T09:13:00.000Z',
  vehicle_data: { finance: { monthlyRate: 299 } },
};

// Radix-Auswahlportale blockieren den Testprozess – hier als klickbare Container dargestellt.
vi.mock('@/components/ui/select', async () => {
  const React = await import('react');
  const Ctx = React.createContext<{ onValueChange?: (v: string) => void } | null>(null);
  return {
    Select: ({ children, onValueChange }: any) => <Ctx.Provider value={{ onValueChange }}>{children}</Ctx.Provider>,
    SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value }: any) => {
      const ctx = React.useContext(Ctx);
      return <div data-testid="option" data-value={value} onClick={() => ctx?.onValueChange?.(value)}>{children}</div>;
    },
    SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  };
});

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => ({ balance: 999 }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('vehicle=vehicle-1'), vi.fn()],
}));
vi.mock('@/hooks/useVehicleAssets', () => ({ useVehicleAssets: () => ({ data: null }) }));
vi.mock('@/lib/vehicle-utils', () => ({ ensureVehicleAuto: async () => 'vehicle-1' }));
vi.mock('@/components/VehicleAssetPicker', () => ({ default: () => null }));
vi.mock('@/components/landing/LiveVehiclesBlock', async () => {
  const real = await import('@/lib/live-inventory');
  return { DEFAULT_LIVE_INVENTORY: real.DEFAULT_LIVE_INVENTORY, default: () => null };
});
vi.mock('@/hooks/useVehicleMakes', () => ({
  useVehicleMakes: () => ({
    makes: [{ key: 'Volkswagen', models: [{ key: 'Caddy' }] }],
    logos: [],
    loading: false,
    getModelsForMake: (makeKey: string) => (makeKey === 'Volkswagen' ? ['Caddy'] : []),
    getLogoForMake: () => '',
    filterMakes: (query: string) => (query ? [] : [{ key: 'Volkswagen', models: [{ key: 'Caddy' }] }]),
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn(async () => ({ data: null, error: { message: 'Teststopp' } })) },
    from: () => ({
      select: (columns: string) => {
        if (columns.includes('vehicle_data')) {
          return { eq: () => ({ maybeSingle: () => Promise.resolve({ data: VEHICLE }) }) };
        }
        if (columns.includes('created_at')) {
          return { eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [VEHICLE] }) }) }) };
        }
        return { eq: () => ({ single: () => Promise.resolve({ data: null }) }) };
      },
    }),
  },
}));

import ManualLandingGenerator from '@/components/ManualLandingGenerator';

afterEach(() => cleanup());

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const priceInput = () => screen.getByPlaceholderText(/ab 299€/);
const colorInput = () => screen.getByPlaceholderText(/Alpinweiß/);

it('clears the taken-over vehicle data when switching back to manual entry', async () => {
  render(<ManualLandingGenerator onBack={vi.fn()} onComplete={vi.fn()} />);

  // Prefill aus dem gewählten Fahrzeug abwarten.
  await waitFor(() => expect(priceInput().value).toBe('ab 299 €/mtl.'));
  expect(colorInput().value).toBe('Blau');

  fireEvent.click(screen.getByTestId('option').querySelector('[data-value="__none"]') as HTMLElement);

  await waitFor(() => expect(priceInput().value).toBe(''));
  expect(colorInput().value).toBe('');
});
