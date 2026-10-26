import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/** Open access requests from self-registered accounts. */
export default function AccountApprovalRequests() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ['admin-account-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('account_approvals').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (!data.length) return null;

  const review = async (user_id: string, decision: 'approved' | 'rejected') => {
    const { data: res, error } = await supabase.functions.invoke('account-approval', { body: { action: 'review', user_id, decision } });
    if (error || !res?.ok) return toast.error('Aktion fehlgeschlagen');
    toast.success(decision === 'approved' ? 'Zugang freigegeben' : 'Anfrage abgelehnt');
    qc.invalidateQueries({ queryKey: ['admin-account-approvals'] });
  };

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
      <h2 className="font-display text-lg font-semibold text-foreground">Offene Freigaben ({data.length})</h2>
      {data.map(r => (
        <div key={r.user_id} className="flex flex-col md:flex-row md:items-center gap-3 rounded-lg bg-card p-3 border border-border">
          <div className="flex-1 text-sm space-y-0.5">
            <div className="font-medium text-foreground">{r.full_name || '–'} · {r.email}</div>
            {r.submitted_at ? (
              <div className="text-muted-foreground">{r.company_name} · {r.company_address} · Tel. {r.phone}{r.company_website ? ` · ${r.company_website}` : ''}</div>
            ) : (
              <div className="text-muted-foreground">Formular noch nicht ausgefüllt</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => review(r.user_id, 'approved')}>Freigeben</Button>
            <Button size="sm" variant="outline" onClick={() => review(r.user_id, 'rejected')}>Ablehnen</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
