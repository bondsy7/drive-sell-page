import React, { useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Chrome, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { STRIPE_PRICES } from '@/lib/stripe-plans';
import logoLight from '@/assets/logo-light.png';

const Auth = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan'); // e.g. free, starter, pro, enterprise
  const cycle = searchParams.get('cycle') || 'monthly';

  // Only allow registration if a plan is selected
  const [isLogin, setIsLogin] = useState(!plan);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  
  // If already logged in, redirect
  if (user) return <Navigate to="/generator" replace />;

  const startCheckoutWithEmail = async (userEmail: string, userId?: string) => {
    if (!plan || plan === 'free') {
      // Free plan: no Stripe needed, just tell user to confirm email
      return;
    }
    const prices = STRIPE_PRICES[plan];
    if (!prices) return;

    const priceId = cycle === 'yearly' ? prices.yearly : prices.monthly;
    try {
      // Call create-checkout WITHOUT auth, passing email directly
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ priceId, email: userEmail, userId }),
        }
      );
      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Fallback: user can pay later from pricing page
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Erfolgreich angemeldet!');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, selected_plan: plan, selected_cycle: cycle }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;

        // Signup succeeded — user needs to confirm email
        // But first redirect to Stripe checkout if paid plan
        if (plan && plan !== 'free') {
          toast.success('Registrierung erfolgreich! Du wirst zum Checkout weitergeleitet…');
          await startCheckoutWithEmail(email, data.user?.id);
          // If we get here, checkout redirect didn't work
          toast.info('Bitte bestätige deine E-Mail-Adresse und melde dich an, um den Checkout abzuschließen.');
        } else {
          toast.success('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: plan
        ? `${window.location.origin}/auth?plan=${plan}&cycle=${cycle}`
        : window.location.origin,
    });
    if (error) toast.error('Google Login fehlgeschlagen');
  };

  const PLAN_LABELS: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-4">
          <Link to="/">
            <img src={logoLight} alt="Autohaus.AI" className="h-14 mx-auto" />
          </Link>
          <p className="text-sm text-muted-foreground">
            {isLogin ? 'Melde dich an' : 'Erstelle deinen Account'}
          </p>
          {!isLogin && plan && PLAN_LABELS[plan] && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Gewählter Plan: {PLAN_LABELS[plan]} ({cycle === 'yearly' ? 'Jährlich' : 'Monatlich'})
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" placeholder="Max Mustermann" value={name} onChange={e => setName(e.target.value)} className="pl-9" required />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-Mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="name@firma.de" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Passwort</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9" minLength={6} required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Laden...' : isLogin ? 'Anmelden' : plan && plan !== 'free' ? 'Registrieren & zum Checkout' : 'Kostenlos registrieren'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">oder</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          <Chrome className="w-4 h-4 mr-2" /> Mit Google {isLogin ? 'anmelden' : 'registrieren'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? (
            <>
              Noch kein Account?{' '}
              {plan ? (
                <button className="text-accent font-medium hover:underline" onClick={() => setIsLogin(false)}>
                  Registrieren
                </button>
              ) : (
                <Link to="/pricing" className="text-accent font-medium hover:underline">
                  Plan wählen & registrieren
                </Link>
              )}
            </>
          ) : (
            <>
              Bereits registriert?{' '}
              <button className="text-accent font-medium hover:underline" onClick={() => setIsLogin(true)}>
                Anmelden
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
