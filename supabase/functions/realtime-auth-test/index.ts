// Server-side Realtime channel-authorization test runner.
//
// Provisions two ephemeral test users via the service role, attempts four
// channel-join scenarios with the real Realtime server, then deletes the users
// and returns the results as JSON. Guarded by an admin-only auth check so it
// cannot be triggered by anonymous traffic.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type JoinOutcome = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

async function joinPrivate(
  url: string,
  anon: string,
  accessToken: string | null,
  topic: string,
  timeoutMs = 6000,
): Promise<JoinOutcome> {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (accessToken) await client.realtime.setAuth(accessToken);
  return await new Promise<JoinOutcome>((resolve) => {
    const ch = client.channel(topic, { config: { private: true } });
    let settled = false;
    const finish = (o: JoinOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeChannel(ch).catch(() => {});
      client.realtime.disconnect();
      resolve(o);
    };
    const timer = setTimeout(() => finish("TIMED_OUT"), timeoutMs);
    ch.subscribe((status) => {
      if (
        status === "SUBSCRIBED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        finish(status as JoinOutcome);
      }
    });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // --- Auth guard: caller must be an admin (has_role) ---
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "missing_bearer" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice("Bearer ".length);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: claims.claims.sub,
    _role: "admin",
  });
  if (isAdmin !== true) {
    return new Response(JSON.stringify({ error: "admin_only" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // --- Provision two ephemeral users ---
  const mkUser = async () => {
    const email = `rt-test-${crypto.randomUUID()}@example.com`;
    const password = `Pw_${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    return { id: data.user.id, email, password };
  };

  const cleanup: string[] = [];
  try {
    const a = await mkUser();
    cleanup.push(a.id);
    const b = await mkUser();
    cleanup.push(b.id);

    const signIn = async (email: string, password: string) => {
      const c = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await c.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw error ?? new Error("signIn failed");
      return data.session.access_token;
    };

    const aToken = await signIn(a.email, a.password);

    const results = {
      own_channel: await joinPrivate(
        SUPABASE_URL, ANON_KEY, aToken, `user:${a.id}:notifications`,
      ),
      foreign_channel: await joinPrivate(
        SUPABASE_URL, ANON_KEY, aToken, `user:${b.id}:notifications`,
      ),
      anonymous_attempt: await joinPrivate(
        SUPABASE_URL, ANON_KEY, null, `user:${a.id}:notifications`,
      ),
      non_user_prefixed: await joinPrivate(
        SUPABASE_URL, ANON_KEY, aToken, `global:announcements`,
      ),
    };

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } finally {
    for (const id of cleanup) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  }
});
