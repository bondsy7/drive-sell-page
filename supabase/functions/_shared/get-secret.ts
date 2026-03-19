// Shared helper: reads a secret from admin_secrets table, falls back to Deno.env
// Usage: const apiKey = await getSecret("GEMINI_API_KEY", supabaseAdmin);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let _cache: Record<string, string> = {};
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function getSecret(key: string, supabaseAdmin?: any): Promise<string | undefined> {
  // If cache is fresh, use it
  if (_cache[key] && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache[key] || undefined;
  }

  // Try DB first
  try {
    const admin = supabaseAdmin || createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await admin
      .from("admin_secrets")
      .select("key, value")
      .order("key");

    if (data && data.length > 0) {
      _cache = {};
      _cacheTime = Date.now();
      for (const row of data) {
        if (row.value) _cache[row.key] = row.value;
      }
      if (_cache[key]) return _cache[key];
    }
  } catch (e) {
    console.warn(`getSecret: DB lookup failed for ${key}, falling back to env`, e);
  }

  // Fallback to env var
  return Deno.env.get(key) || undefined;
}
