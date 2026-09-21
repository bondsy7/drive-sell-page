import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
  const callerId = claims?.claims?.sub as string | undefined;
  if (claimsError || !callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: callerId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const credits = Number.isFinite(body?.credits) ? Math.trunc(body.credits) : 0;
    const companyName = body?.company_name ? String(body.company_name) : null;

    if (!email.includes("@") || password.length < 8) {
      return new Response(JSON.stringify({ error: "Invalid email or password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;
    const userId = created.user!.id;

    if (companyName) {
      await supabase.from("profiles").update({ company_name: companyName }).eq("id", userId);
    }

    if (credits > 0) {
      const { error: creditError } = await supabase.rpc("add_credits", {
        _user_id: userId,
        _amount: credits,
        _action_type: "admin_adjustment",
        _description: `Admin-Anlage: +${credits} Credits`,
      });
      if (creditError) throw creditError;
    }

    const { data: balanceRow } = await supabase
      .from("credit_balances")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(
      JSON.stringify({ success: true, userId, email, balance: balanceRow?.balance ?? null }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
