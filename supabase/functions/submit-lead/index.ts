import { blockedAccountResponse } from "../_shared/blocked-accounts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSecret } from "../_shared/get-secret.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isHoneypotSubmission, leadSchema, ownsLeadContext } from "./validation.ts";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
const RECIPIENT_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

const reply = (body: object, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  { const __blocked = blockedAccountResponse(req); if (__blocked) return __blocked; }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") return reply({ error: "Nur POST ist erlaubt." }, 405);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 16384) return reply({ error: "Anfrage zu groß." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Ungültige Anfrage." }, 400); }
    if (isHoneypotSubmission(body)) return reply({ success: true });
    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) return reply({ error: "Bitte Name, E-Mail und Kontaktangaben prüfen." }, 400);
    const {
      dealerUserId, projectId, vehicleId, name, email, phone, message, vehicleTitle,
      interestedTestDrive, interestedTradeIn, interestedLeasing, interestedFinancing, interestedPurchase
    } = parsed.data;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return reply({ error: "Dienst nicht verfügbar." }, 503);
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: dealerProfile, error: dealerError } = await supabase.from("profiles").select("id").eq("id", dealerUserId).maybeSingle();
    if (dealerError) return reply({ error: "Anfrage konnte nicht geprüft werden." }, 503);
    if (!dealerProfile) return reply({ error: "Ungültiger Anfragekontext." }, 400);

    let resolvedVehicleId = vehicleId || null;
    // Landing-page recipient/subject come only from the saved page of this dealer, never from the request.
    let pageContact: { recipientEmail?: string; subject?: string } | null = null;
    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("vehicle_id, user_id, vehicle_data")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) return reply({ error: "Anfrage konnte nicht geprüft werden." }, 503);
      if (!ownsLeadContext(dealerUserId, project, null, projectId)) return reply({ error: "Ungültiger Anfragekontext." }, 400);
      if (project?.vehicle_id && vehicleId && project.vehicle_id !== vehicleId) return reply({ error: "Ungültiger Anfragekontext." }, 400);
      if (!resolvedVehicleId) resolvedVehicleId = project?.vehicle_id || null;
      const cfg = (project?.vehicle_data as any)?.contactFormConfig;
      if (project?.user_id === dealerUserId && cfg && typeof cfg.recipientEmail === "string" && RECIPIENT_RE.test(cfg.recipientEmail.trim())) {
        pageContact = { recipientEmail: cfg.recipientEmail.trim().slice(0, 255), subject: typeof cfg.subject === "string" ? cfg.subject.slice(0, 200) : undefined };
      }
    }

    if (resolvedVehicleId) {
      const { data: vehicle, error: vehicleError } = await supabase.from("vehicles").select("user_id").eq("id", resolvedVehicleId).maybeSingle();
      if (vehicleError) return reply({ error: "Anfrage konnte nicht geprüft werden." }, 503);
      if (!ownsLeadContext(dealerUserId, null, vehicle, null, resolvedVehicleId)) return reply({ error: "Ungültiger Anfragekontext." }, 400);
    }
    const { data: lead, error } = await supabase.from("leads").insert({
      dealer_user_id: dealerUserId,
      project_id: projectId || null,
      vehicle_id: resolvedVehicleId,
      name: String(name).slice(0, 200),
      email: String(email).slice(0, 255),
      phone: phone ? String(phone).slice(0, 50) : null,
      message: message || null,
      vehicle_title: vehicleTitle ? String(vehicleTitle).slice(0, 300) : null,
      interested_test_drive: !!interestedTestDrive,
      interested_trade_in: !!interestedTradeIn,
      interested_leasing: !!interestedLeasing,
      interested_financing: !!interestedFinancing,
      interested_purchase: !!interestedPurchase,
    }).select('id').single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: "Anfrage konnte nicht gespeichert werden." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (lead?.id && pageContact?.recipientEmail) {
      try {
        const apiKey = await getSecret("RESEND_API_KEY");
        const from = await getSecret("RESEND_FROM_EMAIL");
        if (!apiKey || !from) {
          console.warn("[submit-lead] event=recipient_mail_skipped reason=resend_not_configured");
        } else {
          const interests = [
            interestedTestDrive && "Probefahrt", interestedTradeIn && "Inzahlungnahme", interestedLeasing && "Leasing",
            interestedFinancing && "Finanzierung", interestedPurchase && "Barkauf",
          ].filter(Boolean).join(", ");
          const rows: [string, unknown][] = [["Fahrzeug", vehicleTitle], ["Name", name], ["E-Mail", email], ["Telefon", phone], ["Interesse", interests], ["Nachricht", message]];
          const html = `<h2>Neue Anfrage über die Landingpage</h2><table cellpadding="6">${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td><b>${k}</b></td><td style="white-space:pre-line">${esc(String(v).slice(0, 2000))}</td></tr>`).join("")}</table>`;
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              from, to: [pageContact.recipientEmail], reply_to: String(email).slice(0, 255),
              subject: (pageContact.subject || `Neue Anfrage${vehicleTitle ? ` zu ${String(vehicleTitle).slice(0, 120)}` : ""}`).replace(/[\r\n]+/g, " "),
              html,
            }),
          });
          console.log(`[submit-lead] event=recipient_mail status=${res.status} lead=${lead.id}`);
        }
      } catch (mailErr) {
        console.error("[submit-lead] event=recipient_mail_error", mailErr);
      }
    }

    // Check if dealer has autopilot enabled and trigger auto-processing.
    // Hardening (lead_credit_drain): autopilot only fires when the dealer
    //   (a) actually exists as a profile, and
    //   (b) still has credits left.
    // Otherwise we degrade to a normal in-app notification — never burn
    // credits for an unknown/exhausted dealer that an attacker could spoof.
    if (lead?.id) {
      if (!dealerProfile) {
        console.warn("submit-lead: unknown dealerUserId, skipping autopilot", { dealerUserId });
      } else {
        const { data: profile } = await supabase.from("sales_assistant_profiles")
          .select("autopilot_mode, active")
          .eq("user_id", dealerUserId)
          .eq("active", true)
          .maybeSingle();

        const { data: creditRow } = await supabase
          .from("credit_balances")
          .select("balance")
          .eq("user_id", dealerUserId)
          .maybeSingle();
        const balance = creditRow?.balance ?? 0;

        if (profile && profile.autopilot_mode !== 'off' && balance > 0) {
          // Trigger auto-process in background (fire and forget)
          fetch(`${supabaseUrl}/functions/v1/auto-process-lead`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ leadId: lead.id, dealerUserId }),
          }).catch(err => console.error("Auto-process trigger error:", err));
        } else {
          await supabase.from("sales_notifications").insert({
            user_id: dealerUserId,
            notification_type: "new_lead",
            title: "Neuer Lead eingegangen",
            body: `${String(name).slice(0, 200)} hat eine Anfrage${vehicleTitle ? ` zu ${String(vehicleTitle).slice(0, 120)}` : ''} gesendet.`,
            related_lead_id: lead.id,
            requires_approval: false,
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lead submission error:", err);
    return new Response(JSON.stringify({ error: "Serverfehler." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
