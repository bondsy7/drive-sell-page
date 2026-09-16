import React, { useState } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Chrome, ShieldCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { LEGAL_VERSIONS, TERMS_DOCUMENT, B2B_CONFIRM_TEXT } from '@/lib/legal-config';
import { recordTermsAcceptance } from '@/lib/legal-acceptance';
import auto3Logo from '@/assets/auto3-logo.png';
import SiteFooter from '@/components/legal/SiteFooter';

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
  const [company, setCompany] = useState('');
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [b2bConfirmed, setB2bConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const signupReady = company.trim().length > 0 && termsConfirmed && b2bConfirmed;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  
  // If already logged in, redirect
  if (user) return <Navigate to="/generator" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Erfolgreich angemeldet!');
      } else {
        if (!signupReady) {
          toast.error('Bitte bestätige deine Unternehmereigenschaft und die AGB.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              company_name: company.trim(),
              selected_plan: plan,
              selected_cycle: cycle,
              terms_document: TERMS_DOCUMENT,
              terms_version: LEGAL_VERSIONS.agb,
              terms_confirmed: true,
              confirms_business_and_age: true,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // Falls bereits eine Session besteht, beide Nachweise sofort dokumentieren.
        // Ohne Session (E-Mail-Bestätigung ausstehend) holt der LegalOnboardingGate das nach.
        if (data.session?.user) {
          const { error: acceptErr } = await recordTermsAcceptance(
            data.session.user.id,
            company,
            'password',
          );
          if (acceptErr) console.warn('[auth] Nachweis konnte nicht gespeichert werden:', acceptErr.message);
        }

        toast.success('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse über den Link in deinem Postfach.');
        if (plan && plan !== 'free') {
          toast.info('Nach der Bestätigung kannst du das Paket unter "Preise" buchen.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    // Google-Registrierung darf die B2B-/AGB-Bestätigung nicht umgehen.
    if (!isLogin && !signupReady) {
      toast.error('Bitte bestätige zuerst deine Unternehmereigenschaft und die AGB.');
      return;
    }
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: plan
          ? `${window.location.origin}/auth?plan=${plan}&cycle=${cycle}`
          : window.location.origin,
      });
      if (result.error) {
        toast.error(`Google Login fehlgeschlagen: ${result.error.message ?? ''}`);
      }
    } catch (e: any) {
      toast.error(`Google Login fehlgeschlagen: ${e?.message ?? ''}`);
    }
  };

  const PLAN_LABELS: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-4">
          <Link to="/">
            <img src={auto3Logo} alt="AUTO3" className="h-14 mx-auto" />
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
          {!isLogin && (
            <div className="space-y-1.5">
              <Label htmlFor="company">Firmenname</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="company" placeholder="Autohaus Mustermann GmbH" value={company} onChange={e => setCompany(e.target.value)} className="pl-9" autoComplete="organization" required />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{isLogin ? 'E-Mail' : 'Geschäftliche E-Mail'}</Label>
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
          {!isLogin && (
            <div className="space-y-3">
              <label htmlFor="b2b" className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                <Checkbox id="b2b" checked={b2bConfirmed} onCheckedChange={(c) => setB2bConfirmed(c === true)} />
                <span>{B2B_CONFIRM_TEXT} *</span>
              </label>
              <label htmlFor="terms" className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                <Checkbox id="terms" checked={termsConfirmed} onCheckedChange={(c) => setTermsConfirmed(c === true)} />
                <span>
                  Ich habe die{' '}
                  <Link to="/agb" target="_blank" className="font-medium text-accent underline underline-offset-2">AGB</Link>{' '}
                  für AUTO3 gelesen und akzeptiere sie. *
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Informationen zur Verarbeitung deiner Daten findest du in der{' '}
                <Link to="/datenschutz" target="_blank" className="underline underline-offset-2">Datenschutzerklärung</Link>.
              </p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitting || (!isLogin && !signupReady)}>
            {submitting ? 'Laden...' : isLogin ? 'Anmelden' : 'Registrieren'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">oder</span></div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={!isLogin && !signupReady}
        >
          <Chrome className="w-4 h-4 mr-2" /> Mit Google {isLogin ? 'anmelden' : 'registrieren'}
        </Button>

        {!isLogin && (
          <p className="text-center text-xs text-muted-foreground">
            Nur für Unternehmer im Sinne des § 14 BGB. Alle Preise netto zzgl. gesetzlicher
            Umsatzsteuer. Mindestalter 18 Jahre.
          </p>
        )}

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
      <SiteFooter compact />
    </div>
  );
};

export default Auth;
