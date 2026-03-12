import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type OutboxEmail = {
  id: string;
  user_id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_html: string;
  body_text: string | null;
};

const toPlainText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    const resendReplyTo = Deno.env.get("RESEND_REPLY_TO") || null;

    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const emailId = typeof body?.emailId === "string" ? body.emailId : null;
    const userId = typeof body?.userId === "string" ? body.userId : null;

    let query = adminSupabase
      .from("sales_email_outbox")
      .select("id, user_id, to_email, to_name, subject, body_html, body_text")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(emailId ? 1 : 20);

    if (emailId) query = query.eq("id", emailId);
    if (userId) query = query.eq("user_id", userId);

    const { data: queuedEmails, error: queueError } = await query;
    if (queueError) throw queueError;

    const emails = (queuedEmails || []) as OutboxEmail[];
    if (emails.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resendApiKey || !resendFromEmail) {
      const missingReason = !resendApiKey
        ? "RESEND_API_KEY fehlt – bitte E-Mail-Versand konfigurieren."
        : "RESEND_FROM_EMAIL fehlt – bitte Absenderadresse konfigurieren.";

      await adminSupabase
        .from("sales_email_outbox")
        .update({ status: "failed", error_message: missingReason })
        .in("id", emails.map((email) => email.id));

      return new Response(JSON.stringify({ processed: emails.length, sent: 0, failed: emails.length, error: missingReason }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const payload: Record<string, unknown> = {
          from: resendFromEmail,
          to: [email.to_email],
          subject: email.subject,
          html: email.body_html,
          text: email.body_text || toPlainText(email.body_html),
        };

        if (resendReplyTo) payload.reply_to = resendReplyTo;

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          failed += 1;
          await adminSupabase.from("sales_email_outbox").update({
            status: "failed",
            error_message: `Resend ${resendResponse.status}: ${errorText.slice(0, 500)}`,
          }).eq("id", email.id);
          continue;
        }

        sent += 1;
        await adminSupabase.from("sales_email_outbox").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", email.id);
      } catch (error) {
        failed += 1;
        await adminSupabase.from("sales_email_outbox").update({
          status: "failed",
          error_message: error instanceof Error ? error.message.slice(0, 500) : "Unbekannter Versandfehler",
        }).eq("id", email.id);
      }
    }

    return new Response(JSON.stringify({ processed: emails.length, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-sales-email error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
