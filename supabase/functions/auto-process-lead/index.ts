import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();
const normalizePhone = (value?: string | null) => (value || '').replace(/[^\d+]/g, '');

async function getCustomPrompt(sb: any, key: string, defaultPrompt: string): Promise<string> {
  try {
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
}

const DEFAULT_LEAD_PROMPT = `Du bist ein KI-Verkaufsassistent für ein Autohaus.
Erstelle eine professionelle Erstantwort-E-Mail auf die Kundenanfrage.

WICHTIG: Gehe gezielt auf die Kundeninteressen ein:
- Bei Probefahrt-Interesse: Biete konkret einen Termin an
- Bei Inzahlungnahme: Frage nach Fahrzeugdetails
- Bei Leasing/Finanzierung: Erwähne attraktive Konditionen
- Bei Kauf: Bestätige Preis und Verfügbarkeit
- Biete einen Rückruf an wenn gewünscht

Erstelle NUR den E-Mail-Text (Betreff wird separat generiert). Beginne mit der Anrede.
Antworte auf Deutsch.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

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
    let vehicleTitle = lead.vehicle_title || '';
    if (lead.project_id) {
      const { data: project } = await adminSupabase.from('projects').select('vehicle_data, title').eq('id', lead.project_id).single();
      if (project) {
        vehicleContext = project.vehicle_data || {};
        if (!vehicleTitle) vehicleTitle = project.title || '';
      }
    }

    const autopilotMode = profile.autopilot_mode || 'approval';
    const autoReplyStages = profile.auto_reply_stages || ['new_lead'];

    const journeyStage = 'new_lead';

    // Build interest summary
    const interests: string[] = [];
    if (lead.interested_test_drive) interests.push('Probefahrt');
    if (lead.interested_trade_in) interests.push('Inzahlungnahme');
    if (lead.interested_leasing) interests.push('Leasing');
    if (lead.interested_financing) interests.push('Finanzierung');
    if (lead.interested_purchase) interests.push('Barkauf');

    // Load dealer profile for context
    const { data: dealerProfile } = await adminSupabase.from('profiles').select('*').eq('id', dealerUserId).single();

    const tone = profile.default_tone || 'freundlich';
    const customerMessage = lead.message || `Anfrage von ${lead.name} zu ${vehicleTitle || 'einem Fahrzeug'}`;

    // Build prompt – load custom base prompt from admin settings
    const basePrompt = await getCustomPrompt(adminSupabase, "auto_process_lead", DEFAULT_LEAD_PROMPT);
    const systemPrompt = `${basePrompt}

Autohaus: "${dealerProfile?.company_name || 'unbekannt'}"
Erstelle eine professionelle Erstantwort-E-Mail auf die Kundenanfrage.
Tonalität: ${tone}
${profile.brand_voice ? `Markenstimme: ${profile.brand_voice}` : ''}

KUNDENINTERESSEN:
${interests.length > 0 ? interests.map(i => `- ${i}`).join('\n') : '- Allgemeines Interesse'}

WICHTIG: Gehe gezielt auf die Kundeninteressen ein:
${lead.interested_test_drive ? '- Biete konkret einen Probefahrt-Termin an und frage nach bevorzugtem Datum/Uhrzeit.' : ''}
${lead.interested_trade_in ? '- Frage nach Details zum Fahrzeug für die Inzahlungnahme (Marke, Modell, Baujahr, km-Stand).' : ''}
${lead.interested_leasing ? '- Erwähne attraktive Leasing-Konditionen und biete eine individuelle Berechnung an.' : ''}
${lead.interested_financing ? '- Erwähne Finanzierungsmöglichkeiten und biete eine individuelle Berechnung an.' : ''}
${lead.interested_purchase ? '- Bestätige den aktuellen Kaufpreis und Verfügbarkeit.' : ''}
${!interests.length && profile.should_push_test_drive ? '- Biete eine Probefahrt an.' : ''}
${!interests.length && profile.should_push_financing ? '- Erwähne Finanzierungsmöglichkeiten.' : ''}
${profile.should_offer_callback ? '- Biete einen Rückruf an.' : ''}

Erstelle NUR den E-Mail-Text (Betreff wird separat generiert). Beginne mit der Anrede.
${profile.signature_name ? `Signatur: ${profile.signature_name}${profile.signature_role ? ', ' + profile.signature_role : ''}${profile.signature_phone ? ', Tel: ' + profile.signature_phone : ''}${profile.signature_email ? ', ' + profile.signature_email : ''}` : ''}
Antworte auf Deutsch.`;

    const userPrompt = `Kundenanfrage:
Name: ${lead.name}
E-Mail: ${lead.email}
${lead.phone ? `Telefon: ${lead.phone}` : ''}
${vehicleTitle ? `Fahrzeug: ${vehicleTitle}` : ''}
Nachricht: ${customerMessage}
${interests.length > 0 ? `Interessen: ${interests.join(', ')}` : ''}
${Object.keys(vehicleContext).length > 0 ? `\nFahrzeugdaten: ${JSON.stringify(vehicleContext)}` : ''}`;

    // Call Gemini API directly
    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      },
    );

    if (!aiResponse.ok) {
      const t = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, t);
      throw new Error("Gemini API error");
    }

    const aiResult = await aiResponse.json();
    const generatedText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!generatedText) throw new Error("No response generated");

    // Generate subject line
    const subjectPrompt = `Erstelle eine kurze, professionelle E-Mail-Betreffzeile für diese Antwort an einen Kunden der sich für "${vehicleTitle || 'ein Fahrzeug'}" interessiert. Nur den Betreff, keine Anführungszeichen.`;
    let emailSubject = `Ihre Anfrage zu ${vehicleTitle || 'Ihrem Wunschfahrzeug'} – ${dealerProfile?.company_name || 'Autohaus'}`;

    try {
      const subjectResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: subjectPrompt }],
          stream: false,
        }),
      });
      if (subjectResp.ok) {
        const sr = await subjectResp.json();
        const s = sr.choices?.[0]?.message?.content?.trim();
        if (s) emailSubject = s.replace(/^["']|["']$/g, '');
      }
    } catch {}

    const needsApproval = autopilotMode !== 'full_auto' || !autoReplyStages.includes(journeyStage);

    // Create conversation
    const { data: conversation } = await adminSupabase.from('sales_assistant_conversations').insert({
      user_id: dealerUserId,
      lead_id: leadId,
      project_id: lead.project_id || null,
      vehicle_context: vehicleContext,
      customer_context: { name: lead.name, email: lead.email, phone: lead.phone, message: lead.message, interests },
      journey_stage: journeyStage,
      source_channel: 'website',
      conversation_title: `Lead: ${lead.name} – ${vehicleTitle || 'Anfrage'}`,
      status: needsApproval ? 'open' : 'in_progress',
      last_generated_output: generatedText,
      summary: `Automatisch erstellter Entwurf für ${lead.name}`,
    }).select().single();

    if (conversation) {
      // Save message
      await adminSupabase.from('sales_assistant_messages').insert({
        conversation_id: conversation.id,
        user_id: dealerUserId,
        role: 'assistant',
        message_type: 'email_reply',
        output_text: generatedText,
        approval_status: needsApproval ? 'draft' : 'approved',
        generation_mode: 'quick_reply',
        metadata: { auto_generated: true, lead_id: leadId, interests },
      });

      // Put email in outbox (pending_approval or queued)
      const { data: emailRow } = await adminSupabase.from('sales_email_outbox').insert({
        user_id: dealerUserId,
        to_email: lead.email,
        to_name: lead.name,
        subject: emailSubject,
        body_html: `<div style="font-family:sans-serif;line-height:1.6">${generatedText.replace(/\n/g, '<br>')}</div>`,
        body_text: generatedText,
        status: needsApproval ? 'pending_approval' : 'queued',
        conversation_id: conversation.id,
        lead_id: leadId,
      }).select().single();

      // Create follow-up task
      await adminSupabase.from('sales_assistant_tasks').insert({
        conversation_id: conversation.id,
        user_id: dealerUserId,
        title: `Follow-up mit ${lead.name}`,
        description: `Nachfassen bei ${lead.name} bzgl. ${vehicleTitle || 'Anfrage'}${interests.length > 0 ? `. Interessen: ${interests.join(', ')}` : ''}`,
        task_type: 'send_follow_up',
        priority: 'high',
        status: 'open',
        due_at: new Date(Date.now() + (profile.auto_follow_up_delay_hours || 24) * 3600000).toISOString(),
      });

      // If interested in test drive, create booking task
      if (lead.interested_test_drive) {
        await adminSupabase.from('sales_assistant_tasks').insert({
          conversation_id: conversation.id,
          user_id: dealerUserId,
          title: `Probefahrt-Termin für ${lead.name}`,
          description: `${lead.name} hat Interesse an einer Probefahrt für ${vehicleTitle || 'Fahrzeug'}. Termin vereinbaren.`,
          task_type: 'book_test_drive',
          priority: 'high',
          status: 'open',
        });
      }

      // If interested in trade-in, create valuation task
      if (lead.interested_trade_in) {
        await adminSupabase.from('sales_assistant_tasks').insert({
          conversation_id: conversation.id,
          user_id: dealerUserId,
          title: `Inzahlungnahme für ${lead.name}`,
          description: `${lead.name} möchte ein Fahrzeug in Zahlung geben. Details anfordern und Bewertung erstellen.`,
          task_type: 'create_trade_in',
          priority: 'medium',
          status: 'open',
        });
      }

      // Create notification with draft content
      await adminSupabase.from('sales_notifications').insert({
        user_id: dealerUserId,
        notification_type: 'new_lead',
        title: needsApproval ? '🔔 Neuer Lead – Entwurf zur Freigabe' : '✅ Neuer Lead – Automatisch beantwortet',
        body: `${lead.name} hat sich für "${vehicleTitle || 'ein Fahrzeug'}" interessiert.${interests.length > 0 ? ` Interessen: ${interests.join(', ')}.` : ''} ${needsApproval ? 'Bitte prüfe den Antwortentwurf.' : 'Die Antwort wurde automatisch gesendet.'}`,
        action_type: 'view_conversation',
        action_payload: {
          conversationId: conversation.id,
          emailId: emailRow?.id || null,
          draftSubject: emailSubject,
          draftBody: generatedText,
          leadName: lead.name,
          leadEmail: lead.email,
          interests,
        },
        requires_approval: needsApproval,
        approval_status: needsApproval ? 'pending' : 'approved',
        related_conversation_id: conversation.id,
        related_lead_id: leadId,
      });
    }

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
