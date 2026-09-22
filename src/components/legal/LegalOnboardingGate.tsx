import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TERMS_CONFIRM_TEXT, B2B_CONFIRM_TEXT } from '@/lib/legal-config';
import { hasCurrentTermsAcceptance, recordTermsAcceptance } from '@/lib/legal-acceptance';

/**
 * Prüft vor geschützten Bereichen, ob die aktuelle AGB-/B2B-Bestätigung vorliegt.
 * Gilt für neue Google-Konten und Bestandskonten gleichermaßen.
 */
export default function LegalOnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [checked, setChecked] = useState<boolean | null>(null);
  const [company, setCompany] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [b2b, setB2b] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) return;

    const checkProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, legal_confirmed_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;
      setCompany(profile?.company_name || (user.user_metadata?.company_name as string) || '');

      if (profile?.legal_confirmed_at) {
        setChecked(true);
        return;
      }

      const accepted = await hasCurrentTermsAcceptance(user.id);
      if (active) setChecked(accepted);
    };

    void checkProfile();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user || checked === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (checked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !confirm || !b2b) return;
    setSaving(true);
    try {
      const authMethod =
        user.app_metadata?.provider === 'google' ? ('google' as const) : ('onboarding' as const);
      const { error } = await recordTermsAcceptance(user.id, company, authMethod);
      if (error) throw error;

      await supabase.auth.updateUser({
        data: { company_name: company.trim(), terms_confirmed: true },
      });
      setChecked(true);
      toast.success('Danke – Bestätigung gespeichert.');
    } catch (err) {
      toast.error((err as Error).message || 'Speichern nicht möglich.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6">
        <div className="space-y-2">
          <h1 className="font-display text-xl font-bold text-foreground">Kurze Bestätigung nötig</h1>
          <p className="text-sm text-muted-foreground">
            autohaus.ai richtet sich ausschließlich an Unternehmen. Bitte ergänze deine Firmenangabe und
            bestätige die AGB, um fortzufahren.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gate-company">Firmenname</Label>
          <Input
            id="gate-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Autohaus Mustermann GmbH"
            autoComplete="organization"
            required
          />
        </div>

        <label htmlFor="gate-b2b" className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <Checkbox id="gate-b2b" checked={b2b} onCheckedChange={(c) => setB2b(c === true)} />
          <span>{B2B_CONFIRM_TEXT}</span>
        </label>

        <label htmlFor="gate-confirm" className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <Checkbox id="gate-confirm" checked={confirm} onCheckedChange={(c) => setConfirm(c === true)} />
          <span>
            Ich habe die{' '}
            <Link to="/agb" target="_blank" className="font-medium text-accent underline underline-offset-2">
              AGB
            </Link>{' '}
            für autohaus.ai gelesen und akzeptiere sie.
          </span>
        </label>

        <p className="text-xs text-muted-foreground">
          Informationen zur Verarbeitung deiner Daten findest du in der{' '}
          <Link to="/datenschutz" target="_blank" className="underline underline-offset-2">
            Datenschutzerklärung
          </Link>
          .
        </p>

        <Button type="submit" className="w-full" disabled={saving || !confirm || !b2b || !company.trim()}>
          {saving ? 'Speichern…' : 'Bestätigen und fortfahren'}
        </Button>
        <p className="sr-only">{TERMS_CONFIRM_TEXT}</p>
      </form>
    </div>
  );
}
