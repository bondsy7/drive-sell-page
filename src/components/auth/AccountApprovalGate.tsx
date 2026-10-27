import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Props { userId: string; email?: string | null; fullName?: string; children: React.ReactNode }

/** Self-registered accounts stay locked until the team approves the submitted request. */
export default function AccountApprovalGate({ userId, email, fullName, children }: Props) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['account-approval', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('account_approvals').select('status, submitted_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ full_name: fullName || '', phone: '', company_name: '', company_address: '', company_website: '' });
  const [sending, setSending] = useState(false);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  if (isError) return <div className="min-h-screen flex flex-col gap-4 items-center justify-center bg-background px-4"><p className="text-muted-foreground">Deine Zugangsfreigabe konnte nicht geprüft werden.</p><Button onClick={() => refetch()}>Erneut prüfen</Button></div>;
  if (!data || data.status === 'approved') return <>{children}</>;

  const signOut = () => supabase.auth.signOut();
  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">{content}
        <Button variant="ghost" onClick={signOut}>Abmelden</Button>
      </div>
    </div>
  );

  if (data.status === 'rejected') return shell(
    <div className="space-y-2">
      <h2 className="font-display text-xl font-bold text-foreground">Zugang nicht freigegeben</h2>
      <p className="text-sm text-muted-foreground">Deine Anfrage wurde leider nicht freigegeben. Bei Fragen erreichst du uns unter <a className="text-accent underline" href="mailto:info@breadcrumb.de">info@breadcrumb.de</a>.</p>
    </div>,
  );

  if (data.submitted_at) return shell(
    <div className="space-y-2">
      <h2 className="font-display text-xl font-bold text-foreground">Anfrage wird geprüft</h2>
      <p className="text-sm text-muted-foreground">Deine Registrierung ist vorgemerkt und deine E-Mail-Adresse bestätigt. Dein Konto bleibt inaktiv, bis ein Admin deine Angaben geprüft und den Zugang ausdrücklich freigegeben hat. Über die Entscheidung informieren wir dich per E-Mail an {email}.</p>
    </div>,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { data: res, error } = await supabase.functions.invoke('account-approval', { body: { action: 'submit', ...form } });
    setSending(false);
    if (error || !res?.ok) {
      toast.error('Anfrage konnte nicht gesendet werden. Bitte prüfe deine Angaben.');
      return;
    }
    qc.invalidateQueries({ queryKey: ['account-approval', userId] });
  };
  const field = (key: keyof typeof form, label: string, required = true, type = 'text') => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}{required ? ' *' : ''}</Label>
      <Input id={key} type={type} required={required} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return shell(
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-foreground">Zugang anfragen</h2>
        <p className="text-sm text-muted-foreground">Deine Registrierung ist zunächst nur eine Vormerkung. Deine E-Mail-Adresse ist bestätigt; bitte sende uns jetzt deine Kontakt- und Firmendaten. Erst nach Prüfung und manueller Admin-Freigabe wird dein Zugang aktiv.</p>
      </div>
      {field('full_name', 'Name')}
      <div className="space-y-1.5"><Label>E-Mail</Label><Input value={email || ''} disabled /></div>
      {field('phone', 'Telefon', true, 'tel')}
      {field('company_name', 'Firma')}
      {field('company_address', 'Firmenadresse')}
      {field('company_website', 'Website', false)}
      <Button type="submit" className="w-full" disabled={sending}>{sending ? 'Wird gesendet …' : 'Freigabe anfragen'}</Button>
    </form>,
  );
}
