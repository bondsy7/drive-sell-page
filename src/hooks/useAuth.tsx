import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext>({ user: null, session: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Consume OAuth tokens returned via full-page redirect (mobile / non-iframe flow)
    const consumeOAuthRedirect = async (): Promise<boolean> => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const query = new URLSearchParams(window.location.search);
        const access_token = hash.get('access_token') || query.get('access_token');
        const refresh_token = hash.get('refresh_token') || query.get('refresh_token');
        if (!access_token || !refresh_token) return false;

        const { error } = await supabase.auth.setSession({ access_token, refresh_token });

        // Clean tokens out of the URL
        ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'state', 'provider_token'].forEach((k) => query.delete(k));
        const cleanUrl = window.location.pathname + (query.toString() ? `?${query}` : '');
        window.history.replaceState({}, '', cleanUrl);

        return !error;
      } catch {
        return false;
      }
    };

    (async () => {
      await consumeOAuthRedirect();
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.warn('signOut error (ignored):', e);
    } finally {
      setSession(null);
      setUser(null);
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {}
      window.location.href = '/auth';
    }
  };

  return (
    <AuthCtx.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
};

export const useAuth = () => useContext(AuthCtx);
