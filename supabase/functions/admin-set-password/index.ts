import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: claims, error: claimsErr } = await sb.auth.getClaims(token);
  const callerId = claims?.claims?.sub;
  if (claimsErr || !callerId) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: callerId, _role: "admin" });
  if (!isAdmin) return json({ error: "Nur für Admins" }, 403);

  let body: { userId?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Ungültige Anfrage" }, 400); }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "Ungültige Nutzer-ID" }, 400);
  if (password.length < 10 || password.length > 72) {
    return json({ error: "Passwort muss 10–72 Zeichen lang sein" }, 400);
  }

  const { error } = await sb.auth.admin.updateUserById(userId, { password });
  if (error) return json({ error: error.message }, 400);

  // Audit log without the password itself
  console.log(`[admin-set-password] event=password_set admin=${callerId} user=${userId} at=${new Date().toISOString()}`);
  return json({ success: true });
});
