import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getCustomPrompt(sb: any, key: string, defaultPrompt: string): Promise<string> {
  try {
    const { data } = await sb.from("admin_settings").select("value").eq("key", "ai_prompts").single();
    const override = (data?.value as Record<string, string>)?.[key];
    if (override && override.trim() !== "" && override.trim().toLowerCase() !== "default") return override;
  } catch (e) { console.warn("Custom prompt load failed:", e); }
  return defaultPrompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { messages } = await req.json();

    // Load all context in parallel
    const [notifResult, tasksResult, convsResult, profileResult, bookingsResult, quotesResult, tradeInsResult, leadsResult, emailsResult, dealerProfileResult] = await Promise.all([
      supabase.from('sales_notifications').select('*')
        .eq('user_id', user.id).eq('is_read', false)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('sales_assistant_tasks').select('*')
        .eq('user_id', user.id).eq('status', 'open')
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('sales_assistant_conversations').select('*')
        .eq('user_id', user.id).in('status', ['open', 'in_progress', 'waiting'])
        .order('updated_at', { ascending: false }).limit(10),
      supabase.from('sales_assistant_profiles').select('*')
        .eq('user_id', user.id).single(),
      supabase.from('test_drive_bookings').select('*')
        .eq('user_id', user.id).in('status', ['pending', 'confirmed'])
        .order('booking_date', { ascending: true }).limit(20),
      supabase.from('sales_quotes').select('*')
        .eq('user_id', user.id).in('status', ['draft', 'sent'])
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('trade_in_valuations').select('*')
        .eq('user_id', user.id).in('status', ['draft', 'sent'])
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('leads').select('*')
        .eq('dealer_user_id', user.id)
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('sales_email_outbox').select('*')
        .eq('user_id', user.id).in('status', ['queued', 'sent'])
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('*')
        .eq('id', user.id).single(),
    ]);

    const notifications = notifResult.data || [];
    const tasks = tasksResult.data || [];
    const conversations = convsResult.data || [];
    const profile = profileResult.data;
    const bookings = bookingsResult.data || [];
    const quotes = quotesResult.data || [];
    const tradeIns = tradeInsResult.data || [];
    const leads = leadsResult.data || [];
    const emails = emailsResult.data || [];
    const dealerProfile = dealerProfileResult.data;

    const pendingApprovals = notifications.filter((n: any) => n.requires_approval && n.approval_status === 'pending');
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter((b: any) => b.booking_date === today);
    const upcomingBookings = bookings.filter((b: any) => b.booking_date > today);

    const DEFAULT_SALES_CHAT_INTRO = `Du bist der interne Verkaufsassistent-Chatbot für ein Autohaus. Du hast Zugriff auf folgende Systeme und Daten:`;
    const chatIntro = await getCustomPrompt(adminSupabase, "sales_chat", DEFAULT_SALES_CHAT_INTRO);

    const systemPrompt = `${chatIntro}

## DEINE FÄHIGKEITEN
1. **Probefahrten verwalten**: Du siehst alle Termine, kannst über anstehende Probefahrten informieren und Empfehlungen geben.
2. **Angebote überblicken**: Du siehst offene Angebote (Entwürfe & gesendete) und kannst den Händler erinnern.
3. **Inzahlungnahmen**: Du siehst laufende Bewertungen und kannst Empfehlungen zur Preisgestaltung geben.
4. **Leads & Gespräche**: Du informierst über neue Leads und den Status aktiver Verkaufsgespräche.
5. **Aufgaben & Freigaben**: Du zeigst offene Aufgaben und ausstehende Freigaben.
6. **E-Mails verfassen & senden**: Du kannst E-Mail-Entwürfe erstellen und in die Outbox legen. Nutze das Kommando-Format.
7. **Inzahlungnahme-Bewertung per KI**: Du kannst basierend auf Fahrzeugdaten eine Marktpreisschätzung abgeben.

## AKTIONSKOMMANDOS
Wenn der Nutzer eine Aktion wünscht, füge am Ende deiner Antwort einen speziellen Block ein:

### E-Mail senden
Wenn der Nutzer sagt "Schreib eine E-Mail an [Kunde]" oder "Sende [Kunde] eine Nachricht":
\`\`\`action:email
to_email: kunde@email.de
to_name: Max Mustermann
subject: Ihr Angebot bei [Autohaus]
body: Sehr geehrter Herr Mustermann, ...
\`\`\`

### Inzahlungnahme schätzen
Wenn der Nutzer fragt "Was ist ein [Fahrzeug] wert?" oder "Schätze den Wert":
\`\`\`action:trade_in_estimate
vehicle_make: VW
vehicle_model: Golf
vehicle_year: 2019
mileage_km: 85000
condition: good
\`\`\`

### Probefahrt buchen
Wenn der Nutzer sagt "Buche eine Probefahrt für [Kunde]":
\`\`\`action:book_test_drive
customer_name: Max Mustermann
customer_email: max@email.de
customer_phone: 0171-1234567
vehicle_title: BMW 320i Touring
booking_date: 2026-03-15
booking_time: 14:00
\`\`\`

### Angebot erstellen
Wenn der Nutzer sagt "Erstelle ein Angebot für [Fahrzeug]":
\`\`\`action:create_quote
vehicle_title: BMW 320i Touring
base_price: 35990
discount_amount: 1500
trade_in_value: 8000
valid_days: 14
\`\`\`

## WICHTIG: KEINE HALLUZINATIONEN!
Erfinde NIEMALS Daten, Zahlen, Kundennamen oder Details! Antworte NUR basierend auf den unten aufgelisteten Daten.
Wenn keine Daten vorhanden sind, sage das ehrlich: "Aktuell steht nichts an. Alles erledigt! 🎉"

## HÄNDLERPROFIL
${dealerProfile ? `- Firma: ${dealerProfile.company_name || 'k.A.'}
- Kontakt: ${dealerProfile.contact_name || 'k.A.'}
- E-Mail: ${dealerProfile.email || 'k.A.'}
- Telefon: ${dealerProfile.phone || 'k.A.'}` : 'Kein Händlerprofil hinterlegt.'}

## AKTUELLER STATUS (${new Date().toLocaleDateString('de-DE')})
- ${notifications.length} ungelesene Benachrichtigungen
- ${pendingApprovals.length} ausstehende Freigaben
- ${tasks.length} offene Aufgaben
- ${conversations.length} aktive Gespräche
- ${bookings.length} anstehende Probefahrten
- ${quotes.length} offene Angebote
- ${tradeIns.length} laufende Inzahlungnahmen
- ${leads.length} Leads insgesamt
- ${emails.length} E-Mails in der Outbox

## HEUTIGE PROBEFAHRTEN (${todayBookings.length})
${todayBookings.length > 0 ? todayBookings.map((b: any) => `- ${b.booking_time?.slice(0, 5)} Uhr: ${b.customer_name} – ${b.vehicle_title || 'Fahrzeug nicht angegeben'} (Status: ${b.status})${b.customer_phone ? ` Tel: ${b.customer_phone}` : ''}`).join('\n') : 'Keine Probefahrten heute.'}

## KOMMENDE PROBEFAHRTEN (${upcomingBookings.length})
${upcomingBookings.length > 0 ? upcomingBookings.slice(0, 10).map((b: any) => `- ${b.booking_date} ${b.booking_time?.slice(0, 5)}: ${b.customer_name} – ${b.vehicle_title || 'k.A.'} (${b.status})`).join('\n') : 'Keine weiteren Termine.'}

## OFFENE ANGEBOTE (${quotes.length})
${quotes.length > 0 ? quotes.slice(0, 10).map((q: any) => `- ${q.vehicle_title || 'Ohne Titel'}: ${q.final_price ? q.final_price.toLocaleString('de-DE') + ' €' : 'k.A.'} (Status: ${q.status})${q.valid_until ? ` – gültig bis ${q.valid_until}` : ''}`).join('\n') : 'Keine offenen Angebote.'}

## INZAHLUNGNAHMEN (${tradeIns.length})
${tradeIns.length > 0 ? tradeIns.map((t: any) => `- ${t.vehicle_make || ''} ${t.vehicle_model || ''} ${t.vehicle_year || ''}: ${t.estimated_value_min?.toLocaleString('de-DE') || '?'} – ${t.estimated_value_max?.toLocaleString('de-DE') || '?'} € (${t.condition}, ${t.mileage_km?.toLocaleString('de-DE') || '?'} km)`).join('\n') : 'Keine laufenden Bewertungen.'}

## NEUE LEADS (letzte 10)
${leads.length > 0 ? leads.slice(0, 10).map((l: any) => {
  const interests: string[] = [];
  if (l.interested_test_drive) interests.push('Probefahrt');
  if (l.interested_trade_in) interests.push('Inzahlungnahme');
  if (l.interested_leasing) interests.push('Leasing');
  if (l.interested_financing) interests.push('Finanzierung');
  if (l.interested_purchase) interests.push('Kauf');
  return `- ${l.name} (${l.email})${l.vehicle_title ? ` – Fahrzeug: ${l.vehicle_title}` : ''}${interests.length > 0 ? ` – Interessen: ${interests.join(', ')}` : ''}${l.phone ? ` Tel: ${l.phone}` : ''} (${new Date(l.created_at).toLocaleDateString('de-DE')})`;
}).join('\n') : 'Keine Leads vorhanden.'}

## E-MAIL OUTBOX (letzte ${emails.length})
${emails.length > 0 ? emails.map((e: any) => `- An: ${e.to_name || e.to_email} | Betreff: ${e.subject} | Status: ${e.status} | ${new Date(e.created_at).toLocaleDateString('de-DE')}`).join('\n') : 'Keine E-Mails in der Outbox.'}

${pendingApprovals.length > 0 ? `\n## AUSSTEHENDE FREIGABEN\n${pendingApprovals.map((n: any) => `- ${n.title}: ${n.body || ''}`).join('\n')}` : ''}

${tasks.length > 0 ? `\n## OFFENE AUFGABEN\n${tasks.slice(0, 10).map((t: any) => `- [${t.priority}] ${t.title} (Typ: ${t.task_type || 'sonstig'})${t.due_at ? ` (fällig: ${new Date(t.due_at).toLocaleDateString('de-DE')})` : ''}`).join('\n')}` : ''}

${conversations.length > 0 ? `\n## AKTIVE GESPRÄCHE\n${conversations.slice(0, 5).map((c: any) => `- ${c.conversation_title || 'Unbenannt'} (Status: ${c.status}, Phase: ${c.journey_stage})${c.next_action ? ` → ${c.next_action}` : ''}`).join('\n')}` : ''}

## VERHALTEN
- Antworte immer auf Deutsch, knapp und hilfreich
- Sei PROAKTIV: Wenn ein neuer Lead Interesse an Probefahrt hat, schlage sofort vor einen Termin zu buchen. Bei Leasing/Finanzierungsinteresse, biete an ein Angebot zu erstellen. Bei Inzahlungnahme, frage nach Details zum Altfahrzeug.
- Wenn du etwas nicht findest oder dir Informationen fehlen (z.B. Fahrzeugpreis für ein Angebot), frage den Nutzer gezielt danach statt zu raten
- Wenn der User eine Freigabe erteilt, bestätige das
- Wenn nach einer Zusammenfassung gefragt wird, strukturiere die Übersicht
- Für E-Mail-Entwürfe: Erstelle professionelle, personalisierte Texte basierend auf den Kundendaten und verwende die Aktionskommandos
- Für Probefahrt-Vorschläge: Beachte die heutigen und kommenden Termine
- Für Angebots-Beratung: Berücksichtige Inzahlungnahme-Werte wenn vorhanden. Wenn der Preis nicht bekannt ist, frage danach.
- Für Inzahlungnahme-Schätzungen: Gib realistische Marktpreise basierend auf Fahrzeugdaten an
- Nutze die Aktionskommandos (action:email, action:trade_in_estimate, action:book_test_drive, action:create_quote) um Aktionen auszuführen
- Wenn ein Lead nach Leasing/Finanzierung fragt aber kein Preis bekannt ist, sage dem Nutzer dass du den Grundpreis brauchst um ein Angebot zu erstellen
${profile?.assistant_name ? `Du heißt "${profile.assistant_name}".` : ''}`;

    // Save user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === 'user') {
      await supabase.from('sales_chat_messages').insert({
        user_id: user.id, role: 'user', content: lastUserMsg.content,
      });
    }

    // Check for approval commands
    const userText = (lastUserMsg?.content || '').toLowerCase();
    if (userText.includes('freigabe') || userText.includes('genehmig') || userText.includes('absenden') || userText.includes('freigeben')) {
      if (pendingApprovals.length > 0) {
        // Approve notifications
        const approvalIds = pendingApprovals.map((n: any) => n.id);
        await supabase.from('sales_notifications').update({
          approval_status: 'approved', is_read: true,
        }).in('id', approvalIds);

        // Queue pending emails for sending
        for (const n of pendingApprovals) {
          const payload = n.action_payload || {};
          if (payload.emailId) {
            await supabase.from('sales_email_outbox').update({ status: 'queued', error_message: null }).eq('id', payload.emailId);
            await fetch(`${supabaseUrl}/functions/v1/process-sales-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ emailId: payload.emailId }),
            }).catch((error) => console.error('process-sales-email invoke error:', error));
          }
          if (payload.conversationId) {
            await supabase.from('sales_assistant_conversations').update({ status: 'in_progress' }).eq('id', payload.conversationId);
          }
        }
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht, bitte versuche es gleich nochmal." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Guthaben aufgebraucht." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    let assistantContent = aiResult.choices?.[0]?.message?.content || "Keine Antwort erhalten.";

    // Parse and execute action commands from the AI response
    const actions: string[] = [];

    // Parse email actions
    const emailRegex = /```action:email\n([\s\S]*?)```/g;
    let emailMatch;
    while ((emailMatch = emailRegex.exec(assistantContent)) !== null) {
      const block = emailMatch[1];
      const toEmail = block.match(/to_email:\s*(.+)/)?.[1]?.trim();
      const toName = block.match(/to_name:\s*(.+)/)?.[1]?.trim();
      const subject = block.match(/subject:\s*(.+)/)?.[1]?.trim();
      const bodyMatch = block.match(/body:\s*([\s\S]*?)$/);
      const body = bodyMatch?.[1]?.trim();

      if (toEmail && subject && body) {
        const { data: queuedEmail, error } = await supabase.from('sales_email_outbox').insert({
          user_id: user.id,
          to_email: toEmail,
          to_name: toName || null,
          subject: subject,
          body_html: `<div style="font-family:sans-serif;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>`,
          body_text: body,
          status: 'queued',
        }).select('id').single();

        if (!error) {
          if (queuedEmail?.id) {
            await fetch(`${supabaseUrl}/functions/v1/process-sales-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({ emailId: queuedEmail.id }),
            }).catch((invokeError) => console.error('process-sales-email invoke error:', invokeError));
          }
          actions.push(`📧 E-Mail an ${toName || toEmail} in die Outbox gelegt.`);
        }
      }
    }

    // Parse trade-in estimate actions
    const tradeInRegex = /```action:trade_in_estimate\n([\s\S]*?)```/g;
    let tradeInMatch;
    while ((tradeInMatch = tradeInRegex.exec(assistantContent)) !== null) {
      const block = tradeInMatch[1];
      const make = block.match(/vehicle_make:\s*(.+)/)?.[1]?.trim();
      const model = block.match(/vehicle_model:\s*(.+)/)?.[1]?.trim();
      const year = parseInt(block.match(/vehicle_year:\s*(\d+)/)?.[1] || '0');
      const mileage = parseInt(block.match(/mileage_km:\s*(\d+)/)?.[1] || '0');
      const condition = block.match(/condition:\s*(.+)/)?.[1]?.trim() || 'good';

      if (make && model && year) {
        // Use AI to estimate value
        const estimateResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: `Du bist ein Fahrzeugbewertungs-Experte für den deutschen Markt. Gib eine realistische Marktpreisschätzung ab. Antworte NUR im JSON-Format: {"min": number, "max": number, "notes": "string"}. Die Werte sind in Euro. Berücksichtige: Marke, Modell, Baujahr, Kilometerstand und Zustand. Orientiere dich an deutschen Gebrauchtwagenportalen (mobile.de, AutoScout24).` },
              { role: "user", content: `Schätze den Marktwert: ${make} ${model}, Baujahr ${year}, ${mileage.toLocaleString('de-DE')} km, Zustand: ${condition}` },
            ],
            stream: false,
          }),
        });

        if (estimateResp.ok) {
          const estimateResult = await estimateResp.json();
          const estimateText = estimateResult.choices?.[0]?.message?.content || '';
          try {
            const jsonMatch = estimateText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const estimate = JSON.parse(jsonMatch[0]);
              // Save to DB
              await supabase.from('trade_in_valuations').insert({
                user_id: user.id,
                vehicle_make: make,
                vehicle_model: model,
                vehicle_year: year,
                mileage_km: mileage,
                condition: condition,
                estimated_value_min: estimate.min,
                estimated_value_max: estimate.max,
                notes: `KI-Schätzung: ${estimate.notes || ''}`,
                status: 'draft',
              });
              actions.push(`🚗 Inzahlungnahme-Bewertung erstellt: ${make} ${model} → ${estimate.min.toLocaleString('de-DE')} – ${estimate.max.toLocaleString('de-DE')} €`);
            }
          } catch (e) {
            console.error("Failed to parse trade-in estimate:", e);
          }
        }
      }
    }

    // Parse test drive booking actions
    const testDriveRegex = /```action:book_test_drive\n([\s\S]*?)```/g;
    let tdMatch;
    while ((tdMatch = testDriveRegex.exec(assistantContent)) !== null) {
      const block = tdMatch[1];
      const customerName = block.match(/customer_name:\s*(.+)/)?.[1]?.trim();
      const customerEmail = block.match(/customer_email:\s*(.+)/)?.[1]?.trim();
      const customerPhone = block.match(/customer_phone:\s*(.+)/)?.[1]?.trim();
      const vehicleTitle = block.match(/vehicle_title:\s*(.+)/)?.[1]?.trim();
      const bookingDate = block.match(/booking_date:\s*(.+)/)?.[1]?.trim();
      const bookingTime = block.match(/booking_time:\s*(.+)/)?.[1]?.trim();

      if (customerName && bookingDate && bookingTime) {
        const { error } = await supabase.from('test_drive_bookings').insert({
          user_id: user.id,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          vehicle_title: vehicleTitle || null,
          booking_date: bookingDate,
          booking_time: bookingTime,
          status: 'pending',
        });
        if (!error) {
          actions.push(`📅 Probefahrt gebucht: ${customerName} am ${bookingDate} um ${bookingTime}`);
        }
      }
    }

    // Parse quote creation actions
    const quoteRegex = /```action:create_quote\n([\s\S]*?)```/g;
    let qMatch;
    while ((qMatch = quoteRegex.exec(assistantContent)) !== null) {
      const block = qMatch[1];
      const vehicleTitle = block.match(/vehicle_title:\s*(.+)/)?.[1]?.trim();
      const basePrice = parseInt(block.match(/base_price:\s*(\d+)/)?.[1] || '0');
      const discountAmount = parseInt(block.match(/discount_amount:\s*(\d+)/)?.[1] || '0');
      const tradeInValue = parseInt(block.match(/trade_in_value:\s*(\d+)/)?.[1] || '0');
      const validDays = parseInt(block.match(/valid_days:\s*(\d+)/)?.[1] || '14');

      if (vehicleTitle && basePrice > 0) {
        const finalPrice = basePrice - discountAmount - tradeInValue;
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + validDays);

        const { error } = await supabase.from('sales_quotes').insert({
          user_id: user.id,
          vehicle_title: vehicleTitle,
          base_price: basePrice,
          discount_amount: discountAmount,
          trade_in_value: tradeInValue,
          final_price: finalPrice,
          valid_until: validUntil.toISOString().split('T')[0],
          status: 'draft',
        });
        if (!error) {
          actions.push(`📋 Angebot erstellt: ${vehicleTitle} für ${finalPrice.toLocaleString('de-DE')} €`);
        }
      }
    }

    // Remove action blocks from visible response and append action confirmations
    let cleanContent = assistantContent
      .replace(/```action:(email|trade_in_estimate|book_test_drive|create_quote)\n[\s\S]*?```/g, '')
      .trim();

    if (actions.length > 0) {
      cleanContent += '\n\n---\n**Ausgeführte Aktionen:**\n' + actions.map(a => `- ${a}`).join('\n');
    }

    await supabase.from('sales_chat_messages').insert({
      user_id: user.id, role: 'assistant', content: cleanContent,
    });

    return new Response(JSON.stringify({ content: cleanContent, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sales-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
