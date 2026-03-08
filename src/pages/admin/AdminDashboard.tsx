import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Zap, FileText, TrendingUp, Mail, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalCreditsUsed: number;
  totalTransactions: number;
  totalLeads: number;
  activeSubscriptions: number;
  recentUsers: { id: string; email: string; created_at: string }[];
  topActions: { action_type: string; count: number }[];
  userGrowth: { date: string; count: number }[];
  creditTrend: { date: string; amount: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalProjects: 0, totalCreditsUsed: 0, totalTransactions: 0,
    totalLeads: 0, activeSubscriptions: 0,
    recentUsers: [], topActions: [], userGrowth: [], creditTrend: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    const [profiles, projects, balances, transactions, leads, subscriptions] = await Promise.all([
      supabase.from('profiles').select('id, email, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(100),
      supabase.from('projects').select('id', { count: 'exact' }),
      supabase.from('credit_balances').select('lifetime_used'),
      supabase.from('credit_transactions').select('action_type, amount, created_at'),
      supabase.from('leads').select('id', { count: 'exact' }),
      supabase.from('user_subscriptions').select('id, status').eq('status', 'active' as any),
    ]);

    const allProfiles = (profiles.data as any[]) || [];
    const allTransactions = (transactions.data as any[]) || [];
    const totalCreditsUsed = ((balances.data as any[]) || []).reduce((s: number, b: any) => s + (b.lifetime_used || 0), 0);

    // Action counts
    const actionCounts: Record<string, number> = {};
    for (const t of allTransactions) {
      actionCounts[t.action_type] = (actionCounts[t.action_type] || 0) + 1;
    }
    const topActions = Object.entries(actionCounts)
      .map(([action_type, count]) => ({ action_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // User growth (last 30 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userGrowthMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      userGrowthMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const p of allProfiles) {
      const d = p.created_at.split('T')[0];
      if (d in userGrowthMap) userGrowthMap[d]++;
    }
    const userGrowth = Object.entries(userGrowthMap).map(([date, count]) => ({ date, count }));

    // Credit usage trend (last 30 days)
    const creditMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      creditMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const t of allTransactions) {
      const d = t.created_at.split('T')[0];
      if (d in creditMap && t.amount < 0) creditMap[d] += Math.abs(t.amount);
    }
    const creditTrend = Object.entries(creditMap).map(([date, amount]) => ({ date, amount }));

    setStats({
      totalUsers: profiles.count || 0,
      totalProjects: projects.count || 0,
      totalCreditsUsed,
      totalTransactions: allTransactions.length,
      totalLeads: leads.count || 0,
      activeSubscriptions: (subscriptions.data as any[])?.length || 0,
      recentUsers: allProfiles.slice(0, 5),
      topActions,
      userGrowth,
      creditTrend,
    });
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  const cards = [
    { icon: Users, label: 'Nutzer', value: stats.totalUsers, color: 'text-blue-500' },
    { icon: FileText, label: 'Projekte', value: stats.totalProjects, color: 'text-emerald-500' },
    { icon: Zap, label: 'Credits verbraucht', value: stats.totalCreditsUsed, color: 'text-amber-500' },
    { icon: TrendingUp, label: 'Transaktionen', value: stats.totalTransactions, color: 'text-purple-500' },
    { icon: Mail, label: 'Leads', value: stats.totalLeads, color: 'text-pink-500' },
    { icon: CreditCard, label: 'Aktive Abos', value: stats.activeSubscriptions, color: 'text-cyan-500' },
  ];

  const maxUserGrowth = Math.max(...stats.userGrowth.map(d => d.count), 1);
  const maxCreditTrend = Math.max(...stats.creditTrend.map(d => d.amount), 1);

  return (
    <div className="p-8 space-y-8">
      <h1 className="font-display text-2xl font-bold text-foreground">Admin-Übersicht</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Growth Chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Nutzer-Wachstum (30 Tage)</h2>
          <div className="flex items-end gap-[2px] h-28">
            {stats.userGrowth.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-blue-500/80 rounded-t-sm min-h-[2px] transition-all hover:bg-blue-500"
                  style={{ height: `${Math.max((d.count / maxUserGrowth) * 100, 2)}%` }}
                />
                <div className="absolute -top-8 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}: {d.count} neue
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>{new Date(stats.userGrowth[0]?.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
            <span>Gesamt: {stats.userGrowth.reduce((s, d) => s + d.count, 0)} neue Nutzer</span>
          </div>
        </div>

        {/* Credit Usage Chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Credit-Verbrauch (30 Tage)</h2>
          <div className="flex items-end gap-[2px] h-28">
            {stats.creditTrend.map(d => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
                <div
                  className="w-full bg-amber-500/80 rounded-t-sm min-h-[2px] transition-all hover:bg-amber-500"
                  style={{ height: `${Math.max((d.amount / maxCreditTrend) * 100, 2)}%` }}
                />
                <div className="absolute -top-8 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}: {d.amount} Credits
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>{new Date(stats.creditTrend[0]?.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
            <span>Gesamt: {stats.creditTrend.reduce((s, d) => s + d.amount, 0)} Credits</span>
          </div>
        </div>
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
                  <Badge variant="secondary" className="text-xs">{a.count}</Badge>
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
