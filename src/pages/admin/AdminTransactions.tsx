import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, RefreshCw, Undo2, CreditCard, FileText, Receipt, Crown, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  model_used: string | null;
  description: string | null;
  created_at: string;
  user_email?: string;
}

interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_email: string | null;
  customer_name: string | null;
  description: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  metadata: Record<string, string>;
  refunded: boolean;
  amount_refunded: number;
}

interface StripeInvoice {
  id: string;
  number: string | null;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  period_start: number;
  period_end: number;
  customer_email: string | null;
  customer_name: string | null;
  subscription_id: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  billing_reason: string | null;
}

interface StripeSub {
  id: string;
  status: string;
  created: number;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  customer_email: string | null;
  customer_name: string | null;
  plan_name: string;
  plan_interval: string | null;
  plan_amount: number;
  currency: string;
}

interface StripeRefund {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  reason: string | null;
  payment_intent_id: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtMoney = (amount: number, currency = 'eur') => (amount / 100).toLocaleString('de-DE', { style: 'currency', currency: currency.toUpperCase() });

const STATUS_COLORS: Record<string, string> = {
  succeeded: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  open: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  trialing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  requires_payment_method: 'bg-red-500/10 text-red-500 border-red-500/20',
  canceled: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-muted text-muted-foreground border-border',
  incomplete: 'bg-red-500/10 text-red-500 border-red-500/20',
  past_due: 'bg-red-500/10 text-red-500 border-red-500/20',
  void: 'bg-muted text-muted-foreground border-border',
  draft: 'bg-muted text-muted-foreground border-border',
  uncollectible: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const REFUND_REASONS: Record<string, string> = {
  requested_by_customer: 'Kundenwunsch',
  duplicate: 'Doppelt',
  fraudulent: 'Betrug',
};

// ─── Stripe API call helper ──────────────────────────────────────────────────

async function stripeAdmin(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-stripe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminTransactions() {
  const [tab, setTab] = useState('credits');
  const [search, setSearch] = useState('');

  // Credit transactions
  const [credits, setCredits] = useState<CreditTransaction[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);

  // Stripe data
  const [payments, setPayments] = useState<StripePayment[]>([]);
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [subs, setSubs] = useState<StripeSub[]>([]);
  const [refunds, setRefunds] = useState<StripeRefund[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Refund dialog
  const [refundTarget, setRefundTarget] = useState<StripePayment | null>(null);
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refundPartial, setRefundPartial] = useState('');
  const [refunding, setRefunding] = useState(false);

  // Cancel sub dialog
  const [cancelTarget, setCancelTarget] = useState<StripeSub | null>(null);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadCredits = useCallback(async () => {
    setCreditsLoading(true);
    const { data } = await supabase
      .from('credit_transactions' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    const userIds = [...new Set(((data as any[]) || []).map((t: any) => t.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', userIds);
    const emailMap: Record<string, string> = {};
    for (const p of (profiles as any[]) || []) emailMap[p.id] = p.email || '';

    setCredits(((data as any[]) || []).map((t: any) => ({ ...t, user_email: emailMap[t.user_id] || t.user_id.slice(0, 8) })));
    setCreditsLoading(false);
  }, []);

  const loadStripeData = useCallback(async (type: string) => {
    setStripeLoading(true);
    try {
      if (type === 'payments') {
        const res = await stripeAdmin('list_payments');
        setPayments(res.payments || []);
      } else if (type === 'invoices') {
        const res = await stripeAdmin('list_invoices');
        setInvoices(res.invoices || []);
      } else if (type === 'subscriptions') {
        const res = await stripeAdmin('list_subscriptions');
        setSubs(res.subscriptions || []);
      } else if (type === 'refunds') {
        const res = await stripeAdmin('list_refunds');
        setRefunds(res.refunds || []);
      }
    } catch (err: any) {
      toast.error('Stripe-Fehler: ' + err.message);
    }
    setStripeLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'credits') loadCredits();
    else if (tab === 'payments') loadStripeData('payments');
    else if (tab === 'invoices') loadStripeData('invoices');
    else if (tab === 'subscriptions') loadStripeData('subscriptions');
    else if (tab === 'refunds') loadStripeData('refunds');
  }, [tab, loadCredits, loadStripeData]);

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const params: any = { payment_intent_id: refundTarget.id, reason: refundReason };
      if (refundPartial) params.amount = Math.round(parseFloat(refundPartial) * 100);
      await stripeAdmin('refund', params);
      toast.success('Erstattung erfolgreich');
      setRefundTarget(null);
      setRefundPartial('');
      loadStripeData('payments');
      loadStripeData('refunds');
    } catch (err: any) {
      toast.error('Erstattung fehlgeschlagen: ' + err.message);
    }
    setRefunding(false);
  };

  const handleCancelSub = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await stripeAdmin('cancel_subscription', { subscription_id: cancelTarget.id, immediate: cancelImmediate });
      toast.success(cancelImmediate ? 'Abo sofort gekündigt' : 'Abo wird zum Periodenende gekündigt');
      setCancelTarget(null);
      loadStripeData('subscriptions');
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    }
    setCancelling(false);
  };

  const refreshTab = () => {
    if (tab === 'credits') loadCredits();
    else loadStripeData(tab);
  };

  const Loader = () => (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  // Filter helper
  const filterByEmail = (email: string | null) =>
    !search || (email || '').toLowerCase().includes(search.toLowerCase());

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Zahlungen & Transaktionen</h1>
        <Button variant="outline" size="sm" onClick={refreshTab} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Aktualisieren
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Nach E-Mail suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="credits" className="gap-1.5 text-xs sm:text-sm">
            <Receipt className="w-3.5 h-3.5 hidden sm:block" /> Credits
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm">
            <CreditCard className="w-3.5 h-3.5 hidden sm:block" /> Zahlungen
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="w-3.5 h-3.5 hidden sm:block" /> Rechnungen
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="gap-1.5 text-xs sm:text-sm">
            <Crown className="w-3.5 h-3.5 hidden sm:block" /> Abos
          </TabsTrigger>
          <TabsTrigger value="refunds" className="gap-1.5 text-xs sm:text-sm">
            <Undo2 className="w-3.5 h-3.5 hidden sm:block" /> Erstattungen
          </TabsTrigger>
        </TabsList>

        {/* ── Credit Transactions ───────────────────────────────────────────── */}
        <TabsContent value="credits">
          {creditsLoading ? <Loader /> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Nutzer</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Aktion</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Credits</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Modell</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Beschreibung</th>
                  </tr>
                </thead>
                <tbody>
                  {credits
                    .filter(t => !search || (t.user_email || '').toLowerCase().includes(search.toLowerCase()) || t.action_type.includes(search.toLowerCase()) || (t.description || '').toLowerCase().includes(search.toLowerCase()))
                    .map(t => (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-foreground truncate max-w-[150px]">{t.user_email}</td>
                        <td className="p-3 capitalize text-foreground">{t.action_type.replace(/_/g, ' ')}</td>
                        <td className={`p-3 text-center font-semibold ${t.amount < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount}
                        </td>
                        <td className="p-3 text-muted-foreground">{t.model_used || '—'}</td>
                        <td className="p-3 text-muted-foreground truncate max-w-[200px]">{t.description || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {credits.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Transaktionen</p>}
            </div>
          )}
        </TabsContent>

        {/* ── Stripe Payments ───────────────────────────────────────────────── */}
        <TabsContent value="payments">
          {stripeLoading ? <Loader /> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Kunde</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Betrag</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Rechnung</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.filter(p => filterByEmail(p.customer_email)).map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(p.created)}</td>
                      <td className="p-3">
                        <div className="text-foreground truncate max-w-[180px]">{p.customer_email || '—'}</div>
                        {p.customer_name && <div className="text-xs text-muted-foreground">{p.customer_name}</div>}
                      </td>
                      <td className="p-3 text-right font-semibold text-foreground">{fmtMoney(p.amount, p.currency)}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[p.status] || ''}`}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{p.invoice_number || '—'}</td>
                      <td className="p-3">
                        {p.status === 'succeeded' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => { setRefundTarget(p); setRefundPartial(''); }}
                          >
                            <Undo2 className="w-3 h-3" /> Erstatten
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Zahlungen gefunden</p>}
            </div>
          )}
        </TabsContent>

        {/* ── Invoices ──────────────────────────────────────────────────────── */}
        <TabsContent value="invoices">
          {stripeLoading ? <Loader /> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Nr.</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Kunde</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Grund</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Betrag</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Zeitraum</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.filter(inv => filterByEmail(inv.customer_email)).map(inv => (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="p-3 text-foreground font-mono text-xs">{inv.number || '—'}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(inv.created)}</td>
                      <td className="p-3">
                        <div className="text-foreground truncate max-w-[160px]">{inv.customer_email || '—'}</div>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs capitalize">
                        {inv.billing_reason?.replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-foreground">{fmtMoney(inv.amount_paid || inv.amount_due, inv.currency)}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[inv.status] || ''}`}>
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDate(inv.period_start).split(',')[0]} – {fmtDate(inv.period_end).split(',')[0]}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {inv.hosted_invoice_url && (
                            <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2"><ExternalLink className="w-3.5 h-3.5" /></Button>
                            </a>
                          )}
                          {inv.invoice_pdf && (
                            <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 px-2"><FileText className="w-3.5 h-3.5" /></Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoices.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Rechnungen</p>}
            </div>
          )}
        </TabsContent>

        {/* ── Subscriptions ─────────────────────────────────────────────────── */}
        <TabsContent value="subscriptions">
          {stripeLoading ? <Loader /> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Kunde</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Plan</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Preis</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Aktuelle Periode</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Erstellt</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.filter(s => filterByEmail(s.customer_email)).map(s => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="p-3">
                        <div className="text-foreground truncate max-w-[180px]">{s.customer_email || '—'}</div>
                        {s.customer_name && <div className="text-xs text-muted-foreground">{s.customer_name}</div>}
                      </td>
                      <td className="p-3 text-foreground font-medium">
                        {s.plan_name}
                        {s.plan_interval && <span className="text-muted-foreground text-xs ml-1">/ {s.plan_interval === 'year' ? 'Jahr' : 'Monat'}</span>}
                      </td>
                      <td className="p-3 text-right font-semibold text-foreground">{fmtMoney(s.plan_amount, s.currency)}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[s.status] || ''}`}>
                          {s.status}
                        </Badge>
                        {s.cancel_at_period_end && (
                          <div className="text-[10px] text-amber-600 mt-0.5">kündigt zum Ende</div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {fmtDate(s.current_period_start).split(',')[0]} – {fmtDate(s.current_period_end).split(',')[0]}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{fmtDate(s.created).split(',')[0]}</td>
                      <td className="p-3">
                        {s.status === 'active' && !s.cancel_at_period_end && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1 text-xs text-amber-600 hover:text-amber-700"
                            onClick={() => { setCancelTarget(s); setCancelImmediate(false); }}
                          >
                            Kündigen
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {subs.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Abonnements</p>}
            </div>
          )}
        </TabsContent>

        {/* ── Refunds ───────────────────────────────────────────────────────── */}
        <TabsContent value="refunds">
          {stripeLoading ? <Loader /> : (
            <div className="bg-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Erstattungs-ID</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Betrag</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Grund</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Zahlung</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(r => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.created)}</td>
                      <td className="p-3 text-foreground font-mono text-xs">{r.id.slice(0, 20)}…</td>
                      <td className="p-3 text-right font-semibold text-foreground">{fmtMoney(r.amount, r.currency)}</td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLORS[r.status] || ''}`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.reason ? (REFUND_REASONS[r.reason] || r.reason) : '—'}</td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">{r.payment_intent_id?.slice(0, 16) || '—'}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {refunds.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Erstattungen</p>}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Refund Dialog ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!refundTarget} onOpenChange={open => !open && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zahlung erstatten</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Zahlung von <strong>{refundTarget?.customer_email}</strong> über{' '}
                  <strong>{refundTarget ? fmtMoney(refundTarget.amount, refundTarget.currency) : ''}</strong> erstatten.
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Erstattungsbetrag (leer = vollständig)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={refundTarget ? (refundTarget.amount / 100).toFixed(2) : ''}
                    value={refundPartial}
                    onChange={e => setRefundPartial(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Grund</label>
                  <Select value={refundReason} onValueChange={setRefundReason}>
                    <SelectTrigger className="max-w-[250px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="requested_by_customer">Kundenwunsch</SelectItem>
                      <SelectItem value="duplicate">Doppelte Zahlung</SelectItem>
                      <SelectItem value="fraudulent">Betrug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} disabled={refunding} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {refunding ? 'Wird erstattet...' : 'Erstatten'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Cancel Subscription Dialog ─────────────────────────────────────── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abo kündigen</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Das Abo <strong>{cancelTarget?.plan_name}</strong> von <strong>{cancelTarget?.customer_email}</strong> kündigen.
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!cancelImmediate}
                      onChange={() => setCancelImmediate(false)}
                      className="accent-primary"
                    />
                    <span className="text-sm">Zum Periodenende ({cancelTarget ? fmtDate(cancelTarget.current_period_end).split(',')[0] : ''})</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={cancelImmediate}
                      onChange={() => setCancelImmediate(true)}
                      className="accent-destructive"
                    />
                    <span className="text-sm text-destructive">Sofort kündigen (keine Rückerstattung)</span>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelSub} disabled={cancelling} className={cancelImmediate ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>
              {cancelling ? 'Wird gekündigt...' : 'Abo kündigen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
