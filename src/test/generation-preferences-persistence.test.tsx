import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGenerationPreferences } from '@/hooks/useGenerationPreferences';

const { store, auth, calls } = vi.hoisted(() => ({
  store: new Map<string, unknown[]>(), auth: { user: { id: 'user-a' } }, calls: [] as string[],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({
    select: () => ({ eq: (_column: string, id: string) => { calls.push(id); return Promise.resolve({ data: store.get(id) || [], error: null }); } }),
    upsert: async (row: { user_id: string; preference_key: string; settings: unknown }) => {
      const old = store.get(row.user_id) || [];
      store.set(row.user_id, [...old.filter(p => (p as { preference_key: string }).preference_key !== row.preference_key), row]);
      return { error: null };
    },
  }),
} }));
afterEach(() => { cleanup(); store.clear(); calls.length = 0; auth.user = { id: 'user-a' }; });
function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}
describe('account-scoped settings persistence', () => {
  it('reads back the last pipeline choices after a fresh mount', async () => {
    const first = renderHook(useGenerationPreferences, { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    await act(async () => first.result.current.save('last:pipeline:car', { selectedKeys: ['MASTER', 'EXT_FRONT', 'DETAIL_WHEEL'], scope: 'car' }));
    first.unmount();
    const second = renderHook(useGenerationPreferences, { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    expect(second.result.current.data?.[0].settings.selectedKeys).toEqual(['MASTER', 'EXT_FRONT', 'DETAIL_WHEEL']);
  });
  it('does not load another user’s settings', async () => {
    store.set('user-a', [{ preference_key: 'last:pipeline:car', settings: { selectedKeys: ['EXT_FRONT'] } }]);
    auth.user = { id: 'user-b' };
    const hook = renderHook(useGenerationPreferences, { wrapper });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toEqual([]);
    expect(calls).toEqual(['user-b']);
  });
});