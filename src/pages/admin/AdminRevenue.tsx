import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, CreditCard, Users, ArrowDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';

const COLORS = ['hsl(221, 83%, 53%)', 'hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(262, 83%, 58%)', 'hsl(340, 82%, 52%)'];

type Plan = { id: string; name: string; slug: string; price_monthly_cents: number; price_yearly_cents: number; monthly_credits: number };
type Sub = { id: string; user_id: string; plan_id: string; status: string; billing_cycle: string; created_at: string; current_period_end: string };
type CreditTx = { amount: number; action_type: string; created_at: string };

export default function AdminRevenue() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [creditTx, setCreditTx] = useState<CreditTx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, s, ct] = await Promise.all([
        supabase.from('subscription_plans').select('id, name, slug, price_monthly_cents, price_yearly_cents, monthly_credits'),
        supabase.from('user_subscriptions').select('id, user_id, plan_id, status, billing_cycle, created_at, current_period_end'),
        supabase.from('credit_transactions').select('amount, action_type, created_at').eq('action_type', 'credit_purchase' as any).order('created_at', { ascending: false }).limit(500),
      ]);
      setPlans((p.data as any[]) || []);
      setSubs((s.data as any[]) || []);
      setCreditTx((ct.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const activeSubs = useMemo(() => subs.filter(s => s.status === 'active'), [subs]);
  const cancelledSubs = useMemo(() => subs.filter(s => s.status === 'cancelled' || s.status === 'canceled'), [subs]);

  const planMap = useMemo(() => {
    const m: Record<string, Plan> = {};
    plans.forEach(p => { m[p.id] = p; });
    return m;
  }, [plans]);

  // MRR calculation
  const mrr = useMemo(() => {
    return activeSubs.reduce((total, sub) => {
      const plan = planMap[sub.plan_id];
      if (!plan) return total;
      if (sub.billing_cycle === 'yearly') return total + Math.round(plan.price_yearly_cents / 12);
      return total + plan.price_monthly_cents;
    }, 0);
  }, [activeSubs, planMap]);

  // Plan distribution
  const planDist = useMemo(() => {
    const counts: Record<string, number> = {};
    activeSubs.forEach(s => {
      const plan = planMap[s.plan_id];
      const name = plan?.name || 'Unbekannt';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activeSubs, planMap]);

  // Churn rate
  const churnRate = useMemo(() => {
    const total = subs.length;
    if (!total) return 0;
    return Math.round(cancelledSubs.length / total * 100);
  }, [subs, cancelledSubs]);

  // Credit purchase revenue
  const creditRevenue = useMemo(() => {
    return creditTx.reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [creditTx]);

  // Monthly sub growth
  const monthlyGrowth = useMemo(() => {
    const map: Record<string, number> = {};
    subs.forEach(s => {
      const month = s.created_at.slice(0, 7);
      map[month] = (map[month] || 0) + 1;
    });
    return Object.entries(map).sort().slice(-12).map(([month, count]) => ({ month, count }));
  }, [subs]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Abo- & Umsatz-Dashboard</h1>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /><span className="text-sm text-muted-foreground">MRR</span></div>
          <p className="text-2xl font-bold text-foreground">{(mrr / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4 text-blue-500" /><span className="text-sm text-muted-foreground">Aktive Abos</span></div>
          <p className="text-2xl font-bold text-foreground">{activeSubs.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><ArrowDownRight className="w-4 h-4 text-red-500" /><span className="text-sm text-muted-foreground">Churn-Rate</span></div>
          <p className="text-2xl font-bold text-foreground">{churnRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-purple-500" /><span className="text-sm text-muted-foreground">Credit-Käufe</span></div>
          <p className="text-2xl font-bold text-foreground">{creditTx.length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Plan-Verteilung</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Neue Abos / Monat</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
