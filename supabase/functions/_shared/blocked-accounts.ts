// Accounts blocked for security reasons. Keep in sync with src/lib/blocked-accounts.ts.
const BLOCKED_ACCOUNT_EMAILS = new Set(["akyildizturhan@gmail.com"]);

export function isBlockedEmail(email?: string | null): boolean {
  return !!email && BLOCKED_ACCOUNT_EMAILS.has(email.trim().toLowerCase());
}

/** Reads the email claim from the bearer token. Signature is verified later by each function; a forged token cannot unblock anyone. */
export function emailFromRequest(req: Request): string | null {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    return JSON.parse(json)?.email ?? null;
  } catch {
    return null;
  }
}

/** Returns a 403 response for blocked accounts, otherwise null. */
export function blockedAccountResponse(req: Request): Response | null {
  if (req.method === "OPTIONS" || !isBlockedEmail(emailFromRequest(req))) return null;
  return new Response(
    JSON.stringify({
      error: "account_blocked",
      message: "Ihr Zugang ist aus Sicherheitsgründen gesperrt. Kontakt: info@breadcrumb.de / Your access has been blocked for security reasons. Contact: info@breadcrumb.de",
    }),
    {
      status: 403,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Content-Type": "application/json",
      },
    },
  );
}
