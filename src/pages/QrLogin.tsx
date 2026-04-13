import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const QrLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const tokenHash = searchParams.get('token_hash');
  const next = searchParams.get('next') || '/generator';
  const otpType = useMemo(() => {
    const rawType = searchParams.get('type');
    return (rawType === 'magiclink' ? rawType : 'magiclink') as EmailOtpType;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!tokenHash) {
        setStatus('error');
        setErrorMessage('Der QR-Login-Link ist ungültig.');
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });

      if (cancelled) return;

      if (error) {
        setStatus('error');
        setErrorMessage(error.message || 'Der QR-Login-Link ist abgelaufen oder ungültig.');
        return;
      }

      setStatus('success');
      window.setTimeout(() => navigate(next, { replace: true }), 700);
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [navigate, next, otpType, tokenHash]);

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
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          {status === 'error' && (
            <Button onClick={() => navigate('/auth', { replace: true })} className="w-full">
              Normal anmelden
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QrLogin;
