// End-to-end test of the Realtime channel-authorization policies that scope
// private channels to `user:<auth.uid>:*`.
//
// User provisioning + actual Realtime joins happen server-side inside the
// `realtime-auth-test` Edge Function (which has access to the service role).
// This test only invokes that function and asserts on the outcome matrix.
//
// Required env (loaded from .env):
//   VITE_SUPABASE_URL                — project URL
//   VITE_SUPABASE_PUBLISHABLE_KEY    — anon/publishable key
//   REALTIME_TEST_ADMIN_TOKEN        — access_token of an admin user
//                                       (run once in the browser console:
//                                        `JSON.parse(localStorage.getItem(
//                                          'sb-<ref>-auth-token')).access_token`
//                                        and paste into .env)

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const ADMIN_TOKEN = Deno.env.get("REALTIME_TEST_ADMIN_TOKEN");

const skipReason = !ADMIN_TOKEN
  ? "REALTIME_TEST_ADMIN_TOKEN not set — sign in as an admin in the app, " +
    "copy the access_token and add it to .env to enable this test."
  : null;

type Outcome = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";
type RunnerResponse = {
  ok: boolean;
  error?: string;
  results?: {
    own_channel: Outcome;
    foreign_channel: Outcome;
    anonymous_attempt: Outcome;
    non_user_prefixed: Outcome;
  };
};

async function runScenarios(): Promise<RunnerResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/realtime-auth-test`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const json = (await res.json()) as RunnerResponse;
  if (!res.ok || !json.ok) {
    throw new Error(`runner failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

Deno.test({
  name: "Realtime channel auth: user CAN join own user-scoped channel",
  ignore: !!skipReason,
  async fn() {
    if (skipReason) {
      console.log("SKIP:", skipReason);
      return;
    }
    const { results } = await runScenarios();
    assertEquals(
      results!.own_channel,
      "SUBSCRIBED",
      "Owner must join their own user:<uid>:* private channel",
    );
  },
});

Deno.test({
  name: "Realtime channel auth: user CANNOT join another user's channel",
  ignore: !!skipReason,
  async fn() {
    if (skipReason) return;
    const { results } = await runScenarios();
    assert(
      results!.foreign_channel !== "SUBSCRIBED",
      `Foreign channel must be rejected, got ${results!.foreign_channel}`,
    );
  },
});

Deno.test({
  name: "Realtime channel auth: anonymous CANNOT join private channel",
  ignore: !!skipReason,
  async fn() {
    if (skipReason) return;
    const { results } = await runScenarios();
    assert(
      results!.anonymous_attempt !== "SUBSCRIBED",
      `Anonymous join must be rejected, got ${results!.anonymous_attempt}`,
    );
  },
});

Deno.test({
  name: "Realtime channel auth: non user-prefixed topic is rejected",
  ignore: !!skipReason,
  async fn() {
    if (skipReason) return;
    const { results } = await runScenarios();
    assert(
      results!.non_user_prefixed !== "SUBSCRIBED",
      `Topics outside user:<uid>:* must be rejected, got ${results!.non_user_prefixed}`,
    );
  },
});
