import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Loader2, Bell, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export default function SalesChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('sales_notifications' as any)
      .select('*').eq('user_id', user.id).eq('is_read', false)
      .order('created_at', { ascending: false }).limit(20);
    const notifs = (data as any) || [];
    setNotifications(notifs);
    setUnreadCount(notifs.length);
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Realtime notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('sales-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sales_notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        // Auto-open widget on new notification
        if (!open) setOpen(true);
        // Auto-add as assistant message
        const n = payload.new as Notification;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `🔔 **${n.title}**\n\n${n.body || ''}${n.requires_approval ? '\n\n_Sag "Freigabe", um den Entwurf zu genehmigen._' : ''}`,
        }]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, open]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial greeting
  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = unreadCount > 0
        ? `👋 Hallo! Du hast **${unreadCount} ungelesene Benachrichtigungen**. Frag mich nach einer Zusammenfassung oder sage "Zeig mir meine Aufgaben".`
        : '👋 Hallo! Ich bin dein Verkaufsassistent. Frag mich nach offenen Aufgaben, Leads oder Zusammenfassungen.';
      setMessages([{ role: 'assistant', content: greeting }]);
    }
  }, [open]);

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
      if (!resp.ok) throw new Error(data.error || 'Fehler bei der Kommunikation');

      const assistantContent = data.content || 'Keine Antwort erhalten.';
      setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
      loadNotifications();
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, loadNotifications]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('sales_notifications' as any)
      .update({ is_read: true } as any)
      .eq('user_id', user.id);
    setUnreadCount(0);
    loadNotifications();
  };

  if (!user) return null;

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        >
          <MessageSquare className="w-6 h-6 group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Verkaufsassistent</p>
                <p className="text-xs text-muted-foreground">
                  {unreadCount > 0 ? `${unreadCount} neue Meldungen` : 'Online'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="h-8 px-2 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Gelesen
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-accent text-accent-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
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

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-border">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nachricht eingeben..."
                className="min-h-[40px] max-h-[100px] resize-none text-sm"
                rows={1}
              />
              <Button
                size="icon"
                className="shrink-0 h-10 w-10"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
