import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bell, CheckCircle2, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Notification {
  id: string;
  title: string;
  body: string | null;
  notification_type: string;
  is_read: boolean;
  requires_approval: boolean;
  approval_status: string;
  action_payload: any;
  created_at: string;
}

export default function SalesChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('sales_notifications' as any)
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(50);
    setNotifications((data as any) || []);
  }, [user]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('sales_chat_messages' as any)
      .select('*').eq('user_id', user.id)
      .order('created_at', { ascending: true }).limit(100);
    const msgs = (data as any) || [];
    if (msgs.length > 0) {
      setMessages(msgs.map((m: any) => ({ role: m.role, content: m.content })));
    } else {
      setMessages([{ role: 'assistant', content: '👋 Hallo! Ich bin dein Verkaufsassistent. Ich halte dich über Leads, Aufgaben und Freigaben auf dem Laufenden. Was möchtest du wissen?' }]);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
    loadHistory();
  }, [loadNotifications, loadHistory]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('sales-chat-notifs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sales_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        const n = payload.new as Notification;
        setNotifications(prev => [n, ...prev]);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔔 **${n.title}**\n\n${n.body || ''}${n.requires_approval ? '\n\n_Antworte mit "Freigabe" um zu genehmigen._' : ''}`,
        }]);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Nicht eingeloggt');

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: allMessages }),
        }
      );

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Fehler');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && prev.length === allMessages.length + 1) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Save assistant message
      if (assistantSoFar) {
        await supabase.from('sales_chat_messages' as any).insert({
          user_id: user!.id, role: 'assistant', content: assistantSoFar,
        });
      }

      loadNotifications();
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Fehler aufgetreten. Bitte versuche es erneut.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, user, loadNotifications]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const approveNotification = async (notifId: string) => {
    await supabase.from('sales_notifications' as any)
      .update({ approval_status: 'approved', is_read: true } as any).eq('id', notifId);
    loadNotifications();
    setMessages(prev => [...prev, { role: 'assistant', content: '✅ Freigabe erteilt!' }]);
  };

  const pendingApprovals = notifications.filter(n => n.requires_approval && n.approval_status === 'pending');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-16rem)]">
      {/* Chat - Main */}
      <div className="lg:col-span-3 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-foreground">Assistent Chat</h3>
          <p className="text-xs text-muted-foreground">Dein persönlicher Verkaufsassistent – immer informiert</p>
        </div>

        <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-accent-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2 rounded-bl-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="px-4 pb-4 pt-2 border-t border-border">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frag nach Aufgaben, Leads, Zusammenfassungen..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button size="icon" className="shrink-0 h-11 w-11" onClick={sendMessage} disabled={!input.trim() || isLoading}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar - Notifications & Approvals */}
      <div className="space-y-4 overflow-auto">
        {pendingApprovals.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-accent" />
                Freigaben ({pendingApprovals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingApprovals.map(n => (
                <div key={n.id} className="p-2 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <Button size="sm" className="h-7 text-xs mt-1" onClick={() => approveNotification(n.id)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Freigeben
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Letzte Meldungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Meldungen</p>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div key={n.id} className={`p-2 rounded-lg text-xs space-y-0.5 ${n.is_read ? 'bg-muted/30' : 'bg-accent/5 border border-accent/20'}`}>
                  <p className="font-medium text-foreground">{n.title}</p>
                  <p className="text-muted-foreground line-clamp-1">{n.body}</p>
                  <p className="text-muted-foreground/60">{new Date(n.created_at).toLocaleString('de-DE')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
