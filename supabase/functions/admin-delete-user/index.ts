import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { getSecret } from "../_shared/get-secret.ts";

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
    { auth: { persistSession: false } }
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const { action, userId, subscriptionId } = await req.json();

  try {
    if (action === "cancel_subscription" && subscriptionId) {
      const stripe = new Stripe((await getSecret("STRIPE_SECRET_KEY")) || "", { apiVersion: "2025-08-27.basil" });
      await stripe.subscriptions.cancel(subscriptionId);
      
      // Update DB
      await supabase
        .from("user_subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscriptionId);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user" && userId) {
      // Cancel any Stripe subscriptions first
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId);

      const stripe = new Stripe((await getSecret("STRIPE_SECRET_KEY")) || "", { apiVersion: "2025-08-27.basil" });
      for (const sub of subs || []) {
        if (sub.stripe_subscription_id) {
          try { await stripe.subscriptions.cancel(sub.stripe_subscription_id); } catch { /* already cancelled */ }
        }
      }

      // Delete user data (cascading FKs handle most, but clean up explicitly)
      await supabase.from("user_subscriptions").delete().eq("user_id", userId);
      await supabase.from("credit_balances").delete().eq("user_id", userId);
      await supabase.from("credit_transactions").delete().eq("user_id", userId);
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("project_images").delete().eq("user_id", userId);
      await supabase.from("projects").delete().eq("user_id", userId);
      await supabase.from("ftp_configs").delete().eq("user_id", userId);
      await supabase.from("profiles").delete().eq("id", userId);

      // Delete auth user
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
