import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Lock, User, Chrome } from 'lucide-react';
import { toast } from 'sonner';
import logoDark from '@/assets/logo-dark.png';

const Auth = () => {
  const { user, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Registrierung erfolgreich! Bitte bestätige deine E-Mail.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Ein Fehler ist aufgetreten');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await lovable.auth.signInWithOAuth('google', {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error('Google Login fehlgeschlagen');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-4">
          <Link to="/">
            <img src={logoDark} alt="Autohaus.AI" className="h-14 mx-auto" />
          </Link>
          <p className="text-sm text-muted-foreground">{isLogin ? 'Melde dich an' : 'Erstelle deinen Account'}</p>
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
            {submitting ? 'Laden...' : isLogin ? 'Anmelden' : 'Registrieren'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">oder</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle}>
          <Chrome className="w-4 h-4 mr-2" /> Mit Google anmelden
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {isLogin ? 'Noch kein Account?' : 'Bereits registriert?'}{' '}
          <button className="text-accent font-medium hover:underline" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Registrieren' : 'Anmelden'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
