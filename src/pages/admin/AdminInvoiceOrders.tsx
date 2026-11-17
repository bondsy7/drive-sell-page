import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Loader2, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react';
import { formatInvoiceEuro } from '@/lib/invoice-order';
import { toast } from 'sonner';

type InvoiceOrder = {
  id: string;
  order_number: string;
  user_id: string | null;
  offer_slug: string;
  offer_name: string;
  offer_kind: 'subscription' | 'credit_pack' | 'service';
  credits: number;
  price_net_cents: number;
  setup_fee_cents: number;
  vat_cents: number;
  total_gross_cents: number;
  billing_company: string;
  billing_contact: string;
  billing_email: string;
  billing_phone: string | null;
  billing_street: string;
  billing_postal_code: string;
  billing_city: string;
  billing_country: string;
  billing_tax_id: string | null;
  notes: string | null;
  payment_term_days: number;
  status: 'pending' | 'activated' | 'cancelled';
  invoice_status: 'not_sent' | 'sent';
  payment_status: 'unpaid' | 'paid';
  invoice_number: string | null;
  created_at: string;
  activated_at: string | null;
};

type Account = { id: string; email: string | null; company_name: string | null; contact_name: string | null };
type Approval = { user_id: string; status: string };

export default function AdminInvoiceOrders() {
  const [orders, setOrders] = useState<InvoiceOrder[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'open' | 'activated' | 'cancelled' | 'all'>('open');
  const [invoiceNumbers, setInvoiceNumbers] = useState<Record<string, string>>({});
  const [activationOrder, setActivationOrder] = useState<InvoiceOrder | null>(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-invoice-orders', { body });
    if (error || data?.error) throw new Error(data?.error || error?.message || 'Die Aktion ist fehlgeschlagen.');
    return data;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: 'list' });
      setOrders(data.orders || []);
      setAccounts(data.users || []);
      setApprovals(data.approvals || []);
      setInvoiceNumbers(Object.fromEntries((data.orders || []).map((order: InvoiceOrder) => [order.id, order.invoice_number || ''])));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Rechnungsaufträge konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { void load(); }, [load]);

  const runAction = async (order: InvoiceOrder, action: string, extra: Record<string, unknown> = {}) => {
    const key = `${order.id}-${action}`;
    setBusy(key);
    try {
      const data = await invoke({ action, orderId: order.id, ...extra });
      if (data.order) setOrders((current) => current.map((item) => item.id === order.id ? data.order : item));
      if (action === 'activate') toast.success(`${order.offer_name} wurde manuell freigegeben.`);
      else if (action === 'mark_invoiced') toast.success('Rechnungsversand wurde erfasst.');
      else if (action === 'mark_paid') toast.success('Zahlungseingang wurde erfasst – keine automatische Freigabe.');
      else if (action === 'mark_unpaid') toast.success('Zahlungsstatus wurde zurückgesetzt.');
      else if (action === 'cancel') toast.success('Auftrag wurde storniert.');
      setActivationOrder(null);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Die Aktion ist fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => orders.filter((order) => {
    const matchesFilter = filter === 'all' || (filter === 'open' ? order.status === 'pending' : order.status === filter);
    const haystack = `${order.order_number} ${order.billing_company} ${order.billing_email} ${order.offer_name}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  }), [orders, filter, search]);

  const accountLabel = (order: InvoiceOrder) => {
    const account = accounts.find((item) => item.id === order.user_id);
    return account ? `${account.company_name || account.contact_name || 'Konto'} (${account.email})` : 'Noch kein Konto zugeordnet';
  };

  const isApproved = (userId: string) => {
    const approval = approvals.find((item) => item.user_id === userId);
    return !approval || approval.status === 'approved';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Rechnungsaufträge</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Rechnung, Zahlung und Leistungsfreigabe werden getrennt erfasst. Nur „Leistung freigeben“ aktiviert einen Tarif oder Credits.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Aktualisieren</Button>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_220px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Rechnungsaufträge suchen" className="pl-9" placeholder="Bestellnummer, Firma, E-Mail oder Leistung" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <select aria-label="Auftragsstatus filtern" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
          <option value="open">Offene Aufträge</option><option value="activated">Freigegeben</option><option value="cancelled">Storniert</option><option value="all">Alle Aufträge</option>
        </select>
      </div>

      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Keine passenden Rechnungsaufträge gefunden.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const needsAccount = order.offer_kind !== 'service';
            const approved = order.user_id ? isApproved(order.user_id) : false;
            return (
              <article key={order.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold">{order.order_number} · {order.offer_name}</h2>
                      <Badge variant={order.status === 'activated' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'secondary'}>{order.status === 'activated' ? 'Freigegeben' : order.status === 'cancelled' ? 'Storniert' : 'Wartet auf Prüfung'}</Badge>
                      <Badge variant="outline">{order.invoice_status === 'sent' ? 'Rechnung versendet' : 'Rechnung offen'}</Badge>
                      <Badge variant="outline">{order.payment_status === 'paid' ? 'Bezahlt' : 'Unbezahlt'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{order.billing_company} · {order.billing_email} · {new Date(order.created_at).toLocaleString('de-DE')}</p>
                  </div>
                  <div className="text-right"><p className="text-lg font-bold">{formatInvoiceEuro(order.total_gross_cents)}</p><p className="text-xs text-muted-foreground">inkl. {formatInvoiceEuro(order.vat_cents)} USt.</p></div>
                </div>

                <div className="mt-4 grid gap-4 border-t border-border pt-4 text-sm lg:grid-cols-3">
                  <div><p className="font-semibold">Rechnungsadresse</p><p className="mt-1 text-muted-foreground">{order.billing_contact}<br />{order.billing_street}<br />{order.billing_postal_code} {order.billing_city}<br />{order.billing_country}{order.billing_tax_id ? <><br />USt.-IdNr.: {order.billing_tax_id}</> : null}</p></div>
                  <div><p className="font-semibold">Abrechnung</p><p className="mt-1 text-muted-foreground">Leistung netto: {formatInvoiceEuro(order.price_net_cents)}<br />Einrichtung: {formatInvoiceEuro(order.setup_fee_cents)}<br />Zahlungsziel: {order.payment_term_days} Tage ab Rechnungserhalt{order.credits > 0 ? <><br />Credits: {order.credits}</> : null}</p></div>
                  <div><p className="font-semibold">Zugeordnetes Konto</p><p className="mt-1 text-muted-foreground">{accountLabel(order)}</p>{order.user_id && needsAccount && !approved && <p className="mt-1 text-xs text-destructive">Dieses Konto ist noch nicht freigegeben.</p>}{order.notes && <p className="mt-2 text-xs text-muted-foreground">Bemerkung: {order.notes}</p>}</div>
                </div>

                {order.status !== 'activated' && order.status !== 'cancelled' && (
                  <div className="mt-5 space-y-4 border-t border-border pt-4">
                    {needsAccount && (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <label className="text-xs font-medium">Konto für die spätere Leistungsfreigabe
                          <select aria-label={`Konto für ${order.order_number} zuordnen`} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={order.user_id || ''} disabled={busy !== null} onChange={(event) => event.target.value && void runAction(order, 'assign_user', { userId: event.target.value })}>
                            <option value="">Konto auswählen …</option>
                            {accounts.map((account) => <option key={account.id} value={account.id}>{account.company_name || account.contact_name || 'Konto'} · {account.email}{isApproved(account.id) ? '' : ' · nicht freigegeben'}</option>)}
                          </select>
                        </label>
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                      {order.invoice_status === 'not_sent' && <div className="flex min-w-64 flex-1 gap-2 sm:flex-none"><Input aria-label={`Rechnungsnummer für ${order.order_number}`} placeholder="Rechnungsnummer" value={invoiceNumbers[order.id] || ''} onChange={(event) => setInvoiceNumbers((current) => ({ ...current, [order.id]: event.target.value }))} /><Button variant="outline" disabled={busy !== null || !(invoiceNumbers[order.id] || '').trim()} onClick={() => void runAction(order, 'mark_invoiced', { invoiceNumber: invoiceNumbers[order.id] })}>Rechnung versendet</Button></div>}
                      {order.invoice_status === 'sent' && <span className="flex h-10 items-center text-xs text-muted-foreground">Rechnungsnr. {order.invoice_number}</span>}
                      <Button variant="outline" disabled={busy !== null} onClick={() => void runAction(order, order.payment_status === 'paid' ? 'mark_unpaid' : 'mark_paid')}>{order.payment_status === 'paid' ? 'Zahlung zurücksetzen' : 'Zahlung erfassen'}</Button>
                      <Button disabled={busy !== null || (needsAccount && (!order.user_id || !approved))} title={needsAccount && !order.user_id ? 'Zuerst ein Konto zuordnen' : needsAccount && !approved ? 'Das Konto muss zuerst freigegeben werden' : ''} onClick={() => setActivationOrder(order)}><ShieldCheck className="mr-2 h-4 w-4" />Leistung freigeben</Button>
                      <Button variant="ghost" className="text-destructive" disabled={busy !== null} onClick={() => void runAction(order, 'cancel')}><XCircle className="mr-2 h-4 w-4" />Stornieren</Button>
                    </div>
                  </div>
                )}
                {busy?.startsWith(order.id) && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Wird gespeichert …</p>}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={activationOrder !== null} onOpenChange={(open) => !open && setActivationOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Leistung wirklich freigeben?</DialogTitle><DialogDescription>Dies ist die einzige Aktion, die den Service aktiviert. Rechnungs- und Zahlungsstatus lösen keine Aktivierung aus.</DialogDescription></DialogHeader>
          {activationOrder && <div className="rounded-lg bg-muted/50 p-4 text-sm"><p><strong>{activationOrder.order_number}</strong> · {activationOrder.offer_name}</p><p className="mt-1 text-muted-foreground">{activationOrder.billing_company}<br />{accountLabel(activationOrder)}</p>{activationOrder.credits > 0 && <p className="mt-2">Es werden {activationOrder.credits} Credits entsprechend der Leistungsart verarbeitet.</p>}</div>}
          <DialogFooter><Button variant="outline" onClick={() => setActivationOrder(null)}>Abbrechen</Button><Button disabled={!activationOrder || busy !== null} onClick={() => activationOrder && void runAction(activationOrder, 'activate')}><Check className="mr-2 h-4 w-4" />Jetzt manuell freigeben</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
