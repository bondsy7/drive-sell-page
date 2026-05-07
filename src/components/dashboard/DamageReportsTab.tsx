import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSearch, Trash2, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import DamageImageLightbox from './DamageImageLightbox';

interface Report {
  id: string;
  title: string;
  vehicle_info: any;
  anlass: string | null;
  analysis: any;
  images: any[];
  schaden_count: number;
  schweregrad: string | null;
  kosten_realistisch_brutto: number | null;
  created_at: string;
}

const fmt = (n: number | null) => n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

const sevColor = (s: string | null) => {
  if (s === 'hoch') return 'bg-destructive/15 text-destructive';
  if (s === 'mittel') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  if (s === 'gering') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  return 'bg-muted text-muted-foreground';
};

export default function DamageReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Report | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('damage_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setReports((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('damage_reports').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Bericht gelöscht');
    setReports(prev => prev.filter(r => r.id !== id));
  };

  const downloadMd = (r: Report) => {
    const md = r.analysis?.berichtMarkdown || '';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${r.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16">
        <FileSearch className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="font-display text-lg font-semibold text-foreground">Noch keine Schadensberichte</h3>
        <p className="text-sm text-muted-foreground mt-1">Erstelle deinen ersten Bericht über Generator → KI-Schadensanalyse.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(r => {
          const cover = r.images?.[0]?.annotatedBase64 || r.images?.[0]?.base64;
          return (
            <Card key={r.id} className="overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-muted relative">
                {cover ? <img src={cover} alt={r.title} className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center"><FileSearch className="w-8 h-8 text-muted-foreground/40" /></div>
                )}
                <Badge className={`absolute top-2 left-2 ${sevColor(r.schweregrad)}`}>
                  {r.schweregrad || 'unbekannt'}
                </Badge>
              </div>
              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-foreground line-clamp-1">{r.title}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs">
                    <span className="text-muted-foreground">{r.schaden_count} Schäden</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold text-foreground">{fmt(r.kosten_realistisch_brutto)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                  <Button size="sm" variant="ghost" className="flex-1 h-8" onClick={() => setActive(r)}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Ansehen
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => downloadMd(r)}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bericht löschen?</AlertDialogTitle>
                        <AlertDialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className={sevColor(active.schweregrad)}>Schwere: {active.schweregrad || '–'}</Badge>
                <Badge variant="outline">{active.schaden_count} Schäden</Badge>
                <Badge variant="outline">Realistisch: {fmt(active.kosten_realistisch_brutto)}</Badge>
                {active.anlass && <Badge variant="outline">{active.anlass}</Badge>}
              </div>
              {active.analysis?.fazit?.gesamteindruck && (
                <p className="text-sm text-foreground leading-relaxed">{active.analysis.fazit.gesamteindruck}</p>
              )}
              {active.images?.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {active.images.map((img: any, i: number) => (
                    <div key={i} className="aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border">
                      <img src={img.annotatedBase64 || img.base64} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
              {active.analysis?.berichtMarkdown && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <pre className="text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed">{active.analysis.berichtMarkdown}</pre>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => downloadMd(active)} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" /> Bericht (.md) herunterladen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
