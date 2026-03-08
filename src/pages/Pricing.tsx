import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Check, Zap, Loader2, Plus, Crown, Calendar, AlertTriangle, RefreshCw, CreditCard, ArrowUpDown, XCircle } from 'lucide-react';
import CancelSubscriptionDialog from '@/components/CancelSubscriptionDialog';
import AppHeader from '@/components/AppHeader';
import { STRIPE_PRICES, CREDIT_PACKS } from '@/lib/stripe-plans';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  slug: string;
  monthly_credits: number;
  price_monthly_cents: number;
  price_yearly_cents: number;
  extra_credit_price_cents: number;
  features: string[];
  sort_order: number;
}

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [yearly, setYearly] = useState(false);
  const [searchParams] = useSearchParams();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const { balance, costs } = useCredits();
  const { user } = useAuth();
  const { planSlug: activePlanSlug, planName: activePlanName, billingCycle, periodEnd, loading: subLoading } = useSubscription();

  useEffect(() => {
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setPlans(data as any);
      });
  }, []);

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
      <AppHeader />

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-8 sm:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
            Wähle deinen Plan
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-6 text-sm sm:text-base">
            Starte kostenlos mit 10 Credits. Upgrade jederzeit für mehr Power.
          </p>
          <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setYearly(false)}
              className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${!yearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >Monatlich</button>
            <button
              onClick={() => setYearly(true)}
              className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${yearly ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}
            >Jährlich <span className="text-[10px] font-bold ml-1">-20%</span></button>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const price = yearly ? Math.round(plan.price_yearly_cents / 12) : plan.price_monthly_cents;
            const isPro = plan.slug === 'pro';
            const isFree = plan.slug === 'free';
            const isLoading = loadingSlug === plan.slug;
            const isActivePlan = activePlanSlug === plan.slug;
            const isUpgrade = !isActivePlan && !isFree;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 flex flex-col transition-all ${
                  isActivePlan
                    ? 'border-accent shadow-glow bg-card ring-2 ring-accent/20'
                    : isPro
                      ? 'border-accent/50 shadow-glow/50 bg-card'
                      : 'border-border bg-card'
                }`}
              >
                {isActivePlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Dein Plan
                  </div>
                )}
                {isPro && !isActivePlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold uppercase tracking-wide">
                    Beliebt
                  </div>
                )}
                <h3 className="font-display font-bold text-foreground text-lg mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-foreground">
                    {price === 0 ? '0' : (price / 100).toFixed(0)}€
                  </span>
                  {price > 0 && <span className="text-sm text-muted-foreground">/Mo</span>}
                </div>
                <div className="flex items-center gap-1.5 mb-4 text-sm text-accent font-semibold">
                  <Zap className="w-4 h-4" />
                  {plan.monthly_credits > 0 ? `${plan.monthly_credits} Credits/Monat` : '10 Credits einmalig'}
                </div>
                {plan.extra_credit_price_cents > 0 && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Zusätzliche Credits: {(plan.extra_credit_price_cents / 100).toFixed(2)}€/Credit
                  </p>
                )}
                <ul className="space-y-2 mb-6 flex-1">
                  {(plan.features as string[]).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isActivePlan ? (
                  <Button variant="outline" size="sm" disabled className="border-accent/30 text-accent">
                    <Crown className="w-3.5 h-3.5 mr-1" /> Aktueller Plan
                  </Button>
                ) : isFree && !user ? (
                  <Link to="/auth">
                    <Button variant="outline" size="sm" className="w-full">
                      Kostenlos starten
                    </Button>
                  </Link>
                ) : isFree ? (
                  <Button variant="outline" size="sm" disabled className="opacity-50">
                    Kostenlos
                  </Button>
                ) : !user ? (
                  <Link to="/auth">
                    <Button
                      className={isPro ? 'gradient-accent text-accent-foreground w-full' : 'w-full'}
                      variant={isPro ? 'default' : 'outline'}
                      size="sm"
                    >
                      Jetzt buchen
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className={isPro ? 'gradient-accent text-accent-foreground' : ''}
                    variant={isPro ? 'default' : 'outline'}
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleCheckout(plan.slug)}
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    {isLoading ? 'Weiterleitung…' : 'Upgrade'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

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
              <div key={pack.priceId} className="relative rounded-xl border border-border bg-card p-5 flex flex-col items-center text-center">
                {pack.badge && (
                  <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                    {pack.badge}
                  </span>
                )}
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
                  Kaufen
                </Button>
              </div>
            ))}
          </div>
        </div>

        {Object.keys(costs).length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-xl font-bold text-foreground text-center mb-6">Credit-Kosten pro Aktion</h2>
            <div className="max-w-lg mx-auto bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Aktion</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Standard</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(costs).map(([action, tiers]) => (
                    <tr key={action} className="border-b border-border last:border-0">
                      <td className="p-3 text-foreground capitalize">{action.replace(/_/g, ' ')}</td>
                      <td className="p-3 text-center text-muted-foreground">{(tiers as any).standard} Cr.</td>
                      <td className="p-3 text-center text-muted-foreground">{(tiers as any).pro} Cr.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Pricing;
