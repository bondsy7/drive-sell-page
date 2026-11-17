import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import {
  calculateInvoiceTotals,
  formatInvoiceEuro,
  getInvoiceOffer,
  INVOICE_OFFERS,
  INVOICE_PAYMENT_TERM_DAYS,
} from '@/lib/invoice-order';
import { Building2, Check, ChevronLeft, FileCheck2, FileText, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['Leistung wählen', 'Rechnungsdaten', 'Auftrag prüfen', 'Bestätigung'];

type SubmittedOrder = {
  orderNumber: string;
  offerName: string;
  totalGrossCents: number;
  paymentTermDays: number;
};

const Checkout = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [slug, setSlug] = useState(params.get('plan') || 'advanced');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Deutschland');
  const [taxId, setTaxId] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);
  const [business, setBusiness] = useState(false);
  const [website, setWebsite] = useState('');
  const [firstBooking, setFirstBooking] = useState<boolean | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);
  const [emailSent, setEmailSent] = useState(true);
  const requestId = useRef(crypto.randomUUID());
  const startedAt = useRef(Date.now());

  const offer = useMemo(() => getInvoiceOffer(slug) ?? getInvoiceOffer('advanced')!, [slug]);
  const totals = useMemo(() => calculateInvoiceTotals(offer, firstBooking !== false), [offer, firstBooking]);

  useEffect(() => {
    if (!user) return;
    setEmail((value) => value || user.email || '');
    void (async () => {
      const [{ data: profile }, { data: subscriptions }, { data: previousOrders }] = await Promise.all([
        supabase.from('profiles')
          .select('company_name, contact_name, phone, email, address, postal_code, city, tax_id')
          .eq('id', user.id).maybeSingle(),
        supabase.from('user_subscriptions').select('id').eq('user_id', user.id).limit(1),
        supabase.from('invoice_orders').select('id').eq('user_id', user.id)
          .gt('setup_fee_cents', 0).neq('status', 'cancelled').limit(1),
      ]);
      if (profile) {
        setCompany((value) => value || profile.company_name || '');
        setContact((value) => value || profile.contact_name || '');
        setPhone((value) => value || profile.phone || '');
        setEmail((value) => value || profile.email || user.email || '');
        setStreet((value) => value || profile.address || '');
        setPostalCode((value) => value || profile.postal_code || '');
        setCity((value) => value || profile.city || '');
        setTaxId((value) => value || profile.tax_id || '');
      }
      setFirstBooking((subscriptions?.length ?? 0) === 0 && (previousOrders?.length ?? 0) === 0);
    })();
  }, [user]);

  const dataComplete = company.trim().length > 1 && contact.trim().length > 1 && /\S+@\S+\.\S+/.test(email)
    && street.trim().length > 1 && postalCode.trim().length > 1 && city.trim().length > 1 && country.trim().length > 1;

  const chooseOffer = (nextSlug: string) => {
    setSlug(nextSlug);
    requestId.current = crypto.randomUUID();
    startedAt.current = Date.now();
  };

  const startCheckout = async () => {
    if (!dataComplete || !terms || !business) return;
    setLoading(true);
    try {
      if (user) {
        await supabase.from('profiles').update({
          company_name: company.trim(), contact_name: contact.trim(), phone: phone.trim(), email: email.trim(),
          address: street.trim(), postal_code: postalCode.trim(), city: city.trim(), tax_id: taxId.trim(),
        }).eq('id', user.id);
      }
      const { data, error } = await supabase.functions.invoke('create-invoice-order', {
        body: {
          offerSlug: offer.slug,
          requestId: requestId.current,
          company, contact, email, phone, street, postalCode, city, country, taxId, notes,
          termsAccepted: terms,
          businessConfirmed: business,
          startedAt: startedAt.current,
          website,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Bestellung fehlgeschlagen');
      if (!data?.order?.orderNumber) throw new Error('Die Bestellnummer fehlt in der Bestätigung.');
      setSubmittedOrder(data.order);
      setEmailSent(data.emailSent !== false);
      setStep(4);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Der Rechnungsauftrag konnte nicht gesendet werden.');
    } finally {
      setLoading(false);
    }
  };

  const resetCheckout = () => {
    setSubmittedOrder(null);
    setTerms(false);
    setBusiness(false);
    setStep(1);
    requestId.current = crypto.randomUUID();
    startedAt.current = Date.now();
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/pricing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Zurück zu den Preisen
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Direkt auf Rechnung buchen</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Ohne Kreditkarte bestellen.</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Wähle eine Leistung und sende deinen Rechnungsauftrag. Ein Konto ist für die Bestellung nicht erforderlich.
        </p>

        <ol className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const done = step > number;
            const active = step === number;
            return (
              <li key={label} className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  active ? 'bg-primary text-primary-foreground' : done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {done ? <Check className="h-4 w-4" /> : number}
                </span>
                <span className={`text-sm ${active ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><span className="text-primary">1.</span> Leistung wählen</h2>
              {step === 1 ? (
                <>
                  <Label htmlFor="offer" className="mt-5 block">Tarif, Credit-Paket oder Zusatzleistung</Label>
                  <select
                    id="offer"
                    value={offer.slug}
                    onChange={(event) => chooseOffer(event.target.value)}
                    className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <optgroup label="Abos und Credit-Pakete">
                      {INVOICE_OFFERS.filter((item) => item.kind !== 'service').map((item) => <option key={item.slug} value={item.slug}>{item.subtitle}: {item.name}</option>)}
                    </optgroup>
                    <optgroup label="Zusatzleistungen und Einzelsets">
                      {INVOICE_OFFERS.filter((item) => item.kind === 'service').map((item) => <option key={item.slug} value={item.slug}>{item.name} · {item.unit}</option>)}
                    </optgroup>
                  </select>
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{offer.subtitle}</p>
                    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xl font-semibold">{offer.name}</h3>
                      <p className="text-xl font-bold">{offer.fromPrice ? 'ab ' : ''}{formatInvoiceEuro(offer.priceCents)} <span className="text-sm font-normal text-muted-foreground">{offer.unit}</span></p>
                    </div>
                    <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      {offer.bullets.map((bullet) => <li key={bullet} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{bullet}</li>)}
                    </ul>
                  </div>
                  <Button className="mt-5" onClick={() => setStep(2)}>Weiter zu den Rechnungsdaten</Button>
                </>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                  <span><strong>{offer.name}</strong> · {offer.fromPrice ? 'ab ' : ''}{formatInvoiceEuro(offer.priceCents)} {offer.unit}</span>
                  {step < 4 && <button type="button" className="shrink-0 text-primary hover:underline" onClick={() => setStep(1)}>Ändern</button>}
                </div>
              )}
            </section>

            <section className={`rounded-xl border bg-card p-6 shadow-sm ${step === 2 ? 'border-primary/40' : 'border-border'}`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><Building2 className="h-5 w-5 text-primary" /> 2. Rechnungsdaten</h2>
              {step >= 2 ? (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">Diese Angaben werden für die Rechnungsstellung verwendet.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div><Label htmlFor="company">Unternehmensname *</Label><Input id="company" autoComplete="organization" value={company} onChange={(event) => setCompany(event.target.value)} /></div>
                    <div><Label htmlFor="contact">Ansprechpartner *</Label><Input id="contact" autoComplete="name" value={contact} onChange={(event) => setContact(event.target.value)} /></div>
                    <div><Label htmlFor="email">Rechnungs-E-Mail *</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
                    <div><Label htmlFor="phone">Telefon</Label><Input id="phone" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="street">Straße und Hausnummer *</Label><Input id="street" autoComplete="street-address" value={street} onChange={(event) => setStreet(event.target.value)} /></div>
                    <div><Label htmlFor="postalCode">PLZ *</Label><Input id="postalCode" autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} /></div>
                    <div><Label htmlFor="city">Ort *</Label><Input id="city" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} /></div>
                    <div><Label htmlFor="country">Land *</Label><Input id="country" autoComplete="country-name" value={country} onChange={(event) => setCountry(event.target.value)} /></div>
                    <div><Label htmlFor="taxId">USt.-IdNr. (optional)</Label><Input id="taxId" value={taxId} onChange={(event) => setTaxId(event.target.value)} /></div>
                    <div className="sm:col-span-2"><Label htmlFor="notes">Bemerkung zur Bestellung (optional)</Label><Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></div>
                  </div>
                  <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                    <Label htmlFor="website">Website</Label><Input id="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                  </div>
                  {step === 2 && <div className="mt-5 flex gap-3"><Button disabled={!dataComplete} onClick={() => setStep(3)}>Auftrag prüfen</Button><Button variant="ghost" onClick={() => setStep(1)}>Zurück</Button></div>}
                </>
              ) : <p className="mt-2 text-sm text-muted-foreground">Wird nach der Leistungsauswahl ausgefüllt.</p>}
            </section>

            <section className={`rounded-xl border bg-card p-6 shadow-sm ${step === 3 ? 'border-primary/40' : 'border-border'}`}>
              <h2 className="flex items-center gap-2 text-lg font-semibold"><FileText className="h-5 w-5 text-primary" /> 3. Rechnungsauftrag prüfen</h2>
              {step >= 3 ? (
                <>
                  <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                    <p><strong>Ausschließlich Zahlung auf Rechnung.</strong> Die Rechnung erhalten Sie nach Prüfung per E-Mail.</p>
                    <p className="mt-2">Zahlungsziel: {INVOICE_PAYMENT_TERM_DAYS} Tage ab Rechnungserhalt. Credits, Tarife und Services werden erst nach manueller Prüfung durch einen Admin freigegeben.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox checked={business} onCheckedChange={(value) => setBusiness(value === true)} className="mt-0.5" />
                      <span>Ich bestelle als Unternehmer im Sinne des § 14 BGB und bestätige die Richtigkeit der Rechnungsdaten. *</span>
                    </label>
                    <label className="flex items-start gap-3 text-sm">
                      <Checkbox checked={terms} onCheckedChange={(value) => setTerms(value === true)} className="mt-0.5" />
                      <span>Ich akzeptiere die <Link to="/agb" className="text-primary hover:underline" target="_blank">AGB</Link> und habe die <Link to="/datenschutz" className="text-primary hover:underline" target="_blank">Datenschutzerklärung</Link> zur Kenntnis genommen. *</span>
                    </label>
                  </div>
                  <Button className="mt-5 w-full" size="lg" disabled={!terms || !business || loading} onClick={startCheckout}>
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Auftrag wird gespeichert …</> : 'Rechnungsauftrag verbindlich senden'}
                  </Button>
                  <p className="mt-3 text-center text-xs text-muted-foreground">Keine Kreditkarte, kein SEPA und keine Weiterleitung zu einem Zahlungsanbieter.</p>
                  <button type="button" className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setStep(2)}>Zurück zu den Rechnungsdaten</button>
                </>
              ) : <p className="mt-2 text-sm text-muted-foreground">Verfügbar, sobald die Rechnungsdaten vollständig sind.</p>}
            </section>

            {step === 4 && submittedOrder && (
              <section className="rounded-xl border border-primary/40 bg-primary/5 p-6" aria-live="polite">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><FileCheck2 className="h-5 w-5 text-primary" /> Rechnungsauftrag erhalten</h2>
                <p className="mt-3 text-sm">Bestellnummer: <strong>{submittedOrder.orderNumber}</strong></p>
                <p className="mt-2 text-sm text-muted-foreground">{submittedOrder.offerName} · Gesamtbetrag {formatInvoiceEuro(submittedOrder.totalGrossCents)} inkl. USt.</p>
                <div className="mt-4 flex items-start gap-3 rounded-lg bg-card p-4 text-sm">
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p>{emailSent
                    ? `Eine Eingangsbestätigung wurde an ${email} gesendet. Die Rechnung folgt nach Prüfung separat. Das Zahlungsziel beträgt ${submittedOrder.paymentTermDays} Tage ab Rechnungserhalt.`
                    : 'Der Auftrag ist gespeichert. Die Bestätigungs-E-Mail konnte nicht versendet werden; bitte notiere die Bestellnummer. Die Rechnung folgt nach Prüfung.'}</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Die Leistung wird ausschließlich durch einen Admin freigegeben, nicht automatisch durch Rechnungs- oder Zahlungsstatus.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {user && <Button onClick={() => navigate('/dashboard')}>Zum Dashboard</Button>}
                  <Button variant={user ? 'outline' : 'default'} onClick={resetCheckout}>Weitere Leistung buchen</Button>
                  <Button variant="ghost" onClick={() => navigate('/pricing')}>Zurück zu den Preisen</Button>
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Bestellübersicht</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3"><span className="font-medium">{offer.name}</span><span className="shrink-0 font-medium">{offer.fromPrice ? 'ab ' : ''}{formatInvoiceEuro(totals.serviceNetCents)}</span></div>
                {totals.setupFeeCents > 0 && <div className="flex justify-between gap-3 text-muted-foreground"><span>Einrichtung bei Erstbuchung</span><span>{formatInvoiceEuro(totals.setupFeeCents)}</span></div>}
                <div className="flex justify-between text-muted-foreground"><span>Zwischensumme netto</span><span>{formatInvoiceEuro(totals.netCents)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>MwSt. (19 %)</span><span>{formatInvoiceEuro(totals.vatCents)}</span></div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold"><span>{totals.setupFeeCents > 0 ? 'Erste Rechnung' : 'Gesamt'}</span><span>{formatInvoiceEuro(totals.totalGrossCents)}</span></div>
              </div>
              {offer.fromPrice && <p className="mt-3 text-xs text-muted-foreground">Bei „ab“-Preisen wird Umfang und Endpreis vor der Rechnungsstellung abgestimmt.</p>}
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Rechnung per E-Mail</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> {INVOICE_PAYMENT_TERM_DAYS} Tage Zahlungsziel</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Manuelle Admin-Freigabe</li>
              </ul>
              <div className="mt-5 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-xs text-muted-foreground"><p className="font-semibold text-foreground">Keine Zahlungsdaten nötig</p>Die Bestellung benötigt keine Karten- oder Bankdaten.</div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Checkout;
