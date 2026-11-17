import { z } from "npm:zod@3.25.76";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const BodySchema = z.object({
  action: z.enum(["list", "mark_invoiced", "mark_paid", "mark_unpaid", "assign_user", "activate", "cancel"]),
  orderId: z.string().uuid().optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  userId: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return jsonResponse({ error: "Methode nicht erlaubt" }, 405);

  try {
    const { user, adminSupabase } = await authenticateRequest(req);
    const { data: role } = await adminSupabase.from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return jsonResponse({ error: "Admin-Berechtigung erforderlich" }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse({ error: "Ungültige Anfrage" }, 400);
    const body = parsed.data;

    if (body.action === "list") {
      const [{ data: orders, error: ordersError }, { data: users, error: usersError }, { data: approvals }] = await Promise.all([
        adminSupabase.from("invoice_orders").select("*").order("created_at", { ascending: false }).limit(500),
        adminSupabase.from("profiles").select("id, email, company_name, contact_name").order("company_name", { ascending: true }).limit(2000),
        adminSupabase.from("account_approvals").select("user_id, status"),
      ]);
      if (ordersError || usersError) throw ordersError || usersError;
      return jsonResponse({ orders: orders || [], users: users || [], approvals: approvals || [] });
    }

    if (!body.orderId) return jsonResponse({ error: "Bestellung fehlt" }, 400);
    const { data: current, error: currentError } = await adminSupabase.from("invoice_orders").select("*").eq("id", body.orderId).maybeSingle();
    if (currentError || !current) return jsonResponse({ error: "Bestellung nicht gefunden" }, 404);

    if (body.action === "activate") {
      const { data, error } = await adminSupabase.rpc("activate_invoice_order", { _order_id: body.orderId, _admin_id: user.id });
      if (error) {
        const message = error.message.includes("approved account required")
          ? "Bitte zuerst ein freigegebenes Konto zuordnen."
          : error.message.includes("account is not approved")
            ? "Das zugeordnete Konto ist noch nicht freigegeben."
            : error.message.includes("cancelled")
              ? "Ein stornierter Auftrag kann nicht freigegeben werden."
              : "Die Leistung konnte nicht freigegeben werden.";
        return jsonResponse({ error: message }, 400);
      }
      const { data: order } = await adminSupabase.from("invoice_orders").select("*").eq("id", body.orderId).single();
      return jsonResponse({ order, activation: data });
    }

    if (current.status === "cancelled") return jsonResponse({ error: "Der Auftrag ist bereits storniert." }, 400);

    if (body.action === "assign_user") {
      if (!body.userId) return jsonResponse({ error: "Bitte ein Konto auswählen." }, 400);
      if (current.status === "activated") return jsonResponse({ error: "Aktivierte Aufträge können nicht neu zugeordnet werden." }, 400);
      const { data: profile } = await adminSupabase.from("profiles").select("id").eq("id", body.userId).maybeSingle();
      if (!profile) return jsonResponse({ error: "Konto nicht gefunden" }, 404);
      const { data: order, error } = await adminSupabase.from("invoice_orders").update({ user_id: body.userId }).eq("id", body.orderId).select("*").single();
      if (error) throw error;
      return jsonResponse({ order });
    }

    if (body.action === "cancel") {
      if (current.status === "activated") return jsonResponse({ error: "Eine aktivierte Leistung kann hier nicht storniert werden." }, 400);
      const { data: order, error } = await adminSupabase.from("invoice_orders").update({ status: "cancelled" }).eq("id", body.orderId).select("*").single();
      if (error) throw error;
      return jsonResponse({ order });
    }

    if (body.action === "mark_invoiced") {
      const invoiceNumber = body.invoiceNumber?.trim();
      if (!invoiceNumber) return jsonResponse({ error: "Bitte die tatsächliche Rechnungsnummer eintragen." }, 400);
      const { data: order, error } = await adminSupabase.from("invoice_orders").update({
        invoice_status: "sent", invoice_number: invoiceNumber, invoice_issued_at: new Date().toISOString(),
      }).eq("id", body.orderId).select("*").single();
      if (error) throw error;
      return jsonResponse({ order });
    }

    if (body.action === "mark_paid" || body.action === "mark_unpaid") {
      const paid = body.action === "mark_paid";
      const { data: order, error } = await adminSupabase.from("invoice_orders").update({
        payment_status: paid ? "paid" : "unpaid", paid_at: paid ? new Date().toISOString() : null,
      }).eq("id", body.orderId).select("*").single();
      if (error) throw error;
      return jsonResponse({ order });
    }

    return jsonResponse({ error: "Unbekannte Aktion" }, 400);
  } catch (error) {
    console.error("manage-invoice-orders failed", (error as Error).message);
    return jsonResponse({ error: (error as Error).message === "Not authenticated" ? "Nicht authentifiziert" : "Die Verwaltung konnte nicht geladen werden." }, 500);
  }
});
