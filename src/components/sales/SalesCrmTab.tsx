import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Search, Filter, ChevronDown, ChevronRight, Phone, Mail, Car, Clock,
  MessageSquare, Tag, User, ArrowRight, Circle, CheckCircle2, XCircle,
  AlertCircle, Flame, Snowflake, CalendarDays, FileText, MoreHorizontal,
  Send, Bot, PenLine, ArrowUpDown, Plus, RefreshCw, Reply,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  groupLeadsByCustomer, type CustomerLeadThread, type LeadForGrouping,
} from '@/lib/sales-customer-utils';
import {
  JOURNEY_STAGE_LABELS, CONVERSATION_STATUS_LABELS,
  type JourneyStage, type ConversationStatus, type SalesConversation,
} from '@/types/sales-assistant';

/* ── Journey stage config with visual styling ── */
const STAGE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new_lead: { label: 'Neuer Lead', color: 'bg-blue-500', icon: <Circle className="w-3 h-3" /> },
  first_contact: { label: 'Erstkontakt', color: 'bg-sky-500', icon: <MessageSquare className="w-3 h-3" /> },
  needs_analysis: { label: 'Bedarfsanalyse', color: 'bg-indigo-500', icon: <Search className="w-3 h-3" /> },
  vehicle_interest: { label: 'Fahrzeuginteresse', color: 'bg-violet-500', icon: <Car className="w-3 h-3" /> },
  offer_sent: { label: 'Angebot gesendet', color: 'bg-amber-500', icon: <FileText className="w-3 h-3" /> },
  follow_up_1: { label: 'Follow-up 1', color: 'bg-orange-500', icon: <ArrowRight className="w-3 h-3" /> },
  follow_up_2: { label: 'Follow-up 2', color: 'bg-orange-600', icon: <ArrowRight className="w-3 h-3" /> },
  hot_lead: { label: 'Heißer Lead', color: 'bg-red-500', icon: <Flame className="w-3 h-3" /> },
  cold_lead: { label: 'Kalter Lead', color: 'bg-slate-400', icon: <Snowflake className="w-3 h-3" /> },
  test_drive: { label: 'Probefahrt', color: 'bg-emerald-500', icon: <CalendarDays className="w-3 h-3" /> },
  closing: { label: 'Abschluss', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
  closed_won: { label: 'Gewonnen', color: 'bg-green-600', icon: <CheckCircle2 className="w-3 h-3" /> },
  closed_lost: { label: 'Verloren', color: 'bg-red-400', icon: <XCircle className="w-3 h-3" /> },
};

const STATUS_COLORS: Record<string, string> = {
  open: 'border-blue-400 bg-blue-500/10',
  in_progress: 'border-amber-400 bg-amber-500/10',
  waiting: 'border-orange-400 bg-orange-500/10',
  closed_won: 'border-green-400 bg-green-500/10',
  closed_lost: 'border-red-400 bg-red-500/10',
  archived: 'border-muted bg-muted/30',
};

const INTENT_COLORS: Record<string, string> = {
  Probefahrt: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Inzahlungnahme: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Leasing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Finanzierung: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  Kauf: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Gewerbekunde: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Privatkunde: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Zeitnaher Bedarf': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: 'new_lead', label: 'Neu' },
  { key: 'first_contact', label: 'Kontakt' },
  { key: 'vehicle_interest', label: 'Interesse' },
  { key: 'offer_sent', label: 'Angebot' },
  { key: 'hot_lead', label: 'Heiß' },
  { key: 'test_drive', label: 'Probefahrt' },
  { key: 'closing', label: 'Abschluss' },
];

interface StageLog {
  id: string;
  conversation_id: string;
  previous_stage: string | null;
  new_stage: string;
  reason: string | null;
  changed_by: string;
  created_at: string;
}

interface CrmNote {
  id: string;
  conversation_id: string | null;
  lead_id: string | null;
  note_type: string;
  content: string;
  created_at: string;
}

interface BotMessage {
  id: string;
  conversation_id: string;
  role: string;
  input_text: string | null;
  output_text: string | null;
  message_type: string;
  channel: string | null;
  created_at: string;
}

interface CustomerWithJourney extends CustomerLeadThread {
  conversations: SalesConversation[];
  currentStage: string;
  currentStatus: string;
}

