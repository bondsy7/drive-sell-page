import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const log = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// Safe timestamp → ISO string conversion
const toISO = (val: any): string => {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  const ms = typeof val === 'number' && val < 1e12 ? val * 1000 : val;
  const d = new Date(ms);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// Plan slug mapping by Stripe product ID (monthly + yearly products)
const PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_U6vMgZiKJOuEph': 'starter',
  'prod_U6vMFLF7W8nh43': 'pro',
  'prod_U6vQHQJucwwipk': 'enterprise',
  'prod_U6xgJe3nEY2OOS': 'starter',
  'prod_U6yCFgnOHMFzqW': 'pro',
  'prod_U6yDWJrKKBCYF2': 'enterprise',
};

const PLAN_CREDITS: Record<string, number> = {
  starter: 50,
  pro: 200,
  enterprise: 600,
};

// Helper: find user by Stripe customer email
async function findUserByCustomerEmail(supabase: any, stripe: Stripe, customerId: string) {
  const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
  if (!customer.email) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", customer.email)
    .single();
  return profile ? { userId: profile.id, email: customer.email } : null;
}

// Helper: find user by stripe_subscription_id in DB
async function findUserByStripeSubId(supabase: any, stripeSubId: string) {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", stripeSubId)
    .limit(1)
    .single();
  return data?.user_id || null;
}

