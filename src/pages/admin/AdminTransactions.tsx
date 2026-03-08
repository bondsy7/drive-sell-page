import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  model_used: string | null;
  description: string | null;
  created_at: string;
  user_email?: string;
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTransactions(); }, []);

  const loadTransactions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('credit_transactions' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    // Get emails for user_ids
    const userIds = [...new Set(((data as any[]) || []).map((t: any) => t.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const emailMap: Record<string, string> = {};
    for (const p of (profiles as any[]) || []) emailMap[p.id] = p.email || '';

    setTransactions(((data as any[]) || []).map((t: any) => ({ ...t, user_email: emailMap[t.user_id] || t.user_id.slice(0, 8) })));
    setLoading(false);
  };

  const filtered = transactions.filter(t =>
    !search ||
    (t.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
    t.action_type.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Transaktionen</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Datum</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Nutzer</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Aktion</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Credits</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Modell</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="p-3 text-muted-foreground whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="p-3 text-foreground truncate max-w-[150px]">{t.user_email}</td>
                <td className="p-3 capitalize text-foreground">{t.action_type.replace(/_/g, ' ')}</td>
                <td className={`p-3 text-center font-semibold ${t.amount < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount}
                </td>
                <td className="p-3 text-muted-foreground">{t.model_used || '—'}</td>
                <td className="p-3 text-muted-foreground truncate max-w-[200px]">{t.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Transaktionen</p>}
      </div>
    </div>
  );
}
