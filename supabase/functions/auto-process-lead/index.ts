import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { leadId, dealerUserId } = await req.json();
    if (!leadId || !dealerUserId) throw new Error("leadId and dealerUserId required");

    // Load dealer's autopilot profile
    const { data: profile } = await adminSupabase
      .from('sales_assistant_profiles')
      .select('*')
      .eq('user_id', dealerUserId)
      .eq('active', true)
      .single();

    if (!profile) {
      // No profile or not active -> just create a notification
      await adminSupabase.from('sales_notifications').insert({
        user_id: dealerUserId,
        notification_type: 'new_lead',
        title: 'Neuer Lead eingegangen',
        body: 'Ein neuer Interessent hat sich gemeldet. Kein Autopilot konfiguriert.',
        related_lead_id: leadId,
        requires_approval: false,
      });
      return new Response(JSON.stringify({ status: 'notified_only' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load lead data
    const { data: lead } = await adminSupabase.from('leads').select('*').eq('id', leadId).single();
    if (!lead) throw new Error("Lead not found");

    // Load vehicle context from project if linked
    let vehicleContext: any = {};
    if (lead.project_id) {
      const { data: project } = await adminSupabase.from('projects').select('vehicle_data, title').eq('id', lead.project_id).single();
      if (project) vehicleContext = project.vehicle_data || {};
    }

    const autopilotMode = profile.autopilot_mode || 'approval';
    const autoReplyStages = profile.auto_reply_stages || ['new_lead'];

    // Determine journey stage
    const journeyStage = 'new_lead';
    const sourceChannel = 'website'; // Leads come from website

    // Generate a draft response
    const tone = profile.default_tone || 'freundlich';
    const customerMessage = lead.message || `Anfrage von ${lead.name} zu ${lead.vehicle_title || 'einem Fahrzeug'}`;

    // Load dealer profile for context
    const { data: dealerProfile } = await adminSupabase.from('profiles').select('*').eq('id', dealerUserId).single();

    // Build prompt
    const systemPrompt = `Du bist ein KI-Verkaufsassistent für das Autohaus "${dealerProfile?.company_name || 'unbekannt'}".
Erstelle eine professionelle Erstantwort auf die Kundenanfrage.
Tonalität: ${tone}
${profile.brand_voice ? `Markenstimme: ${profile.brand_voice}` : ''}
${profile.should_push_financing ? 'Erwähne Finanzierungsmöglichkeiten.' : ''}
${profile.should_push_test_drive ? 'Biete eine Probefahrt an.' : ''}
${profile.should_offer_callback ? 'Biete einen Rückruf an.' : ''}
${profile.signature_name ? `Signatur: ${profile.signature_name}${profile.signature_role ? ', ' + profile.signature_role : ''}${profile.signature_phone ? ', Tel: ' + profile.signature_phone : ''}${profile.signature_email ? ', ' + profile.signature_email : ''}` : ''}
Antworte auf Deutsch. Erstelle eine E-Mail-Antwort.`;

    const userPrompt = `Kundenanfrage:
Name: ${lead.name}
E-Mail: ${lead.email}
${lead.phone ? `Telefon: ${lead.phone}` : ''}
${lead.vehicle_title ? `Fahrzeug: ${lead.vehicle_title}` : ''}
Nachricht: ${customerMessage}
${Object.keys(vehicleContext).length > 0 ? `\nFahrzeugdaten: ${JSON.stringify(vehicleContext)}` : ''}`;

    // Call Gemini
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!generatedText) throw new Error("No response generated");

    // Create conversation
    const { data: conversation } = await adminSupabase.from('sales_assistant_conversations').insert({
      user_id: dealerUserId,
      lead_id: leadId,
      project_id: lead.project_id || null,
      vehicle_context: vehicleContext,
      customer_context: { name: lead.name, email: lead.email, phone: lead.phone, message: lead.message },
      journey_stage: journeyStage,
      source_channel: sourceChannel,
      conversation_title: `Lead: ${lead.name} - ${lead.vehicle_title || 'Anfrage'}`,
      status: autopilotMode === 'full_auto' && autoReplyStages.includes(journeyStage) ? 'in_progress' : 'open',
      last_generated_output: generatedText,
      summary: `Automatisch erstellter Entwurf für Lead ${lead.name}`,
    }).select().single();

    if (conversation) {
      // Save message
      await adminSupabase.from('sales_assistant_messages').insert({
        conversation_id: conversation.id,
        user_id: dealerUserId,
        role: 'assistant',
        message_type: 'email_reply',
        output_text: generatedText,
        approval_status: autopilotMode === 'full_auto' && autoReplyStages.includes(journeyStage) ? 'approved' : 'draft',
        generation_mode: 'quick_reply',
        metadata: { auto_generated: true, lead_id: leadId },
      });

      // Create follow-up task
      await adminSupabase.from('sales_assistant_tasks').insert({
        conversation_id: conversation.id,
        user_id: dealerUserId,
        title: `Follow-up mit ${lead.name}`,
        description: `Nachfassen bei ${lead.name} bzgl. ${lead.vehicle_title || 'Anfrage'}`,
        task_type: 'send_follow_up',
        priority: 'high',
        status: 'open',
        due_at: new Date(Date.now() + (profile.auto_follow_up_delay_hours || 24) * 3600000).toISOString(),
      });
    }

    // Create notification
    const needsApproval = autopilotMode !== 'full_auto' || !autoReplyStages.includes(journeyStage);
    await adminSupabase.from('sales_notifications').insert({
      user_id: dealerUserId,
      notification_type: 'new_lead',
      title: needsApproval ? '🔔 Neuer Lead – Entwurf zur Freigabe' : '✅ Neuer Lead – Automatisch beantwortet',
      body: `${lead.name} hat sich für "${lead.vehicle_title || 'ein Fahrzeug'}" interessiert. ${needsApproval ? 'Bitte prüfe und genehmige den Antwortentwurf.' : 'Die Antwort wurde automatisch gesendet.'}`,
      action_type: 'view_conversation',
      action_payload: { conversationId: conversation?.id },
      requires_approval: needsApproval,
      approval_status: needsApproval ? 'pending' : 'approved',
      related_conversation_id: conversation?.id || null,
      related_lead_id: leadId,
    });

    // Deduct credit
    await adminSupabase.rpc('deduct_credits', {
      _user_id: dealerUserId,
      _amount: 1,
      _action_type: 'admin_adjustment',
      _description: 'Sales Autopilot: Automatische Lead-Antwort',
    });

    return new Response(JSON.stringify({
      status: needsApproval ? 'draft_created' : 'auto_sent',
      conversationId: conversation?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-process-lead error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
