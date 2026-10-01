// Server-to-server actor for background jobs (Auto3 processing orchestrator).
// Only accepted when the caller presents the project's service-role key, which never
// leaves the backend. Credits are still deducted for the acting user by the generator.
export function resolveInternalActor(req: Request): string | null {
  if (req.headers.get("x-internal-job") !== "auto3-processing") return null;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!key || auth !== key) return null;
  const userId = req.headers.get("x-acting-user-id") || "";
  return /^[0-9a-f-]{36}$/i.test(userId) ? userId : null;
}
