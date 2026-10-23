import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn(async (_name: string) => ({ data: null, error: { message: 'Teststopp' } })));
const ensureVehicleAuto = vi.hoisted(() => vi.fn(async () => 'vehicle-1'));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/hooks/useCredits', () => ({ useCredits: () => ({ balance: 999 }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(''), vi.fn()] }));
vi.mock('@/hooks/useVehicleAssets', () => ({ useVehicleAssets: () => ({ data: null }) }));
vi.mock('@/lib/vehicle-utils', () => ({ ensureVehicleAuto }));
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
    functions: { invoke },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
          maybeSingle: () => Promise.resolve({ data: null }),
        }),
      }),
    }),
  },
}));

import ManualLandingGenerator from '@/components/ManualLandingGenerator';

afterEach(() => {
  cleanup();
  invoke.mockClear();
});

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

async function configurePage() {
  render(<ManualLandingGenerator onBack={vi.fn()} onComplete={vi.fn()} />);
  fireEvent.click(screen.getByText('Marke wählen...'));
  fireEvent.click(await screen.findByRole('button', { name: /Audi/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'A3' }));
  fireEvent.keyDown(screen.getAllByRole('combobox')[0], { key: 'ArrowDown' });
  fireEvent.keyDown(await screen.findByRole('option', { name: /Leasing-Angebot/ }), { key: 'Enter' });
}

it('opens a confirmation with the chosen configuration before any generation runs', async () => {
  await configurePage();
  fireEvent.click(screen.getByRole('button', { name: /Landing Page generieren/ }));

  const dialog = await screen.findByRole('dialog');
  expect(dialog.textContent).toContain('Grundeinstellungen der Seite');
  expect(dialog.textContent).toContain('Audi A3');
  expect(dialog.textContent).toContain('Leasing-Angebot');
  expect(invoke).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(invoke).not.toHaveBeenCalled();
});

it('starts the generation only after the confirmation is accepted', async () => {
  await configurePage();
  fireEvent.click(screen.getByRole('button', { name: /Landing Page generieren/ }));
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: /Ja, jetzt generieren/ }));

  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  expect(invoke.mock.calls[0][0]).toBe('generate-landing-page');
});
