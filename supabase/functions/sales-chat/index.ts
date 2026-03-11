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

    // Load context: pending notifications, open tasks, recent conversations
    const [notifResult, tasksResult, convsResult, profileResult] = await Promise.all([
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
    ]);

    const notifications = notifResult.data || [];
    const tasks = tasksResult.data || [];
    const conversations = convsResult.data || [];
    const profile = profileResult.data;

    // Build system context
    const pendingApprovals = notifications.filter((n: any) => n.requires_approval && n.approval_status === 'pending');
    const unreadCount = notifications.length;
    const openTaskCount = tasks.length;
    const activeConvCount = conversations.length;

    const systemPrompt = `Du bist der interne Verkaufsassistent-Chatbot für ein Autohaus. Du informierst den Händler über:
- Offene Aufgaben und fällige Follow-ups
- Neue Leads und automatisch erstellte Entwürfe (Freigaben)
- Zusammenfassungen der Verkaufsaktivitäten
- Empfehlungen für nächste Schritte

**WICHTIG: Erfinde NIEMALS Daten, Zahlen oder Details! Antworte NUR basierend auf den unten aufgelisteten Daten. Wenn keine Daten vorhanden sind, sage das ehrlich.**

Aktueller Status:
- ${unreadCount} ungelesene Benachrichtigungen
- ${pendingApprovals.length} ausstehende Freigaben
- ${openTaskCount} offene Aufgaben
- ${activeConvCount} aktive Gespräche

${pendingApprovals.length > 0 ? `\nAusstehende Freigaben:\n${pendingApprovals.map((n: any) => `- ${n.title}: ${n.body || ''}`).join('\n')}` : '\nKeine ausstehenden Freigaben.'}

${tasks.length > 0 ? `\nOffene Aufgaben:\n${tasks.slice(0, 10).map((t: any) => `- [${t.priority}] ${t.title} (Typ: ${t.task_type || 'sonstig'})${t.due_at ? ` (fällig: ${new Date(t.due_at).toLocaleDateString('de-DE')})` : ''} ${t.description ? `– ${t.description}` : ''}`).join('\n')}` : '\nKeine offenen Aufgaben vorhanden.'}

${conversations.length > 0 ? `\nAktive Gespräche:\n${conversations.slice(0, 5).map((c: any) => `- ${c.conversation_title || 'Unbenannt'} (Status: ${c.status}, Phase: ${c.journey_stage})${c.next_action ? ` → Nächster Schritt: ${c.next_action}` : ''}`).join('\n')}` : '\nKeine aktiven Gespräche vorhanden.'}

Antworte immer auf Deutsch. Sei knapp, hilfreich und proaktiv. Wenn der User eine Freigabe erteilt, bestätige das.
Wenn der User nach einer Zusammenfassung fragt, gib eine strukturierte Übersicht NUR basierend auf den obigen Daten.
Wenn es nichts gibt, sage: "Aktuell steht nichts an. Alles erledigt! 🎉"
${profile?.assistant_name ? `Du heißt "${profile.assistant_name}".` : ''}`;

    // Save user message
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg?.role === 'user') {
      await supabase.from('sales_chat_messages').insert({
        user_id: user.id,
        role: 'user',
        content: lastUserMsg.content,
      });
    }

    // Check for approval commands
    const userText = (lastUserMsg?.content || '').toLowerCase();
    if (userText.includes('freigabe') || userText.includes('genehmig') || userText.includes('absenden')) {
      // Approve pending notifications
      if (pendingApprovals.length > 0) {
        await supabase.from('sales_notifications').update({
          approval_status: 'approved',
          is_read: true,
        }).in('id', pendingApprovals.map((n: any) => n.id));
      }
    }

    // Stream response from AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
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
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sales-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
