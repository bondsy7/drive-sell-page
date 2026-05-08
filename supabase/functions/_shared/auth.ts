// Shared auth helpers for edge functions
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  user: { id: string; email?: string };
  supabase: SupabaseClient;      // user-scoped client
  adminSupabase: SupabaseClient;  // service-role client
}

/**
 * Authenticate the request and return user + both clients.
 * Throws if not authenticated.
 */
export async function authenticateRequest(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Not authenticated");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Reliable auth via getClaims (JWT verification, no network round-trip flakiness)
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: claimsData, error } = await supabase.auth.getClaims(token);
  const claims = claimsData?.claims as any;
  const userId = claims?.sub as string | undefined;
  if (error || !userId) throw new Error("Not authenticated");

  const adminSupabase = createClient(supabaseUrl, serviceKey);

  return { user: { id: userId, email: claims?.email }, supabase, adminSupabase };
}

/** Create a service-role admin client */
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
