import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

// Credit pack mapping: priceId -> credits
const CREDIT_PACKS: Record<string, number> = {
  "price_1T8kL9P3eWRHEALNnK3GQmXI": 10,
  "price_1T8kLAP3eWRHEALN1wl28rEl": 50,
  "price_1T8kLBP3eWRHEALNZCqMlh0N": 200,
};

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user } = await authenticateRequest(req);

    const { priceId } = await req.json();
    if (!priceId || !CREDIT_PACKS[priceId]) throw new Error("Ungültiges Credit-Paket");

    const stripe = new Stripe((await getSecret("STRIPE_SECRET_KEY")) || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/pricing?credit_success=true`,
      cancel_url: `${req.headers.get("origin")}/pricing?canceled=true`,
      metadata: { user_id: user.id, credits: String(CREDIT_PACKS[priceId]) },
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
