import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { action_type, model_tier } = await req.json();

    // Get credit costs from admin_settings
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "credit_costs")
      .single();

    const costs = settings?.value as Record<string, Record<string, number>> || {};
    const tier = model_tier || "schnell";
    const cost = costs[action_type]?.[tier] ?? 1;

    // Get user balance
    const { data: balance } = await supabase
      .from("credit_balances")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    const currentBalance = balance?.balance ?? 0;

    return new Response(JSON.stringify({
      allowed: currentBalance >= cost,
      balance: currentBalance,
      cost,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-credits error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
