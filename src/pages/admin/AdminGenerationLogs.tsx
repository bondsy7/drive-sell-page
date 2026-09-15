import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { describeGenerationError, type GenerationErrorCode } from '@/lib/generation-log';

/**
 * Internes Fehler-/Verlaufsprotokoll jeder Generierungsstufe.
 * Zweck: Kundenfälle auch Wochen später nachvollziehen (Anbieter-Antwort,
 * Dauer, Fehlercode, Wiederholungsstand) – Serverlogs laufen ab.
 */

interface AttemptLog {
  id: string;
  created_at: string;
  user_id: string;
  workflow_key: string | null;
  project_id: string | null;
  vehicle_id: string | null;
  job_key: string | null;
  job_label: string | null;
  prompt_index: number | null;
  stage: string;
  attempt: number | null;
  status: 'success' | 'error';
  model_tier: string | null;
  engine: string | null;
  model: string | null;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  provider_status: number | null;
  provider_response: unknown;
  retryable: boolean | null;
}

const STAGE_LABELS: Record<string, string> = {
  generate: 'Erstversuch',
  retry: 'Wiederholung (Sammel)',
  'single-retry': 'Wiederholung (Einzelbild)',
  save: 'Speichern',
};

function formatDuration(ms: number | null): string {
  if (!ms && ms !== 0) return '–';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function AdminGenerationLogs() {
  const [logs, setLogs] = useState<AttemptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openRow, setOpenRow] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 365;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase
      .from('generation_attempt_logs' as never)
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000);
    setLogs((data as unknown as AttemptLog[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (statusFilter === 'error' && l.status !== 'error') return false;
      if (statusFilter === 'success' && l.status !== 'success') return false;
      if (!q) return true;
      return [l.user_id, l.workflow_key, l.vehicle_id, l.project_id, l.job_key, l.job_label, l.error_code, l.error_message]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [logs, statusFilter, search]);

  const errorCount = filtered.filter((l) => l.status === 'error').length;
  const avgDuration = (() => {
    const withTime = filtered.filter((l) => l.duration_ms);
    if (withTime.length === 0) return 0;
    return withTime.reduce((s, l) => s + (l.duration_ms || 0), 0) / withTime.length;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-bold mr-auto">Generierungs-Protokoll</h1>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24 Stunden</SelectItem>
            <SelectItem value="7d">7 Tage</SelectItem>
            <SelectItem value="30d">30 Tage</SelectItem>
            <SelectItem value="365d">1 Jahr</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="error">Nur Fehler</SelectItem>
            <SelectItem value="success">Nur Erfolge</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Suche nach Nutzer-ID, Fahrzeug-ID, Lauf, Job oder Fehlertext…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Einträge</p><p className="text-xl font-bold">{filtered.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">davon Fehler</p><p className="text-xl font-bold text-destructive">{errorCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ø Dauer</p><p className="text-xl font-bold">{formatDuration(Math.round(avgDuration))}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Versuche je Stufe</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Wird geladen…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Einträge im gewählten Zeitraum.</p>
          )}
          {filtered.map((log) => {
            const info = log.error_code
              ? describeGenerationError(log.error_code as GenerationErrorCode)
              : null;
            const open = openRow === log.id;
            return (
              <div key={log.id} className="rounded-lg border border-border p-3">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setOpenRow(open ? null : log.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <span className="text-sm font-medium">{log.job_label || log.job_key || '—'}</span>
                    <Badge variant="outline" className="text-[10px]">{STAGE_LABELS[log.stage] || log.stage}</Badge>
                    <Badge variant="secondary" className="text-[10px]">Versuch {log.attempt ?? 1}</Badge>
                    {log.error_code && <Badge variant="destructive" className="text-[10px]">{log.error_code}</Badge>}
                    {log.retryable != null && (
                      <Badge variant="outline" className="text-[10px]">
                        {log.retryable ? 'wiederholbar' : 'nicht wiederholbar'}
                      </Badge>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                      {formatDuration(log.duration_ms)} · {new Date(log.created_at).toLocaleString('de-DE')}
                    </span>
                  </div>
                  {info && <p className="text-xs text-muted-foreground mt-1">{info.title}: {info.hint}</p>}
                </button>

                {open && (
                  <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground break-words">
                    <p>Lauf: {log.workflow_key || '—'}</p>
                    <p>Nutzer: {log.user_id}</p>
                    <p>Fahrzeug: {log.vehicle_id || '—'} · Projekt: {log.project_id || '—'}</p>
                    <p>Stufe/Modell: {log.model_tier || '—'} · {log.engine || '—'} · {log.model || '—'}</p>
                    <p>Bild-Index: {log.prompt_index ?? '—'}</p>
                    <p>Anbieter-Status: {log.provider_status ?? '—'}</p>
                    {log.error_message && <p>Meldung: {log.error_message}</p>}
                    {log.provider_response != null && (
                      <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-[10px] max-h-64 overflow-auto">
                        {JSON.stringify(log.provider_response, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
