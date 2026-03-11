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
    const [notifResult, tasksResult, convsResult, profileResult, bookingsResult, quotesResult, tradeInsResult, leadsResult] = await Promise.all([
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
    ]);

    const notifications = notifResult.data || [];
    const tasks = tasksResult.data || [];
    const conversations = convsResult.data || [];
    const profile = profileResult.data;
    const bookings = bookingsResult.data || [];
    const quotes = quotesResult.data || [];
    const tradeIns = tradeInsResult.data || [];
    const leads = leadsResult.data || [];

    const pendingApprovals = notifications.filter((n: any) => n.requires_approval && n.approval_status === 'pending');
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter((b: any) => b.booking_date === today);
    const upcomingBookings = bookings.filter((b: any) => b.booking_date > today);

    const systemPrompt = `Du bist der interne Verkaufsassistent-Chatbot für ein Autohaus. Du hast Zugriff auf folgende Systeme und Daten:

## DEINE FÄHIGKEITEN
1. **Probefahrten verwalten**: Du siehst alle Termine, kannst über anstehende Probefahrten informieren und Empfehlungen geben.
2. **Angebote überblicken**: Du siehst offene Angebote (Entwürfe & gesendete) und kannst den Händler erinnern.
3. **Inzahlungnahmen**: Du siehst laufende Bewertungen und kannst Empfehlungen zur Preisgestaltung geben.
4. **Leads & Gespräche**: Du informierst über neue Leads und den Status aktiver Verkaufsgespräche.
5. **Aufgaben & Freigaben**: Du zeigst offene Aufgaben und ausstehende Freigaben.
6. **E-Mail-Entwürfe**: Du kannst Vorschläge für E-Mail-Texte an Kunden machen.

## WICHTIG: KEINE HALLUZINATIONEN!
Erfinde NIEMALS Daten, Zahlen, Kundennamen oder Details! Antworte NUR basierend auf den unten aufgelisteten Daten.
Wenn keine Daten vorhanden sind, sage das ehrlich: "Aktuell steht nichts an. Alles erledigt! 🎉"

## AKTUELLER STATUS (${new Date().toLocaleDateString('de-DE')})
- ${notifications.length} ungelesene Benachrichtigungen
- ${pendingApprovals.length} ausstehende Freigaben
- ${tasks.length} offene Aufgaben
- ${conversations.length} aktive Gespräche
- ${bookings.length} anstehende Probefahrten
- ${quotes.length} offene Angebote
- ${tradeIns.length} laufende Inzahlungnahmen
- ${leads.length} Leads insgesamt

## HEUTIGE PROBEFAHRTEN (${todayBookings.length})
${todayBookings.length > 0 ? todayBookings.map((b: any) => `- ${b.booking_time?.slice(0, 5)} Uhr: ${b.customer_name} – ${b.vehicle_title || 'Fahrzeug nicht angegeben'} (Status: ${b.status})${b.customer_phone ? ` Tel: ${b.customer_phone}` : ''}`).join('\n') : 'Keine Probefahrten heute.'}

## KOMMENDE PROBEFAHRTEN (${upcomingBookings.length})
${upcomingBookings.length > 0 ? upcomingBookings.slice(0, 10).map((b: any) => `- ${b.booking_date} ${b.booking_time?.slice(0, 5)}: ${b.customer_name} – ${b.vehicle_title || 'k.A.'} (${b.status})`).join('\n') : 'Keine weiteren Termine.'}

## OFFENE ANGEBOTE (${quotes.length})
${quotes.length > 0 ? quotes.slice(0, 10).map((q: any) => `- ${q.vehicle_title || 'Ohne Titel'}: ${q.final_price ? q.final_price.toLocaleString('de-DE') + ' €' : 'k.A.'} (Status: ${q.status})${q.valid_until ? ` – gültig bis ${q.valid_until}` : ''}`).join('\n') : 'Keine offenen Angebote.'}

## INZAHLUNGNAHMEN (${tradeIns.length})
${tradeIns.length > 0 ? tradeIns.map((t: any) => `- ${t.vehicle_make || ''} ${t.vehicle_model || ''} ${t.vehicle_year || ''}: ${t.estimated_value_min?.toLocaleString('de-DE') || '?'} – ${t.estimated_value_max?.toLocaleString('de-DE') || '?'} € (${t.condition}, ${t.mileage_km?.toLocaleString('de-DE') || '?'} km)`).join('\n') : 'Keine laufenden Bewertungen.'}

## NEUE LEADS (letzte 10)
${leads.length > 0 ? leads.slice(0, 10).map((l: any) => `- ${l.name} (${l.email})${l.vehicle_title ? ` – Interesse an: ${l.vehicle_title}` : ''}${l.phone ? ` Tel: ${l.phone}` : ''} (${new Date(l.created_at).toLocaleDateString('de-DE')})`).join('\n') : 'Keine Leads vorhanden.'}

${pendingApprovals.length > 0 ? `\n## AUSSTEHENDE FREIGABEN\n${pendingApprovals.map((n: any) => `- ${n.title}: ${n.body || ''}`).join('\n')}` : ''}

${tasks.length > 0 ? `\n## OFFENE AUFGABEN\n${tasks.slice(0, 10).map((t: any) => `- [${t.priority}] ${t.title} (Typ: ${t.task_type || 'sonstig'})${t.due_at ? ` (fällig: ${new Date(t.due_at).toLocaleDateString('de-DE')})` : ''}`).join('\n')}` : ''}

${conversations.length > 0 ? `\n## AKTIVE GESPRÄCHE\n${conversations.slice(0, 5).map((c: any) => `- ${c.conversation_title || 'Unbenannt'} (Status: ${c.status}, Phase: ${c.journey_stage})${c.next_action ? ` → ${c.next_action}` : ''}`).join('\n')}` : ''}

## VERHALTEN
- Antworte immer auf Deutsch, knapp und hilfreich
- Sei proaktiv: Schlage nächste Schritte vor
- Wenn der User eine Freigabe erteilt, bestätige das
- Wenn nach einer Zusammenfassung gefragt wird, strukturiere die Übersicht
- Für E-Mail-Entwürfe: Erstelle professionelle, personalisierte Texte basierend auf den Kundendaten
- Für Probefahrt-Vorschläge: Beachte die heutigen und kommenden Termine
- Für Angebots-Beratung: Berücksichtige Inzahlungnahme-Werte wenn vorhanden
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
    if (userText.includes('freigabe') || userText.includes('genehmig') || userText.includes('absenden')) {
      if (pendingApprovals.length > 0) {
        await supabase.from('sales_notifications').update({
          approval_status: 'approved', is_read: true,
        }).in('id', pendingApprovals.map((n: any) => n.id));
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
    const assistantContent = aiResult.choices?.[0]?.message?.content || "Keine Antwort erhalten.";

    await supabase.from('sales_chat_messages').insert({
      user_id: user.id, role: 'assistant', content: assistantContent,
    });

    return new Response(JSON.stringify({ content: assistantContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sales-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
