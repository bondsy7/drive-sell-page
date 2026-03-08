import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Zap, FileText, TrendingUp, Mail, CreditCard, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

/* ── Types ─────────────────────────────────────────── */

interface Profile { id: string; email: string; created_at: string }
interface Transaction { user_id: string; action_type: string; amount: number; created_at: string }
interface RawData {
  profiles: Profile[];
  transactions: Transaction[];
  totalProjects: number;
  totalLeads: number;
  activeSubscriptions: number;
  totalCreditsUsed: number;
}

type RangeKey = '7d' | '30d' | '90d' | '1y' | 'all';
type KpiKey = 'users' | 'projects' | 'credits' | 'transactions' | 'leads' | 'subscriptions';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 Tage' },
  { key: '30d', label: '30 Tage' },
  { key: '90d', label: '90 Tage' },
  { key: '1y', label: '1 Jahr' },
  { key: 'all', label: 'Gesamt' },
];

const COLORS = [
  'hsl(221, 83%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)',
  'hsl(262, 83%, 58%)', 'hsl(340, 82%, 52%)', 'hsl(190, 90%, 50%)',
  'hsl(30, 90%, 55%)', 'hsl(280, 65%, 60%)',
];

const ACTION_LABELS: Record<string, string> = {
  pdf_analysis: 'PDF-Analyse',
  image_generate: 'Bildgenerierung',
  image_remaster: 'Bild-Remaster',
  vin_ocr: 'VIN-OCR',
  credit_purchase: 'Credit-Kauf',
  subscription_reset: 'Abo-Reset',
  admin_adjustment: 'Admin-Anpassung',
  landing_page_export: 'Landing-Export',
};

