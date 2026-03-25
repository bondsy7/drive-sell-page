import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Timer, Image, AlertCircle, Zap, TrendingUp } from 'lucide-react';

interface TimingLog {
  id: string;
  user_id: string;
  model_tier: string;
  total_jobs: number;
  total_images: number;
  completed_images: number;
  failed_images: number;
  total_duration_ms: number;
  job_durations: { key: string; label: string; duration_ms: number; images: number; status: string }[];
  vehicle_description: string | null;
  detected_brand: string | null;
  created_at: string;
}

const MODEL_COLORS: Record<string, string> = {
  schnell: 'hsl(var(--chart-1))',
  qualitaet: 'hsl(var(--chart-2))',
  standard: 'hsl(var(--chart-2))',
  premium: 'hsl(var(--chart-3))',
  turbo: 'hsl(var(--chart-4))',
  ultra: 'hsl(var(--chart-5))',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec % 60}s`;
}

export default function AdminPipelineStats() {
  const [logs, setLogs] = useState<TimingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    loadLogs();
  }, [timeRange]);

  const loadLogs = async () => {
    setLoading(true);
    const daysAgo = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
    const since = new Date(Date.now() - daysAgo * 86400000).toISOString();

    const { data } = await supabase
      .from('pipeline_timing_logs' as any)
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    setLogs((data as any) || []);
    setLoading(false);
  };

  // KPIs
  const totalRuns = logs.length;
  const totalImages = logs.reduce((s, l) => s + l.completed_images, 0);
  const totalFailed = logs.reduce((s, l) => s + l.failed_images, 0);
  const avgDuration = totalRuns > 0 ? logs.reduce((s, l) => s + l.total_duration_ms, 0) / totalRuns : 0;
  const avgPerImage = totalImages > 0 ? logs.reduce((s, l) => s + l.total_duration_ms, 0) / totalImages : 0;
  const failRate = totalImages + totalFailed > 0 ? (totalFailed / (totalImages + totalFailed)) * 100 : 0;

  // Model distribution
  const modelDist = logs.reduce<Record<string, { count: number; totalMs: number; images: number }>>((acc, l) => {
    const key = l.model_tier || 'standard';
    if (!acc[key]) acc[key] = { count: 0, totalMs: 0, images: 0 };
    acc[key].count++;
    acc[key].totalMs += l.total_duration_ms;
    acc[key].images += l.completed_images;
    return acc;
  }, {});

  const modelChartData = Object.entries(modelDist).map(([model, d]) => ({
    name: model.charAt(0).toUpperCase() + model.slice(1),
    runs: d.count,
    avgSec: Math.round(d.totalMs / d.count / 1000),
    images: d.images,
    avgPerImage: d.images > 0 ? Math.round(d.totalMs / d.images / 1000) : 0,
  }));

  const pieData = Object.entries(modelDist).map(([model, d]) => ({
    name: model.charAt(0).toUpperCase() + model.slice(1),
    value: d.count,
    fill: MODEL_COLORS[model] || 'hsl(var(--muted))',
  }));

  // Brand distribution
  const brandDist = logs.reduce<Record<string, number>>((acc, l) => {
    const brand = l.detected_brand || 'Unbekannt';
    acc[brand] = (acc[brand] || 0) + 1;
    return acc;
  }, {});
  const brandChartData = Object.entries(brandDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count }));

  // Per-job duration breakdown (from all job_durations across logs)
  const jobStats = logs.flatMap(l => (l.job_durations || [])).reduce<Record<string, { totalMs: number; count: number }>>((acc, jd) => {
    if (!acc[jd.label]) acc[jd.label] = { totalMs: 0, count: 0 };
    acc[jd.label].totalMs += jd.duration_ms;
    acc[jd.label].count++;
    return acc;
  }, {});
  const jobChartData = Object.entries(jobStats)
    .map(([label, d]) => ({ name: label, avgSec: Math.round(d.totalMs / d.count / 1000), count: d.count }))
    .sort((a, b) => b.avgSec - a.avgSec)
    .slice(0, 15);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Timer className="w-5 h-5 text-accent" /> Pipeline-Statistiken
          </h1>
          <p className="text-sm text-muted-foreground">Laufzeiten, Modellverteilung & Fehlerraten</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24 Stunden</SelectItem>
            <SelectItem value="7d">7 Tage</SelectItem>
            <SelectItem value="30d">30 Tage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalRuns}</p>
            <p className="text-xs text-muted-foreground">Pipeline-Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalImages}</p>
            <p className="text-xs text-muted-foreground">Bilder generiert</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{totalFailed}</p>
            <p className="text-xs text-muted-foreground">Fehlgeschlagen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{formatDuration(avgDuration)}</p>
            <p className="text-xs text-muted-foreground">Ø Laufzeit/Run</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{formatDuration(avgPerImage)}</p>
            <p className="text-xs text-muted-foreground">Ø pro Bild</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold" style={{ color: failRate > 10 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}>
              {failRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">Fehlerrate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Model Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Modellverteilung</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Keine Daten</p>
            )}
          </CardContent>
        </Card>

        {/* Model Avg Duration Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ø Dauer pro Bild nach Modell (Sek.)</CardTitle>
          </CardHeader>
          <CardContent>
            {modelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={modelChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v}s`} />
                  <Bar dataKey="avgPerImage" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Keine Daten</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Job Duration Chart */}
      {jobChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ø Dauer pro Perspektive (Sek.)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={jobChartData} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v: number) => `${v}s`} />
                <Bar dataKey="avgSec" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Brand Distribution */}
      {brandChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Marken</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={brandChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Runs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Letzte Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-medium text-muted-foreground">Zeitpunkt</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Modell</th>
                  <th className="text-left p-2 font-medium text-muted-foreground">Marke</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Bilder</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Fehler</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Dauer</th>
                  <th className="text-right p-2 font-medium text-muted-foreground">Ø/Bild</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map(log => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-2 text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{log.model_tier}</Badge>
                    </td>
                    <td className="p-2 text-muted-foreground capitalize">{log.detected_brand || '–'}</td>
                    <td className="p-2 text-right text-foreground font-medium">{log.completed_images}</td>
                    <td className="p-2 text-right">
                      {log.failed_images > 0 ? (
                        <span className="text-destructive font-medium">{log.failed_images}</span>
                      ) : '–'}
                    </td>
                    <td className="p-2 text-right text-foreground font-medium">{formatDuration(log.total_duration_ms)}</td>
                    <td className="p-2 text-right text-muted-foreground">
                      {log.completed_images > 0 ? formatDuration(Math.round(log.total_duration_ms / log.completed_images)) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-8">Noch keine Pipeline-Runs im gewählten Zeitraum.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
