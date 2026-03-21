import React, { useMemo } from 'react';
import {
  ChevronDown, ChevronRight, Phone, Mail, Car, Clock,
  MessageSquare, User, ArrowRight, ArrowUpDown,
  Bot, PenLine, Reply,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JOURNEY_STAGE_LABELS, CONVERSATION_STATUS_LABELS } from '@/types/sales-assistant';
import type { SalesConversation, JourneyStage, ConversationStatus } from '@/types/sales-assistant';
import type { LeadForGrouping } from '@/lib/sales-customer-utils';
import {
  STAGE_CONFIG, STATUS_COLORS, INTENT_COLORS, formatCrmDate,
  type StageLog, type CrmNote, type BotMessage, type CustomerWithJourney,
} from './crm-constants';

interface Props {
  customer: CustomerWithJourney;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStage: (convId: string, currentStage: string, newStage: string) => void;
  onUpdateStatus: (convId: string, status: string) => void;
  stageLogs: StageLog[];
  crmNotes: CrmNote[];
  botMessages: BotMessage[];
  onAddReply: (convId: string | null, leadId: string | null, contextLabel: string | null) => void;
}

export default function CrmCustomerCard({
  customer, isExpanded, onToggle,
  onUpdateStage, onUpdateStatus,
  stageLogs, crmNotes, botMessages, onAddReply,
}: Props) {
  const stageCfg = STAGE_CONFIG[customer.currentStage] || STAGE_CONFIG['new_lead'];
  const statusClass = STATUS_COLORS[customer.currentStatus] || STATUS_COLORS['open'];
  const latestConv = customer.conversations[0];

  const leadIds = customer.requests.map((r) => r.id);
  const convIds = customer.conversations.map((c) => c.id);

  const timelineEntries = useMemo(() => {
    const entries: Array<{
      type: 'lead' | 'conversation' | 'bot_message' | 'stage_change' | 'customer_reply' | 'internal_note';
      date: string;
      data: any;
      convTitle?: string;
    }> = [];

    customer.requests.forEach((req) => {
      entries.push({ type: 'lead', date: req.created_at, data: req });
    });
    customer.conversations.forEach((conv) => {
      entries.push({ type: 'conversation', date: conv.created_at, data: conv });
    });
    botMessages.filter((m) => convIds.includes(m.conversation_id)).forEach((msg) => {
      const conv = customer.conversations.find(c => c.id === msg.conversation_id);
      entries.push({ type: 'bot_message', date: msg.created_at, data: msg, convTitle: conv?.conversation_title || undefined });
    });
    stageLogs.filter((l) => convIds.includes(l.conversation_id)).forEach((log) => {
      entries.push({ type: 'stage_change', date: log.created_at, data: log });
    });
    crmNotes.filter((n) =>
      (n.conversation_id && convIds.includes(n.conversation_id)) ||
      (n.lead_id && leadIds.includes(n.lead_id))
    ).forEach((note) => {
      if (note.note_type === 'stage_change') return;
      entries.push({
        type: note.note_type === 'customer_reply' ? 'customer_reply' : 'internal_note',
        date: note.created_at,
        data: note,
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries;
  }, [customer, stageLogs, crmNotes, botMessages, convIds, leadIds]);

  return (
    <Card className={`border-l-4 ${statusClass} transition-all hover:shadow-md`}>
      {/* Header */}
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="flex-shrink-0">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
        <div className={`w-10 h-10 rounded-full ${stageCfg.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
          {customer.displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">{customer.displayName}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              {stageCfg.icon} {stageCfg.label}
            </Badge>
            {customer.totalInquiries > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{customer.totalInquiries} Anfragen</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            {customer.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {customer.email}</span>}
            {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(customer.latestAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
          </span>
          {customer.vehicles.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Car className="w-3 h-3" /> {customer.vehicles.length} Fzg.
            </span>
          )}
        </div>
      </button>

      {/* Intent Tags */}
      {customer.intentTags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {customer.intentTags.map((tag) => (
            <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${INTENT_COLORS[tag] || 'bg-muted text-muted-foreground'}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="border-t border-border/50 bg-muted/20">
          {/* Vehicles */}
          {customer.vehicles.length > 0 && (
            <div className="px-4 py-3 border-b border-border/30">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                <Car className="w-3.5 h-3.5" /> Fahrzeuge
              </p>
              <div className="flex flex-wrap gap-1.5">
                {customer.vehicles.map((v, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{v}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Journey Stage Editor */}
          {latestConv && (
            <div className="px-4 py-3 border-b border-border/30">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> Journey & Status
              </p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={customer.currentStage}
                  onValueChange={(v) => onUpdateStage(latestConv.id, customer.currentStage, v)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(JOURNEY_STAGE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={customer.currentStatus}
                  onValueChange={(v) => onUpdateStatus(latestConv.id, v)}
                >
                  <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONVERSATION_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {latestConv.next_action && (
                <p className="text-xs mt-2 text-muted-foreground">
                  <strong>Nächster Schritt:</strong> {latestConv.next_action}
                </p>
              )}
            </div>
          )}

          {/* Full Timeline */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
              <Clock className="w-3.5 h-3.5" /> Kontaktverlauf
            </p>
            <div className="relative pl-4 space-y-3">
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />

              {timelineEntries.map((entry, i) => {
                const isLatest = i === timelineEntries.length - 1;

                if (entry.type === 'lead') {
                  const req = entry.data as LeadForGrouping;
                  return (
                    <div key={`lead-${req.id}`} className="relative group/entry">
                      <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background ${isLatest ? 'bg-accent' : 'bg-muted-foreground/30'}`} />
                      <div className="bg-card rounded-lg border border-border/50 p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                              <Mail className="w-3 h-3" /> Anfrage
                            </p>
                            {req.vehicle_title && (
                              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                                <Car className="w-3 h-3 text-muted-foreground" /> {req.vehicle_title}
                              </p>
                            )}
                            {req.message && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">„{req.message}"</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {req.interested_test_drive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Probefahrt</span>}
                              {req.interested_trade_in && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Inzahlungnahme</span>}
                              {req.interested_leasing && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Leasing</span>}
                              {req.interested_financing && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Finanzierung</span>}
                              {req.interested_purchase && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Kauf</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatCrmDate(req.created_at)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddReply(null, req.id, `Anfrage: ${req.vehicle_title || req.message?.slice(0, 40) || 'Lead'}`); }}
                              className="opacity-0 group-hover/entry:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                              title="Antwort/Notiz hinzufügen"
                            >
                              <Reply className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'conversation') {
                  const conv = entry.data as SalesConversation;
                  return (
                    <div key={`conv-${conv.id}`} className="relative group/entry">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background bg-accent/50" />
                      <div className="bg-accent/5 rounded-lg border border-accent/20 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Bot className="w-3 h-3 text-accent" />
                            <span className="text-xs font-medium text-foreground">{conv.conversation_title || 'Konversation'}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {CONVERSATION_STATUS_LABELS[conv.status as ConversationStatus] || conv.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{formatCrmDate(conv.created_at)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddReply(conv.id, null, conv.conversation_title || 'Konversation'); }}
                              className="opacity-0 group-hover/entry:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                              title="Antwort/Notiz hinzufügen"
                            >
                              <Reply className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        {conv.summary && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{conv.summary}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'bot_message') {
                  const msg = entry.data as BotMessage;
                  const isBot = msg.role === 'assistant';
                  const text = msg.output_text || msg.input_text || '';
                  if (!text) return null;
                  return (
                    <div key={`msg-${msg.id}`} className="relative group/entry">
                      <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background ${isBot ? 'bg-accent' : 'bg-sky-400'}`} />
                      <div className={`rounded-lg border p-3 ${isBot ? 'bg-accent/5 border-accent/20' : 'bg-sky-500/5 border-sky-500/20'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[10px] font-medium flex items-center gap-1 ${isBot ? 'text-accent' : 'text-sky-600 dark:text-sky-400'}`}>
                            {isBot ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {isBot ? 'Bot-Antwort' : 'Eingabe'}
                            {msg.channel && <Badge variant="outline" className="text-[8px] px-1 py-0 ml-1">{msg.channel}</Badge>}
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{formatCrmDate(msg.created_at)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddReply(msg.conversation_id, null, `Bot: ${text.slice(0, 50)}…`); }}
                              className="opacity-0 group-hover/entry:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                              title="Antwort/Notiz hinzufügen"
                            >
                              <Reply className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap break-words line-clamp-6">{text}</p>
                        {entry.convTitle && (
                          <p className="text-[9px] text-muted-foreground mt-1">↳ {entry.convTitle}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'stage_change') {
                  const log = entry.data as StageLog;
                  const fromLabel = STAGE_CONFIG[log.previous_stage || '']?.label || log.previous_stage || '—';
                  const toLabel = STAGE_CONFIG[log.new_stage]?.label || log.new_stage;
                  return (
                    <div key={`sc-${log.id}`} className="relative">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background bg-violet-400" />
                      <div className="bg-violet-500/5 rounded-lg border border-violet-500/20 p-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ArrowUpDown className="w-3 h-3 text-violet-500 flex-shrink-0" />
                          <span className="text-xs text-foreground">{fromLabel}</span>
                          <ArrowRight className="w-3 h-3 text-violet-400" />
                          <Badge className={`${STAGE_CONFIG[log.new_stage]?.color || 'bg-muted'} text-white border-0 text-[9px] px-1.5 py-0`}>
                            {toLabel}
                          </Badge>
                          <Badge variant="outline" className="text-[8px] px-1 py-0">
                            {log.changed_by === 'bot' ? 'Bot' : 'Manuell'}
                          </Badge>
                        </div>
                        {log.reason && (
                          <p className="text-xs text-muted-foreground mt-1">Grund: {log.reason}</p>
                        )}
                        <span className="text-[10px] text-muted-foreground">{formatCrmDate(log.created_at)}</span>
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'customer_reply') {
                  const note = entry.data as CrmNote;
                  return (
                    <div key={`cr-${note.id}`} className="relative group/entry">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background bg-blue-400" />
                      <div className="bg-blue-500/5 rounded-lg border border-blue-500/20 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                            <Mail className="w-3 h-3" /> Kundenantwort
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground">{formatCrmDate(note.created_at)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); onAddReply(note.conversation_id, note.lead_id, `Kundenantwort: ${note.content.slice(0, 40)}…`); }}
                              className="opacity-0 group-hover/entry:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                              title="Antwort/Notiz hinzufügen"
                            >
                              <Reply className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-foreground whitespace-pre-wrap break-words">„{note.content}"</p>
                      </div>
                    </div>
                  );
                }

                if (entry.type === 'internal_note') {
                  const note = entry.data as CrmNote;
                  return (
                    <div key={`in-${note.id}`} className="relative">
                      <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background bg-amber-400" />
                      <div className="bg-amber-500/5 rounded-lg border border-amber-500/20 p-2.5">
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1 font-medium">
                          <PenLine className="w-3 h-3" /> Interne Notiz
                        </p>
                        <p className="text-xs text-foreground whitespace-pre-wrap break-words">{note.content}</p>
                        <span className="text-[10px] text-muted-foreground">{formatCrmDate(note.created_at)}</span>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
