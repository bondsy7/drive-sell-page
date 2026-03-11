import React, { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2, Eye, MessageSquare, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSalesAssistant } from '@/hooks/useSalesAssistant';
import {
  JOURNEY_STAGE_LABELS, SOURCE_CHANNEL_LABELS, CONVERSATION_STATUS_LABELS,
  type JourneyStage, type SourceChannel, type ConversationStatus, type SalesMessage,
} from '@/types/sales-assistant';

export default function SalesHistoryTab() {
  const { conversations, conversationsLoading, deleteConversation, loadMessages } = useSalesAssistant();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<SalesMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const handleView = useCallback(async (convId: string) => {
    if (selectedConv === convId) { setSelectedConv(null); return; }
    setSelectedConv(convId);
    setLoadingMessages(true);
    const msgs = await loadMessages(convId);
    setMessages(msgs);
    setLoadingMessages(false);
  }, [selectedConv, loadMessages]);

  const handleDelete = async (id: string) => {
    if (!confirm('Verlauf wirklich löschen?')) return;
    await deleteConversation(id);
    if (selectedConv === id) setSelectedConv(null);
    toast.success('Verlauf gelöscht.');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert!');
  };

  const statusColors: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-600',
    in_progress: 'bg-yellow-500/10 text-yellow-600',
    waiting: 'bg-orange-500/10 text-orange-600',
    closed_won: 'bg-green-500/10 text-green-600',
    closed_lost: 'bg-red-500/10 text-red-600',
    archived: 'bg-muted text-muted-foreground',
  };

  if (conversationsLoading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-foreground">Gespeicherte Verläufe ({conversations.length})</h3>

      {conversations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Noch keine Verläufe vorhanden.</p>
          <p className="text-xs mt-1">Generiere eine Antwort im Assistenten-Tab, um einen Verlauf zu erstellen.</p>
        </div>
      ) : (
        conversations.map((conv) => (
          <div key={conv.id} className="rounded-lg border border-border bg-card">
            <div className="p-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{conv.conversation_title || 'Ohne Titel'}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColors[conv.status] || 'bg-muted text-muted-foreground'}`}>
                    {CONVERSATION_STATUS_LABELS[conv.status as ConversationStatus] || conv.status}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {JOURNEY_STAGE_LABELS[conv.journey_stage as JourneyStage] || conv.journey_stage}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {SOURCE_CHANNEL_LABELS[conv.source_channel as SourceChannel] || conv.source_channel}
                  </span>
                </div>
                {conv.summary && <p className="text-xs text-muted-foreground line-clamp-2">{conv.summary}</p>}
                {conv.next_action && <p className="text-xs mt-1"><strong>Nächster Schritt:</strong> {conv.next_action}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(conv.updated_at).toLocaleString('de-DE')}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => handleView(conv.id)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(conv.id)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Messages Detail */}
            {selectedConv === conv.id && (
              <div className="border-t border-border p-4 space-y-2 bg-muted/20">
                {loadingMessages ? (
                  <div className="flex justify-center py-4"><div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Nachrichten vorhanden.</p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg text-sm ${msg.role === 'assistant' ? 'bg-accent/5 border border-accent/10' : 'bg-muted/50'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {msg.role === 'assistant' ? '🤖 Assistent' : '👤 Eingabe'} · {msg.message_type}
                        </span>
                        {msg.output_text && (
                          <Button size="sm" variant="ghost" onClick={() => handleCopy(msg.output_text!)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs whitespace-pre-wrap">{msg.output_text || msg.input_text}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
