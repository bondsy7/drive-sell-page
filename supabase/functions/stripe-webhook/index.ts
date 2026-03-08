import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const log = (step: string, details?: any) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// Plan slug mapping by Stripe product ID
const PRODUCT_TO_PLAN: Record<string, string> = {
  'prod_U6vMgZiKJOuEph': 'starter',
  'prod_U6vMFLF7W8nh43': 'pro',
  'prod_U6vQHQJucwwipk': 'enterprise',
};

const PLAN_CREDITS: Record<string, number> = {
  starter: 50,
  pro: 200,
  enterprise: 600,
};

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

  // If webhook secret is configured, verify signature; otherwise parse directly
  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
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

        // Get plan ID from DB
        const { data: planData } = await supabase
          .from("subscription_plans")
          .select("id")
          .eq("slug", planSlug)
          .single();

        if (!planData) { log("Plan not found", { planSlug }); break; }

        // Upsert subscription
        const { error: subError } = await supabase
          .from("user_subscriptions")
          .upsert({
            user_id: userId,
            plan_id: planData.id,
            status: "active",
            billing_cycle: priceInterval === "year" ? "yearly" : "monthly",
            stripe_subscription_id: subscriptionId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (subError) log("Error upserting subscription", { error: subError.message });

        // Add credits
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

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        // Skip first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === "subscription_create") break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const productId = subscription.items.data[0].price.product as string;
        const planSlug = PRODUCT_TO_PLAN[productId];
        if (!planSlug) break;

        // Find user by stripe customer email
        const customer = await stripe.customers.retrieve(invoice.customer as string) as Stripe.Customer;
        if (!customer.email) break;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", customer.email)
          .single();

        if (!profile) { log("Profile not found", { email: customer.email }); break; }

        // Update period
        await supabase
          .from("user_subscriptions")
          .update({
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", profile.id);

        // Reset credits for renewal
        const credits = PLAN_CREDITS[planSlug] || 0;
        if (credits > 0) {
          await supabase.rpc("add_credits", {
            _user_id: profile.id,
            _amount: credits,
            _action_type: "subscription_reset",
            _description: `${planSlug} Abo verlängert – ${credits} Credits`,
          });
        }

        log("Subscription renewed", { userId: profile.id, planSlug, credits });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
        if (!customer.email) break;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", customer.email)
          .single();

        if (profile) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("user_id", profile.id);
          log("Subscription cancelled", { userId: profile.id });
        }
        break;
      }

      default:
        log("Unhandled event type", { type: event.type });
    }
  } catch (error) {
    log("Error processing event", { error: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
