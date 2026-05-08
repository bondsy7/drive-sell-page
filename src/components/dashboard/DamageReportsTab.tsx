import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSearch, Trash2, Eye, Download, Sparkles, Maximize2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
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
  const [viewerIndex, setViewerIndex] = useState(0);
  const [repairingIndex, setRepairingIndex] = useState<number | null>(null);

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
  useEffect(() => { setViewerIndex(0); }, [active?.id]);

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

  const handleRepairInReport = async (report: Report, imageIndex: number) => {
    const current = report.images?.[imageIndex];
    if (!current?.base64) {
      toast.error('Kein Originalbild für die Reparatur gefunden');
      return;
    }

    setRepairingIndex(imageIndex);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Nicht eingeloggt');

      const schaeden = (report.analysis?.schaeden || []).filter((s: any) => s.bildIndex === imageIndex);
      const { uploadToGeminiFiles } = await import('@/lib/gemini-file-upload');
      const refs = await uploadToGeminiFiles([{ id: 'damage-repair', imageBase64: current.base64 }]);
      const imageFileUri = refs?.[0] || null;

      const { data, error } = await supabase.functions.invoke('repair-damage-image', {
        body: imageFileUri
          ? { imageFileUri, schaeden }
          : { image: current.base64, schaeden },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.repaired) {
        throw new Error(data?.error || error?.message || 'Reparatur-Bild konnte nicht generiert werden');
      }

      const nextImages = report.images.map((img: any, i: number) => (
        i === imageIndex ? { ...img, repairedBase64: data.repaired } : img
      ));
      const { error: updateError } = await supabase
        .from('damage_reports')
        .update({ images: nextImages as any })
        .eq('id', report.id);
      if (updateError) throw updateError;

      setActive(prev => prev?.id === report.id ? { ...prev, images: nextImages } : prev);
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, images: nextImages } : r));
      toast.success('Reparatur-Vorschau erstellt');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler bei der Reparatur');
    } finally {
      setRepairingIndex(null);
    }
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

              <Tabs defaultValue="uebersicht" className="space-y-4">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="uebersicht">Fazit</TabsTrigger>
                  <TabsTrigger value="schaeden">Schäden ({active.analysis?.schaeden?.length || 0})</TabsTrigger>
                  <TabsTrigger value="bilder">Markierte Bilder</TabsTrigger>
                  <TabsTrigger value="bericht">Bericht</TabsTrigger>
                </TabsList>

                {/* FAZIT */}
                <TabsContent value="uebersicht" className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${sevColor(active.analysis?.fazit?.schweregrad)}`}>
                        Schwere: {active.analysis?.fazit?.schweregrad || '–'}
                      </span>
                      {active.analysis?.fazit?.kategorie && (
                        <span className="px-2 py-1 rounded bg-muted text-xs">{active.analysis.fazit.kategorie}</span>
                      )}
                    </div>
                    {active.analysis?.fazit?.gesamteindruck && (
                      <p className="text-sm text-foreground leading-relaxed">{active.analysis.fazit.gesamteindruck}</p>
                    )}
                    {active.analysis?.fazit?.betroffeneBereiche?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {active.analysis.fazit.betroffeneBereiche.map((b: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent">{b}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Konservativ</p>
                      <p className="text-xl font-bold text-foreground">{fmt(active.analysis?.kostenGesamt?.konservativBrutto)}</p>
                      <p className="text-[10px] text-muted-foreground">brutto · {fmt(active.analysis?.kostenGesamt?.konservativNetto)} netto</p>
                    </div>
                    <div className="rounded-xl border border-accent bg-accent/5 p-4">
                      <p className="text-xs text-accent font-semibold">Realistisch</p>
                      <p className="text-xl font-bold text-foreground">{fmt(active.analysis?.kostenGesamt?.realistischBrutto)}</p>
                      <p className="text-[10px] text-muted-foreground">brutto · {fmt(active.analysis?.kostenGesamt?.realistischNetto)} netto</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-xs text-muted-foreground">Max (verdeckt)</p>
                      <p className="text-xl font-bold text-foreground">{fmt(active.analysis?.kostenGesamt?.maxBrutto)}</p>
                      <p className="text-[10px] text-muted-foreground">brutto · {fmt(active.analysis?.kostenGesamt?.maxNetto)} netto</p>
                    </div>
                  </div>
                  {active.analysis?.kostenGesamt?.annahmen && (
                    <p className="text-xs text-muted-foreground italic">Annahmen: {active.analysis.kostenGesamt.annahmen}</p>
                  )}

                  {active.analysis?.verdeckteSchaeden?.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold mb-2">Mögliche verdeckte Schäden</p>
                      <ul className="space-y-1.5 text-xs">
                        {active.analysis.verdeckteSchaeden.map((v: any, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
                            <span><strong>{v.bauteil}</strong> – {v.wahrscheinlichkeit}: {v.hinweis}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>

                {/* SCHÄDEN-TABELLE */}
                <TabsContent value="schaeden">
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Nr.</th>
                          <th className="p-2 text-left">Position / Bauteil</th>
                          <th className="p-2 text-left">Art</th>
                          <th className="p-2 text-left">Schwere</th>
                          <th className="p-2 text-left">Maßnahme</th>
                          <th className="p-2 text-left">Std.</th>
                          <th className="p-2 text-left">Kosten brutto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {active.analysis?.schaeden?.map((s: any) => (
                          <tr key={s.nr} className="border-t border-border">
                            <td className="p-2 font-bold">{s.nr}</td>
                            <td className="p-2"><strong>{s.position}</strong><br /><span className="text-muted-foreground">{s.bauteil}</span></td>
                            <td className="p-2">{s.art}<br /><span className="text-muted-foreground">{s.merkmale}</span></td>
                            <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-[10px] ${sevColor(s.schweregrad)}`}>{s.schweregrad}</span></td>
                            <td className="p-2">{s.massnahme}<br /><span className="text-muted-foreground">{s.reparaturart}</span></td>
                            <td className="p-2">{s.stunden}h</td>
                            <td className="p-2">{fmt(s.kostenBrutto?.min)} – {fmt(s.kostenBrutto?.max)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                {/* MARKIERTE BILDER + REPARATUR */}
                <TabsContent value="bilder">
                  {active.images?.length > 0 ? (() => {
                    const cur: any = active.images[viewerIndex] || active.images[0];
                    const orig = cur?.base64;
                    const annotated = cur?.annotatedBase64 || cur?.base64;
                    const repaired = cur?.repairedBase64;
                    return (
                      <div className="space-y-3">
                        <Tabs defaultValue="annotated" className="w-full">
                          <TabsList className="grid grid-cols-3 w-full">
                            <TabsTrigger value="annotated">Markiert</TabsTrigger>
                            <TabsTrigger value="original">Original</TabsTrigger>
                            <TabsTrigger value="repair">Vorher / Nachher</TabsTrigger>
                          </TabsList>

                          <TabsContent value="annotated" className="mt-3">
                            <div className="relative rounded-xl overflow-hidden bg-muted max-h-[55vh] flex items-center justify-center">
                              <img src={annotated} alt="Markiert" className="max-h-[55vh] w-auto object-contain" />
                              <button
                                onClick={() => setLightboxIndex(viewerIndex)}
                                className="absolute top-2 right-2 bg-foreground/60 hover:bg-foreground/80 text-background rounded-full p-1.5"
                                aria-label="Vergrößern"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            </div>
                          </TabsContent>

                          <TabsContent value="original" className="mt-3">
                            <div className="relative rounded-xl overflow-hidden bg-muted max-h-[55vh] flex items-center justify-center">
                              {orig ? (
                                <img src={orig} alt="Original" className="max-h-[55vh] w-auto object-contain" />
                              ) : (
                                <div className="py-12 text-sm text-muted-foreground">Kein Original gespeichert</div>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="repair" className="mt-3">
                            {repaired && orig ? (
                              <div className="space-y-3">
                                <BeforeAfterSlider
                                  beforeSrc={orig}
                                  afterSrc={repaired}
                                  beforeLabel="Vorher"
                                  afterLabel="Nachher"
                                  className="max-h-[55vh]"
                                />
                                <div className="flex justify-center">
                                  <Button size="sm" variant="outline" onClick={() => handleRepairInReport(active, viewerIndex)} disabled={repairingIndex === viewerIndex}>
                                    {repairingIndex === viewerIndex ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                                    Neu generieren
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-card border border-border p-6 text-center space-y-3">
                                <div className="mx-auto w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                                  <Sparkles className="w-5 h-5 text-accent" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-foreground">Reparatur-Vorschau noch nicht erstellt</h4>
                                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                                    Die Vorher-/Nachher-Visualisierung wird direkt aus dem Originalbild erstellt.
                                  </p>
                                </div>
                                <Button size="sm" onClick={() => handleRepairInReport(active, viewerIndex)} disabled={repairingIndex === viewerIndex} className="gradient-accent text-accent-foreground font-semibold">
                                  {repairingIndex === viewerIndex ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                                  {repairingIndex === viewerIndex ? 'Generiere Reparatur…' : 'Reparatur generieren'}
                                </Button>
                              </div>
                            )}
                          </TabsContent>
                        </Tabs>

                        {active.images.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {active.images.map((img: any, i: number) => (
                              <button
                                key={i}
                                onClick={() => setViewerIndex(i)}
                                className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                  i === viewerIndex ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                              >
                                <img src={img.annotatedBase64 || img.base64} alt="" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="py-12 text-center text-sm text-muted-foreground">Keine Bilder gespeichert</div>
                  )}
                </TabsContent>

                {/* BERICHT (markdown) */}
                <TabsContent value="bericht">
                  <div className="rounded-xl border border-border bg-card">
                    <div className="p-3 flex justify-between items-center border-b border-border">
                      <span className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Schadensbericht</span>
                      <Button size="sm" variant="outline" onClick={() => downloadMd(active)} className="gap-1">
                        <Download className="w-3.5 h-3.5" /> Download .md
                      </Button>
                    </div>
                    <pre className="p-4 text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed max-h-[60vh] overflow-y-auto">
                      {active.analysis?.berichtMarkdown || 'Kein Bericht gespeichert.'}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {active && lightboxIndex !== null && (
        <DamageImageLightbox
          open={lightboxIndex !== null}
          images={(active.images as any[]) || []}
          schaeden={active.analysis?.schaeden || []}
          initialIndex={lightboxIndex}
          reportId={active.id}
          onClose={() => setLightboxIndex(null)}
          onUpdate={(next) => {
            setActive(prev => prev ? { ...prev, images: next } : prev);
            setReports(prev => prev.map(r => r.id === active.id ? { ...r, images: next } : r));
          }}
        />
      )}
    </>
  );
}
