import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, ArrowDownLeft, ArrowUpRight, RefreshCw, ChevronDown, ChevronUp, FileEdit, Check, Save } from 'lucide-react';
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

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  vehicle_title: string | null;
  interested_test_drive: boolean;
  interested_trade_in: boolean;
  interested_leasing: boolean;
  interested_financing: boolean;
  interested_purchase: boolean;
  created_at: string;
}

interface EmailEntry {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_text: string | null;
  body_html: string;
  status: string;
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
      supabase.from('leads').select('*').eq('dealer_user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('sales_email_outbox').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
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

  const drafts = emails.filter(e => e.status === 'pending_approval');
  const sentOrQueued = emails.filter(e => e.status !== 'pending_approval');

  const statusLabel = (status: string) => {
    switch (status) {
      case 'queued': return { text: 'Zum Versand', variant: 'default' as const };
      case 'pending_approval': return { text: 'Entwurf', variant: 'secondary' as const };
      case 'sent': return { text: 'Gesendet', variant: 'outline' as const };
      case 'failed': return { text: 'Fehler', variant: 'destructive' as const };
      default: return { text: status, variant: 'secondary' as const };
    }
  };

  const interestBadges = (lead: Lead) => {
    const badges: string[] = [];
    if (lead.interested_test_drive) badges.push('Probefahrt');
    if (lead.interested_trade_in) badges.push('Inzahlungnahme');
    if (lead.interested_leasing) badges.push('Leasing');
    if (lead.interested_financing) badges.push('Finanzierung');
    if (lead.interested_purchase) badges.push('Kauf');
    return badges;
  };

  const startEditing = (email: EmailEntry) => {
    setEditingId(email.id);
    setEditSubject(email.subject);
    setEditBody(email.body_text || '');
  };

  const saveEdit = async (emailId: string) => {
    const { error } = await supabase.from('sales_email_outbox').update({
      subject: editSubject,
      body_text: editBody,
      body_html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${editBody}</pre>`,
    }).eq('id', emailId);
    if (error) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success('Entwurf gespeichert');
      setEditingId(null);
      load();
    }
  };

  const approveDraft = async (emailId: string) => {
    const { error } = await supabase.from('sales_email_outbox').update({
      status: 'queued',
    }).eq('id', emailId);
    if (error) {
      toast.error('Fehler bei der Freigabe');
    } else {
      toast.success('E-Mail freigegeben & zum Versand bereit');
      load();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  const renderLeadCard = (lead: Lead) => {
    const badges = interestBadges(lead);
    const isExpanded = expandedId === `lead-${lead.id}`;
    return (
      <Card key={lead.id} className="overflow-hidden">
        <button
          className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : `lead-${lead.id}`)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="font-medium text-sm text-foreground truncate">{lead.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{lead.email}</p>
              {lead.vehicle_title && (
                <p className="text-xs text-accent mt-0.5 truncate">🚗 {lead.vehicle_title}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">{new Date(lead.created_at).toLocaleString('de-DE')}</p>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto mt-1" />}
            </div>
          </div>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {badges.map(b => <Badge key={b} variant="secondary" className="text-[10px] h-4">{b}</Badge>)}
            </div>
          )}
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-border pt-2 space-y-1.5">
            {lead.phone && <p className="text-xs text-muted-foreground">📞 {lead.phone}</p>}
            {lead.message && (
              <div className="bg-muted/50 rounded-md p-2 text-xs text-foreground whitespace-pre-wrap">
                {lead.message}
              </div>
            )}
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
          onClick={() => { setExpandedId(isExpanded ? null : `email-${email.id}`); if (!isExpanded && editingId !== email.id) setEditingId(null); }}
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
                {showActions && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startEditing(email); }}>
                      <FileEdit className="w-3.5 h-3.5 mr-1" /> Bearbeiten
                    </Button>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); approveDraft(email.id); }}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Freigeben
                    </Button>
                  </div>
                )}
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
          <p className="text-xs text-muted-foreground">Eingehende Anfragen, Entwürfe und ausgehende E-Mails</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="drafts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" className="flex items-center gap-1.5">
            <ArrowDownLeft className="w-4 h-4" /> Posteingang ({leads.length})
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
              {leads.length === 0
                ? <p className="text-sm text-muted-foreground text-center py-8">Noch keine Anfragen eingegangen.</p>
                : leads.map(renderLeadCard)}
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
                ? <p className="text-sm text-muted-foreground text-center py-8">Noch keine E-Mails versendet.</p>
                : sentOrQueued.map(email => renderEmailCard(email, false))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