function rangeDays(key: RangeKey): number {
  if (key === '7d') return 7;
  if (key === '30d') return 30;
  if (key === '90d') return 90;
  if (key === '1y') return 365;
  return 9999; // 'all' – effectively everything
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function formatDateLong(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
};

/* ── Component ─────────────────────────────────────── */

export default function AdminDashboard() {
  const [raw, setRaw] = useState<RawData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>('30d');
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [allUsersSelected, setAllUsersSelected] = useState(true);

  /* ── Load raw data once ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [profiles, projects, balances, transactions, leads, subscriptions] = await Promise.all([
        supabase.from('profiles').select('id, email, created_at').order('created_at', { ascending: true }),
        supabase.from('projects').select('id', { count: 'exact' }),
        supabase.from('credit_balances').select('lifetime_used'),
        supabase.from('credit_transactions').select('user_id, action_type, amount, created_at').order('created_at', { ascending: true }),
        supabase.from('leads').select('id', { count: 'exact' }),
        supabase.from('user_subscriptions').select('id, status').eq('status', 'active' as any),
      ]);

      const allProfiles = (profiles.data as any[] || []) as Profile[];
      const allTransactions = (transactions.data as any[] || []) as Transaction[];
      const totalCreditsUsed = ((balances.data as any[]) || []).reduce((s: number, b: any) => s + (b.lifetime_used || 0), 0);

      const userSet = new Set(allProfiles.map(p => p.id));
      setSelectedUsers(userSet);
      setAllUsersSelected(true);

      setRaw({
        profiles: allProfiles,
        transactions: allTransactions,
        totalProjects: projects.count || 0,
        totalLeads: leads.count || 0,
        activeSubscriptions: (subscriptions.data as any[])?.length || 0,
        totalCreditsUsed,
      });
      setLoading(false);
    })();
  }, []);

  /* ── Derived: date cutoff ── */
  const cutoff = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return new Date(now.getTime() - rangeDays(range) * 86400000);
  }, [range]);

  /* ── Users list for filter ── */
  const usersList = useMemo(() => raw?.profiles || [], [raw]);

  const toggleUser = useCallback((id: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      setAllUsersSelected(next.size === usersList.length);
      return next;
    });
  }, [usersList.length]);

  const toggleAllUsers = useCallback(() => {
    if (allUsersSelected) {
      setSelectedUsers(new Set());
      setAllUsersSelected(false);
    } else {
      setSelectedUsers(new Set(usersList.map(u => u.id)));
      setAllUsersSelected(true);
    }
  }, [allUsersSelected, usersList]);

  /* ── Filtered transactions ── */
  const filteredTx = useMemo(() => {
    if (!raw) return [];
    return raw.transactions.filter(t => {
      const d = new Date(t.created_at);
      return d >= cutoff && selectedUsers.has(t.user_id);
    });
  }, [raw, cutoff, selectedUsers]);

  /* ── KPI values ── */
  const kpis = useMemo(() => {
    if (!raw) return null;
    const filteredProfiles = raw.profiles.filter(p => new Date(p.created_at) >= cutoff && selectedUsers.has(p.id));
    const spentCredits = filteredTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    return {
      users: filteredProfiles.length,
      projects: raw.totalProjects,
      credits: spentCredits,
      transactions: filteredTx.length,
      leads: raw.totalLeads,
      subscriptions: raw.activeSubscriptions,
    };
  }, [raw, cutoff, selectedUsers, filteredTx]);

  /* ── Chart data builders ── */
  const buildDailyMap = useCallback((daysCount: number) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const days = Math.min(daysCount, rangeDays(range));
    const map: Record<string, number> = {};
    for (let i = days; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      map[d.toISOString().split('T')[0]] = 0;
    }
    return map;
  }, [range]);

  /* User growth chart */
  const userGrowthData = useMemo(() => {
    if (!raw) return [];
    const days = rangeDays(range);
    const map = buildDailyMap(days);
    let baseline = 0;
    for (const p of raw.profiles) {
      if (!selectedUsers.has(p.id)) continue;
      const key = p.created_at.split('T')[0];
      if (key in map) { map[key]++; }
      else if (new Date(p.created_at) < cutoff) { baseline++; }
    }
    let cum = baseline;
    return Object.entries(map).map(([date, newUsers]) => {
      cum += newUsers;
      return { date, total: cum, newUsers };
    });
  }, [raw, range, cutoff, selectedUsers, buildDailyMap]);

  /* Credit usage chart */
  const creditTrendData = useMemo(() => {
    if (!raw) return [];
    const days = rangeDays(range);
    const map = buildDailyMap(days);
    for (const t of filteredTx) {
      if (t.amount < 0) {
        const key = t.created_at.split('T')[0];
        if (key in map) map[key] += Math.abs(t.amount);
      }
    }
    return Object.entries(map).map(([date, amount]) => ({ date, amount }));
  }, [raw, filteredTx, range, buildDailyMap]);

  /* Action distribution */
  const actionDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of filteredTx) {
      if (t.amount < 0) {
        const label = ACTION_LABELS[t.action_type] || t.action_type.replace(/_/g, ' ');
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTx]);

  /* Per-action breakdown over time */
  const perActionTrendData = useMemo(() => {
    if (!raw) return { data: [] as any[], actions: [] as string[] };
    const days = rangeDays(range);
    const actionSet = new Set<string>();
    const dayMap: Record<string, Record<string, number>> = {};
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = Math.min(days, rangeDays(range)); i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0];
      dayMap[d] = {};
    }
    for (const t of filteredTx) {
      if (t.amount < 0) {
        const key = t.created_at.split('T')[0];
        const label = ACTION_LABELS[t.action_type] || t.action_type.replace(/_/g, ' ');
        actionSet.add(label);
        if (key in dayMap) dayMap[key][label] = (dayMap[key][label] || 0) + 1;
      }
    }
    const actions = Array.from(actionSet);
    const data = Object.entries(dayMap).map(([date, vals]) => {
      const row: any = { date };
      for (const a of actions) row[a] = vals[a] || 0;
      return row;
    });
    return { data, actions };
  }, [raw, filteredTx, range]);

  /* Per-user credit breakdown */
  const perUserCreditData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filteredTx) {
      if (t.amount < 0) {
        const userId = t.user_id;
        const profile = raw?.profiles.find(p => p.id === userId);
        const label = profile?.email || userId.slice(0, 8);
        map[label] = (map[label] || 0) + Math.abs(t.amount);
      }
    }
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTx, raw]);

  /* ── XAxis interval ── */
  const xInterval = useMemo(() => {
    const days = rangeDays(range);
    if (days <= 7) return 0;
    if (days <= 30) return 3;
    if (days <= 90) return 13;
    return 30;
  }, [range]);

  if (loading || !raw || !kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const kpiCards: { key: KpiKey; icon: any; label: string; value: number; color: string }[] = [
    { key: 'users', icon: Users, label: 'Nutzer', value: kpis.users, color: 'text-blue-500' },
    { key: 'projects', icon: FileText, label: 'Projekte', value: kpis.projects, color: 'text-emerald-500' },
    { key: 'credits', icon: Zap, label: 'Credits verbraucht', value: kpis.credits, color: 'text-amber-500' },
    { key: 'transactions', icon: TrendingUp, label: 'Transaktionen', value: kpis.transactions, color: 'text-purple-500' },
    { key: 'leads', icon: Mail, label: 'Leads', value: kpis.leads, color: 'text-pink-500' },
    { key: 'subscriptions', icon: CreditCard, label: 'Aktive Abos', value: kpis.subscriptions, color: 'text-cyan-500' },
  ];

  const totalCreditsPeriod = creditTrendData.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-foreground">Admin-Übersicht</h1>

        {/* Date range selector */}
        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg">
          <CalendarDays className="w-4 h-4 text-muted-foreground ml-2" />
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                range === r.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* User filter */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground">Nutzer-Filter</h3>
          <Button variant="ghost" size="sm" className="text-xs" onClick={toggleAllUsers}>
            {allUsersSelected ? 'Alle abwählen' : 'Alle auswählen'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {usersList.map(u => (
            <label
              key={u.id}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                selectedUsers.has(u.id)
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-muted/50 border-border text-muted-foreground'
              }`}
            >
              <Checkbox
                checked={selectedUsers.has(u.id)}
                onCheckedChange={() => toggleUser(u.id)}
                className="w-3.5 h-3.5"
              />
              {u.email || u.id.slice(0, 8)}
            </label>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpiCards.map(({ key, icon: Icon, label, value, color }) => (
          <button
            key={key}
            onClick={() => setActiveKpi(activeKpi === key ? null : key)}
            className={`text-left bg-card rounded-xl border p-5 transition-all ${
              activeKpi === key
                ? 'border-accent ring-2 ring-accent/20 shadow-md'
                : 'border-border hover:border-accent/40 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{value.toLocaleString('de-DE')}</p>
          </button>
        ))}
      </div>

      {/* Expandable detail panel based on active KPI */}
      {activeKpi === 'users' && (
        <div className="bg-card rounded-xl border border-border p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <h2 className="font-display font-semibold text-foreground mb-1">Nutzer-Wachstum (kumulativ)</h2>
          <p className="text-xs text-muted-foreground mb-4">Gesamtzahl registrierter Nutzer über Zeit</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowthData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval={xInterval} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip labelFormatter={formatDateLong} formatter={(v: number, n: string) => [v, n === 'total' ? 'Gesamt' : 'Neue Nutzer']} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="total" stroke="hsl(221, 83%, 53%)" strokeWidth={2} fill="url(#colorUsers)" />
                <Bar dataKey="newUsers" fill="hsl(221, 83%, 53%)" opacity={0.5} barSize={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeKpi === 'credits' && (
        <div className="bg-card rounded-xl border border-border p-5 animate-in fade-in slide-in-from-top-2 duration-200 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-semibold text-foreground">Credit-Verbrauch gesamt</h2>
              <Badge variant="secondary" className="text-xs">{totalCreditsPeriod} Credits</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Täglicher Credit-Verbrauch</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={creditTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval={xInterval} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip labelFormatter={formatDateLong} formatter={(v: number) => [v, 'Credits']} contentStyle={tooltipStyle} />
                  <Bar dataKey="amount" fill="hsl(38, 92%, 50%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-user breakdown */}
          {perUserCreditData.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-foreground mb-3">Verbrauch pro Nutzer</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perUserCreditData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => [v, 'Credits']} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="hsl(38, 92%, 50%)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {activeKpi === 'transactions' && (
        <div className="bg-card rounded-xl border border-border p-5 animate-in fade-in slide-in-from-top-2 duration-200 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pie: Action distribution */}
            <div>
              <h2 className="font-display font-semibold text-foreground mb-3">Aktionen-Verteilung</h2>
              {actionDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Aktionen</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={actionDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={2} dataKey="value">
                        {actionDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Line: Per-action trend */}
            <div>
              <h2 className="font-display font-semibold text-foreground mb-3">Aktionen über Zeit</h2>
              {perActionTrendData.actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Daten</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={perActionTrendData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} interval={xInterval} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip labelFormatter={formatDateLong} contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {perActionTrendData.actions.map((a, i) => (
                        <Line key={a} type="monotone" dataKey={a} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(activeKpi === 'leads' || activeKpi === 'projects' || activeKpi === 'subscriptions') && (
        <div className="bg-card rounded-xl border border-border p-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-muted-foreground">
            {activeKpi === 'leads' && `Insgesamt ${kpis.leads} Leads erfasst. Detailansicht unter Leads im Seitenmenü.`}
            {activeKpi === 'projects' && `Insgesamt ${kpis.projects} Projekte erstellt. Detailansicht unter Nutzer im Seitenmenü.`}
            {activeKpi === 'subscriptions' && `${kpis.subscriptions} aktive Abonnements.`}
          </p>
        </div>
      )}

      {/* Always visible: recent users + top actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Neueste Nutzer</h2>
          {raw.profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Nutzer</p>
          ) : (
            <div className="space-y-2">
              {[...raw.profiles].reverse().slice(0, 8).map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground truncate max-w-[200px]">{u.email || u.id.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">Top-Aktionen (Zeitraum)</h2>
          {actionDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Aktionen</p>
          ) : (
            <div className="space-y-2">
              {actionDistribution.slice(0, 8).map(a => (
                <div key={a.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-foreground capitalize">{a.name}</span>
                  <Badge variant="secondary" className="text-xs">{a.value}×</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
