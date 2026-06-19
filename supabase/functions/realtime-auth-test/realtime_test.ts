// Verifies the Realtime channel-authorization policies added in the
// "Realtime Channel-Berechtigungen" migration.
//
// Convention enforced by RLS on realtime.messages:
//   Only `user:<auth.uid>:<suffix>` topics may be joined as a private channel
//   by the authenticated user owning that uid.
//
// Run with: Supabase Edge Function test runner (Deno).

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing env: SUPABASE_URL, (anon/publishable) key, SUPABASE_SERVICE_ROLE_KEY required.",
  );
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type TestUser = { id: string; email: string; password: string };

async function createTestUser(): Promise<TestUser> {
  const email = `rt-test-${crypto.randomUUID()}@example.com`;
  const password = `Pw_${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password };
}

async function signedInClient(u: TestUser): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  const { data, error } = await c.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  });
  if (error || !data.session) throw error ?? new Error("signIn failed");
  await c.realtime.setAuth(data.session.access_token);
  return c;
}

type JoinOutcome = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

function joinPrivateChannel(
  client: SupabaseClient,
  topic: string,
  timeoutMs = 6000,
): Promise<JoinOutcome> {
  return new Promise((resolve) => {
    const ch = client.channel(topic, { config: { private: true } });
    let settled = false;
    const finish = (outcome: JoinOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.removeChannel(ch).catch(() => {});
      resolve(outcome);
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

async function cleanup(clients: SupabaseClient[], users: TestUser[]) {
  for (const c of clients) {
    try {
      await c.removeAllChannels();
    } catch { /* ignore */ }
    try {
      await c.auth.signOut();
    } catch { /* ignore */ }
  }
  for (const u of users) {
    try {
      await admin.auth.admin.deleteUser(u.id);
    } catch { /* ignore */ }
  }
}

Deno.test("Realtime: user can join their OWN user-scoped private channel", async () => {
  const userA = await createTestUser();
  const clients: SupabaseClient[] = [];
  try {
    const a = await signedInClient(userA);
    clients.push(a);
    const outcome = await joinPrivateChannel(a, `user:${userA.id}:notifications`);
    assertEquals(
      outcome,
      "SUBSCRIBED",
      `Owner must be able to join own channel, got ${outcome}`,
    );
  } finally {
    await cleanup(clients, [userA]);
  }
});

Deno.test("Realtime: user CANNOT join another user's user-scoped private channel", async () => {
  const userA = await createTestUser();
  const userB = await createTestUser();
  const clients: SupabaseClient[] = [];
  try {
    const a = await signedInClient(userA);
    clients.push(a);
    const outcome = await joinPrivateChannel(a, `user:${userB.id}:notifications`);
    assert(
      outcome !== "SUBSCRIBED",
      `User A must not be able to join user B's channel, but got ${outcome}`,
    );
  } finally {
    await cleanup(clients, [userA, userB]);
  }
});

Deno.test("Realtime: anonymous (no auth) CANNOT join a user-scoped private channel", async () => {
  const userA = await createTestUser();
  const clients: SupabaseClient[] = [];
  try {
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    clients.push(anon);
    const outcome = await joinPrivateChannel(anon, `user:${userA.id}:notifications`);
    assert(
      outcome !== "SUBSCRIBED",
      `Anonymous client must not be able to join private channel, but got ${outcome}`,
    );
  } finally {
    await cleanup(clients, [userA]);
  }
});

Deno.test("Realtime: user CANNOT join a non-user-prefixed private channel", async () => {
  const userA = await createTestUser();
  const clients: SupabaseClient[] = [];
  try {
    const a = await signedInClient(userA);
    clients.push(a);
    const outcome = await joinPrivateChannel(a, `global:announcements`);
    assert(
      outcome !== "SUBSCRIBED",
      `Topics outside user:<uid>:* must be rejected, but got ${outcome}`,
    );
  } finally {
    await cleanup(clients, [userA]);
  }
});
