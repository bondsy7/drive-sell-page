import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Search, Filter, ChevronDown, ChevronRight, Phone, Mail, Car, Clock,
  MessageSquare, Tag, User, ArrowRight, Circle, CheckCircle2, XCircle,
  AlertCircle, Flame, Snowflake, CalendarDays, FileText, MoreHorizontal,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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

/* ── Pipeline stages for the visual funnel ── */
const PIPELINE_STAGES: { key: string; label: string }[] = [
  { key: 'new_lead', label: 'Neu' },
  { key: 'first_contact', label: 'Kontakt' },
  { key: 'vehicle_interest', label: 'Interesse' },
  { key: 'offer_sent', label: 'Angebot' },
  { key: 'hot_lead', label: 'Heiß' },
  { key: 'test_drive', label: 'Probefahrt' },
  { key: 'closing', label: 'Abschluss' },
];

interface CustomerWithJourney extends CustomerLeadThread {
  conversations: SalesConversation[];
  currentStage: string;
  currentStatus: string;
}

export default function SalesCrmTab() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<LeadForGrouping[]>([]);
  const [conversations, setConversations] = useState<SalesConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState<string>('all');
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [leadsRes, convsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('dealer_user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('sales_assistant_conversations' as any).select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
    ]);
    setLeads((leadsRes.data as any) || []);
    setConversations((convsRes.data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Build enriched customer list ── */
  const customers = useMemo((): CustomerWithJourney[] => {
    const grouped = groupLeadsByCustomer(leads);
    return grouped.map((cust) => {
      // Find conversations linked to this customer's leads
      const leadIds = cust.requests.map((r) => r.id);
      const custConvs = conversations.filter(
        (c) => c.lead_id && leadIds.includes(c.lead_id)
      );
      // Determine current stage from latest conversation or default
      const latestConv = custConvs[0];
      const currentStage = latestConv?.journey_stage || 'new_lead';
      const currentStatus = latestConv?.status || 'open';
      return { ...cust, conversations: custConvs, currentStage, currentStatus };
    });
  }, [leads, conversations]);

  /* ── Filtered list ── */
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

  /* ── Pipeline counts ── */
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach((s) => { counts[s.key] = 0; });
    customers.forEach((c) => {
      const key = PIPELINE_STAGES.find((s) => s.key === c.currentStage)?.key || 'new_lead';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [customers]);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    total: customers.length,
    hot: customers.filter((c) => c.currentStage === 'hot_lead').length,
    active: customers.filter((c) => ['open', 'in_progress', 'waiting'].includes(c.currentStatus)).length,
    won: customers.filter((c) => c.currentStatus === 'closed_won' || c.currentStage === 'closing').length,
  }), [customers]);

  const updateConversationStage = async (convId: string, stage: string) => {
    await supabase.from('sales_assistant_conversations' as any)
      .update({ journey_stage: stage, updated_at: new Date().toISOString() } as any)
      .eq('id', convId);
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

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Stats Bar ── */}
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

      {/* ── Pipeline Visualization ── */}
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

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Kunde, E-Mail, Fahrzeug suchen…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
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

      {/* ── Customer count ── */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} von {customers.length} Kunden
      </p>

      {/* ── Customer List ── */}
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
                onUpdateStage={updateConversationStage}
                onUpdateStatus={updateConversationStatus}
              />
            ))
          )}
        </div>
      </div>
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
}: {
  customer: CustomerWithJourney;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateStage: (convId: string, stage: string) => void;
  onUpdateStatus: (convId: string, status: string) => void;
}) {
  const stageCfg = STAGE_CONFIG[customer.currentStage] || STAGE_CONFIG['new_lead'];
  const statusClass = STATUS_COLORS[customer.currentStatus] || STATUS_COLORS['open'];
  const latestConv = customer.conversations[0];

  return (
    <Card className={`border-l-4 ${statusClass} transition-all hover:shadow-md`}>
      {/* ── Header ── */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className="flex-shrink-0">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>

        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full ${stageCfg.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
          {customer.displayName.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground truncate">{customer.displayName}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              {stageCfg.icon}
              {stageCfg.label}
            </Badge>
            {customer.totalInquiries > 1 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {customer.totalInquiries} Anfragen
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            {customer.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3" /> {customer.email}
              </span>
            )}
            {customer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> {customer.phone}
              </span>
            )}
          </div>
        </div>

        {/* Right side */}
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

      {/* ── Intent Tags ── */}
      {customer.intentTags.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {customer.intentTags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${INTENT_COLORS[tag] || 'bg-muted text-muted-foreground'}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Expanded Detail ── */}
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

          {/* Journey Stage Editor (if conversation exists) */}
          {latestConv && (
            <div className="px-4 py-3 border-b border-border/30">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> Journey & Status
              </p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={customer.currentStage}
                  onValueChange={(v) => onUpdateStage(latestConv.id, v)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
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

          {/* Interaction Timeline */}
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Kontaktverlauf
            </p>
            <div className="relative pl-4 space-y-3">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />

              {customer.requests.map((req, i) => (
                <div key={req.id} className="relative">
                  {/* Dot */}
                  <div className={`absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background ${
                    i === 0 ? 'bg-accent' : 'bg-muted-foreground/30'
                  }`} />

                  <div className="bg-card rounded-lg border border-border/50 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {req.vehicle_title && (
                          <p className="text-xs font-medium text-foreground flex items-center gap-1">
                            <Car className="w-3 h-3 text-muted-foreground" /> {req.vehicle_title}
                          </p>
                        )}
                        {req.message && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                            „{req.message}"
                          </p>
                        )}
                        {/* Inline interest flags */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {req.interested_test_drive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Probefahrt</span>}
                          {req.interested_trade_in && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Inzahlungnahme</span>}
                          {req.interested_leasing && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Leasing</span>}
                          {req.interested_financing && <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Finanzierung</span>}
                          {req.interested_purchase && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Kauf</span>}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                        {new Date(req.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Conversations timeline entries */}
              {customer.conversations.map((conv) => (
                <div key={conv.id} className="relative">
                  <div className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full border-2 border-background bg-accent/50" />
                  <div className="bg-accent/5 rounded-lg border border-accent/20 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3 h-3 text-accent" />
                      <span className="text-xs font-medium text-foreground">
                        {conv.conversation_title || 'Konversation'}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {CONVERSATION_STATUS_LABELS[conv.status as ConversationStatus] || conv.status}
                      </Badge>
                    </div>
                    {conv.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{conv.summary}</p>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
