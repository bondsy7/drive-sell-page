import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Clock, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(340, 82%, 52%)', 'hsl(221, 83%, 53%)', 'hsl(262, 83%, 58%)'];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Wartend', color: 'bg-yellow-500/10 text-yellow-600', icon: Clock },
  processing: { label: 'In Bearbeitung', color: 'bg-blue-500/10 text-blue-600', icon: Activity },
  completed: { label: 'Fertig', color: 'bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 },
  failed: { label: 'Fehlgeschlagen', color: 'bg-red-500/10 text-red-600', icon: XCircle },
  cancelled: { label: 'Abgebrochen', color: 'bg-muted text-muted-foreground', icon: Pause },
};

type Job = {
  id: string;
  user_id: string;
  status: string;
  job_type: string;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  model_tier: string;
  vehicle_description: string | null;
  created_at: string;
  updated_at: string;
};

type SpinJob = {
  id: string;
  user_id: string;
  status: string;
  target_frame_count: number;
  created_at: string;
  updated_at: string;
  error_message: string | null;
};

export default function AdminJobMonitor() {
  const [imgJobs, setImgJobs] = useState<Job[]>([]);
  const [spinJobs, setSpinJobs] = useState<SpinJob[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pipeline' | 'spin'>('pipeline');

  const load = async () => {
    setLoading(true);
    const [ij, sj, pr] = await Promise.all([
      supabase.from('image_generation_jobs').select('id, user_id, status, job_type, total_tasks, completed_tasks, failed_tasks, model_tier, vehicle_description, created_at, updated_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('spin360_jobs').select('id, user_id, status, target_frame_count, created_at, updated_at, error_message').order('created_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, email'),
    ]);
    const pMap: Record<string, string> = {};
    ((pr.data as any[]) || []).forEach((p: any) => { pMap[p.id] = p.email || p.id.slice(0, 8); });
    setProfiles(pMap);
    setImgJobs((ij.data as any[]) || []);
    setSpinJobs((sj.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const cancelJob = async (id: string, type: 'img' | 'spin') => {
    const table = type === 'img' ? 'image_generation_jobs' : 'spin360_jobs';
    await supabase.from(table).update({ status: 'cancelled' } as any).eq('id', id);
    toast.success('Job abgebrochen');
    load();
  };

  const retryJob = async (id: string, type: 'img' | 'spin') => {
    const table = type === 'img' ? 'image_generation_jobs' : 'spin360_jobs';
    await supabase.from(table).update({ status: 'pending', failed_tasks: 0 } as any).eq('id', id);
    toast.success('Job zurückgesetzt auf Wartend');
    load();
  };

  const imgStats = useMemo(() => {
    const counts: Record<string, number> = {};
    imgJobs.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: STATUS_MAP[name]?.label || name, value }));
  }, [imgJobs]);

  const spinStats = useMemo(() => {
    const counts: Record<string, number> = {};
    spinJobs.forEach(j => { counts[j.status] = (counts[j.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: STATUS_MAP[name]?.label || name, value }));
  }, [spinJobs]);

  const avgDuration = useMemo(() => {
    const completed = imgJobs.filter(j => j.status === 'completed');
    if (!completed.length) return 0;
    const total = completed.reduce((s, j) => s + (new Date(j.updated_at).getTime() - new Date(j.created_at).getTime()), 0);
    return Math.round(total / completed.length / 1000);
  }, [imgJobs]);

  const dailyJobs = useMemo(() => {
    const map: Record<string, number> = {};
    const jobs = tab === 'pipeline' ? imgJobs : spinJobs;
    jobs.forEach(j => {
      const day = j.created_at.split('T')[0];
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).sort().slice(-14).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      count,
    }));
  }, [imgJobs, spinJobs, tab]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  const jobs = tab === 'pipeline' ? imgJobs : [];
  const stats = tab === 'pipeline' ? imgStats : spinStats;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Pipeline & Job-Monitor</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren</Button>
      </div>

      {/* Tab switch */}
      <div className="flex gap-2">
        {(['pipeline', 'spin'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {t === 'pipeline' ? `Bild-Pipeline (${imgJobs.length})` : `360° Spin (${spinJobs.length})`}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Gesamt Jobs</p>
          <p className="text-2xl font-bold text-foreground">{tab === 'pipeline' ? imgJobs.length : spinJobs.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Aktiv / Wartend</p>
          <p className="text-2xl font-bold text-blue-500">
            {(tab === 'pipeline' ? imgJobs : spinJobs).filter(j => j.status === 'processing' || j.status === 'pending').length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">Fehlgeschlagen</p>
          <p className="text-2xl font-bold text-red-500">
            {(tab === 'pipeline' ? imgJobs : spinJobs).filter(j => j.status === 'failed').length}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground mb-1">⌀ Dauer (Pipeline)</p>
          <p className="text-2xl font-bold text-foreground">{avgDuration}s</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Status-Verteilung</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                  {stats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Jobs / Tag (letzte 14 Tage)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyJobs}>
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

      {/* Job table */}
      {tab === 'pipeline' ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nutzer</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fortschritt</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Fahrzeug</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imgJobs.slice(0, 50).map(j => {
                const s = STATUS_MAP[j.status] || STATUS_MAP.pending;
                return (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs">{profiles[j.user_id] || j.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{j.job_type}</Badge></TableCell>
                    <TableCell><Badge className={`${s.color} text-xs`}>{s.label}</Badge></TableCell>
                    <TableCell className="text-xs">{j.completed_tasks}/{j.total_tasks} {j.failed_tasks > 0 && <span className="text-red-500">({j.failed_tasks} ✗)</span>}</TableCell>
                    <TableCell className="text-xs">{j.model_tier}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{j.vehicle_description || '–'}</TableCell>
                    <TableCell className="text-xs">{new Date(j.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(j.status === 'pending' || j.status === 'processing') && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => cancelJob(j.id, 'img')}>Abbrechen</Button>
                        )}
                        {j.status === 'failed' && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => retryJob(j.id, 'img')}>Retry</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nutzer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Frames</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Fehler</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spinJobs.slice(0, 50).map(j => {
                const s = STATUS_MAP[j.status] || STATUS_MAP.pending;
                return (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs">{profiles[j.user_id] || j.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge className={`${s.color} text-xs`}>{s.label}</Badge></TableCell>
                    <TableCell className="text-xs">{j.target_frame_count}</TableCell>
                    <TableCell className="text-xs">{new Date(j.created_at).toLocaleString('de-DE')}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate text-red-500">{j.error_message || '–'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(j.status === 'pending' || j.status === 'processing' || j.status === 'uploaded') && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => cancelJob(j.id, 'spin')}>Abbrechen</Button>
                        )}
                        {j.status === 'failed' && (
                          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => retryJob(j.id, 'spin')}>Retry</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
