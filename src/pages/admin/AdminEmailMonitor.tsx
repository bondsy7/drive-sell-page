import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Mail, RefreshCw, Send, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { toast } from 'sonner';

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(340, 82%, 52%)', 'hsl(221, 83%, 53%)'];

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-yellow-500/10 text-yellow-600',
  sent: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
  pending_approval: 'bg-blue-500/10 text-blue-600',
};

type Email = {
  id: string;
  user_id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

export default function AdminEmailMonitor() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [em, pr] = await Promise.all([
      supabase.from('sales_email_outbox').select('id, user_id, to_email, to_name, subject, status, error_message, created_at, sent_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, email'),
    ]);
    const pMap: Record<string, string> = {};
    ((pr.data as any[]) || []).forEach((p: any) => { pMap[p.id] = p.email || p.id.slice(0, 8); });
    setProfiles(pMap);
    setEmails((em.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resendEmail = async (id: string) => {
    await supabase.from('sales_email_outbox').update({ status: 'queued', error_message: null } as any).eq('id', id);
    toast.success('E-Mail zurück in die Warteschlange gesetzt');
    load();
  };

  const statusDist = useMemo(() => {
    const counts: Record<string, number> = {};
    emails.forEach(e => { counts[e.status] = (counts[e.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [emails]);

  const dailyVolume = useMemo(() => {
    const map: Record<string, number> = {};
    emails.forEach(e => {
      const day = e.created_at.split('T')[0];
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).sort().slice(-14).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      count,
    }));
  }, [emails]);

  const filtered = useMemo(() => {
    if (!statusFilter) return emails;
    return emails.filter(e => e.status === statusFilter);
  }, [emails, statusFilter]);

  const failRate = useMemo(() => {
    if (!emails.length) return 0;
    return Math.round(emails.filter(e => e.status === 'failed').length / emails.length * 100);
  }, [emails]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">E-Mail-Outbox Monitor</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Mail className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Gesamt</span></div>
          <p className="text-2xl font-bold text-foreground">{emails.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-sm text-muted-foreground">Gesendet</span></div>
          <p className="text-2xl font-bold text-emerald-500">{emails.filter(e => e.status === 'sent').length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-sm text-muted-foreground">Fehlgeschlagen</span></div>
          <p className="text-2xl font-bold text-red-500">{emails.filter(e => e.status === 'failed').length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-yellow-500" /><span className="text-sm text-muted-foreground">Fehlerquote</span></div>
          <p className="text-2xl font-bold text-foreground">{failRate}%</p>
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
          <h3 className="font-semibold text-foreground mb-3">Versandvolumen / Tag</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyVolume}>
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

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter(null)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statusFilter ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>Alle</button>
        {['queued', 'sent', 'failed', 'pending_approval'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Absender</TableHead>
              <TableHead>Empfänger</TableHead>
              <TableHead>Betreff</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead>Fehler</TableHead>
              <TableHead>Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 50).map(e => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{profiles[e.user_id] || e.user_id.slice(0, 8)}</TableCell>
                <TableCell className="text-xs">{e.to_name ? `${e.to_name} <${e.to_email}>` : e.to_email}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{e.subject}</TableCell>
                <TableCell><Badge className={`${STATUS_BADGE[e.status] || 'bg-muted text-muted-foreground'} text-xs`}>{e.status}</Badge></TableCell>
                <TableCell className="text-xs">{new Date(e.created_at).toLocaleString('de-DE')}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate text-red-500">{e.error_message || '–'}</TableCell>
                <TableCell>
                  {e.status === 'failed' && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => resendEmail(e.id)}>
                      <Send className="w-3 h-3 mr-1" /> Resend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
