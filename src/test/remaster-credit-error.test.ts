import { expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { creditErrorMessage } from '@/lib/remaster-invoke';

it('402 insufficient_credits names balance and cost', () => {
  expect(creditErrorMessage({ error: 'insufficient_credits', balance: 0, cost: 3 }))
    .toBe('Nicht genug Credits (Guthaben 0, benötigt 3). Bitte Credits aufladen und danach erneut starten.');
});

it('other errors are not reported as credit errors', () => {
  expect(creditErrorMessage({ error: 'NB21 v2: Originalbeleg fehlt.' })).toBeNull();
});
