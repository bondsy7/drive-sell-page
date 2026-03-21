import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { User, MessageSquare, Flame, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  groupLeadsByCustomer, type LeadForGrouping,
} from '@/lib/sales-customer-utils';
import type { SalesConversation } from '@/types/sales-assistant';

import {
  STAGE_CONFIG, PIPELINE_STAGES,
  type StageLog, type CrmNote, type BotMessage, type CustomerWithJourney,
} from './crm/crm-constants';
import { CrmPipelineBar } from './crm/CrmPipelineBar';
import { CrmFilters } from './crm/CrmFilters';
import { CrmStageDialog } from './crm/CrmStageDialog';
import { CrmReplyDialog, type ReplyDialogData } from './crm/CrmReplyDialog';
import CrmCustomerCard from './crm/CrmCustomerCard';

export default function SalesCrmTab() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadForGrouping[]>([]);
  const [conversations, setConversations] = useState<SalesConversation[]>([]);
  const [stageLogs, setStageLogs] = useState<StageLog[]>([]);
  const [crmNotes, setCrmNotes] = useState<CrmNote[]>([]);
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Reply dialog
  const [replyDialog, setReplyDialog] = useState<ReplyDialogData | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyType, setReplyType] = useState<'customer_reply' | 'internal_note'>('customer_reply');
  const [replyConvId, setReplyConvId] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [leadsRes, convsRes, logsRes, notesRes, msgsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('dealer_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('sales_assistant_conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('conversation_stage_log').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('crm_manual_notes').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      supabase.from('sales_assistant_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    ]);
    setLeads((leadsRes.data ?? []) as LeadForGrouping[]);
    setConversations((convsRes.data ?? []) as SalesConversation[]);
    setStageLogs((logsRes.data ?? []) as StageLog[]);
    setCrmNotes((notesRes.data ?? []) as CrmNote[]);
    setBotMessages((msgsRes.data ?? []) as BotMessage[]);
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
      return {
        ...cust,
        conversations: custConvs,
        currentStage: latestConv?.journey_stage || 'new_lead',
        currentStatus: latestConv?.status || 'open',
      };
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

  const handleStageChangeRequest = (convId: string, currentStage: string, newStage: string) => {
    setStageDialog({ convId, currentStage, newStage });
    setStageReason('');
  };

  const confirmStageChange = async () => {
    if (!stageDialog || !user) return;
    const { convId, currentStage, newStage } = stageDialog;

    await supabase.from('conversation_stage_log').insert({
      conversation_id: convId,
      user_id: user.id,
      previous_stage: currentStage,
      new_stage: newStage,
      reason: stageReason || null,
      changed_by: 'manual',
    });

    const stageLabel = STAGE_CONFIG[newStage]?.label || newStage;
    await supabase.from('crm_manual_notes').insert({
      conversation_id: convId,
      user_id: user.id,
      note_type: 'stage_change',
      content: `Phase geändert: ${STAGE_CONFIG[currentStage]?.label || currentStage} → ${stageLabel}${stageReason ? ` — ${stageReason}` : ''}`,
    });

    await supabase.from('sales_assistant_conversations')
      .update({ journey_stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', convId);

    setStageDialog(null);
    toast.success('Phase aktualisiert');
    loadData();
  };

  const updateConversationStatus = async (convId: string, status: string) => {
    await supabase.from('sales_assistant_conversations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', convId);
    toast.success('Status aktualisiert');
    loadData();
  };

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

  const handleReplySubmit = async () => {
    if (!replyDialog || !replyText.trim() || !user) return;
    const convId = replyConvId || replyDialog.convId;
    await supabase.from('crm_manual_notes').insert({
      conversation_id: convId || null,
      lead_id: replyDialog.leadId,
      user_id: user.id,
      note_type: replyType,
      content: replyText.trim(),
    });
    setReplyDialog(null);
    setReplyText('');
    toast.success(replyType === 'customer_reply' ? 'Kundenantwort hinzugefügt' : 'Notiz hinzugefügt');
    loadData();
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
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

      <CrmPipelineBar pipelineCounts={pipelineCounts} filterStage={filterStage} onFilterStage={setFilterStage} />

      <CrmFilters
        searchTerm={searchTerm} onSearchChange={setSearchTerm}
        filterStage={filterStage} onFilterStage={setFilterStage}
        filterIntent={filterIntent} onFilterIntent={setFilterIntent}
        filterStatus={filterStatus} onFilterStatus={setFilterStatus}
      />

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
              <CrmCustomerCard
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

      <CrmStageDialog
        stageDialog={stageDialog}
        stageReason={stageReason}
        onStageReasonChange={setStageReason}
        onClose={() => setStageDialog(null)}
        onConfirm={confirmStageChange}
      />

      <CrmReplyDialog
        replyDialog={replyDialog}
        replyText={replyText}
        onReplyTextChange={setReplyText}
        replyType={replyType}
        onReplyTypeChange={setReplyType}
        replyConvId={replyConvId}
        onReplyConvIdChange={setReplyConvId}
        onClose={() => setReplyDialog(null)}
        onSubmit={handleReplySubmit}
      />
    </div>
  );
}
