import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Zap, FileText, TrendingUp } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalCreditsUsed: number;
  totalTransactions: number;
  recentUsers: { id: string; email: string; created_at: string }[];
  topActions: { action_type: string; count: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalProjects: 0, totalCreditsUsed: 0, totalTransactions: 0,
    recentUsers: [], topActions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    const [profiles, projects, balances, transactions] = await Promise.all([
      supabase.from('profiles').select('id, email, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(10),
      supabase.from('projects').select('id', { count: 'exact' }),
      supabase.from('credit_balances' as any).select('lifetime_used'),
      supabase.from('credit_transactions' as any).select('action_type'),
    ]);

    const totalCreditsUsed = ((balances.data as any[]) || []).reduce((s: number, b: any) => s + (b.lifetime_used || 0), 0);

    // Count actions
    const actionCounts: Record<string, number> = {};
    for (const t of ((transactions.data as any[]) || [])) {
      actionCounts[t.action_type] = (actionCounts[t.action_type] || 0) + 1;
    }
    const topActions = Object.entries(actionCounts)
      .map(([action_type, count]) => ({ action_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setStats({
      totalUsers: profiles.count || 0,
      totalProjects: projects.count || 0,
      totalCreditsUsed,
      totalTransactions: (transactions.data as any[])?.length || 0,
      recentUsers: (profiles.data as any[])?.slice(0, 5) || [],
      topActions,
    });
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  const cards = [
    { icon: Users, label: 'Nutzer', value: stats.totalUsers, color: 'text-blue-500' },
    { icon: FileText, label: 'Projekte', value: stats.totalProjects, color: 'text-emerald-500' },
    { icon: Zap, label: 'Credits verbraucht', value: stats.totalCreditsUsed, color: 'text-amber-500' },
    { icon: TrendingUp, label: 'Transaktionen', value: stats.totalTransactions, color: 'text-purple-500' },
  ];

  return (
    <div className="p-8 space-y-8">
      <h1 className="font-display text-2xl font-bold text-foreground">Admin-Übersicht</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 mb-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString('de-DE')}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Actions */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Top-Aktionen</h2>
          {stats.topActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Aktionen</p>
          ) : (
            <div className="space-y-2">
              {stats.topActions.map(a => (
                <div key={a.action_type} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground capitalize">{a.action_type.replace(/_/g, ' ')}</span>
                  <span className="text-sm font-semibold text-muted-foreground">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Neueste Nutzer</h2>
          {stats.recentUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Nutzer</p>
          ) : (
            <div className="space-y-2">
              {stats.recentUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground truncate max-w-[200px]">{u.email || u.id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
