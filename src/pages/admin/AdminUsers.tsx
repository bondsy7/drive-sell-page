import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, Plus, Minus, Shield, ShieldCheck, User, Crown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface PlanInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  billing_cycle: string;
}

interface UserRow {
  id: string;
  email: string | null;
  company_name: string | null;
  created_at: string;
  balance?: number;
  lifetime_used?: number;
  roles?: string[];
  plan?: PlanInfo | null;
  project_count?: number;
  lead_count?: number;
  last_transaction?: string | null;
}

interface AvailablePlan {
  id: string;
  name: string;
  slug: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: 'Admin', icon: ShieldCheck, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  moderator: { label: 'Moderator', icon: Shield, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  user: { label: 'User', icon: User, color: 'bg-muted text-muted-foreground border-border' },
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-muted text-muted-foreground border-border',
  starter: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  pro: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  enterprise: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  cancelled: 'Gekündigt',
  past_due: 'Überfällig',
  trialing: 'Testphase',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [plans, setPlans] = useState<AvailablePlan[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: balances }, { data: roles }, { data: subscriptions }, { data: availablePlans }, { data: projects }, { data: leadsData }, { data: lastTransactions }] = await Promise.all([
      supabase.from('profiles').select('id, email, company_name, created_at').order('created_at', { ascending: false }),
      supabase.from('credit_balances').select('user_id, balance, lifetime_used'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('user_subscriptions').select('user_id, plan_id, status, billing_cycle, subscription_plans(id, name, slug)'),
      supabase.from('subscription_plans').select('id, name, slug').eq('active', true).order('sort_order'),
      supabase.from('projects').select('id, user_id'),
      supabase.from('leads').select('id, dealer_user_id'),
      supabase.from('credit_transactions').select('user_id, created_at').order('created_at', { ascending: false }),
    ]);

    setPlans((availablePlans as any[]) || []);

    const balanceMap: Record<string, { balance: number; lifetime_used: number }> = {};
    for (const b of (balances as any[]) || []) {
      balanceMap[b.user_id] = { balance: b.balance, lifetime_used: b.lifetime_used };
    }

    const roleMap: Record<string, string[]> = {};
    for (const r of (roles as any[]) || []) {
      if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
      roleMap[r.user_id].push(r.role);
    }

    const subMap: Record<string, PlanInfo> = {};
    for (const s of (subscriptions as any[]) || []) {
      const plan = s.subscription_plans;
      if (plan) {
        subMap[s.user_id] = {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          status: s.status,
          billing_cycle: s.billing_cycle,
        };
      }
    }

    // Project counts per user
    const projectCountMap: Record<string, number> = {};
    for (const p of (projects as any[]) || []) {
      projectCountMap[p.user_id] = (projectCountMap[p.user_id] || 0) + 1;
    }

    // Lead counts per dealer
    const leadCountMap: Record<string, number> = {};
    for (const l of (leadsData as any[]) || []) {
      leadCountMap[l.dealer_user_id] = (leadCountMap[l.dealer_user_id] || 0) + 1;
    }

    // Last transaction per user
    const lastTxMap: Record<string, string> = {};
    for (const t of (lastTransactions as any[]) || []) {
      if (!lastTxMap[t.user_id]) lastTxMap[t.user_id] = t.created_at;
    }

    const merged = ((profiles as any[]) || []).map(p => ({
      ...p,
      balance: balanceMap[p.id]?.balance ?? 0,
      lifetime_used: balanceMap[p.id]?.lifetime_used ?? 0,
      roles: roleMap[p.id] || [],
      plan: subMap[p.id] || null,
      project_count: projectCountMap[p.id] || 0,
      lead_count: leadCountMap[p.id] || 0,
      last_transaction: lastTxMap[p.id] || null,
    }));
    setUsers(merged);
    setLoading(false);
  };

  const adjustCredits = async (userId: string, amount: number) => {
    if (amount === 0) return;
    const action = amount > 0 ? 'add_credits' : 'deduct_credits';
    const { error } = await supabase.rpc(action as any, {
      _user_id: userId,
      _amount: Math.abs(amount),
      _action_type: 'admin_adjustment',
      ...(action === 'deduct_credits' ? { _model: null } : {}),
      _description: `Admin-Anpassung: ${amount > 0 ? '+' : ''}${amount} Credits`,
    });
    if (error) { toast.error('Fehler: ' + error.message); return; }
    toast.success(`Credits angepasst: ${amount > 0 ? '+' : ''}${amount}`);
    setAdjusting(null);
    setAdjustAmount('');
    loadUsers();
  };

