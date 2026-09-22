import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Check, Zap, Loader2, Plus, Crown, Calendar, AlertTriangle, RefreshCw, CreditCard, ArrowUpDown, XCircle, FileDown } from 'lucide-react';
import CancelSubscriptionDialog from '@/components/CancelSubscriptionDialog';
import PublicHeader from '@/components/public/PublicHeader';
import SiteFooter from '@/components/legal/SiteFooter';
import CreditSlider from '@/components/CreditSlider';
import {
  STRIPE_PRICES,
  CREDIT_PACKS,
  ALL_INCL_PACKAGES,
  FOTO_PACKAGES,
  FOTO_ADDONS,
  EXTRA_PACKAGES,
} from '@/lib/stripe-plans';

import {
  generateOfferContractPdf,
  allInclContractInput,
  fotoContractInput,
} from '@/lib/offer-contract-pdf';

import { toast } from 'sonner';

const Pricing = () => {
  const [tab, setTab] = useState<'foto' | 'allincl'>('allincl');
  // Es gibt ausschließlich Monatsprodukte – kein Jahrespreis vortäuschen.
  const yearly = false;
  const [searchParams] = useSearchParams();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const { balance, costs } = useCredits();
  const { user } = useAuth();
  const { planSlug: activePlanSlug, planName: activePlanName, billingCycle, periodEnd, loading: subLoading } = useSubscription();


  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Abo erfolgreich abgeschlossen! Deine Credits werden in Kürze gutgeschrieben.');
    } else if (searchParams.get('credit_success') === 'true') {
      toast.success('Credits wurden deinem Konto gutgeschrieben!');
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout abgebrochen.');
    }
  }, [searchParams]);

  const handleCheckout = async (slug: string) => {
    if (!user) {
      toast.error('Bitte melde dich zuerst an.');
      return;
    }
    const prices = STRIPE_PRICES[slug];
    if (!prices) return;

    setLoadingSlug(slug);
    try {
      const priceId = yearly ? prices.yearly : prices.monthly;
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast.error('Fehler beim Checkout: ' + (err.message || 'Unbekannter Fehler'));
    } finally {
      setLoadingSlug(null);
    }
  };

  const handleManage = async () => {
    setManageError(null);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Kein Stripe-Kunde')) {
          setManageError('Du hast noch kein Abo über Stripe abgeschlossen. Wähle zuerst einen Plan oben.');
          return;
        }
        throw new Error(data.error);
      }
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      setManageError(err.message || 'Unbekannter Fehler');
    }
  };

  const handleCancel = async () => {
    setManageError(null);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.error) {
        if (data.error.includes('Kein Stripe-Kunde')) {
          setManageError('Kein aktives Stripe-Abo gefunden. Kontaktiere den Support, falls du Hilfe benötigst.');
          setCancelOpen(false);
          return;
        }
        throw new Error(data.error);
      }
      if (data?.url) {
        window.open(data.url, '_blank');
        setCancelOpen(false);
      }
    } catch (err: any) {
      setManageError(err.message || 'Unbekannter Fehler');
      setCancelOpen(false);
    }
  };

  const [loadingCredit, setLoadingCredit] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);
  const handleBuyCredits = async (priceId: string) => {
    if (!user) {
      toast.error('Bitte melde dich zuerst an.');
      return;
    }
    setLoadingCredit(priceId);
    try {
      const { data, error } = await supabase.functions.invoke('buy-credits', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (err: any) {
      toast.error('Fehler: ' + (err.message || 'Unbekannter Fehler'));
    } finally {
      setLoadingCredit(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-12 sm:py-20">
        <div className="text-center mb-8 sm:mb-10">
          <p className="mb-3 text-sm font-semibold text-primary">Preise für professionelles Fahrzeugmarketing</p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Das passende Paket für dein Autohaus.
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-4 text-sm sm:text-base">
            Wähle zwischen reinem <strong className="text-foreground">Fotoservice</strong> und der{' '}
            <strong className="text-foreground">Komplettlösung inklusive Marketing</strong>. Alle Portal-Gebühren und
            API-Kosten sind enthalten. Brauchst du mehr, lädst du jederzeit{' '}
            <strong className="text-foreground">200 Credits für 100 € netto</strong> nach.
          </p>
          <p className="mx-auto max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Alle Preise verstehen sich netto zzgl. der gesetzlichen Umsatzsteuer. Das Angebot richtet sich ausschließlich
            an Unternehmer im Sinne des § 14 BGB. Die Mindestvertragslaufzeit beträgt 12 Monate, die Abrechnung erfolgt
            monatlich im Voraus. Der Vertrag verlängert sich um jeweils weitere 12 Monate, wenn er nicht mit einer Frist
            von einem Monat zum Ende der Laufzeit gekündigt wird. Bei der Erstbuchung fallen einmalig 990 € netto
            Implementierungskosten an. Die monatlichen Credits werden zu Beginn des Abrechnungszeitraums gutgeschrieben;
            Top-up-Credits werden separat abgerechnet.
          </p>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground mt-2">
            Es gelten unsere{' '}
            <Link to="/agb" className="underline underline-offset-2">AGB</Link>,{' '}
            die <Link to="/datenschutz" className="underline underline-offset-2">Datenschutzerklärung</Link>{' '}
            und der <Link to="/avv" className="underline underline-offset-2">Auftragsverarbeitungsvertrag</Link>.
          </p>
        </div>

        {/* Umschalter */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {(['foto', 'allincl'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors ${
                  tab === key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {key === 'foto' ? 'Fotoservice' : 'All-Incl-Marketing'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'allincl' && (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {ALL_INCL_PACKAGES.map((pkg) => {
              const isActivePlan = activePlanSlug === pkg.slug;
              const isLoading = loadingSlug === pkg.slug;
              return (
                <div
                  key={pkg.slug}
                  className={`relative rounded-lg border p-6 flex flex-col transition-all shadow-card ${
                    isActivePlan
                      ? 'border-primary shadow-glow bg-card ring-1 ring-primary/20'
                      : pkg.recommended
                        ? 'border-primary bg-card'
                        : 'border-border bg-card'
                  }`}
                >
                  {isActivePlan ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Dein Plan
                    </div>
                  ) : pkg.recommended ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide">
                      Empfohlen
                    </div>
                  ) : null}
                  <h3 className="font-display font-bold text-foreground text-lg">{pkg.name}</h3>
                  {pkg.subtitle && <p className="text-xs text-muted-foreground mb-2">{pkg.subtitle}</p>}
                  <div className="mt-2 mb-1">
                    <span className="text-3xl font-bold text-foreground">{(pkg.priceCents / 100).toFixed(0)}€</span>
                    <span className="text-xs text-muted-foreground"> /Monat netto</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    ca. {pkg.vehiclesPerMonth} Fahrzeuge mtl. · {(pkg.effectivePerVehicleCents / 100).toFixed(2)}€ je Fahrzeug
                  </p>
                  <div className="flex items-center gap-1.5 mb-3 text-sm text-accent font-semibold">
                    <Zap className="w-4 h-4" />
                    {pkg.credits.toLocaleString('de-DE')} Credits/Monat
                  </div>
                  <ul className="space-y-1.5 mb-4 flex-1">
                    {pkg.included.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    zzgl. einmalig 990 € netto Implementierung · 12 Monate Mindestlaufzeit
                  </p>
                  {isActivePlan ? (
                    <Button variant="outline" size="sm" disabled className="border-accent/30 text-accent">
                      <Crown className="w-3.5 h-3.5 mr-1" /> Aktueller Plan
                    </Button>
                  ) : !user ? (
                    <Link to={`/auth?plan=${pkg.slug}&cycle=monthly`}>
                      <Button className="w-full gradient-accent text-accent-foreground" size="sm">
                        Verbindlich buchen
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="gradient-accent text-accent-foreground"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleCheckout(pkg.slug)}
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                      {isLoading ? 'Weiterleitung…' : 'Verbindlich buchen'}
                    </Button>
                  )}
                  <Link
                    to={`/fahrzeug-testen?paket=${pkg.slug}`}
                    className="mt-2 text-center text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Unverbindlich anfragen
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const input = allInclContractInput(pkg.slug);
                      if (input) generateOfferContractPdf(input);
                    }}
                    className="mt-2 inline-flex items-center justify-center gap-1 text-xs text-accent underline underline-offset-2"
                  >
                    <FileDown className="w-3.5 h-3.5" /> Vertrag als PDF
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'foto' && (
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
              {FOTO_PACKAGES.map((pkg) => {
                const isActivePlan = activePlanSlug === pkg.slug;
                const isLoading = loadingSlug === pkg.slug;
                return (
                  <div
                    key={pkg.slug}
                    className={`relative rounded-2xl border-2 p-5 flex flex-col transition-all ${
                      isActivePlan
                        ? 'border-accent shadow-glow bg-card ring-2 ring-accent/20'
                        : pkg.recommended
                          ? 'border-accent/60 bg-card'
                          : 'border-border bg-card'
                    }`}
                  >
                    {pkg.recommended && !isActivePlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide">
                        Empfohlen
                      </div>
                    )}
                    <h3 className="font-display font-bold text-foreground text-base">
                      {pkg.vehicles} {pkg.vehicles === 1 ? 'Fahrzeug' : 'Fahrzeuge'}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">pro Monat · 16 Perspektiven je Fahrzeug</p>
                    <div className="mb-1">
                      <span className="text-2xl font-bold text-foreground">
                        {(pkg.pricePerVehicleCents / 100).toFixed(2).replace('.', ',')}€
                      </span>
                      <span className="text-xs text-muted-foreground"> /Fahrzeug netto</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      = {(pkg.monthlyCents / 100).toFixed(2).replace('.', ',')}€ mtl. netto
                    </p>
                    <div className="flex items-center gap-1.5 mb-4 text-sm text-accent font-semibold flex-1">
                      <Zap className="w-4 h-4" />
                      {pkg.credits.toLocaleString('de-DE')} Credits/Monat
                    </div>
                    {isActivePlan ? (
                      <Button variant="outline" size="sm" disabled className="border-accent/30 text-accent">
                        <Crown className="w-3.5 h-3.5 mr-1" /> Aktueller Plan
                      </Button>
                    ) : !user ? (
                      <Link to={`/auth?plan=${pkg.slug}&cycle=monthly`}>
                        <Button className="w-full" variant="outline" size="sm">
                          Paket buchen
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => handleCheckout(pkg.slug)}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        {isLoading ? 'Weiterleitung…' : 'Paket buchen'}
                      </Button>
                    )}
                    <Link
                      to={`/fahrzeug-testen?paket=${pkg.slug}`}
                      className="mt-2 text-center text-xs text-muted-foreground underline underline-offset-2"
                    >
                      Paket anfragen
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        const input = fotoContractInput(pkg.slug);
                        if (input) generateOfferContractPdf(input);
                      }}
                      className="mt-2 inline-flex items-center justify-center gap-1 text-xs text-accent underline underline-offset-2"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Vertrag als PDF
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-bold text-foreground mb-3">Zusatzapplikationen</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {FOTO_ADDONS.map((addon) => (
                  <div key={addon.label} className="rounded-xl border border-border p-3">
                    <p className="font-semibold text-foreground text-sm">{addon.label}</p>
                    <p className="text-xs text-muted-foreground">{addon.hint}</p>
                    <p className="text-sm font-bold text-accent mt-1">
                      {addon.price} <span className="text-xs font-normal text-muted-foreground">{addon.unit} netto</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display font-bold text-foreground mb-3">Einzelsets & Zusatzpakete</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {EXTRA_PACKAGES.map((extra) => (
                  <div key={extra.label} className="rounded-xl border border-border p-3 flex flex-col">
                    <div className="flex items-start justify-between gap-2 flex-1">
                      <p className="font-semibold text-foreground text-sm">{extra.label}</p>
                      {extra.onRequest && (
                        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Nur auf Anfrage
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-accent mt-1">
                      {extra.price} <span className="text-xs font-normal text-muted-foreground">{extra.unit} netto</span>
                    </p>
                    {extra.onRequest && (
                      <Link
                        to="/fahrzeug-testen"
                        className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                      >
                        Anfragen
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Whitelabel-Automarkt und Flipping-Plugin sind derzeit nicht direkt buchbar – wir richten sie nach
                individueller Abstimmung ein.{' '}
                <Link to="/fahrzeug-testen" className="underline underline-offset-2">Hier anfragen</Link>.
              </p>
            </div>
          </div>
        )}


        {/* Subscription Management */}
        {user && activePlanSlug && activePlanSlug !== 'free' && (
          <div className="mt-10 max-w-lg mx-auto">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-accent" />
                <h3 className="font-display font-bold text-foreground text-lg">Dein Abo</h3>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aktueller Plan</span>
                  <span className="font-semibold text-foreground">{activePlanName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abrechnungszyklus</span>
                  <span className="font-medium text-foreground">{billingCycle === 'yearly' ? 'Jährlich' : 'Monatlich'}</span>
                </div>
                {periodEnd && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Laufzeit bis</span>
                      <span className="font-medium text-foreground">
                        {new Date(periodEnd).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Automatische Verlängerung</span>
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 text-accent" />
                        {billingCycle === 'yearly' ? 'um 1 Jahr' : 'um 1 Monat'}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits verfügbar</span>
                  <span className="font-semibold text-accent">{balance}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <p>
                    {periodEnd
                      ? `Dein Abo verlängert sich automatisch am ${new Date(periodEnd).toLocaleDateString('de-DE')}. Du kannst bis dahin kündigen oder deinen Plan ändern.`
                      : 'Dein Abo verlängert sich automatisch. Du kannst jederzeit kündigen oder deinen Plan ändern.'}
                  </p>
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <p>Ein Downgrade wird erst zum Ende der aktuellen Laufzeit wirksam. Du behältst bis dahin alle Vorteile deines aktuellen Plans.</p>
                </div>
              </div>

              {manageError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{manageError}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={handleManage} className="gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Abo verwalten</span>
                  <span className="sm:hidden">Verwalten</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const plansSection = document.querySelector('.grid.gap-4');
                  plansSection?.scrollIntoView({ behavior: 'smooth' });
                }} className="gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Plan wechseln</span>
                  <span className="sm:hidden">Wechseln</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCancelOpen(true)} className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30">
                  <XCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kündigen</span>
                  <span className="sm:hidden">Kündigen</span>
                </Button>
              </div>

              <CancelSubscriptionDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                onConfirm={handleCancel}
                periodEnd={periodEnd}
              />
            </div>
          </div>
        )}

        {user && (!activePlanSlug || activePlanSlug === 'free') && (
          <div className="text-center mt-8 text-xs text-muted-foreground">
            Du nutzt den kostenlosen Plan. Upgrade für monatliche Credits und mehr Features.
          </div>
        )}

        {/* Credit Packs */}
        <div className="mt-16">
          <h2 className="font-display text-xl font-bold text-foreground text-center mb-2">Credits nachkaufen</h2>
          <p className="text-muted-foreground text-center text-sm mb-6">Einmalig – kein Abo nötig</p>
          <div className="grid gap-4 md:grid-cols-3 max-w-2xl mx-auto">
            {CREDIT_PACKS.map((pack) => (
              <div key={pack.priceId} className="relative rounded-xl border border-border bg-card p-5 flex flex-col items-center text-center md:col-span-3 max-w-sm mx-auto w-full">
                <Zap className="w-6 h-6 text-accent mb-2" />
                <span className="font-display font-bold text-foreground text-lg">{pack.label}</span>
                <span className="text-2xl font-bold text-foreground mt-1">{(pack.priceCents / 100).toFixed(0)}€</span>
                <span className="text-xs text-muted-foreground mb-4">
                  {(pack.priceCents / pack.credits / 100).toFixed(2)}€ / Credit
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={loadingCredit === pack.priceId}
                  onClick={() => handleBuyCredits(pack.priceId)}
                >
                  {loadingCredit === pack.priceId ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                  Nachkaufen
                </Button>
              </div>
            ))}

          </div>
        </div>





        {/* Credit-Rechner */}
        <div className="mt-16">
          <div className="text-center mb-6">
            <h2 className="font-display text-xl font-bold text-foreground mb-2">Credit-Rechner</h2>
            <p className="text-muted-foreground text-sm">
              Plane dein Budget und sieh, wie viele Bilder, Banner, Videos und Landingpages du erstellen kannst.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Paketgrößen: Basic 600 · Advanced 1.000 · Premium 2.000 · Ultra 4.000 Credits pro Monat. Ein komplettes
              Fahrzeug mit 16 Perspektiven kostet 16 Credits.
            </p>
          </div>
          <div className="max-w-3xl mx-auto">
            <CreditSlider defaultCredits={1000} min={100} max={4000} />
          </div>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
};

export default Pricing;