export default function SalesCrmTab() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadForGrouping[]>([]);
  const [conversations, setConversations] = useState<SalesConversation[]>([]);
  const [stageLogs, setStageLogs] = useState<StageLog[]>([]);
  const [crmNotes, setCrmNotes] = useState<CrmNote[]>([]);
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // Stage change dialog
  const [stageDialog, setStageDialog] = useState<{
    convId: string; currentStage: string; newStage: string;
  } | null>(null);
  const [stageReason, setStageReason] = useState('');

  // Reply dialog - now with conversation picker
  const [replyDialog, setReplyDialog] = useState<{
    convId: string | null;
    leadId: string | null;
    customerName: string;
    conversations: SalesConversation[];
    contextLabel: string | null; // what the reply is about
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'customer_reply' | 'internal_note'>('customer_reply');
  const [replyConvId, setReplyConvId] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [leadsRes, convsRes, logsRes, notesRes, msgsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('dealer_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('sales_assistant_conversations' as any).select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('conversation_stage_log' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('crm_manual_notes' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('sales_assistant_messages' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    ]);
    setLeads((leadsRes.data as any) || []);
    setConversations((convsRes.data as any) || []);
    setStageLogs((logsRes.data as any) || []);
    setCrmNotes((notesRes.data as any) || []);
    setBotMessages((msgsRes.data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const customers = useMemo((): CustomerWithJourney[] => {
    const grouped = groupLeadsByCustomer(leads);
    return grouped.map((cust) => {
      const leadIds = cust.requests.map((r) => r.id);
      const custConvs = conversations.filter(
        (c) => c.lead_id && leadIds.includes(c.lead_id)
      );
      const latestConv = custConvs[0];
      const currentStage = latestConv?.journey_stage || 'new_lead';
      const currentStatus = latestConv?.status || 'open';
      return { ...cust, conversations: custConvs, currentStage, currentStatus };
    });
  }, [leads, conversations]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match = c.displayName.toLowerCase().includes(term)
          || c.email.toLowerCase().includes(term)
          || (c.phone || '').includes(term)
          || c.vehicles.some((v) => v.toLowerCase().includes(term));
        if (!match) return false;
      }
      if (filterStage !== 'all' && c.currentStage !== filterStage) return false;
      if (filterIntent !== 'all' && !c.intentTags.includes(filterIntent)) return false;
      if (filterStatus !== 'all' && c.currentStatus !== filterStatus) return false;
      return true;
    });
  }, [customers, searchTerm, filterStage, filterIntent, filterStatus]);

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach((s) => { counts[s.key] = 0; });
    customers.forEach((c) => {
      const key = PIPELINE_STAGES.find((s) => s.key === c.currentStage)?.key || 'new_lead';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [customers]);

  const stats = useMemo(() => ({
    total: customers.length,
    hot: customers.filter((c) => c.currentStage === 'hot_lead').length,
    active: customers.filter((c) => ['open', 'in_progress', 'waiting'].includes(c.currentStatus)).length,
    won: customers.filter((c) => c.currentStatus === 'closed_won' || c.currentStage === 'closing').length,
  }), [customers]);

  // Stage change WITH reason
  const handleStageChangeRequest = (convId: string, currentStage: string, newStage: string) => {
    setStageDialog({ convId, currentStage, newStage });
    setStageReason('');
  };

  const confirmStageChange = async () => {
    if (!stageDialog || !user) return;
    const { convId, currentStage, newStage } = stageDialog;

    await supabase.from('conversation_stage_log' as any).insert({
      conversation_id: convId,
      user_id: user.id,
      previous_stage: currentStage,
      new_stage: newStage,
      reason: stageReason || null,
      changed_by: 'manual',
    } as any);

    const stageLabel = STAGE_CONFIG[newStage]?.label || newStage;
    await supabase.from('crm_manual_notes' as any).insert({
      conversation_id: convId,
      user_id: user.id,
      note_type: 'stage_change',
      content: `Phase geändert: ${STAGE_CONFIG[currentStage]?.label || currentStage} → ${stageLabel}${stageReason ? ` — ${stageReason}` : ''}`,
    } as any);

    await supabase.from('sales_assistant_conversations' as any)
      .update({ journey_stage: newStage, updated_at: new Date().toISOString() } as any)
      .eq('id', convId);

    setStageDialog(null);
    toast.success('Phase aktualisiert');
    loadData();
  };

  const updateConversationStatus = async (convId: string, status: string) => {
    await supabase.from('sales_assistant_conversations' as any)
      .update({ status, updated_at: new Date().toISOString() } as any)
      .eq('id', convId);
    toast.success('Status aktualisiert');
    loadData();
  };

  // Open reply dialog with context
  const openReplyDialog = (
    customerConversations: SalesConversation[],
    customerName: string,
    preselectedConvId: string | null,
    preselectedLeadId: string | null,
    contextLabel: string | null,
  ) => {
    setReplyDialog({
      convId: preselectedConvId,
      leadId: preselectedLeadId,
      customerName,
      conversations: customerConversations,
      contextLabel,
    });
    setReplyText('');
    setReplyType('customer_reply');
    setReplyConvId(preselectedConvId || customerConversations[0]?.id || '');
  };

  // Manual reply / note
  const handleReplySubmit = async () => {
    if (!replyDialog || !replyText.trim() || !user) return;
    const convId = replyConvId || replyDialog.convId;
    await supabase.from('crm_manual_notes' as any).insert({
      conversation_id: convId || null,
      lead_id: replyDialog.leadId,
      user_id: user.id,
      note_type: replyType,
      content: replyText.trim(),
    } as any);
    setReplyDialog(null);
    setReplyText('');
    toast.success(replyType === 'customer_reply' ? 'Kundenantwort hinzugefügt' : 'Notiz hinzugefügt');
    loadData();
  };

  // Seed demo data
  const seedDemoData = async () => {
    setSeeding(true);
    try {
      const { error } = await supabase.functions.invoke('seed-crm-demo');
      if (error) throw error;
      toast.success('Demo-Daten wurden erstellt');
      await loadData();
    } catch (e: any) {
      toast.error('Fehler: ' + (e.message || 'Unbekannt'));
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Gesamt', value: stats.total, icon: <User className="w-4 h-4" />, accent: 'text-foreground' },
          { label: 'Aktiv', value: stats.active, icon: <MessageSquare className="w-4 h-4" />, accent: 'text-blue-500' },
          { label: 'Heiß', value: stats.hot, icon: <Flame className="w-4 h-4" />, accent: 'text-red-500' },
          { label: 'Gewonnen', value: stats.won, icon: <CheckCircle2 className="w-4 h-4" />, accent: 'text-green-500' },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`${s.accent}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex">
            {PIPELINE_STAGES.map((stage, idx) => {
              const cfg = STAGE_CONFIG[stage.key];
              const count = pipelineCounts[stage.key] || 0;
              return (
                <button
                  key={stage.key}
                  onClick={() => setFilterStage(filterStage === stage.key ? 'all' : stage.key)}
                  className={`flex-1 py-3 px-2 text-center transition-all relative group
                    ${filterStage === stage.key ? 'ring-2 ring-accent ring-inset' : ''}
                    ${idx > 0 ? 'border-l border-border/30' : ''}`}
                >
                  <div className={`w-6 h-6 rounded-full ${cfg?.color || 'bg-muted'} mx-auto mb-1 flex items-center justify-center text-white`}>
                    <span className="text-[10px] font-bold">{count}</span>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {stage.label}
                  </p>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 text-muted-foreground/30 z-10" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Kunde, E-Mail, Fahrzeug suchen…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Phasen</SelectItem>
            {Object.entries(JOURNEY_STAGE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterIntent} onValueChange={setFilterIntent}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Interesse" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Interessen</SelectItem>
            {['Probefahrt', 'Inzahlungnahme', 'Leasing', 'Finanzierung', 'Kauf', 'Gewerbekunde'].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(CONVERSATION_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} von {customers.length} Kunden</p>

      {/* Customer List */}
      <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Keine Kunden gefunden.</p>
            </div>
          ) : (
            filtered.map((customer) => (
              <CustomerCard
                key={customer.key}
                customer={customer}
                isExpanded={expandedCustomer === customer.key}
                onToggle={() => setExpandedCustomer(expandedCustomer === customer.key ? null : customer.key)}
                onUpdateStage={handleStageChangeRequest}
                onUpdateStatus={updateConversationStatus}
                stageLogs={stageLogs}
                crmNotes={crmNotes}
                botMessages={botMessages}
                onAddReply={(convId, leadId, contextLabel) => {
                  openReplyDialog(customer.conversations, customer.displayName, convId, leadId, contextLabel);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* Stage Change Dialog */}
      <Dialog open={!!stageDialog} onOpenChange={(o) => !o && setStageDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" /> Phase ändern
            </DialogTitle>
          </DialogHeader>
          {stageDialog && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{STAGE_CONFIG[stageDialog.currentStage]?.label}</Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge className={`${STAGE_CONFIG[stageDialog.newStage]?.color} text-white border-0`}>
                  {STAGE_CONFIG[stageDialog.newStage]?.label}
                </Badge>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Grund (optional)</label>
                <Textarea
                  placeholder="z.B. Kunde hat Angebot akzeptiert…"
                  value={stageReason}
                  onChange={(e) => setStageReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialog(null)}>Abbrechen</Button>
            <Button onClick={confirmStageChange}>Phase ändern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply / Note Dialog with conversation picker */}
      <Dialog open={!!replyDialog} onOpenChange={(o) => !o && setReplyDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              {replyDialog?.customerName} — Eintrag hinzufügen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {replyDialog?.contextLabel && (
              <div className="text-xs bg-muted/50 rounded-md p-2 border border-border/50">
                <span className="text-muted-foreground">Bezug:</span>{' '}
                <span className="font-medium text-foreground">{replyDialog.contextLabel}</span>
              </div>
            )}

            {/* Conversation picker */}
            {replyDialog && replyDialog.conversations.length > 1 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Bezieht sich auf Konversation</label>
                <Select value={replyConvId} onValueChange={setReplyConvId}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Konversation wählen…" /></SelectTrigger>
                  <SelectContent>
                    {replyDialog.conversations.map((conv) => (
                      <SelectItem key={conv.id} value={conv.id} className="text-xs">
                        {conv.conversation_title || 'Konversation'} — {STAGE_CONFIG[conv.journey_stage as string]?.label || conv.journey_stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={replyType === 'customer_reply' ? 'default' : 'outline'}
                onClick={() => setReplyType('customer_reply')}
                className="gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" /> Kundenantwort
              </Button>
              <Button
                size="sm"
                variant={replyType === 'internal_note' ? 'default' : 'outline'}
                onClick={() => setReplyType('internal_note')}
                className="gap-1.5"
              >
                <PenLine className="w-3.5 h-3.5" /> Interne Notiz
              </Button>
            </div>
            <Textarea
              placeholder={replyType === 'customer_reply'
                ? 'Kundenantwort hier einfügen (z.B. per E-Mail erhalten)…'
                : 'Interne Notiz erfassen…'}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyDialog(null)}>Abbrechen</Button>
            <Button onClick={handleReplySubmit} disabled={!replyText.trim()} className="gap-1.5">
              <Send className="w-3.5 h-3.5" /> Hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Customer Card ── */
function CustomerCard({
  customer,
  isExpanded,
  onToggle,
  onUpdateStage,
  onUpdateStatus,
  stageLogs,
  crmNotes,
  botMessages,
  onAddReply,
}: {
  customer: CustomerWithJourney;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStage: (convId: string, currentStage: string, newStage: string) => void;
  onUpdateStatus: (convId: string, status: string) => void;
  stageLogs: StageLog[];
  crmNotes: CrmNote[];
  botMessages: BotMessage[];
  onAddReply: (convId: string | null, leadId: string | null, contextLabel: string | null) => void;
}) {
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

    // Lead requests
    customer.requests.forEach((req) => {
      entries.push({ type: 'lead', date: req.created_at, data: req });
    });

    // Conversations (as header entries)
    customer.conversations.forEach((conv) => {
      entries.push({ type: 'conversation', date: conv.created_at, data: conv });
    });

    // Bot messages for this customer's conversations
    botMessages.filter((m) => convIds.includes(m.conversation_id)).forEach((msg) => {
      const conv = customer.conversations.find(c => c.id === msg.conversation_id);
      entries.push({
        type: 'bot_message',
        date: msg.created_at,
        data: msg,
        convTitle: conv?.conversation_title || undefined,
      });
    });

    // Stage logs
    stageLogs.filter((l) => convIds.includes(l.conversation_id)).forEach((log) => {
      entries.push({ type: 'stage_change', date: log.created_at, data: log });
    });

    // CRM notes
    crmNotes.filter((n) =>
      (n.conversation_id && convIds.includes(n.conversation_id)) ||
      (n.lead_id && leadIds.includes(n.lead_id))
    ).forEach((note) => {
      if (note.note_type === 'stage_change') return; // skip, we show stage_log entries instead
      entries.push({
        type: note.note_type === 'customer_reply' ? 'customer_reply' : 'internal_note',
        date: note.created_at,
        data: note,
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return entries;
  }, [customer, stageLogs, crmNotes, botMessages, convIds, leadIds]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

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
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(req.created_at)}</span>
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
                            <span className="text-[10px] text-muted-foreground">{formatDate(conv.created_at)}</span>
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
                            <span className="text-[10px] text-muted-foreground">{formatDate(msg.created_at)}</span>
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
                        <span className="text-[10px] text-muted-foreground">{formatDate(log.created_at)}</span>
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
                            <span className="text-[10px] text-muted-foreground">{formatDate(note.created_at)}</span>
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
                        <span className="text-[10px] text-muted-foreground">{formatDate(note.created_at)}</span>
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
