import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Zap, FileText, TrendingUp, Mail, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalCreditsUsed: number;
  totalTransactions: number;
  totalLeads: number;
  activeSubscriptions: number;
  recentUsers: { id: string; email: string; created_at: string }[];
  topActions: { action_type: string; count: number }[];
  userGrowthCumulative: { date: string; total: number; newUsers: number }[];
  creditTrend: { date: string; amount: number }[];
  actionDistribution: { name: string; value: number }[];
}

const COLORS = [
  'hsl(221, 83%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)', 'hsl(340, 82%, 52%)', 'hsl(190, 90%, 50%)',
  'hsl(30, 90%, 55%)', 'hsl(280, 65%, 60%)',
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);

    // Fetch all data in parallel — no arbitrary limits
    const [profiles, projects, balances, transactions, leads, subscriptions] = await Promise.all([
      supabase.from('profiles').select('id, email, created_at', { count: 'exact' }).order('created_at', { ascending: true }),
      supabase.from('projects').select('id', { count: 'exact' }),
      supabase.from('credit_balances').select('lifetime_used'),
      supabase.from('credit_transactions').select('action_type, amount, created_at'),
      supabase.from('leads').select('id', { count: 'exact' }),
      supabase.from('user_subscriptions').select('id, status').eq('status', 'active' as any),
    ]);

    const allProfiles = (profiles.data as any[]) || [];
    const allTransactions = (transactions.data as any[]) || [];
    const totalCreditsUsed = ((balances.data as any[]) || []).reduce((s: number, b: any) => s + (b.lifetime_used || 0), 0);

    // --- Action distribution (pie chart) ---
    const actionCounts: Record<string, number> = {};
    for (const t of allTransactions) {
      if (t.amount < 0) {
        const label = t.action_type.replace(/_/g, ' ');
        actionCounts[label] = (actionCounts[label] || 0) + 1;
      }
    }
    const actionDistribution = Object.entries(actionCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const topActions = Object.entries(actionCounts)
      .map(([action_type, count]) => ({ action_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // --- Cumulative user growth (all-time, daily resolution for last 90 days) ---
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysBack = 90;
    const startDate = new Date(now.getTime() - daysBack * 86400000);

    // Count all users before startDate for the baseline
    let baseline = 0;
    const dailyNew: Record<string, number> = {};
    for (let i = daysBack; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      dailyNew[d.toISOString().split('T')[0]] = 0;
    }

    for (const p of allProfiles) {
      const d = new Date(p.created_at);
      const key = d.toISOString().split('T')[0];
      if (d < startDate) {
        baseline++;
      } else if (key in dailyNew) {
        dailyNew[key]++;
      }
    }

    let cumulative = baseline;
    const userGrowthCumulative = Object.entries(dailyNew).map(([date, newUsers]) => {
      cumulative += newUsers;
      return { date, total: cumulative, newUsers };
    });

    // --- Credit usage trend (last 90 days, daily) ---
    const creditMap: Record<string, number> = {};
    for (let i = daysBack; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      creditMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const t of allTransactions) {
      const d = t.created_at.split('T')[0];
      if (d in creditMap && t.amount < 0) creditMap[d] += Math.abs(t.amount);
    }
    const creditTrend = Object.entries(creditMap).map(([date, amount]) => ({ date, amount }));

    setStats({
      totalUsers: profiles.count || allProfiles.length,
      totalProjects: projects.count || 0,
      totalCreditsUsed,
      totalTransactions: allTransactions.length,
      totalLeads: leads.count || 0,
      activeSubscriptions: (subscriptions.data as any[])?.length || 0,
      recentUsers: [...allProfiles].reverse().slice(0, 5),
      topActions,
      userGrowthCumulative,
      creditTrend,
      actionDistribution,
    });
    setLoading(false);
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const cards = [
    { icon: Users, label: 'Nutzer', value: stats.totalUsers, color: 'text-blue-500' },
    { icon: FileText, label: 'Projekte', value: stats.totalProjects, color: 'text-emerald-500' },
    { icon: Zap, label: 'Credits verbraucht', value: stats.totalCreditsUsed, color: 'text-amber-500' },
    { icon: TrendingUp, label: 'Transaktionen', value: stats.totalTransactions, color: 'text-purple-500' },
    { icon: Mail, label: 'Leads', value: stats.totalLeads, color: 'text-pink-500' },
    { icon: CreditCard, label: 'Aktive Abos', value: stats.activeSubscriptions, color: 'text-cyan-500' },
  ];

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  const totalCreditsPeriod = stats.creditTrend.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
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

      {/* Cumulative User Growth (Area Chart) */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-display font-semibold text-foreground mb-1">Nutzer-Wachstum (kumulativ, 90 Tage)</h2>
        <p className="text-xs text-muted-foreground mb-4">Gesamtzahl registrierter Nutzer über Zeit</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.userGrowthCumulative}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                interval={13}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                labelFormatter={(d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                formatter={(value: number, name: string) => [
                  value,
                  name === 'total' ? 'Gesamt-Nutzer' : 'Neue Nutzer',
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2}
                fill="url(#colorUsers)"
              />
              <Bar dataKey="newUsers" fill="hsl(221, 83%, 53%)" opacity={0.5} barSize={4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Credit Usage (Bar Chart) */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display font-semibold text-foreground">Credit-Verbrauch (90 Tage)</h2>
          <Badge variant="secondary" className="text-xs">Gesamt: {totalCreditsPeriod} Credits</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Täglicher Credit-Verbrauch</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.creditTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                interval={13}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                labelFormatter={(d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                formatter={(value: number) => [value, 'Credits']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="amount" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Action Distribution (Pie Chart) */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Aktionen-Verteilung</h2>
          {stats.actionDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Aktionen</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.actionDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {stats.actionDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [value, name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Actions */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Top-Aktionen</h2>
          {stats.topActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Aktionen</p>
          ) : (
            <div className="space-y-2">
              {stats.topActions.map(a => (
                <div key={a.action_type} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground capitalize">{a.action_type}</span>
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
