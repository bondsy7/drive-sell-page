import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Car, Calendar, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['hsl(38, 92%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(221, 83%, 53%)', 'hsl(340, 82%, 52%)', 'hsl(262, 83%, 58%)'];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  confirmed: 'bg-blue-500/10 text-blue-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  cancelled: 'bg-red-500/10 text-red-600',
  no_show: 'bg-muted text-muted-foreground',
};

type Booking = {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string | null;
  vehicle_title: string | null;
  booking_date: string;
  booking_time: string;
  status: string;
  created_at: string;
};

export default function AdminTestDrives() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [b, pr] = await Promise.all([
      supabase.from('test_drive_bookings').select('id, user_id, customer_name, customer_email, vehicle_title, booking_date, booking_time, status, created_at').order('booking_date', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, email, company_name'),
    ]);
    const pMap: Record<string, string> = {};
    ((pr.data as any[]) || []).forEach((p: any) => { pMap[p.id] = p.company_name || p.email || p.id.slice(0, 8); });
    setProfiles(pMap);
    setBookings((b.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const statusDist = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  const topDealers = useMemo(() => {
    const counts: Record<string, number> = {};
    bookings.forEach(b => {
      const dealer = profiles[b.user_id] || b.user_id.slice(0, 8);
      counts[dealer] = (counts[dealer] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [bookings, profiles]);

  // Average lead time (days between created_at and booking_date)
  const avgLeadTime = useMemo(() => {
    const valid = bookings.filter(b => b.booking_date);
    if (!valid.length) return 0;
    const total = valid.reduce((s, b) => {
      const created = new Date(b.created_at).getTime();
      const booked = new Date(b.booking_date).getTime();
      return s + Math.max(0, booked - created);
    }, 0);
    return Math.round(total / valid.length / 86400000);
  }, [bookings]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Probefahrten-Übersicht</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Car className="w-4 h-4 text-blue-500" /><span className="text-sm text-muted-foreground">Gesamt</span></div>
          <p className="text-2xl font-bold text-foreground">{bookings.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-500" /><span className="text-sm text-muted-foreground">Offen</span></div>
          <p className="text-2xl font-bold text-yellow-500">{bookings.filter(b => b.status === 'pending').length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm text-muted-foreground">Abgeschlossen</span></div>
          <p className="text-2xl font-bold text-emerald-500">{bookings.filter(b => b.status === 'completed').length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">⌀ Vorlaufzeit</span></div>
          <p className="text-2xl font-bold text-foreground">{avgLeadTime} Tage</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Status-Verteilung</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                  {statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Top-Händler nach Buchungen</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topDealers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Händler</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Uhrzeit</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.slice(0, 50).map(b => (
              <TableRow key={b.id}>
                <TableCell className="text-xs">{profiles[b.user_id] || b.user_id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">{b.customer_name}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate">{b.vehicle_title || '–'}</TableCell>
                <TableCell className="text-xs">{new Date(b.booking_date).toLocaleDateString('de-DE')}</TableCell>
                <TableCell className="text-xs">{b.booking_time}</TableCell>
                <TableCell><Badge className={`${STATUS_BADGE[b.status] || 'bg-muted text-muted-foreground'} text-xs`}>{b.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
