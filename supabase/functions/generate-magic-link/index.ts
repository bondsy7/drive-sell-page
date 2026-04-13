import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, redirectPath, expiresInHours, maxUses, appDomain } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find user by email
    const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw listErr;
    const targetUser = users.users.find((u: any) => u.email === email);
    if (!targetUser) {
      return new Response(JSON.stringify({ error: `Kein Benutzer mit E-Mail ${email} gefunden` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calculate expiry (null = unlimited)
    let expiresAt: string | null = null;
    if (expiresInHours && expiresInHours > 0) {
      expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
    }

    // Create token
    const { data: tokenRow, error: insertErr } = await supabase
      .from("qr_login_tokens")
      .insert({
        user_id: targetUser.id,
        email,
        redirect_path: redirectPath || "/generator",
        expires_at: expiresAt,
        max_uses: maxUses || null,
        created_by: caller.id,
      })
      .select("token, expires_at")
      .single();

    if (insertErr) throw insertErr;

    const domain = appDomain || "https://pdf.anzeige.ai";
    const loginUrl = `${domain}/qr-login?token=${tokenRow.token}`;

    return new Response(JSON.stringify({
      link: loginUrl,
      token: tokenRow.token,
      expiresAt: tokenRow.expires_at,
      expiresInHours: expiresInHours || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
