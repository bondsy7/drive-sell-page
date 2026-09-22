import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

// Funktionsvergleich der All-Incl-Pakete (rein visuelle Übersicht, keine Abrechnungslogik)
const COMPARISON_ROWS: Array<{ label: string; plans: string[] }> = [
  { label: 'Fahrzeugbilder (KI-optimiert)', plans: ['basic', 'advanced', 'premium', 'ultra'] },
  { label: 'Social-Media-Vorlagen', plans: ['basic', 'advanced', 'premium', 'ultra'] },
  { label: 'Banner', plans: ['basic', 'advanced', 'premium', 'ultra'] },
  { label: 'Video-Erstellung', plans: ['advanced', 'premium', 'ultra'] },
  { label: 'Landingpages', plans: ['premium', 'ultra'] },
  { label: 'KI-Verkaufsassistent', plans: ['advanced', 'premium', 'ultra'] },
  { label: 'Multi-Standorte', plans: ['ultra'] },
  { label: 'API-Zugang', plans: ['ultra'] },
];

const Pricing = () => {

  const [tab, setTab] = useState<'foto' | 'allincl'>('allincl');
  // Es gibt ausschließlich Monatsprodukte – kein Jahrespreis vortäuschen.
  const yearly = false;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

  // Führt in den geführten Checkout (/checkout) statt direkt zu Stripe.
  const handleCheckout = async (slug: string) => {
    if (!STRIPE_PRICES[slug]) return;
    navigate(`/checkout?plan=${slug}`);
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Fair · Transparent · Planbar
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Die passende Lösung für jedes Autohaus.
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
            Wähle den Tarif, der zu deinem Bedarf passt. Alle Pakete enthalten alle Funktionen für professionelles
            Fahrzeugmarketing – Portal-Gebühren und API-Kosten inklusive.
          </p>
        </div>

        {/* Umschalter */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-border bg-muted/50 p-1">
            {(['allincl', 'foto'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-5 py-2 text-sm font-semibold rounded-full transition-all ${
                  tab === key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {key === 'foto' ? 'Fotoservice' : 'All-Incl-Marketing'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'allincl' && (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-start">
            {ALL_INCL_PACKAGES.map((pkg) => {
              const isActivePlan = activePlanSlug === pkg.slug;
              const isLoading = loadingSlug === pkg.slug;
              const highlight = pkg.recommended || isActivePlan;
              return (
                <div
                  key={pkg.slug}
                  className={`relative rounded-2xl border bg-card p-6 flex flex-col transition-all ${
                    highlight
                      ? 'border-primary shadow-lg ring-1 ring-primary/15 lg:-mt-3 lg:pb-8'
                      : 'border-border shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {isActivePlan ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 whitespace-nowrap">
                      <Crown className="w-3 h-3" /> Dein Plan
                    </div>
                  ) : pkg.recommended ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                      Empfohlen
                    </div>
                  ) : null}

                  <h3 className="font-display font-bold text-foreground text-xl">{pkg.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 min-h-[2rem]">
                    {pkg.subtitle ?? `Für ca. ${pkg.vehiclesPerMonth} Fahrzeuge im Monat`}
                  </p>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="font-display text-4xl font-bold text-foreground leading-none">
                      {(pkg.priceCents / 100).toLocaleString('de-DE')} €
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    pro Monat netto · {(pkg.effectivePerVehicleCents / 100).toFixed(2).replace('.', ',')} € je Fahrzeug
                  </p>

                  <div className="my-5 h-px bg-border" />

                  <ul className="space-y-2.5 flex-1">
                    <li className="flex items-start gap-2 text-sm font-semibold text-foreground">
                      <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {pkg.credits.toLocaleString('de-DE')} Credits / Monat
                    </li>
                    {pkg.included.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] leading-relaxed text-muted-foreground mt-5">
                    zzgl. einmalig 990 € netto Implementierung · 12 Monate Mindestlaufzeit
                  </p>

                  <div className="mt-4">
                    {isActivePlan ? (
                      <Button variant="outline" disabled className="w-full border-primary/30 text-primary">
                        <Crown className="w-3.5 h-3.5 mr-1" /> Aktueller Plan
                      </Button>
                    ) : !user ? (
                      <Link to={`/auth?plan=${pkg.slug}&cycle=monthly`} className="block">
                        <Button className="w-full" variant={highlight ? 'default' : 'outline'}>
                          Jetzt starten
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="w-full"
                        variant={highlight ? 'default' : 'outline'}
                        disabled={isLoading}
                        onClick={() => handleCheckout(pkg.slug)}
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        {isLoading ? 'Weiterleitung…' : 'Jetzt starten'}
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-3 text-xs">
                    <Link to={`/fahrzeug-testen?paket=${pkg.slug}`} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
                      Anfragen
                    </Link>
                    <span className="text-border">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const input = allInclContractInput(pkg.slug);
                        if (input) generateOfferContractPdf(input);
                      }}
                      className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2"
                    >
                      <FileDown className="w-3.5 h-3.5" /> Vertrag
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'allincl' && (
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
            <h2 className="font-display text-lg font-bold text-foreground text-center px-6 py-5">
              Alle Funktionen im Vergleich
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left">
                    <th className="px-5 py-3 font-semibold text-foreground">Funktion</th>
                    {ALL_INCL_PACKAGES.map((p) => (
                      <th key={p.slug} className="px-4 py-3 text-center font-semibold text-foreground">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="px-5 py-3 text-muted-foreground">{row.label}</td>
                      {ALL_INCL_PACKAGES.map((p) => (
                        <td key={p.slug} className="px-4 py-3 text-center">
                          {row.plans.includes(p.slug) ? (
                            <Check className="mx-auto h-4 w-4 text-primary" />
                          ) : (
                            <span className="text-muted-foreground/50">–</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-border bg-muted/30 p-6 text-center">
          <p className="mx-auto max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Alle Preise verstehen sich netto zzgl. der gesetzlichen Umsatzsteuer. Das Angebot richtet sich ausschließlich
            an Unternehmer im Sinne des § 14 BGB. Die Mindestvertragslaufzeit beträgt 12 Monate, die Abrechnung erfolgt
            monatlich im Voraus. Der Vertrag verlängert sich um jeweils weitere 12 Monate, wenn er nicht mit einer Frist
            von einem Monat zum Ende der Laufzeit gekündigt wird. Bei der Erstbuchung fallen einmalig 990 € netto
            Implementierungskosten an. Die monatlichen Credits werden zu Beginn des Abrechnungszeitraums gutgeschrieben;
            Top-up-Credits werden separat abgerechnet.
          </p>
          <p className="mx-auto max-w-2xl text-xs text-muted-foreground mt-3">
            Es gelten unsere{' '}
            <Link to="/agb" className="underline underline-offset-2">AGB</Link>,{' '}
            die <Link to="/datenschutz" className="underline underline-offset-2">Datenschutzerklärung</Link>{' '}
            und der <Link to="/avv" className="underline underline-offset-2">Auftragsverarbeitungsvertrag</Link>.
          </p>
        </div>


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
        <div className="mt-14">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.priceId}
              className="rounded-2xl border border-border bg-card p-6 sm:p-8 grid gap-6 md:grid-cols-[auto,1fr,auto] md:items-center"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">Zusätzliche Credits nachkaufen</h2>
                  <p className="font-display text-2xl font-bold text-foreground mt-1">
                    {pack.label} · {(pack.priceCents / 100).toFixed(0)} €
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(pack.priceCents / pack.credits / 100).toFixed(2).replace('.', ',')} € / Credit netto
                  </p>
                </div>
              </div>

              <ul className="grid gap-2 sm:grid-cols-2 text-sm text-muted-foreground">
                {['Sofort verfügbar', 'Für alle Tarife', 'Verfallen nicht zum Monatsende', 'Einfach & sicher'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>

              <Button
                disabled={loadingCredit === pack.priceId}
                onClick={() => handleBuyCredits(pack.priceId)}
                className="w-full md:w-auto"
              >
                {loadingCredit === pack.priceId ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Plus className="w-4 h-4 mr-1" />
                )}
                Credits kaufen
              </Button>
            </div>
          ))}
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
            <p className="text-xs text-muted-foreground mt-2">
              Nicht verbrauchte Paket-Credits verfallen zum Ende des jeweiligen Abrechnungsmonats. Separat
              nachgekaufte Credits bleiben erhalten.
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
