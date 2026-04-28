import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import { getSecret } from "../_shared/get-secret.ts";

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { user } = await authenticateRequest(req);
    if (!user.email) throw new Error("Nicht authentifiziert");

    const stripe = new Stripe((await getSecret("STRIPE_SECRET_KEY")) || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return jsonResponse({ error: "Kein Stripe-Kunde gefunden" });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${req.headers.get("origin")}/pricing`,
    });

    return jsonResponse({ url: portalSession.url });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
