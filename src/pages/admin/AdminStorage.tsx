import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HardDrive, RefreshCw, FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

const BUCKETS = ['vehicle-images', 'banners', 'logos', 'sample-pdfs', 'manufacturer-logos', 'sales-knowledge'];

type BucketStats = { name: string; fileCount: number; totalSizeKB: number };

export default function AdminStorage() {
  const [stats, setStats] = useState<BucketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);

  const loadStats = async () => {
    setLoading(true);
    const results: BucketStats[] = [];
    for (const bucket of BUCKETS) {
      const { data } = await supabase.storage.from(bucket).list('', { limit: 1000 });
      const fileCount = data?.length || 0;
      // Storage API doesn't return size directly in list, estimate from metadata
      results.push({ name: bucket, fileCount, totalSizeKB: 0 });
    }
    setStats(results);
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const browseBucket = async (bucket: string) => {
    setSelectedBucket(bucket);
    const { data } = await supabase.storage.from(bucket).list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
    setFiles(data || []);
  };

  const chartData = stats.map(s => ({ name: s.name, Dateien: s.fileCount }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Storage-Übersicht</h1>
        <Button variant="outline" size="sm" onClick={loadStats}><RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren</Button>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(s => (
          <button key={s.name} onClick={() => browseBucket(s.name)} className={`text-left bg-card rounded-xl border p-5 transition-all hover:shadow-sm ${selectedBucket === s.name ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/40'}`}>
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{s.name}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.fileCount}</p>
            <p className="text-xs text-muted-foreground">Dateien</p>
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="font-semibold text-foreground mb-3">Dateien pro Bucket</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Bar dataKey="Dateien" fill="hsl(262, 83%, 58%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* File browser */}
      {selectedBucket && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-accent" />
            <span className="font-semibold text-foreground">{selectedBucket}</span>
            <span className="text-xs text-muted-foreground">({files.length} Einträge)</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Typ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f: any) => (
                <TableRow key={f.id || f.name}>
                  <TableCell className="text-xs font-mono">{f.name}</TableCell>
                  <TableCell className="text-xs">{f.created_at ? new Date(f.created_at).toLocaleString('de-DE') : '–'}</TableCell>
                  <TableCell className="text-xs">{f.metadata?.mimetype || (f.id ? 'Datei' : 'Ordner')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
