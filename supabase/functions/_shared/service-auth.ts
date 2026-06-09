// Helper to gate internal-only edge functions to service-role callers.
// Returns null when the caller presents the service-role bearer token,
// otherwise returns a 401/403 Response that the handler should return immediately.
import { corsHeaders } from "./cors.ts";

export function requireServiceRole(req: Request): Response | null {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey || !token || token !== serviceKey) {
    return new Response(
      JSON.stringify({ error: "forbidden: service role required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return null;
}
