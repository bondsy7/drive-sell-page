import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bell, CheckCircle2, Eye, Mail, MailOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
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
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);
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

        // Build a rich message with draft preview
        const p = n.action_payload || {};
        let msgContent = `🔔 **${n.title}**\n\n${n.body || ''}`;
        if (p.draftBody) {
          msgContent += `\n\n📧 **E-Mail-Entwurf an ${p.leadName || 'Kunde'}:**\n> Betreff: ${p.draftSubject || 'k.A.'}\n\n${p.draftBody}`;
        }
        if (n.requires_approval) {
          msgContent += '\n\n_Sage "freigeben" um den Entwurf zu genehmigen und zu versenden._';
        }

        setMessages(prev => [...prev, { role: 'assistant', content: msgContent }]);
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

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Fehler');

      const assistantContent = data.content || 'Keine Antwort erhalten.';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
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

  const approveNotification = async (notifId: string, payload: any) => {
    // Approve notification
    await supabase.from('sales_notifications' as any)
      .update({ approval_status: 'approved', is_read: true } as any).eq('id', notifId);

    // If there's an email ID, queue it for sending
    if (payload?.emailId) {
      await supabase.from('sales_email_outbox' as any)
        .update({ status: 'queued' } as any).eq('id', payload.emailId);
    }

    // Update conversation status
    if (payload?.conversationId) {
      await supabase.from('sales_assistant_conversations' as any)
        .update({ status: 'in_progress' } as any).eq('id', payload.conversationId);
    }

    loadNotifications();
    toast.success('Entwurf freigegeben und zum Versand bereitgestellt!');
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `✅ **Freigabe erteilt!** Die E-Mail an ${payload?.leadName || 'den Kunden'} wurde zum Versand freigegeben.`,
    }]);
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
            <CardContent className="space-y-3">
              {pendingApprovals.map(n => {
                const p = n.action_payload || {};
                const isExpanded = expandedDraft === n.id;
                return (
                  <div key={n.id} className="p-3 rounded-lg bg-muted/50 space-y-2 border border-accent/20">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-accent" />
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{n.body}</p>

                    {/* Show draft preview */}
                    {p.draftBody && (
                      <div className="space-y-1">
                        <button
                          onClick={() => setExpandedDraft(isExpanded ? null : n.id)}
                          className="flex items-center gap-1 text-xs text-accent hover:underline font-medium"
                        >
                          <Eye className="w-3 h-3" />
                          {isExpanded ? 'Entwurf ausblenden' : 'Entwurf anzeigen'}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-2.5 rounded-md bg-background border border-border text-xs space-y-1.5">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span className="font-medium">An:</span> {p.leadName || ''} &lt;{p.leadEmail || ''}&gt;
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <span className="font-medium">Betreff:</span> {p.draftSubject || 'k.A.'}
                            </div>
                            {p.interests?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.interests.map((int: string) => (
                                  <Badge key={int} variant="secondary" className="text-[10px] h-4">{int}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="border-t border-border pt-2 mt-2 whitespace-pre-wrap text-foreground leading-relaxed">
                              {p.draftBody}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <Button size="sm" className="h-7 text-xs w-full" onClick={() => approveNotification(n.id, p)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Freigeben & Versenden
                    </Button>
                  </div>
                );
              })}
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
