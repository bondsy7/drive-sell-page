import { useEffect, useState } from 'react';
import { Clock, Instagram, Facebook, Trash2, CheckCircle2, AlertCircle, Loader2, Image as ImageIcon, Video as VideoIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduledRow {
  id: string;
  vehicle_id: string | null;
  media_type: 'image' | 'video';
  media_path: string;
  media_name: string | null;
  media_url: string;
  caption: string;
  platforms: string[];
  scheduled_at: string;
  status: 'pending' | 'processing' | 'published' | 'failed' | 'cancelled';
  attempts: number;
  last_error: string | null;
  results: unknown;
  published_at: string | null;
  created_at: string;
}

const statusMeta: Record<ScheduledRow['status'], { label: string; className: string; icon: JSX.Element }> = {
  pending:    { label: 'Geplant',        className: 'bg-blue-500/10 text-blue-700 border-blue-500/30',       icon: <Clock className="w-3 h-3" /> },
  processing: { label: 'Wird gepostet',  className: 'bg-amber-500/10 text-amber-700 border-amber-500/30',    icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  published:  { label: 'Veröffentlicht', className: 'bg-green-500/10 text-green-700 border-green-500/30',    icon: <CheckCircle2 className="w-3 h-3" /> },
  failed:     { label: 'Fehlgeschlagen', className: 'bg-destructive/10 text-destructive border-destructive/30', icon: <AlertCircle className="w-3 h-3" /> },
  cancelled:  { label: 'Abgebrochen',    className: 'bg-muted text-muted-foreground border-border',          icon: <Trash2 className="w-3 h-3" /> },
};

export default function ScheduledPostsTab() {
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_social_posts')
      .select('*')
      .order('scheduled_at', { ascending: true });
    if (error) toast.error(`Laden fehlgeschlagen: ${error.message}`);
    setRows((data as ScheduledRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const cancelPost = async (id: string) => {
    const { error } = await supabase
      .from('scheduled_social_posts')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) {
      toast.error(`Abbruch fehlgeschlagen: ${error.message}`);
      return;
    }
    toast.success('Geplanter Post abgebrochen');
    load();
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from('scheduled_social_posts').delete().eq('id', id);
    if (error) {
      toast.error(`Löschen fehlgeschlagen: ${error.message}`);
      return;
    }
    load();
  };

  const upcoming = rows.filter((r) => r.status === 'pending' || r.status === 'processing');
  const history  = rows.filter((r) => r.status !== 'pending' && r.status !== 'processing');

  const renderCard = (r: ScheduledRow) => {
    const s = statusMeta[r.status];
    const when = new Date(r.scheduled_at);
    return (
      <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex gap-3">
        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          {r.media_type === 'video' ? (
            <video src={r.media_url} className="w-full h-full object-cover" muted />
          ) : (
            <img src={r.media_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`gap-1 ${s.className}`}>{s.icon}{s.label}</Badge>
            {r.platforms.includes('instagram') && <Instagram className="w-4 h-4 text-pink-600" />}
            {r.platforms.includes('facebook') && <Facebook className="w-4 h-4 text-blue-600" />}
            {r.media_type === 'video'
              ? <VideoIcon className="w-3.5 h-3.5 text-muted-foreground" />
              : <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">
            {r.status === 'published' && r.published_at
              ? `Veröffentlicht ${new Date(r.published_at).toLocaleString('de-DE')}`
              : `Geplant für ${when.toLocaleString('de-DE')}`}
          </p>
          <p className="text-sm line-clamp-2 text-foreground/90">{r.caption}</p>
          {r.last_error && (
            <p className="text-xs text-destructive line-clamp-2">Fehler: {r.last_error}</p>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          {r.status === 'pending' && (
            <Button size="sm" variant="ghost" onClick={() => cancelPost(r.id)} title="Abbrechen">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {(r.status === 'published' || r.status === 'failed' || r.status === 'cancelled') && (
            <Button size="sm" variant="ghost" onClick={() => deleteRow(r.id)} title="Entfernen">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" /> Geplante Posts
          </h2>
          <p className="text-sm text-muted-foreground">
            Automatische Veröffentlichung zum geplanten Zeitpunkt. Prüfung läuft jede Minute im Hintergrund.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">In der Warteschlange ({upcoming.length})</h3>
        {upcoming.length === 0
          ? <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6 text-center">Keine geplanten Posts. Plane einen Post aus dem Banner- oder Video-Modal.</p>
          : <div className="space-y-2">{upcoming.map(renderCard)}</div>}
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Verlauf ({history.length})</h3>
          <div className="space-y-2">{history.slice(0, 30).map(renderCard)}</div>
        </section>
      )}
    </div>
  );
}