// Helper: sync subscription state from Stripe to DB
async function syncSubscriptionToDb(supabase: any, stripe: Stripe, subscription: Stripe.Subscription, status: string) {
  const stripeSubId = subscription.id;
  const customerId = subscription.customer as string;

  // Try to find user by stripe_subscription_id first, then by email
  let userId = await findUserByStripeSubId(supabase, stripeSubId);
  if (!userId) {
    const found = await findUserByCustomerEmail(supabase, stripe, customerId);
    if (found) userId = found.userId;
  }
  if (!userId) {
    log("User not found for subscription sync", { stripeSubId, customerId });
    return null;
  }

  const productId = subscription.items.data[0]?.price?.product as string;
  const planSlug = PRODUCT_TO_PLAN[productId];
  const priceInterval = subscription.items.data[0]?.price?.recurring?.interval;

  const updateData: any = {
    status,
    stripe_subscription_id: stripeSubId,
    current_period_start: toISO(subscription.current_period_start),
    current_period_end: toISO(subscription.current_period_end),
    updated_at: new Date().toISOString(),
  };

  // If we know the plan, also update plan_id and billing_cycle
  if (planSlug) {
    const { data: planData } = await supabase
      .from("subscription_plans")
      .select("id")
      .eq("slug", planSlug)
      .single();
    if (planData) {
      updateData.plan_id = planData.id;
      updateData.billing_cycle = priceInterval === "year" ? "yearly" : "monthly";
    }
  }

  const { error } = await supabase
    .from("user_subscriptions")
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    log("Error updating subscription", { error: error.message, userId });
  }

  return { userId, planSlug };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  let event: Stripe.Event;

  if (webhookSecret && sig) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      log("Signature verification failed", { error: (err as Error).message });
      return new Response("Webhook signature verification failed", { status: 400 });
    }
  } else {
    event = JSON.parse(body) as Stripe.Event;
    log("No webhook secret configured, parsing event directly");
  }

  log("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      // ─── New subscription via checkout ─────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (!userId) { log("No user_id in metadata"); break; }

        // Handle one-time credit purchase
        if (session.mode === "payment") {
          const credits = parseInt(session.metadata?.credits || "0");
          if (credits > 0) {
            await supabase.rpc("add_credits", {
              _user_id: userId,
              _amount: credits,
              _action_type: "credit_purchase",
              _description: `${credits} Credits gekauft`,
            });
            log("Credits purchased", { userId, credits });
          }
          break;
        }

        if (session.mode !== "subscription") break;

        const subscriptionId = session.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = subscription.items.data[0].price.product as string;
        const priceInterval = subscription.items.data[0].price.recurring?.interval;
        const planSlug = PRODUCT_TO_PLAN[productId];

        if (!planSlug) { log("Unknown product", { productId }); break; }

        const { data: planData } = await supabase
          .from("subscription_plans")
          .select("id")
          .eq("slug", planSlug)
          .single();

        if (!planData) { log("Plan not found", { planSlug }); break; }

        const { error: subError } = await supabase
          .from("user_subscriptions")
          .upsert({
            user_id: userId,
            plan_id: planData.id,
            status: "active",
            billing_cycle: priceInterval === "year" ? "yearly" : "monthly",
            stripe_subscription_id: subscriptionId,
            current_period_start: toISO(subscription.current_period_start),
            current_period_end: toISO(subscription.current_period_end),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (subError) log("Error upserting subscription", { error: subError.message });

        const credits = PLAN_CREDITS[planSlug] || 0;
        if (credits > 0) {
          await supabase.rpc("add_credits", {
            _user_id: userId,
            _amount: credits,
            _action_type: "subscription_reset",
            _description: `${planSlug} Abo aktiviert – ${credits} Credits`,
          });
        }

        log("Subscription created", { userId, planSlug, credits });
        break;
      }

      // ─── Subscription updated (plan change, cancel_at_period_end, etc.) ─
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const previousAttrs = (event.data as any).previous_attributes || {};

        // Determine new status
        let dbStatus = "active";
        if (subscription.status === "canceled" || subscription.status === "unpaid") {
          dbStatus = "cancelled";
        } else if (subscription.status === "past_due") {
          dbStatus = "past_due";
        } else if (subscription.status === "trialing") {
          dbStatus = "trialing";
        } else if (subscription.cancel_at_period_end) {
          // Still active but scheduled to cancel
          dbStatus = "active";
        }

        const result = await syncSubscriptionToDb(supabase, stripe, subscription, dbStatus);
        
        // Log what changed
        const changes: string[] = [];
        if (previousAttrs.status) changes.push(`status: ${previousAttrs.status} → ${subscription.status}`);
        if (previousAttrs.cancel_at_period_end !== undefined) changes.push(`cancel_at_period_end: ${subscription.cancel_at_period_end}`);
        if (previousAttrs.items) changes.push("plan changed");
        
        log("Subscription updated", { 
          userId: result?.userId, 
          stripeSubId: subscription.id,
          stripeStatus: subscription.status,
          dbStatus,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          changes,
        });
        break;
      }

      // ─── Subscription fully deleted/cancelled ─────────────────────────
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Try DB lookup first, then email
        let userId = await findUserByStripeSubId(supabase, subscription.id);
        if (!userId) {
          const found = await findUserByCustomerEmail(supabase, stripe, subscription.customer as string);
          if (found) userId = found.userId;
        }

        if (userId) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          log("Subscription cancelled (deleted)", { userId, stripeSubId: subscription.id });
        } else {
          log("User not found for cancelled subscription", { stripeSubId: subscription.id });
        }
        break;
      }

      // ─── Invoice paid (renewal) ───────────────────────────────────────
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        if (invoice.billing_reason === "subscription_create") break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const productId = subscription.items.data[0].price.product as string;
        const planSlug = PRODUCT_TO_PLAN[productId];
        if (!planSlug) break;

        const found = await findUserByCustomerEmail(supabase, stripe, invoice.customer as string);
        if (!found) { log("Profile not found for invoice", { customer: invoice.customer }); break; }

        await supabase
          .from("user_subscriptions")
          .update({
            status: "active",
            current_period_start: toISO(subscription.current_period_start),
            current_period_end: toISO(subscription.current_period_end),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", found.userId);

        const credits = PLAN_CREDITS[planSlug] || 0;
        if (credits > 0) {
          await supabase.rpc("add_credits", {
            _user_id: found.userId,
            _amount: credits,
            _action_type: "subscription_reset",
            _description: `${planSlug} Abo verlängert – ${credits} Credits`,
          });
        }

        log("Subscription renewed", { userId: found.userId, planSlug, credits });
        break;
      }

      // ─── Invoice payment failed ───────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const found = await findUserByCustomerEmail(supabase, stripe, invoice.customer as string);
        if (found) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("user_id", found.userId);
          log("Subscription past_due (payment failed)", { userId: found.userId });
        }
        break;
      }

      // ─── Refund events (for admin visibility) ─────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        log("Charge refunded", { 
          chargeId: charge.id, 
          amount: charge.amount_refunded,
          customer: charge.customer,
        });
        break;
      }

      default:
        log("Unhandled event type", { type: event.type });
    }
  } catch (error) {
    log("Error processing event", { error: (error as Error).message, stack: (error as Error).stack });
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
