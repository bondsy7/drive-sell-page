import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.25.76";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";
import {
  INVOICE_PAYMENT_TERM_DAYS,
  INVOICE_SETUP_FEE_CENTS,
  SERVER_INVOICE_OFFERS,
} from "../_shared/invoice-order-catalog.ts";

const ADMIN_RECIPIENTS = ["d.bonds@autoactiva.de", "p.erhard@autoactiva.de"];
const BodySchema = z.object({
  offerSlug: z.string().trim().min(1).max(80),
  requestId: z.string().uuid(),
  company: z.string().trim().min(2).max(160),
  contact: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(80).optional().default(""),
  street: z.string().trim().min(2).max(180),
  postalCode: z.string().trim().min(2).max(20),
  city: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(100),
  taxId: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  termsAccepted: z.literal(true),
  businessConfirmed: z.literal(true),
  startedAt: z.number().int().positive(),
  website: z.string().max(200).optional().default(""),
});

const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const euro = (cents: number) => (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

function publicOrder(order: any) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    offerName: order.offer_name,
    status: order.status,
    invoiceStatus: order.invoice_status,
    paymentStatus: order.payment_status,
    paymentTermDays: order.payment_term_days,
    priceNetCents: order.price_net_cents,
    setupFeeCents: order.setup_fee_cents,
    vatCents: order.vat_cents,
    totalGrossCents: order.total_gross_cents,
  };
}

