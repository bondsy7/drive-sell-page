import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Users, FileText, Image, Globe, Mail } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type Profile = { id: string; created_at: string };

export default function AdminConversionFunnel() {
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersWithProjects, setUsersWithProjects] = useState(0);
  const [usersWithImages, setUsersWithImages] = useState(0);
  const [usersWithLeads, setUsersWithLeads] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    (async () => {
      const [pr, proj, img, ld] = await Promise.all([
        supabase.from('profiles').select('id, created_at'),
        supabase.from('projects').select('user_id'),
        supabase.from('image_generation_jobs').select('user_id'),
        supabase.from('leads').select('dealer_user_id'),
      ]);

      const allProfiles = (pr.data as any[]) || [];
      setProfiles(allProfiles);
      setTotalUsers(allProfiles.length);

      const projUsers = new Set(((proj.data as any[]) || []).map((p: any) => p.user_id));
      setUsersWithProjects(projUsers.size);

      const imgUsers = new Set(((img.data as any[]) || []).map((i: any) => i.user_id));
      setUsersWithImages(imgUsers.size);

      const leadUsers = new Set(((ld.data as any[]) || []).map((l: any) => l.dealer_user_id));
      setUsersWithLeads(leadUsers.size);

      setLoading(false);
    })();
  }, []);

  const funnelData = useMemo(() => [
    { step: 'Registriert', count: totalUsers, color: 'hsl(221, 83%, 53%)' },
    { step: 'Projekt erstellt', count: usersWithProjects, color: 'hsl(142, 71%, 45%)' },
    { step: 'Bilder generiert', count: usersWithImages, color: 'hsl(38, 92%, 50%)' },
    { step: 'Lead erhalten', count: usersWithLeads, color: 'hsl(340, 82%, 52%)' },
  ], [totalUsers, usersWithProjects, usersWithImages, usersWithLeads]);

  const dropoffs = useMemo(() => {
    return funnelData.slice(1).map((step, i) => {
      const prev = funnelData[i].count;
      const rate = prev > 0 ? Math.round((1 - step.count / prev) * 100) : 0;
      return { from: funnelData[i].step, to: step.step, dropoff: rate };
    });
  }, [funnelData]);

  // Active vs inactive (last 30 days)
  const activityStats = useMemo(() => {
    const cutoff = new Date(Date.now() - 30 * 86400000);
    const active = profiles.filter(p => new Date(p.created_at) >= cutoff).length;
    return { active, inactive: totalUsers - active };
  }, [profiles, totalUsers]);

  // Registrations per week (last 12 weeks)
  const weeklyRegs = useMemo(() => {
    const map: Record<string, number> = {};
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now - i * 7 * 86400000);
      const key = `KW${Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7)}`;
      map[weekStart.toISOString().split('T')[0]] = 0;
    }
    profiles.forEach(p => {
      const day = p.created_at.split('T')[0];
      if (day in map) map[day]++;
    });
    return Object.entries(map).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      count,
    }));
  }, [profiles]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Conversion-Funnel</h1>

      {/* Funnel visualization */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Nutzer-Funnel</h3>
        <div className="space-y-3">
          {funnelData.map((step, i) => {
            const widthPct = totalUsers > 0 ? Math.max(10, (step.count / totalUsers) * 100) : 10;
            const convPct = totalUsers > 0 ? Math.round((step.count / totalUsers) * 100) : 0;
            return (
              <div key={step.step}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{step.step}</span>
                  <span className="text-sm text-muted-foreground">{step.count} ({convPct}%)</span>
                </div>
                <div className="h-8 bg-muted rounded-lg overflow-hidden">
                  <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${widthPct}%`, backgroundColor: step.color }} />
                </div>
                {i < dropoffs.length && (
                  <p className="text-xs text-muted-foreground mt-1 ml-2">↓ {dropoffs[i].dropoff}% Drop-off</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Aktive Nutzer (30 Tage)</p>
          <p className="text-2xl font-bold text-foreground">{activityStats.active}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Inaktive Nutzer</p>
          <p className="text-2xl font-bold text-muted-foreground">{activityStats.inactive}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Gesamt → Lead Conversion</p>
          <p className="text-2xl font-bold text-emerald-500">{totalUsers > 0 ? Math.round(usersWithLeads / totalUsers * 100) : 0}%</p>
        </div>
      </div>

      {/* Weekly registrations */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-3">Registrierungen (letzte 12 Wochen)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyRegs}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(221, 83%, 53%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
