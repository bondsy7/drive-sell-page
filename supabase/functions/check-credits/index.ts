import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse, handleCors } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors();

  try {
    const { supabaseUser: supabase, user } = await authenticateRequest(req);
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

    return jsonResponse({ allowed: currentBalance >= cost, balance: currentBalance, cost });
  } catch (e) {
    console.error("check-credits error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