async function sendNotification(admin: any, to: string[], subject: string, html: string) {
  const [apiKey, from, replyTo] = await Promise.all([
    getSecret("RESEND_API_KEY", admin),
    getSecret("RESEND_FROM_EMAIL", admin),
    getSecret("RESEND_REPLY_TO", admin),
  ]);
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!response.ok) {
    console.error("create-invoice-order email failed", response.status);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Methode nicht erlaubt" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse({ error: "Bitte prüfe die Pflichtfelder und deine E-Mail-Adresse." }, 400);
    const body = parsed.data;
    if (body.website) return jsonResponse({ error: "Die Bestellung konnte nicht gesendet werden." }, 400);
    if (body.startedAt > Date.now() + 60_000 || Date.now() - body.startedAt < 1500) {
      return jsonResponse({ error: "Bitte prüfe deine Angaben und sende den Auftrag erneut." }, 400);
    }

    const catalogOffer = SERVER_INVOICE_OFFERS[body.offerSlug];
    if (!catalogOffer) return jsonResponse({ error: "Diese Leistung ist nicht buchbar." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: existing } = await admin.from("invoice_orders").select("*").eq("request_id", body.requestId).maybeSingle();
    if (existing) return jsonResponse({ order: publicOrder(existing), emailSent: false, duplicate: true });

    let userId: string | null = null;
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const { data } = await admin.auth.getClaims(token);
      userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
    }

    let offer = { ...catalogOffer };
    if (offer.kind === "subscription") {
      const { data: plan, error } = await admin.from("subscription_plans")
        .select("name, price_monthly_cents, monthly_credits")
        .eq("slug", offer.slug).eq("active", true).maybeSingle();
      if (error || !plan) return jsonResponse({ error: "Dieser Tarif ist derzeit nicht verfügbar." }, 400);
      offer = { ...offer, name: offer.slug.startsWith("foto") ? offer.name : plan.name, priceCents: plan.price_monthly_cents, credits: plan.monthly_credits };
    }

    const email = body.email.toLowerCase();
    let profileId = userId;
    if (!profileId) {
      const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      profileId = profile?.id ?? null;
    }

    let hasPreviousSubscription = false;
    if (profileId) {
      const { data: previousSubscription } = await admin.from("user_subscriptions").select("id").eq("user_id", profileId).limit(1);
      hasPreviousSubscription = (previousSubscription?.length ?? 0) > 0;
    }
    if (!hasPreviousSubscription) {
      const { data: previousOrders } = await admin.from("invoice_orders").select("id")
        .eq("billing_email", email).gt("setup_fee_cents", 0).neq("status", "cancelled").limit(1);
      hasPreviousSubscription = (previousOrders?.length ?? 0) > 0;
    }

    const setupFeeCents = offer.setupFeeEligible && !hasPreviousSubscription ? INVOICE_SETUP_FEE_CENTS : 0;
    const netCents = offer.priceCents + setupFeeCents;
    const vatCents = Math.round(netCents * 0.19);
    const insert = {
      request_id: body.requestId,
      user_id: userId,
      offer_slug: offer.slug,
      offer_name: offer.name,
      offer_kind: offer.kind,
      credits: offer.credits,
      price_net_cents: offer.priceCents,
      setup_fee_cents: setupFeeCents,
      vat_cents: vatCents,
      total_gross_cents: netCents + vatCents,
      billing_company: body.company,
      billing_contact: body.contact,
      billing_email: email,
      billing_phone: body.phone || null,
      billing_street: body.street,
      billing_postal_code: body.postalCode,
      billing_city: body.city,
      billing_country: body.country,
      billing_tax_id: body.taxId || null,
      notes: body.notes || null,
      terms_accepted_at: new Date().toISOString(),
      payment_term_days: INVOICE_PAYMENT_TERM_DAYS,
    };

    const { data: order, error } = await admin.from("invoice_orders").insert(insert).select("*").single();
    if (error) {
      if (error.code === "23505") {
        const { data: duplicate } = await admin.from("invoice_orders").select("*").eq("request_id", body.requestId).maybeSingle();
        if (duplicate) return jsonResponse({ order: publicOrder(duplicate), emailSent: false, duplicate: true });
      }
      throw error;
    }

    const summary = `<p><b>Bestellnummer:</b> ${esc(order.order_number)}<br><b>Leistung:</b> ${esc(order.offer_name)}<br><b>Unternehmen:</b> ${esc(order.billing_company)}<br><b>Netto:</b> ${esc(euro(order.price_net_cents + order.setup_fee_cents))}<br><b>Gesamt inkl. 19 % USt.:</b> ${esc(euro(order.total_gross_cents))}</p>`;
    const customerHtml = `<p>Guten Tag ${esc(order.billing_contact)},</p><p>wir haben Ihren Rechnungsauftrag erhalten. Die Rechnung erhalten Sie nach Prüfung in einer separaten E-Mail. Das Zahlungsziel beträgt 14 Tage ab Rechnungserhalt. Die Leistung wird erst nach manueller Freigabe aktiviert.</p>${summary}`;
    const adminHtml = `<p>Ein neuer Rechnungsauftrag ist eingegangen und wartet auf Prüfung.</p>${summary}<p><b>Ansprechpartner:</b> ${esc(order.billing_contact)}<br><b>E-Mail:</b> ${esc(order.billing_email)}<br><b>Telefon:</b> ${esc(order.billing_phone || "–")}</p><p><a href="https://app.autohaus.ai/admin/invoice-orders">Rechnungsaufträge öffnen</a></p>`;
    const [customerResult, adminResult] = await Promise.allSettled([
      sendNotification(admin, [email], `Rechnungsauftrag ${order.order_number} erhalten`, customerHtml),
      sendNotification(admin, ADMIN_RECIPIENTS, `Neuer Rechnungsauftrag ${order.order_number}: ${order.billing_company}`, adminHtml),
    ]);

    return jsonResponse({
      order: publicOrder(order),
      emailSent: customerResult.status === "fulfilled" && customerResult.value === true,
      adminNotified: adminResult.status === "fulfilled" && adminResult.value === true,
    });
  } catch (error) {
    console.error("create-invoice-order failed", (error as Error).message);
    return jsonResponse({ error: "Der Rechnungsauftrag konnte nicht gespeichert werden. Bitte versuche es erneut." }, 500);
  }
});
