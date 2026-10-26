import { blockedAccountResponse } from "../_shared/blocked-accounts.ts";
// Called by a database trigger when a profile is created. Emails the team about
// self-registered accounts (admin-created accounts carry app_metadata.created_by_admin).
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getSecret } from "../_shared/get-secret.ts";

const RECIPIENTS = ["d.bonds@autoactiva.de", "p.erhard@autoactiva.de"];
const MAX_AGE_MS = 15 * 60 * 1000;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

Deno.serve(async (req) => {
  { const __blocked = blockedAccountResponse(req); if (__blocked) return __blocked; }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let userId = "";
  try { userId = String((await req.json())?.user_id ?? ""); } catch { /* ignore */ }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return new Response("Bad request", { status: 400 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return new Response("Not found", { status: 404 });
  if (user.app_metadata?.created_by_admin) return new Response("skipped: admin-created", { status: 200 });
  if (Date.now() - new Date(user.created_at).getTime() > MAX_AGE_MS) {
    return new Response("skipped: not new", { status: 200 });
  }

  // Deduplicate: only the first call per user sends.
  const { error: dupError } = await admin.from("signup_notifications").insert({ user_id: userId });
  if (dupError) return new Response("skipped: already notified", { status: 200 });

  const apiKey = await getSecret("RESEND_API_KEY", admin);
  const from = await getSecret("RESEND_FROM_EMAIL", admin);
  if (!apiKey || !from) {
    await admin.from("signup_notifications").delete().eq("user_id", userId);
    return new Response("email not configured", { status: 500 });
  }

  const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "–");
  const provider = String(user.app_metadata?.provider ?? "email");
  const when = new Date(user.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  const html = `<p>Ein neues Konto wurde eigenständig in autohaus.ai angelegt:</p>
<ul><li><b>E-Mail:</b> ${esc(user.email ?? "–")}</li><li><b>Name:</b> ${esc(name)}</li>
<li><b>Anmeldeart:</b> ${esc(provider)}</li><li><b>Zeitpunkt:</b> ${esc(when)} Uhr</li></ul>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: RECIPIENTS, subject: `Neue Registrierung: ${user.email}`, html }),
  });
  if (!res.ok) {
    await admin.from("signup_notifications").delete().eq("user_id", userId);
    console.error("resend failed", res.status, await res.text());
    return new Response("send failed", { status: 502 });
  }
  return new Response("sent", { status: 200 });
});
