import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HardDrive, RefreshCw, FolderOpen, Database, FileImage, FileText, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BUCKETS = ['vehicle-images', 'banners', 'logos', 'sample-pdfs', 'manufacturer-logos', 'sales-knowledge'];

type FileInfo = {
  name: string;
  created_at?: string;
  metadata?: { size?: number; mimetype?: string };
  id?: string;
};

type BucketStats = { name: string; fileCount: number; totalSizeBytes: number; types: Record<string, number> };

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getFileIcon(mime?: string) {
  if (!mime) return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  if (mime.startsWith('image/')) return <FileImage className="w-3.5 h-3.5 text-blue-500" />;
  if (mime.includes('pdf')) return <FileText className="w-3.5 h-3.5 text-red-500" />;
  return <File className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function AdminStorage() {
  const [stats, setStats] = useState<BucketStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [files, setFiles] = useState<FileInfo[]>([]);

  const collectFiles = async (bucket: string, prefix: string): Promise<FileInfo[]> => {
    const { data } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!data) return [];
    const results: FileInfo[] = [];
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) {
        // It's a folder — recurse
        const nested = await collectFiles(bucket, path);
        results.push(...nested);
      } else {
        results.push(item as FileInfo);
      }
    }
    return results;
  };

  const loadStats = async () => {
    setLoading(true);
    const results: BucketStats[] = [];
    for (const bucket of BUCKETS) {
      const allFiles = await collectFiles(bucket, '');
      let totalSize = 0;
      const types: Record<string, number> = {};
      for (const f of allFiles) {
        const size = f.metadata?.size || 0;
        totalSize += size;
        const mime = f.metadata?.mimetype || 'unknown';
        const cat = mime.startsWith('image/') ? 'Bilder' : mime.includes('pdf') ? 'PDFs' : 'Andere';
        types[cat] = (types[cat] || 0) + 1;
      }
      results.push({ name: bucket, fileCount: allFiles.length, totalSizeBytes: totalSize, types });
    }
    setStats(results);
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const browseBucket = async (bucket: string) => {
    setSelectedBucket(bucket);
    const allFiles = await collectFiles(bucket, '');
    allFiles.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    setFiles(allFiles.slice(0, 200));
  };

  const totalFiles = stats.reduce((s, b) => s + b.fileCount, 0);
  const totalSize = stats.reduce((s, b) => s + b.totalSizeBytes, 0);
  const chartData = stats.map(s => ({ name: s.name, Dateien: s.fileCount, 'MB': +(s.totalSizeBytes / 1024 / 1024).toFixed(1) }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-foreground">Storage-Übersicht</h1>
        <Button variant="outline" size="sm" onClick={loadStats}><RefreshCw className="w-4 h-4 mr-1" /> Aktualisieren</Button>
      </div>

      {/* Global summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><Database className="w-4 h-4 text-accent" /><span className="text-sm text-muted-foreground">Gesamt-Speicher</span></div>
          <p className="text-2xl font-bold text-foreground">{formatBytes(totalSize)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><HardDrive className="w-4 h-4 text-accent" /><span className="text-sm text-muted-foreground">Dateien gesamt</span></div>
          <p className="text-2xl font-bold text-foreground">{totalFiles.toLocaleString('de-DE')}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-1"><FolderOpen className="w-4 h-4 text-accent" /><span className="text-sm text-muted-foreground">Buckets</span></div>
          <p className="text-2xl font-bold text-foreground">{BUCKETS.length}</p>
        </div>
      </div>

      {/* Bucket cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(s => (
          <button key={s.name} onClick={() => browseBucket(s.name)} className={`text-left bg-card rounded-xl border p-5 transition-all hover:shadow-sm ${selectedBucket === s.name ? 'border-accent ring-2 ring-accent/20' : 'border-border hover:border-accent/40'}`}>
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{s.name}</span>
            </div>
            <div className="flex items-baseline gap-4">
              <div>
                <p className="text-2xl font-bold text-foreground">{s.fileCount}</p>
                <p className="text-xs text-muted-foreground">Dateien</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{formatBytes(s.totalSizeBytes)}</p>
                <p className="text-xs text-muted-foreground">Speicher</p>
              </div>
            </div>
            {Object.keys(s.types).length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {Object.entries(s.types).map(([t, c]) => (
                  <span key={t} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{t}: {c}</span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
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
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-3">Speicher pro Bucket (MB)</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="MB" fill="hsl(160, 60%, 45%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                <TableHead>Größe</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Typ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f, i) => (
                <TableRow key={f.id || f.name + i}>
                  <TableCell className="text-xs font-mono flex items-center gap-1.5">{getFileIcon(f.metadata?.mimetype)}{f.name}</TableCell>
                  <TableCell className="text-xs">{f.metadata?.size ? formatBytes(f.metadata.size) : '–'}</TableCell>
                  <TableCell className="text-xs">{f.created_at ? new Date(f.created_at).toLocaleString('de-DE') : '–'}</TableCell>
                  <TableCell className="text-xs">{f.metadata?.mimetype || 'Ordner'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
