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

    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up token
    const { data: tokenRow, error: fetchErr } = await supabase
      .from("qr_login_tokens")
      .select("*")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (fetchErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Ungültiger oder deaktivierter QR-Login-Token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check expiry
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "QR-Login-Token ist abgelaufen" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check max uses
    if (tokenRow.max_uses && tokenRow.used_count >= tokenRow.max_uses) {
      return new Response(JSON.stringify({ error: "QR-Login-Token wurde bereits zu oft verwendet" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate a magic link for the user (instant, short-lived for session creation)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: tokenRow.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: "Session konnte nicht erstellt werden" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Increment usage count
    await supabase
      .from("qr_login_tokens")
      .update({ used_count: tokenRow.used_count + 1 })
      .eq("id", tokenRow.id);

    return new Response(JSON.stringify({
      tokenHash: linkData.properties.hashed_token,
      redirectPath: tokenRow.redirect_path || "/generator",
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