  const assignRole = async (userId: string, role: string) => {
    const user = users.find(u => u.id === userId);
    const currentRoles = user?.roles || [];

    if (role === 'none') {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId);
      if (error) { toast.error('Fehler: ' + error.message); return; }
      toast.success('Alle Rollen entfernt');
    } else if (currentRoles.includes(role)) {
      toast.info('Nutzer hat diese Rolle bereits');
      return;
    } else {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: role as any });
      if (error) { toast.error('Fehler: ' + error.message); return; }
      toast.success(`Rolle "${ROLE_LABELS[role]?.label || role}" zugewiesen`);
    }
    loadUsers();
  };

  const assignPlan = async (userId: string, planId: string) => {
    const user = users.find(u => u.id === userId);

    if (planId === 'none') {
      // Remove subscription
      if (user?.plan) {
        const { error } = await supabase.from('user_subscriptions').delete().eq('user_id', userId);
        if (error) { toast.error('Fehler: ' + error.message); return; }
        toast.success('Plan entfernt');
      }
    } else {
      const selectedPlan = plans.find(p => p.id === planId);
      if (user?.plan) {
        // Update existing subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ plan_id: planId, status: 'active' as any })
          .eq('user_id', userId);
        if (error) { toast.error('Fehler: ' + error.message); return; }
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: planId,
            status: 'active' as any,
            billing_cycle: 'monthly' as any,
          });
        if (error) { toast.error('Fehler: ' + error.message); return; }
      }
      toast.success(`Plan "${selectedPlan?.name || planId}" zugewiesen`);
    }
    loadUsers();
  };

  const filtered = users.filter(u =>
    !search || (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.company_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Nutzerverwaltung</h1>
        <span className="text-sm text-muted-foreground">{users.length} Nutzer registriert</span>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">E-Mail</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Firma</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Rolle</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Plan</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Credits</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Verbraucht</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Projekte</th>
              <th className="text-center p-3 font-medium text-muted-foreground">Leads</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Letzte Aktivität</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Registriert</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const primaryRole = u.roles?.[0] || null;
              const roleInfo = primaryRole ? ROLE_LABELS[primaryRole] : null;
              const planColor = u.plan ? (PLAN_COLORS[u.plan.slug] || PLAN_COLORS.starter) : '';

              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="p-3 text-foreground truncate max-w-[200px]">{u.email || '—'}</td>
                  <td className="p-3 text-muted-foreground truncate max-w-[150px]">{u.company_name || '—'}</td>
                  <td className="p-3 text-center">
                    <Select value={primaryRole || 'none'} onValueChange={(val) => assignRole(u.id, val)}>
                      <SelectTrigger className="h-7 w-[130px] text-xs mx-auto">
                        <SelectValue>
                          {roleInfo ? (
                            <Badge variant="outline" className={`text-xs ${roleInfo.color}`}>{roleInfo.label}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Keine Rolle</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Keine Rolle</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="moderator">Moderator</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-center">
                    <Select value={u.plan?.id || 'none'} onValueChange={(val) => assignPlan(u.id, val)}>
                      <SelectTrigger className="h-7 w-[150px] text-xs mx-auto">
                        <SelectValue>
                          {u.plan ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`text-xs ${planColor}`}>
                                <Crown className="w-3 h-3 mr-1" />
                                {u.plan.name}
                              </Badge>
                              {u.plan.status !== 'active' && (
                                <span className="text-[10px] text-destructive">({STATUS_LABELS[u.plan.status] || u.plan.status})</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Kein Plan</span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Kein Plan</SelectItem>
                        {plans.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-center font-semibold text-foreground">{u.balance}</td>
                  <td className="p-3 text-center text-muted-foreground">{u.lifetime_used}</td>
                  <td className="p-3 text-center text-muted-foreground">{u.project_count}</td>
                  <td className="p-3 text-center text-muted-foreground">{u.lead_count}</td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {u.last_transaction ? new Date(u.last_transaction).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                  </td>
                  <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                  <td className="p-3">
                    {adjusting === u.id ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} className="w-20 h-7 text-xs" placeholder="±10" />
                        <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => adjustCredits(u.id, parseInt(adjustAmount) || 0)}>OK</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setAdjusting(null); setAdjustAmount(''); }}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setAdjusting(u.id)}>
                        <Plus className="w-3 h-3" /><Minus className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">Keine Nutzer gefunden</p>}
      </div>
    </div>
  );
}
