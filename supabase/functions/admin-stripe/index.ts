import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  // Verify admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  const { action, ...params } = await req.json();

  try {
    switch (action) {
      // List recent payment intents
      case "list_payments": {
        const limit = params.limit || 50;
        const starting_after = params.starting_after || undefined;
        const paymentIntents = await stripe.paymentIntents.list({
          limit,
          starting_after,
          expand: ["data.customer", "data.invoice"],
        });
        
        const payments = paymentIntents.data.map((pi: any) => ({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          created: pi.created,
          customer_email: pi.customer?.email || null,
          customer_name: pi.customer?.name || null,
          description: pi.description,
          invoice_id: pi.invoice?.id || null,
          invoice_number: pi.invoice?.number || null,
          metadata: pi.metadata,
          refunded: pi.amount - (pi.amount_received || 0) > 0 || false,
          amount_refunded: pi.metadata?._refunded_amount ? parseInt(pi.metadata._refunded_amount) : 0,
        }));

        return new Response(JSON.stringify({ payments, has_more: paymentIntents.has_more }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // List invoices
      case "list_invoices": {
        const limit = params.limit || 50;
        const starting_after = params.starting_after || undefined;
        const invoices = await stripe.invoices.list({
          limit,
          starting_after,
          expand: ["data.customer", "data.subscription"],
        });

        const items = invoices.data.map((inv: any) => ({
          id: inv.id,
          number: inv.number,
          amount_due: inv.amount_due,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          created: inv.created,
          period_start: inv.period_start,
          period_end: inv.period_end,
          customer_email: inv.customer?.email || null,
          customer_name: inv.customer?.name || null,
          subscription_id: inv.subscription?.id || null,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
          billing_reason: inv.billing_reason,
        }));

        return new Response(JSON.stringify({ invoices: items, has_more: invoices.has_more }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // List subscriptions
      case "list_subscriptions": {
        const status = params.status || "all";
        const listParams: any = {
          limit: params.limit || 50,
          expand: ["data.customer", "data.items.data.price.product"],
        };
        if (status !== "all") listParams.status = status;
        if (params.starting_after) listParams.starting_after = params.starting_after;

        const subs = await stripe.subscriptions.list(listParams);
        const items = subs.data.map((sub: any) => ({
          id: sub.id,
          status: sub.status,
          created: sub.created,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
          customer_email: sub.customer?.email || null,
          customer_name: sub.customer?.name || null,
          plan_name: sub.items.data[0]?.price?.product?.name || "Unknown",
          plan_interval: sub.items.data[0]?.price?.recurring?.interval || null,
          plan_amount: sub.items.data[0]?.price?.unit_amount || 0,
          currency: sub.items.data[0]?.price?.currency || "eur",
          metadata: sub.metadata,
        }));

        return new Response(JSON.stringify({ subscriptions: items, has_more: subs.has_more }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refund a payment
      case "refund": {
        const { payment_intent_id, amount, reason } = params;
        if (!payment_intent_id) throw new Error("payment_intent_id required");

        const refundParams: any = { payment_intent: payment_intent_id };
        if (amount) refundParams.amount = amount; // partial refund in cents
        if (reason) refundParams.reason = reason; // 'duplicate', 'fraudulent', 'requested_by_customer'

        const refund = await stripe.refunds.create(refundParams);

        return new Response(JSON.stringify({
          success: true,
          refund: {
            id: refund.id,
            amount: refund.amount,
            status: refund.status,
            currency: refund.currency,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cancel subscription
      case "cancel_subscription": {
        const { subscription_id, immediate } = params;
        if (!subscription_id) throw new Error("subscription_id required");

        let result;
        if (immediate) {
          result = await stripe.subscriptions.cancel(subscription_id);
        } else {
          result = await stripe.subscriptions.update(subscription_id, {
            cancel_at_period_end: true,
          });
        }

        // Update DB
        if (immediate) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subscription_id);
        }

        return new Response(JSON.stringify({
          success: true,
          status: result.status,
          cancel_at_period_end: result.cancel_at_period_end,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // List refunds
      case "list_refunds": {
        const refunds = await stripe.refunds.list({
          limit: params.limit || 50,
          expand: ["data.payment_intent"],
        });

        const items = refunds.data.map((r: any) => ({
          id: r.id,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          created: r.created,
          reason: r.reason,
          payment_intent_id: r.payment_intent?.id || null,
          customer_email: null,
        }));

        return new Response(JSON.stringify({ refunds: items, has_more: refunds.has_more }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    console.error("[ADMIN-STRIPE]", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
