import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Mail, TrendingUp, Calendar, Car } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LeadStats {
  totalLeads: number;
  leadsToday: number;
  leadsThisWeek: number;
  leadsThisMonth: number;
  topVehicles: { title: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
  topDealers: { dealer_id: string; email: string; count: number }[];
}

export default function AdminLeads() {
  const [stats, setStats] = useState<LeadStats>({
    totalLeads: 0, leadsToday: 0, leadsThisWeek: 0, leadsThisMonth: 0,
    topVehicles: [], dailyTrend: [], topDealers: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    
    const { data: leads } = await supabase
      .from('leads')
      .select('id, created_at, vehicle_title, dealer_user_id')
      .order('created_at', { ascending: false });

    const allLeads = (leads as any[]) || [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);

    const leadsToday = allLeads.filter(l => new Date(l.created_at) >= today).length;
    const leadsThisWeek = allLeads.filter(l => new Date(l.created_at) >= weekAgo).length;
    const leadsThisMonth = allLeads.filter(l => new Date(l.created_at) >= monthAgo).length;

    // Top vehicles (anonymized)
    const vehicleCounts: Record<string, number> = {};
    for (const l of allLeads) {
      const title = l.vehicle_title || 'Unbekannt';
      vehicleCounts[title] = (vehicleCounts[title] || 0) + 1;
    }
    const topVehicles = Object.entries(vehicleCounts)
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Daily trend (last 30 days)
    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      dailyMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const l of allLeads) {
      const d = l.created_at.split('T')[0];
      if (d in dailyMap) dailyMap[d]++;
    }
    const dailyTrend = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Top dealers by lead count (show only count + anonymized id)
    const dealerCounts: Record<string, number> = {};
    for (const l of allLeads) {
      dealerCounts[l.dealer_user_id] = (dealerCounts[l.dealer_user_id] || 0) + 1;
    }

    // Get emails for dealer IDs
    const dealerIds = Object.keys(dealerCounts);
    let emailMap: Record<string, string> = {};
    if (dealerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, company_name')
        .in('id', dealerIds);
      for (const p of (profiles as any[]) || []) {
        emailMap[p.id] = p.company_name || p.email || p.id.slice(0, 8);
      }
    }

    const topDealers = Object.entries(dealerCounts)
      .map(([dealer_id, count]) => ({ dealer_id, email: emailMap[dealer_id] || `Händler #${dealer_id.slice(0, 4)}`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({ totalLeads: allLeads.length, leadsToday, leadsThisWeek, leadsThisMonth, topVehicles, dailyTrend, topDealers });
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;

  const maxDaily = Math.max(...stats.dailyTrend.map(d => d.count), 1);

  const cards = [
    { icon: Mail, label: 'Gesamt', value: stats.totalLeads, color: 'text-blue-500' },
    { icon: Calendar, label: 'Heute', value: stats.leadsToday, color: 'text-emerald-500' },
    { icon: TrendingUp, label: 'Diese Woche', value: stats.leadsThisWeek, color: 'text-amber-500' },
    { icon: TrendingUp, label: 'Dieser Monat', value: stats.leadsThisMonth, color: 'text-purple-500' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Lead-Statistiken</h1>
        <p className="text-sm text-muted-foreground mt-1">
          DSGVO-konforme Übersicht — nur aggregierte Zahlen, keine personenbezogenen Daten.
        </p>
      </div>

      {/* KPI Cards */}
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

      {/* Trend Chart (Simple Bar) */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-display font-semibold text-foreground mb-4">Lead-Verlauf (30 Tage)</h2>
        <div className="flex items-end gap-[2px] h-32">
          {stats.dailyTrend.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end group relative">
              <div
                className="w-full bg-accent/80 rounded-t-sm min-h-[2px] transition-all hover:bg-accent"
                style={{ height: `${Math.max((d.count / maxDaily) * 100, 2)}%` }}
              />
              <div className="absolute -top-8 bg-popover text-popover-foreground text-[10px] px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {new Date(d.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}: {d.count}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>{new Date(stats.dailyTrend[0]?.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
          <span>{new Date(stats.dailyTrend[stats.dailyTrend.length - 1]?.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Vehicles */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">
            <Car className="w-4 h-4 inline mr-1.5" />Meistangefragte Fahrzeuge
          </h2>
          {stats.topVehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Leads</p>
          ) : (
            <div className="space-y-2">
              {stats.topVehicles.map((v, i) => (
                <div key={v.title} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm text-foreground truncate max-w-[250px]">{v.title}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{v.count} Anfragen</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Dealers */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="font-display font-semibold text-foreground mb-4">
            Top-Händler nach Leads
          </h2>
          {stats.topDealers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Leads</p>
          ) : (
            <div className="space-y-2">
              {stats.topDealers.map((d, i) => (
                <div key={d.dealer_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm text-foreground truncate max-w-[200px]">{d.email}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">{d.count} Leads</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
