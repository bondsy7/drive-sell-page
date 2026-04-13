import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // One-time migration - no auth check needed (function will be deleted after use)

  const { oldUserId, newEmail, newPassword } = await req.json();

  if (!oldUserId || !newEmail || !newPassword) {
    return new Response(JSON.stringify({ error: "Missing oldUserId, newEmail, or newPassword" }), { status: 400, headers: corsHeaders });
  }

  try {
    // 1. Get old profile
    const { data: oldProfile } = await supabase.from("profiles").select("*").eq("id", oldUserId).single();
    if (!oldProfile) throw new Error("Old user profile not found");

    // 2. Get old credit balance
    const { data: oldCredits } = await supabase.from("credit_balances").select("*").eq("user_id", oldUserId).single();

    // 3. Get old roles
    const { data: oldRoles } = await supabase.from("user_roles").select("*").eq("user_id", oldUserId);

    // 4. Create new auth user
    const { data: newUserData, error: createErr } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
      email_confirm: true,
      user_metadata: { full_name: oldProfile.contact_name || "" },
    });
    if (createErr) throw new Error(`Failed to create user: ${createErr.message}`);
    const newUserId = newUserData.user.id;

    // 5. Update profile (handle_new_user trigger already created a basic one)
    const { id: _id, created_at: _ca, ...profileData } = oldProfile;
    await supabase.from("profiles").update({
      ...profileData,
      email: newEmail,
      updated_at: new Date().toISOString(),
    }).eq("id", newUserId);

    // 6. Transfer credits
    if (oldCredits) {
      await supabase.from("credit_balances").update({
        balance: oldCredits.balance,
        lifetime_used: oldCredits.lifetime_used,
      }).eq("user_id", newUserId);
    }

    // 7. Transfer roles
    for (const role of oldRoles || []) {
      await supabase.from("user_roles").insert({
        user_id: newUserId,
        role: role.role,
      });
    }

    // 8. Transfer projects
    await supabase.from("projects").update({ user_id: newUserId }).eq("user_id", oldUserId);

    // 9. Transfer project images
    await supabase.from("project_images").update({ user_id: newUserId }).eq("user_id", oldUserId);

    // 10. Transfer leads
    await supabase.from("leads").update({ dealer_user_id: newUserId }).eq("dealer_user_id", oldUserId);

    // 11. Transfer other tables
    const simpleTables = [
      "ftp_configs", "dealer_banks", "dealer_availability", "dealer_blocked_dates",
      "image_generation_jobs", "pipeline_timing_logs", "credit_transactions",
      "sales_assistant_conversations", "sales_assistant_messages", "sales_assistant_profiles",
      "sales_assistant_tasks", "sales_chat_messages", "sales_email_outbox",
      "sales_knowledge_documents", "sales_knowledge_chunks", "sales_notifications",
      "sales_quotes", "test_drive_bookings", "calendar_sync_configs",
      "conversation_stage_log", "crm_manual_notes", "customer_journey_templates",
      "spin360_jobs", "spin360_source_images", "spin360_generated_frames", "spin360_canonical_images",
    ];

    for (const table of simpleTables) {
      await supabase.from(table).update({ user_id: newUserId }).eq("user_id", oldUserId);
    }

    // 12. Delete old user (cleanup)
    await supabase.from("user_roles").delete().eq("user_id", oldUserId);
    await supabase.from("credit_balances").delete().eq("user_id", oldUserId);
    await supabase.from("profiles").delete().eq("id", oldUserId);
    await supabase.auth.admin.deleteUser(oldUserId);

    return new Response(JSON.stringify({
      success: true,
      newUserId,
      message: `Account migrated from ${oldUserId} to ${newUserId} (${newEmail})`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
