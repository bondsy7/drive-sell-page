import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const body = await req.json();
    const {
      conversationId, projectId, leadId, vehicleContext, customerContext,
      journeyStage, sourceChannel, customerMessage, desiredOutputType,
      tone, extraFlags, selectedKnowledgeDocumentIds,
    } = body;

    // Credit deduction (1 credit)
    const { data: creditResult } = await adminSupabase.rpc('deduct_credits', {
      _user_id: user.id,
      _amount: 1,
      _action_type: 'admin_adjustment',
      _description: 'Sales Assistant: Antwort generieren',
    });
    if (!creditResult?.success) {
      return new Response(JSON.stringify({
        error: 'insufficient_credits',
        balance: creditResult?.balance || 0,
        cost: 1,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load dealer profile
    const { data: dealerProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    // Load sales assistant profile
    const { data: salesProfile } = await supabase.from('sales_assistant_profiles').select('*').eq('user_id', user.id).single();

    // Load vehicle context from project
    let vehicleData = vehicleContext || {};
    if (projectId && projectId !== 'none') {
      const { data: project } = await supabase.from('projects').select('vehicle_data, title').eq('id', projectId).single();
      if (project) vehicleData = project.vehicle_data;
    }

    // Load lead context
    let leadData = customerContext || {};
    if (leadId && leadId !== 'none') {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
      if (lead) {
        leadData = { name: lead.name, email: lead.email, phone: lead.phone, message: lead.message, vehicle_title: lead.vehicle_title };
      }
    }

    // Load journey template
    const { data: journeyTemplates } = await supabase.from('customer_journey_templates')
      .select('*').eq('journey_stage', journeyStage)
      .or(`user_id.eq.${user.id},is_global.eq.true`)
      .order('is_global', { ascending: true }).limit(1);
    const journeyTemplate = journeyTemplates?.[0];

    // Load knowledge documents
    let knowledgeContext = '';
    if (selectedKnowledgeDocumentIds?.length > 0) {
      const { data: docs } = await supabase.from('sales_knowledge_documents')
        .select('title, content_text, document_type')
        .in('id', selectedKnowledgeDocumentIds).eq('is_active', true);
      if (docs) knowledgeContext = docs.map((d: any) => `--- ${d.title} (${d.document_type}) ---\n${d.content_text || ''}`).join('\n\n');
    } else {
      const { data: docs } = await supabase.from('sales_knowledge_documents')
        .select('title, content_text, document_type')
        .eq('user_id', user.id).eq('is_active', true).limit(10);
      if (docs) knowledgeContext = docs.map((d: any) => `--- ${d.title} (${d.document_type}) ---\n${d.content_text || ''}`).join('\n\n');
    }

    // Load admin system prompt
    const { data: adminSettings } = await adminSupabase.from('admin_settings')
      .select('value').eq('key', 'sales_assistant_system_prompt').single();
    const systemPrompt = (adminSettings?.value as any)?.prompt ||
      'Du bist ein erfahrener KI-Verkaufsassistent für ein Autohaus. Hilf dem Verkäufer bei der Kundenkommunikation.';

    // Load admin objections
    const { data: objSettings } = await adminSupabase.from('admin_settings')
      .select('value').eq('key', 'sales_assistant_default_objections').single();

    // Build comprehensive prompt
    const promptBlocks: string[] = [];

    // 1. System role
    promptBlocks.push(systemPrompt);

    // 2. Dealer profile
    if (dealerProfile) {
      const dp = dealerProfile as any;
      promptBlocks.push(`## Händlerprofil\nAutohaus: ${dp.company_name || 'Nicht angegeben'}\nAnsprechpartner: ${dp.contact_name || ''}\nAdresse: ${dp.address || ''}, ${dp.postal_code || ''} ${dp.city || ''}\nTelefon: ${dp.phone || ''}\nE-Mail: ${dp.email || ''}\nWebsite: ${dp.website || ''}`);
    }

    // 3. Sales assistant profile
    if (salesProfile) {
      const sp = salesProfile as any;
      let block = '## Vertriebsprofil';
      if (sp.brand_voice) block += `\nMarkenstimme: ${sp.brand_voice}`;
      if (sp.sales_goal) block += `\nVerkaufsziel: ${sp.sales_goal}`;
      if (sp.preferred_cta) block += `\nBevorzugter CTA: ${sp.preferred_cta}`;
      if (sp.forbidden_phrases?.length) block += `\nVerbotene Formulierungen: ${sp.forbidden_phrases.join(', ')}`;
      if (sp.must_use_phrases?.length) block += `\nPflichtformulierungen: ${sp.must_use_phrases.join(', ')}`;
      if (sp.compliance_notes) block += `\nCompliance: ${sp.compliance_notes}`;
      if (sp.signature_name) block += `\nSignatur: ${sp.signature_name}${sp.signature_role ? ', ' + sp.signature_role : ''}`;
      promptBlocks.push(block);
    }

    // 4. Vehicle context
    if (vehicleData && Object.keys(vehicleData).length > 0) {
      const v = vehicleData.vehicle || vehicleData;
      promptBlocks.push(`## Fahrzeugkontext\n${JSON.stringify(v, null, 2)}`);
    }

    // 5. Customer context
    if (leadData && Object.keys(leadData).length > 0) {
      promptBlocks.push(`## Kundenkontext\n${JSON.stringify(leadData, null, 2)}`);
    }

    // 6. Journey stage
    if (journeyTemplate) {
      const jt = journeyTemplate as any;
      let block = `## Customer Journey Phase: ${journeyStage}`;
      block += `\nBeschreibung: ${jt.description || ''}`;
      block += `\nZiel: ${jt.recommended_goal || ''}`;
      block += `\nEmpfohlener CTA: ${jt.recommended_cta || ''}`;
      if (jt.recommended_objections?.length) block += `\nTypische Einwände: ${jt.recommended_objections.join(', ')}`;
      if (jt.default_prompt_block) block += `\n${jt.default_prompt_block}`;
      promptBlocks.push(block);
    }

    // 7. Knowledge context
    if (knowledgeContext) {
      promptBlocks.push(`## Hinterlegtes Firmenwissen\n${knowledgeContext}`);
    }

    // 8. Channel rules
    const channelRules: Record<string, string> = {
      email: 'Professionelle E-Mail mit Betreff, Begrüßung, Haupttext, CTA und Grußformel.',
      whatsapp: 'Kurz, direkt, natürlich für WhatsApp. Max 3-4 Sätze plus ein CTA. Emojis sparsam.',
      phone: 'Telefonleitfaden mit Einstieg, 2-3 Kernargumenten und Abschlussfrage.',
      website: 'Freundliche, professionelle Antwort auf eine Website-Anfrage.',
      walkin: 'Gesprächsleitfaden für einen Walk-In Kunden.',
    };
    promptBlocks.push(`## Kanal: ${sourceChannel}\n${channelRules[sourceChannel] || 'Passende Antwort für den gewählten Kanal.'}`);

    // 9. Output type
    const outputRules: Record<string, string> = {
      reply: 'Direkte Antwort auf die Kundenanfrage.',
      follow_up: 'Freundliche Follow-up Nachricht.',
      offer_summary: 'Angebotszusammenfassung: Fahrzeug, Vorteile, ggf. Finanzierung, nächster Schritt.',
      objection_reply: 'Einwandbehandlung: Verständnis zeigen, sachlich entkräften, zum nächsten Schritt überleiten.',
      call_script: 'Telefonleitfaden: Einstieg, Kernargumente, Abschlussfrage.',
      whatsapp_reply: 'Kurze WhatsApp-Nachricht.',
      email_reply: 'Professionelle E-Mail-Antwort.',
      closing_message: 'Abschluss-Nachricht mit klarer Handlungsaufforderung.',
      internal_note: 'Interne Handlungsempfehlung: Lead-Status, Interpretation, nächste Schritte.',
      summary: 'Zusammenfassung des bisherigen Gesprächsverlaufs.',
    };
    promptBlocks.push(`## Gewünschtes Format: ${desiredOutputType}\n${outputRules[desiredOutputType] || ''}`);

    // 10. Extra flags & compliance
    const flagLines: string[] = [];
    if (extraFlags?.pushFinancing) flagLines.push('- Erwähne aktiv Finanzierungsmöglichkeiten');
    if (extraFlags?.pushTestDrive) flagLines.push('- Biete aktiv eine Probefahrt an');
    if (extraFlags?.pushTradeIn) flagLines.push('- Spreche Inzahlungnahme an');
    if (extraFlags?.offerCallback) flagLines.push('- Biete einen Rückruf an');
    if (extraFlags?.prioritizeAvailable) flagLines.push('- Betone die sofortige Verfügbarkeit');
    if (extraFlags?.mentionPromotion) flagLines.push('- Erwähne aktuelle Aktionen');
    if (flagLines.length) promptBlocks.push(`## Zusätzliche Anweisungen\n${flagLines.join('\n')}`);

    promptBlocks.push(`## Tonalität: ${tone || 'freundlich'}`);
    promptBlocks.push(`## WICHTIGE REGELN\n- Erfinde KEINE falschen technischen Fahrzeugangaben.\n- Mache KEINE rechtlich problematischen Aussagen.\n- Priorisiere hinterlegte Firmenvorgaben.\n- Wenn dir Informationen fehlen, antworte vorsichtig und verkaufsfördernd ohne falsche Fakten.\n- Antworte auf Deutsch.`);

    const fullPrompt = promptBlocks.join('\n\n');

    // Call Gemini
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: fullPrompt + '\n\n## Kundenanfrage/Situation:\n' + customerMessage +
                '\n\nAntworte im folgenden JSON-Format:\n{\n  "generatedText": "Die fertige Antwort/Nachricht",\n  "summary": "Kurze Zusammenfassung der Situation",\n  "recommendedNextSteps": [{"title": "...", "type": "call_customer|send_offer|send_follow_up|book_test_drive|send_financing|other", "description": "..."}],\n  "usedContext": [{"source": "...", "title": "...", "snippet": "..."}],\n  "confidenceNotes": "Hinweise zur Qualität/Vollständigkeit der Antwort"\n}'
            }],
          }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096, responseMimeType: 'application/json' },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini error:', errText);
      throw new Error('AI generation failed');
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = {
        generatedText: responseText,
        summary: '',
        recommendedNextSteps: [],
        usedContext: [],
        confidenceNotes: 'Antwort konnte nicht strukturiert geparst werden.',
      };
    }

    // Save conversation
    let convId = conversationId;
    if (!convId) {
      const { data: conv } = await supabase.from('sales_assistant_conversations').insert({
        user_id: user.id,
        project_id: (projectId && projectId !== 'none') ? projectId : null,
        lead_id: (leadId && leadId !== 'none') ? leadId : null,
        vehicle_context: vehicleData,
        customer_context: leadData,
        journey_stage: journeyStage,
        source_channel: sourceChannel,
        conversation_title: leadData?.name ? `Gespräch mit ${leadData.name}` : `Sales ${new Date().toLocaleDateString('de-DE')}`,
        status: 'in_progress',
        summary: parsedResponse.summary,
        last_generated_output: parsedResponse.generatedText,
        next_action: parsedResponse.recommendedNextSteps?.[0]?.title || null,
      } as any).select('id').single();
      convId = (conv as any)?.id;
    } else {
      await supabase.from('sales_assistant_conversations').update({
        summary: parsedResponse.summary,
        last_generated_output: parsedResponse.generatedText,
        updated_at: new Date().toISOString(),
        next_action: parsedResponse.recommendedNextSteps?.[0]?.title || null,
      } as any).eq('id', convId);
    }

    // Save messages
    let messageId = null;
    if (convId) {
      await supabase.from('sales_assistant_messages').insert({
        conversation_id: convId, user_id: user.id, role: 'user',
        message_type: desiredOutputType, input_text: customerMessage, channel: sourceChannel,
      } as any);

      const { data: msg } = await supabase.from('sales_assistant_messages').insert({
        conversation_id: convId, user_id: user.id, role: 'assistant',
        message_type: desiredOutputType, output_text: parsedResponse.generatedText,
        channel: sourceChannel, approval_status: 'draft', generation_mode: 'quick_reply',
        metadata: { usedContext: parsedResponse.usedContext, confidenceNotes: parsedResponse.confidenceNotes },
      } as any).select('id').single();
      messageId = (msg as any)?.id;

      // Save tasks
      if (parsedResponse.recommendedNextSteps?.length) {
        const taskRows = parsedResponse.recommendedNextSteps.map((step: any) => ({
          conversation_id: convId, user_id: user.id,
          title: step.title, description: step.description,
          task_type: step.type || 'other', priority: 'medium', status: 'open',
        }));
        await supabase.from('sales_assistant_tasks').insert(taskRows as any);
      }
    }

    return new Response(JSON.stringify({
      ...parsedResponse, conversationId: convId, messageId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error('generate-sales-response error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
