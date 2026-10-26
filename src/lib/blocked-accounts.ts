/** Accounts blocked for security reasons. Remove an entry to restore access. */
const BLOCKED_ACCOUNT_EMAILS = new Set<string>([]);

export function isBlockedAccount(email?: string | null): boolean {
  return !!email && BLOCKED_ACCOUNT_EMAILS.has(email.trim().toLowerCase());
}
