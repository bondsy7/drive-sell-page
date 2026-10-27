/** Only trusted Auth confirmation and a submitted application allow activation. */
export function approvalReviewError(
  request: { submitted_at?: string | null } | null,
  emailConfirmedAt?: string | null,
): 'application_required' | 'email_not_verified' | null {
  if (!request?.submitted_at) return 'application_required';
  if (!emailConfirmedAt) return 'email_not_verified';
  return null;
}