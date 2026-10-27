// Account approval for self-registered users.
// action "submit": the pending user sends name, phone and company data -> team gets an email.
// action "review": an admin approves or rejects -> the user gets an email.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "../_shared/cors.ts";
import { getSecret } from "../_shared/get-secret.ts";
import { blockedAccountResponse } from "../_shared/blocked-accounts.ts";
import { approvalReviewError } from "../_shared/account-approval-policy.ts";

const RECIPIENTS = ["d.bonds@autoactiva.de", "p.erhard@autoactiva.de"];
const APP_URL = "https://app.autohaus.ai";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Submit = z.object({
  action: z.literal("submit"),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(40).regex(/^[+0-9 ()/-]+$/),
  company_name: z.string().trim().min(2).max(160),
  company_address: z.string().trim().min(5).max(300),
  company_website: z.string().trim().max(200).optional().default(""),
});
const Review = z.object({
  action: z.literal("review"),
  user_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

async function sendMail(admin: any, to: string[], subject: string, html: string) {
  const apiKey = await getSecret("RESEND_API_KEY", admin);
  const from = await getSecret("RESEND_FROM_EMAIL", admin);
  if (!apiKey || !from) throw new Error("email not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  { const b = blockedAccountResponse(req); if (b) return b; }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "not_configured" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token);
  const userId = claimsData?.claims?.sub as string | undefined;
  const email = claimsData?.claims?.email as string | undefined;
  if (claimsError || !userId) return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  if ((body as any)?.action === "submit") {
    const parsed = Submit.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_input", fields: parsed.error.flatten().fieldErrors }, 400);
    const { data: applicant, error: applicantError } = await admin.auth.admin.getUserById(userId);
    if (applicantError || !applicant.user?.email_confirmed_at) return json({ error: "email_not_verified" }, 403);
    const { data: row } = await admin.from("account_approvals").select("status, submitted_at").eq("user_id", userId).maybeSingle();
    if (!row) return json({ error: "no_approval_needed" }, 409);
    if (row.status !== "pending") return json({ error: "already_decided", status: row.status }, 409);
    const d = parsed.data;
    const { error } = await admin.from("account_approvals").update({
      ...d, action: undefined, email, submitted_at: new Date().toISOString(),
    } as any).eq("user_id", userId);
    if (error) return json({ error: "save_failed" }, 500);
    const rows = [["Name", d.full_name], ["E-Mail", email ?? "–"], ["Telefon", d.phone], ["Firma", d.company_name],
      ["Adresse", d.company_address], ["Website", d.company_website || "–"]]
      .map(([k, v]) => `<li><b>${k}:</b> ${esc(v)}</li>`).join("");
    try {
      await sendMail(admin, RECIPIENTS, `Freigabeanfrage: ${d.company_name} (${email})`,
        `<p>Ein neues Konto wartet auf eure Freigabe:</p><ul>${rows}</ul>
<p><a href="${APP_URL}/admin/users">Jetzt in der Nutzerverwaltung freigeben oder ablehnen</a></p>`);
    } catch (e) {
      console.error("[account-approval] event=submit_mail_failed", String(e));
      return json({ error: "mail_failed" }, 502);
    }
    console.log(`[account-approval] event=submitted user=${userId}`);
    return json({ ok: true });
  }

  const parsed = Review.safeParse(body);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);
  const { user_id, decision } = parsed.data;
  if (decision === "approved") {
    const { data: application, error: applicationError } = await admin.from("account_approvals")
      .select("submitted_at").eq("user_id", user_id).maybeSingle();
    if (applicationError) return json({ error: "lookup_failed" }, 500);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(user_id);
    if (targetError) return json({ error: "lookup_failed" }, 500);
    const prerequisite = approvalReviewError(application, target.user?.email_confirmed_at);
    if (prerequisite) return json({ error: prerequisite }, 409);
  }
  const { data: updated, error } = await admin.from("account_approvals")
    .update({ status: decision, decided_at: new Date().toISOString(), decided_by: userId })
    .eq("user_id", user_id).select("email, full_name").maybeSingle();
  if (error || !updated) return json({ error: "not_found" }, 404);
  if (updated.email) {
    const hi = updated.full_name ? `Hallo ${esc(updated.full_name)},` : "Hallo,";
    const html = decision === "approved"
      ? `<p>${hi}</p><p>dein Zugang zu autohaus.ai wurde freigegeben. Du kannst dich jetzt anmelden:</p><p><a href="${APP_URL}">${APP_URL}</a></p>`
      : `<p>${hi}</p><p>deine Anfrage für einen Zugang zu autohaus.ai konnte leider nicht freigegeben werden. Bei Fragen erreichst du uns unter info@breadcrumb.de.</p>`;
    try {
      await sendMail(admin, [updated.email], decision === "approved" ? "Dein Zugang zu autohaus.ai ist freigegeben" : "Deine Zugangsanfrage bei autohaus.ai", html);
    } catch (e) {
      console.error("[account-approval] event=review_mail_failed", String(e));
    }
  }
  console.log(`[account-approval] event=${decision} user=${user_id} by=${userId}`);
  return json({ ok: true });
});
