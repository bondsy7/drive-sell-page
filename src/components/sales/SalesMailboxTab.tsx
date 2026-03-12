import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Inbox, ArrowDownLeft, ArrowUpRight, RefreshCw, ChevronDown, ChevronUp, FileEdit, Check, Save, UserRound, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { groupLeadsByCustomer, type LeadForGrouping } from '@/lib/sales-customer-utils';

interface Lead extends LeadForGrouping {
  interested_test_drive: boolean;
  interested_trade_in: boolean;
  interested_leasing: boolean;
  interested_financing: boolean;
  interested_purchase: boolean;
}

interface EmailEntry {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_text: string | null;
  body_html: string;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
}

export default function SalesMailboxTab() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [leadsRes, emailsRes] = await Promise.all([
      supabase.from('leads').select('*').eq('dealer_user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('sales_email_outbox').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(120),
    ]);
    setLeads((leadsRes.data as any) || []);
    setEmails((emailsRes.data as any) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('mailbox-leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `dealer_user_id=eq.${user.id}` },
        (payload: any) => setLeads(prev => [payload.new as Lead, ...prev])
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_email_outbox', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const customerThreads = useMemo(() => groupLeadsByCustomer(leads), [leads]);
  const drafts = emails.filter(e => e.status === 'pending_approval');
  const sentOrQueued = emails.filter(e => e.status !== 'pending_approval');

  const statusLabel = (status: string) => {
    switch (status) {
      case 'queued': return { text: 'In Zustellung', variant: 'default' as const };
      case 'pending_approval': return { text: 'Entwurf', variant: 'secondary' as const };
      case 'sent': return { text: 'Gesendet', variant: 'outline' as const };
      case 'failed': return { text: 'Fehler', variant: 'destructive' as const };
      default: return { text: status, variant: 'secondary' as const };
    }
  };

  const startEditing = (email: EmailEntry) => {
    setEditingId(email.id);
    setEditSubject(email.subject);
    setEditBody(email.body_text || '');
  };

  const saveEdit = async (emailId: string) => {
    const bodyHtml = `<div style=\"font-family:sans-serif;line-height:1.6;white-space:pre-wrap\">${editBody.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;

    const { error } = await supabase.from('sales_email_outbox').update({
      subject: editSubject,
      body_text: editBody,
      body_html: bodyHtml,
    }).eq('id', emailId);

    if (error) {
      toast.error('Fehler beim Speichern');
      return;
    }

    toast.success('Entwurf gespeichert');
    setEditingId(null);
    load();
  };

  const triggerDelivery = async (emailId: string, silent = false) => {
    const { error } = await supabase.functions.invoke('process-sales-email', { body: { emailId } });
    if (error) {
      toast.error('Versand konnte nicht gestartet werden');
      return;
    }
    if (!silent) toast.success('Versand gestartet');
    load();
  };

  const approveDraft = async (emailId: string) => {
    const { error } = await supabase.from('sales_email_outbox').update({
      status: 'queued',
      error_message: null,
    }).eq('id', emailId);

    if (error) {
      toast.error('Fehler bei der Freigabe');
      return;
    }

    await supabase.from('sales_notifications').update({
      approval_status: 'approved',
      is_read: true,
    }).contains('action_payload', { emailId });

    await triggerDelivery(emailId, true);
    toast.success('Entwurf freigegeben und Versand gestartet');
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  const renderCustomerCard = (thread: ReturnType<typeof groupLeadsByCustomer>[number]) => {
    const isExpanded = expandedId === `customer-${thread.key}`;

    return (
      <Card key={thread.key} className="overflow-hidden">
        <button
          className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : `customer-${thread.key}`)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <UserRound className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-medium text-sm text-foreground truncate">{thread.displayName}</span>
                <Badge variant="outline" className="text-[10px] h-4">{thread.totalInquiries} Anfragen</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{thread.email}</p>
              {thread.vehicles.length > 0 && (
                <p className="text-xs text-accent mt-0.5 truncate">🚗 {thread.vehicles.join(' • ')}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">{new Date(thread.latestAt).toLocaleString('de-DE')}</p>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto mt-1" />}
            </div>
          </div>

          {thread.intentTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {thread.intentTags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px] h-4">{tag}</Badge>)}
            </div>
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
            {thread.phone && <p className="text-xs text-muted-foreground">📞 {thread.phone}</p>}

            <div className="space-y-2">
              {thread.requests.map((request) => (
                <div key={request.id} className="rounded-md bg-muted/50 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>{new Date(request.created_at).toLocaleString('de-DE')}</span>
                    {request.vehicle_title && <span className="truncate text-accent">{request.vehicle_title}</span>}
                  </div>
                  {request.message && <p className="text-foreground whitespace-pre-wrap">{request.message}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderEmailCard = (email: EmailEntry, showActions: boolean) => {
    const st = statusLabel(email.status);
    const isExpanded = expandedId === `email-${email.id}`;
    const isEditing = editingId === email.id;

    return (
      <Card key={email.id} className="overflow-hidden">
        <button
          className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
          onClick={() => {
            setExpandedId(isExpanded ? null : `email-${email.id}`);
            if (!isExpanded && editingId !== email.id) setEditingId(null);
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {showActions ? <FileEdit className="w-3.5 h-3.5 text-accent shrink-0" /> : <ArrowUpRight className="w-3.5 h-3.5 text-primary shrink-0" />}
                <span className="font-medium text-sm text-foreground truncate">{email.to_name || email.to_email}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">📧 {email.subject}</p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <Badge variant={st.variant} className="text-[10px] h-4">{st.text}</Badge>
              <p className="text-[10px] text-muted-foreground">
                {email.sent_at ? new Date(email.sent_at).toLocaleString('de-DE') : new Date(email.created_at).toLocaleString('de-DE')}
              </p>
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
            <p className="text-xs text-muted-foreground">An: {email.to_name || ''} &lt;{email.to_email}&gt;</p>

            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Betreff</label>
                  <Input value={editSubject} onChange={e => setEditSubject(e.target.value)} className="mt-1 text-xs h-8" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nachricht</label>
                  <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} className="mt-1 text-xs min-h-[120px]" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Abbrechen</Button>
                  <Button size="sm" onClick={() => saveEdit(email.id)}>
                    <Save className="w-3.5 h-3.5 mr-1" /> Speichern
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Betreff: {email.subject}</p>
                <div className="bg-muted/50 rounded-md p-2.5 text-xs text-foreground whitespace-pre-wrap mt-1">
                  {email.body_text || 'Kein Text verfügbar'}
                </div>

                {email.status === 'failed' && email.error_message && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-foreground flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-destructive" />
                    <span>{email.error_message}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {showActions && (
                    <>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEditing(email); }}>
                        <FileEdit className="w-3.5 h-3.5 mr-1" /> Bearbeiten
                      </Button>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); approveDraft(email.id); }}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Freigeben
                      </Button>
                    </>
                  )}

                  {(email.status === 'queued' || email.status === 'failed') && (
                    <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); triggerDelivery(email.id); }}>
                      <Send className="w-3.5 h-3.5 mr-1" /> Jetzt senden
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Inbox className="w-5 h-5" /> Postfach
          </h2>
          <p className="text-xs text-muted-foreground">Kundenprofile, Entwürfe und Versandstatus zentral verwalten</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-1.5">
            <ArrowDownLeft className="w-4 h-4" /> Kunden ({customerThreads.length})
          </TabsTrigger>
          <TabsTrigger value="drafts" className="flex items-center gap-1.5">
            <FileEdit className="w-4 h-4" /> Entwürfe ({drafts.length})
          </TabsTrigger>
          <TabsTrigger value="outbox" className="flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4" /> Postausgang ({sentOrQueued.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <ScrollArea className="h-[calc(100vh-24rem)]">
            <div className="space-y-2">
              {customerThreads.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Noch keine Anfragen eingegangen.</p>
                : customerThreads.map(renderCustomerCard)}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="drafts">
          <ScrollArea className="h-[calc(100vh-24rem)]">
            <div className="space-y-2">
              {drafts.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Keine Entwürfe vorhanden.</p>
                : drafts.map(email => renderEmailCard(email, true))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="outbox">
          <ScrollArea className="h-[calc(100vh-24rem)]">
            <div className="space-y-2">
              {sentOrQueued.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Noch keine E-Mails vorhanden.</p>
                : sentOrQueued.map(email => renderEmailCard(email, false))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
