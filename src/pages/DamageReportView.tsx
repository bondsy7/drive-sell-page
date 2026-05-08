import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Download, Maximize2, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import DamageImageLightbox from '@/components/dashboard/DamageImageLightbox';
import AppHeader from '@/components/AppHeader';

const fmt = (n: number | null | undefined) => n == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const sevColor = (s: string | null | undefined) => {
  if (s === 'hoch') return 'bg-destructive/15 text-destructive';
  if (s === 'mittel') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  if (s === 'gering') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  return 'bg-muted text-muted-foreground';
};

export default function DamageReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [repairingIndex, setRepairingIndex] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase.from('damage_reports').select('*').eq('id', id).maybeSingle();
      if (error) toast.error(error.message);
      setReport(data);
      setLoading(false);
    })();
  }, [id]);

  const downloadMd = () => {
    const md = report?.analysis?.berichtMarkdown || '';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(report?.title || 'bericht').replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const handleRepairInReport = async (imageIndex: number) => {
    const current = report?.images?.[imageIndex];
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
        body: imageFileUri ? { imageFileUri, schaeden } : { image: current.base64, schaeden },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.repaired) throw new Error(data?.error || error?.message || 'Reparatur-Bild konnte nicht generiert werden');
      const nextImages = report.images.map((img: any, i: number) => i === imageIndex ? { ...img, repairedBase64: data.repaired } : img);
      const { error: updateError } = await supabase.from('damage_reports').update({ images: nextImages as any }).eq('id', report.id);
      if (updateError) throw updateError;
      setReport({ ...report, images: nextImages });
      toast.success('Reparatur-Vorschau erstellt');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler bei der Reparatur');
    } finally {
      setRepairingIndex(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground">Bericht nicht gefunden.</p>
        <Button onClick={() => navigate('/dashboard')}><ArrowLeft className="w-4 h-4 mr-1.5" /> Zum Dashboard</Button>
      </div>
    );
  }

  const a = report;
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Zurück
          </Button>
          <Button variant="outline" size="sm" onClick={downloadMd}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Bericht .md
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">{a.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString('de-DE')}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge className={sevColor(a.schweregrad)}>Schwere: {a.schweregrad || '–'}</Badge>
          <Badge variant="outline">{a.schaden_count} Schäden</Badge>
          <Badge variant="outline">Realistisch: {fmt(a.kosten_realistisch_brutto)}</Badge>
          {a.anlass && <Badge variant="outline">{a.anlass}</Badge>}
        </div>

        <Tabs defaultValue="uebersicht" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="uebersicht">Fazit</TabsTrigger>
            <TabsTrigger value="schaeden">Schäden ({a.analysis?.schaeden?.length || 0})</TabsTrigger>
            <TabsTrigger value="bilder">Markierte Bilder</TabsTrigger>
            <TabsTrigger value="bericht">Bericht</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${sevColor(a.analysis?.fazit?.schweregrad)}`}>
                  Schwere: {a.analysis?.fazit?.schweregrad || '–'}
                </span>
                {a.analysis?.fazit?.kategorie && (
                  <span className="px-2 py-1 rounded bg-muted text-xs">{a.analysis.fazit.kategorie}</span>
                )}
              </div>
              {a.analysis?.fazit?.gesamteindruck && (
                <p className="text-sm text-foreground leading-relaxed">{a.analysis.fazit.gesamteindruck}</p>
              )}
              {a.analysis?.fazit?.betroffeneBereiche?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {a.analysis.fazit.betroffeneBereiche.map((b: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent">{b}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Konservativ</p>
                <p className="text-xl font-bold text-foreground">{fmt(a.analysis?.kostenGesamt?.konservativBrutto)}</p>
                <p className="text-[10px] text-muted-foreground">brutto · {fmt(a.analysis?.kostenGesamt?.konservativNetto)} netto</p>
              </div>
              <div className="rounded-xl border border-accent bg-accent/5 p-4">
                <p className="text-xs text-accent font-semibold">Realistisch</p>
                <p className="text-xl font-bold text-foreground">{fmt(a.analysis?.kostenGesamt?.realistischBrutto)}</p>
                <p className="text-[10px] text-muted-foreground">brutto · {fmt(a.analysis?.kostenGesamt?.realistischNetto)} netto</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Max (verdeckt)</p>
                <p className="text-xl font-bold text-foreground">{fmt(a.analysis?.kostenGesamt?.maxBrutto)}</p>
                <p className="text-[10px] text-muted-foreground">brutto · {fmt(a.analysis?.kostenGesamt?.maxNetto)} netto</p>
              </div>
            </div>
            {a.analysis?.kostenGesamt?.annahmen && (
              <p className="text-xs text-muted-foreground italic">Annahmen: {a.analysis.kostenGesamt.annahmen}</p>
            )}

            {a.analysis?.verdeckteSchaeden?.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-2">Mögliche verdeckte Schäden</p>
                <ul className="space-y-1.5 text-xs">
                  {a.analysis.verdeckteSchaeden.map((v: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
                      <span><strong>{v.bauteil}</strong> – {v.wahrscheinlichkeit}: {v.hinweis}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

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
                  {a.analysis?.schaeden?.map((s: any) => (
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

          <TabsContent value="bilder">
            {a.images?.length > 0 ? (() => {
              const cur: any = a.images[viewerIndex] || a.images[0];
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
                      <div className="relative rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                        <img src={annotated} alt="Markiert" className="max-h-[70vh] w-auto object-contain" />
                        <button onClick={() => setLightboxIndex(viewerIndex)} className="absolute top-2 right-2 bg-foreground/60 hover:bg-foreground/80 text-background rounded-full p-1.5" aria-label="Vergrößern">
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TabsContent>
                    <TabsContent value="original" className="mt-3">
                      <div className="relative rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                        {orig ? <img src={orig} alt="Original" className="max-h-[70vh] w-auto object-contain" /> : <div className="py-12 text-sm text-muted-foreground">Kein Original gespeichert</div>}
                      </div>
                    </TabsContent>
                    <TabsContent value="repair" className="mt-3">
                      {repaired && orig ? (
                        <div className="space-y-3">
                          <BeforeAfterSlider beforeSrc={orig} afterSrc={repaired} beforeLabel="Vorher" afterLabel="Nachher" className="max-h-[70vh]" />
                          <div className="flex justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleRepairInReport(viewerIndex)} disabled={repairingIndex === viewerIndex}>
                              {repairingIndex === viewerIndex ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                              Neu generieren
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-card border border-border p-6 text-center space-y-3">
                          <div className="mx-auto w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center"><Sparkles className="w-5 h-5 text-accent" /></div>
                          <div>
                            <h4 className="font-semibold text-foreground">Reparatur-Vorschau noch nicht erstellt</h4>
                            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">Die Vorher-/Nachher-Visualisierung wird direkt aus dem Originalbild erstellt.</p>
                          </div>
                          <Button size="sm" onClick={() => handleRepairInReport(viewerIndex)} disabled={repairingIndex === viewerIndex} className="gradient-accent text-accent-foreground font-semibold">
                            {repairingIndex === viewerIndex ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                            {repairingIndex === viewerIndex ? 'Generiere Reparatur…' : 'Reparatur generieren'}
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {a.images.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {a.images.map((img: any, i: number) => (
                        <button key={i} onClick={() => setViewerIndex(i)} className={`shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === viewerIndex ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'}`}>
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

          <TabsContent value="bericht">
            <div className="rounded-xl border border-border bg-card">
              <div className="p-3 flex justify-between items-center border-b border-border">
                <span className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Schadensbericht</span>
                <Button size="sm" variant="outline" onClick={downloadMd} className="gap-1">
                  <Download className="w-3.5 h-3.5" /> Download .md
                </Button>
              </div>
              <pre className="p-4 text-xs whitespace-pre-wrap font-sans text-foreground leading-relaxed max-h-[70vh] overflow-y-auto">
                {a.analysis?.berichtMarkdown || 'Kein Bericht gespeichert.'}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {lightboxIndex !== null && (
        <DamageImageLightbox
          open={lightboxIndex !== null}
          images={(a.images as any[]) || []}
          schaeden={a.analysis?.schaeden || []}
          initialIndex={lightboxIndex}
          reportId={a.id}
          onClose={() => setLightboxIndex(null)}
          onUpdate={(next) => setReport({ ...a, images: next })}
        />
      )}
    </div>
  );
}
