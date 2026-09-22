import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getSecret } from "../_shared/get-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Nur bekannte Abo-Preise akzeptieren – keine beliebigen Client-Preis-IDs.
const ALLOWED_SUBSCRIPTION_PRICE_IDS = new Set<string>([
  "price_1Tl8cuP3eWRHEALNPuSwqIZe", // Basis (Legacy-Grundpaket)
  // All-Incl-Marketing
  "price_1UINXLP3eWRHEALNd9tA3iGO", // Basic
  "price_1UINXNP3eWRHEALN7RYf2qNH", // Advanced
  "price_1UINXOP3eWRHEALNuZ9k9ZJD", // Premium
  "price_1UINXQP3eWRHEALNMoIszMxo", // Ultra
  // Fotoservice
  "price_1UINXUP3eWRHEALNEKwVan7t", // 1 Fahrzeug
  "price_1UINXWP3eWRHEALNnycuH46I", // 25 Fahrzeuge
  "price_1UINXYP3eWRHEALNnVc7lPwS", // 50 Fahrzeuge
  "price_1UINXZP3eWRHEALNxbIQuvkO", // 100 Fahrzeuge
  "price_1UINXaP3eWRHEALNHnFqWkJs", // 200 Fahrzeuge
]);

// Einmalige Implementierungskosten (990 € netto) – nur bei der allerersten Buchung.
const SETUP_FEE_PRICE_ID = "price_1UINXcP3eWRHEALNRW9nMcih";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId fehlt");
    if (!ALLOWED_SUBSCRIPTION_PRICE_IDS.has(priceId)) {
      return new Response(JSON.stringify({ error: "Ungültige Preis-ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Abo-Checkout ausschließlich für authentifizierte Nutzer.
    // User-ID und E-Mail stammen immer aus dem verifizierten Token, nie aus dem Body.
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    const userEmail = authData?.user?.email;
    const userId = authData?.user?.id;
    if (authError || !userEmail || !userId) {
      return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const stripe = new Stripe((await getSecret("STRIPE_SECRET_KEY")) || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Einrichtungsgebühr nur, wenn der Kunde noch nie ein Abo hatte.
    let chargeSetupFee = true;
    if (customerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 1,
      });
      chargeSetupFee = existingSubs.data.length === 0;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      // Einmalpreis wird als zusätzliche Position mitgeführt und landet auf der ersten Rechnung.
      line_items: chargeSetupFee
        ? [{ price: priceId, quantity: 1 }, { price: SETUP_FEE_PRICE_ID, quantity: 1 }]
        : [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/pricing?success=true`,
      cancel_url: `${req.headers.get("origin")}/pricing?canceled=true`,
      metadata: { user_id: userId || "" },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
