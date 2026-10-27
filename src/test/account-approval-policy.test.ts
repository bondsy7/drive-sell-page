import { describe, expect, it } from 'vitest';
import { approvalReviewError } from '../../supabase/functions/_shared/account-approval-policy';

describe('manual activation prerequisites', () => {
  it('requires a submitted application even with verified email', () => {
    expect(approvalReviewError({ submitted_at: null }, '2026-10-27T07:23:00Z')).toBe('application_required');
  });
  it('requires trusted email verification even after application submission', () => {
    expect(approvalReviewError({ submitted_at: '2026-10-27T07:23:00Z' }, null)).toBe('email_not_verified');
  });
  it('allows manual approval only after both prerequisites', () => {
    expect(approvalReviewError({ submitted_at: '2026-10-27T07:23:00Z' }, '2026-10-27T07:24:00Z')).toBeNull();
  });
});