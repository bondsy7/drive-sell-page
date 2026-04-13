import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const QrLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        setStatus('error');
        setErrorMessage('Der QR-Login-Link ist ungültig.');
        return;
      }

      try {
        // Step 1: Exchange our custom token for a Supabase magic link hash
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-qr-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ token }),
          }
        );

        const data = await res.json();
        if (!res.ok || data.error) {
          if (cancelled) return;
          setStatus('error');
          setErrorMessage(data.error || 'Login fehlgeschlagen');
          return;
        }

        // Step 2: Use the hashed token to create a session
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: 'magiclink',
        });

        if (cancelled) return;

        if (otpErr) {
          setStatus('error');
          setErrorMessage(otpErr.message || 'Session konnte nicht erstellt werden');
          return;
        }

        setStatus('success');
        const redirectPath = data.redirectPath || '/generator';
        setTimeout(() => navigate(redirectPath, { replace: true }), 600);
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err.message || 'Ein unerwarteter Fehler ist aufgetreten');
      }
    };

    verify();
    return () => { cancelled = true; };
  }, [navigate, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-xl">
            {status === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-5 w-5 text-primary" />}
            {status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
            QR-Code Login
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Anmeldung wird vorbereitet…'}
            {status === 'success' && 'Erfolgreich eingeloggt – Weiterleitung läuft…'}
            {status === 'error' && 'Der Login konnte nicht abgeschlossen werden.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === 'error' && (
            <>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                {errorMessage}
              </div>
              <Button onClick={() => navigate('/auth', { replace: true })} className="w-full">
                Normal anmelden
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QrLogin;
