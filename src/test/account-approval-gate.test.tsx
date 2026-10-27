import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountApprovalGate from '@/components/auth/AccountApprovalGate';

const query = vi.hoisted(() => ({ data: null as null | { status: string; submitted_at: string | null }, isLoading: false, isError: false, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => query, useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signOut: vi.fn() } } }));
afterEach(() => { cleanup(); query.data = null; query.isError = false; });
const open = () => render(<AccountApprovalGate userId="test-user" email="test@example.com"><div data-testid="protected">Protected content</div></AccountApprovalGate>);

describe('provisional registration access', () => {
  it('does not expose app content while approval is pending', () => {
    query.data = { status: 'pending', submitted_at: '2026-10-27T07:23:00Z' };
    open();
    expect(screen.queryByTestId('protected')).toBeNull();
  });
  it('does not expose app content after rejection', () => {
    query.data = { status: 'rejected', submitted_at: '2026-10-27T07:23:00Z' };
    open();
    expect(screen.queryByTestId('protected')).toBeNull();
  });
  it('does not expose app content when approval lookup fails', () => {
    query.isError = true;
    open();
    expect(screen.queryByTestId('protected')).toBeNull();
  });
  it('allows approved users', () => {
    query.data = { status: 'approved', submitted_at: '2026-10-27T07:23:00Z' };
    open();
    expect(screen.queryByTestId('protected')).not.toBeNull();
  });
  it('preserves legacy and internally created users without an approval request', () => {
    open();
    expect(screen.queryByTestId('protected')).not.toBeNull();
  });
});