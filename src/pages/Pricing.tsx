import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Check, Zap, ArrowLeft, Loader2, Plus } from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';
import CreditBadge from '@/components/CreditBadge';
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
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast.error('Fehler: ' + (err.message || 'Unbekannter Fehler'));
    }
  };

  const [loadingCredit, setLoadingCredit] = useState<string | null>(null);

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
      <header className="border-b border-border bg-primary sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logoLight} alt="Autohaus.AI" className="h-8" />
          </Link>
          <div className="flex items-center gap-3">
            <CreditBadge />
            <Link to="/"><Button variant="ghost" size="sm" className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Zurück</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
            Wähle deinen Plan
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Starte kostenlos mit 10 Credits. Upgrade jederzeit für mehr Power.
          </p>
          <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-muted">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${!yearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >Monatlich</button>
            <button
              onClick={() => setYearly(true)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${yearly ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}
            >Jährlich <span className="text-[10px] font-bold ml-1">-20%</span></button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const price = yearly ? Math.round(plan.price_yearly_cents / 12) : plan.price_monthly_cents;
            const isPro = plan.slug === 'pro';
            const isFree = plan.slug === 'free';
            const isLoading = loadingSlug === plan.slug;
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  isPro ? 'border-accent shadow-glow bg-card' : 'border-border bg-card'
                }`}
              >
                {isPro && (
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
                {isFree ? (
                  <Button variant="outline" size="sm" disabled>
                    Aktueller Plan
                  </Button>
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

        {user && (
          <div className="text-center mt-8">
            <Button variant="ghost" size="sm" onClick={handleManage} className="text-muted-foreground">
              Bestehendes Abo verwalten
            </Button>
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
