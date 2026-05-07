import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, Loader2, AlertCircle, ArrowLeft, Search, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { compressImageForAI, fileToBase64 } from '@/lib/image-compress';
import { supabase } from '@/integrations/supabase/client';
import ProcessTimer from '@/components/ProcessTimer';

interface Props {
  onBack: () => void;
}

interface UploadedImage {
  id: string;
  base64: string;
  annotatedBase64?: string | null;
}

interface DamageItem {
  nr: number;
  bildIndex: number;
  position: string;
  bauteil: string;
  art: string;
  merkmale: string;
  ursache: string;
  schweregrad: string;
  sicherheitsrelevant: string;
  massnahme: string;
  reparaturart: string;
  stunden: number;
  kostenNetto: { min: number; max: number };
  kostenBrutto: { min: number; max: number };
  unsicherheit: string;
}

interface Analysis {
  fazit: { gesamteindruck: string; schweregrad: string; betroffeneBereiche: string[]; kategorie: string };
  schaeden: DamageItem[];
  verdeckteSchaeden: { bauteil: string; wahrscheinlichkeit: string; hinweis: string }[];
  kostenGesamt: {
    konservativNetto: number; realistischNetto: number; maxNetto: number;
    konservativBrutto: number; realistischBrutto: number; maxBrutto: number;
    annahmen: string;
  };
  berichtMarkdown: string;
  bildQualitaetHinweise?: string[];
}

const MAX_IMAGES = 10;
const MAX_SIZE_MB = 10;

const fmt = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);

const sevColor = (s: string) => {
  if (s === 'hoch') return 'bg-destructive/15 text-destructive';
  if (s === 'mittel') return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
};

const DamageAnalysisFlow: React.FC<Props> = ({ onBack }) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [vehicleInfo, setVehicleInfo] = useState({
    marke: '', modell: '', baujahr: '', kmStand: '', farbe: '', antrieb: '',
  });
  const [anlass, setAnlass] = useState('Gebrauchtwagenbewertung');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [isDetecting, setIsDetecting] = useState(false);

  const autoDetect = useCallback(async (firstImageBase64: string) => {
    setIsDetecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const { data } = await supabase.functions.invoke('detect-vehicle-brand', {
        body: { imageBase64: firstImageBase64 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (data?.brand || data?.model) {
        setVehicleInfo(prev => ({
          ...prev,
          marke: prev.marke || data.brand || '',
          modell: prev.modell || data.model || '',
        }));
        if (data.brand) toast.success(`Erkannt: ${data.brand}${data.model ? ' ' + data.model : ''}`);
      }
    } catch (e) {
      console.warn('Brand detection failed', e);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { toast.error(`Max ${MAX_IMAGES} Bilder.`); return; }
    const list: UploadedImage[] = [];
    for (const f of Array.from(files).slice(0, remaining)) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_SIZE_MB * 1024 * 1024) { toast.error(`${f.name} > ${MAX_SIZE_MB}MB`); continue; }
      const raw = await fileToBase64(f);
      const compressed = await compressImageForAI(raw).catch(() => raw);
      list.push({ id: crypto.randomUUID(), base64: compressed });
    }
    const wasEmpty = images.length === 0;
    setImages(prev => [...prev, ...list]);
    if (wasEmpty && list.length > 0) {
      autoDetect(list[0].base64);
    }
  }, [images.length, autoDetect]);

  const removeImage = (id: string) => setImages(prev => prev.filter(i => i.id !== id));

  const startAnalysis = async () => {
    if (images.length === 0) { toast.error('Bitte mindestens 1 Bild hochladen.'); return; }
    setIsProcessing(true);
    setAnalysis(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Nicht eingeloggt');
      const { data, error } = await supabase.functions.invoke('analyze-damage', {
        body: { images: images.map(i => i.base64), vehicleInfo, anlass },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.analysis) throw new Error(data?.error || error?.message || 'Analyse fehlgeschlagen');
      setAnalysis(data.analysis);
      toast.success('Schadensanalyse abgeschlossen. Markiere Schäden in Bildern …');

      // Fetch annotations per image in parallel (separate function avoids 150s timeout)
      const schaedenAll = data.analysis.schaeden || [];
      await Promise.all(images.map(async (img, idx) => {
        const damagesForImage = schaedenAll.filter((s: any) => s.bildIndex === idx);
        if (damagesForImage.length === 0) return;
        try {
          const { data: ann } = await supabase.functions.invoke('annotate-damage-image', {
            body: { image: img.base64, schaeden: damagesForImage },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (ann?.annotated) {
            setImages(prev => prev.map(p => p.id === img.id ? { ...p, annotatedBase64: ann.annotated } : p));
          }
        } catch (e) {
          console.warn('Annotation fehlgeschlagen für Bild', idx, e);
        }
      }));
      toast.success('Markierungen erstellt.');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler bei der Analyse');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadReport = () => {
    if (!analysis) return;
    const md = analysis.berichtMarkdown || '';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `schadensbericht_${Date.now()}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadImage = (src: string, name: string) => {
    const a = document.createElement('a');
    a.href = src; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} disabled={isProcessing}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">KI-Schadensanalyse</h2>
          <p className="text-sm text-muted-foreground">
            Bilder analysieren, Schäden markieren und professionellen Bericht erstellen.
          </p>
        </div>
      </div>

      {!analysis && (
        <>
          {/* Vehicle info */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">Fahrzeugdaten (optional, verbessert die Analyse)</p>
              {isDetecting && (
                <span className="flex items-center gap-1.5 text-xs text-accent">
                  <Loader2 className="w-3 h-3 animate-spin" /> KI erkennt Marke & Modell…
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label className="text-xs">Marke</Label><Input value={vehicleInfo.marke} onChange={e => setVehicleInfo({ ...vehicleInfo, marke: e.target.value })} /></div>
              <div><Label className="text-xs">Modell</Label><Input value={vehicleInfo.modell} onChange={e => setVehicleInfo({ ...vehicleInfo, modell: e.target.value })} /></div>
              <div><Label className="text-xs">Baujahr</Label><Input value={vehicleInfo.baujahr} onChange={e => setVehicleInfo({ ...vehicleInfo, baujahr: e.target.value })} /></div>
              <div><Label className="text-xs">Km-Stand</Label><Input value={vehicleInfo.kmStand} onChange={e => setVehicleInfo({ ...vehicleInfo, kmStand: e.target.value })} /></div>
              <div><Label className="text-xs">Farbe</Label><Input value={vehicleInfo.farbe} onChange={e => setVehicleInfo({ ...vehicleInfo, farbe: e.target.value })} /></div>
              <div><Label className="text-xs">Antrieb</Label><Input value={vehicleInfo.antrieb} onChange={e => setVehicleInfo({ ...vehicleInfo, antrieb: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs">Anlass der Analyse</Label>
              <Input value={anlass} onChange={e => setAnlass(e.target.value)} placeholder="z.B. Unfallschaden, Leasingrückgabe, Ankaufprüfung" />
            </div>
          </div>

          {/* Upload */}
          {images.length < MAX_IMAGES && !isProcessing && (
            <div
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border hover:border-accent rounded-2xl p-8 text-center cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Bilder hierhin ziehen oder <span className="text-accent font-medium">klicken zum Auswählen</span>
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">Max {MAX_IMAGES} Bilder, je {MAX_SIZE_MB}MB</p>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map(img => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-muted aspect-[4/3]">
                  <img src={img.base64} alt="" className="w-full h-full object-cover" />
                  {!isProcessing && (
                    <button onClick={() => removeImage(img.id)} className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>KI analysiert Bilder & erstellt Markierungen…</span>
                <ProcessTimer running={isProcessing} label="Gesamt" />
              </div>
              <Progress value={undefined as any} className="h-1.5 animate-pulse" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={onBack} disabled={isProcessing}>Zurück</Button>
            <Button onClick={startAnalysis} disabled={images.length === 0 || isProcessing} className="gap-2 gradient-accent text-accent-foreground font-semibold">
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysiere…</> : <><Search className="w-4 h-4" /> Schaden analysieren</>}
            </Button>
          </div>
        </>
      )}

      {analysis && (
        <Tabs defaultValue="uebersicht" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="uebersicht">Fazit</TabsTrigger>
            <TabsTrigger value="schaeden">Schäden ({analysis.schaeden?.length || 0})</TabsTrigger>
            <TabsTrigger value="bilder">Markierte Bilder</TabsTrigger>
            <TabsTrigger value="bericht">Bericht</TabsTrigger>
          </TabsList>

          <TabsContent value="uebersicht" className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${sevColor(analysis.fazit?.schweregrad)}`}>
                  Schwere: {analysis.fazit?.schweregrad}
                </span>
                <span className="px-2 py-1 rounded bg-muted text-xs">{analysis.fazit?.kategorie}</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{analysis.fazit?.gesamteindruck}</p>
              {analysis.fazit?.betroffeneBereiche?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.fazit.betroffeneBereiche.map((b, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-accent/10 text-accent">{b}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Konservativ</p>
                <p className="text-xl font-bold text-foreground">{fmt(analysis.kostenGesamt?.konservativBrutto)}</p>
                <p className="text-[10px] text-muted-foreground">brutto · {fmt(analysis.kostenGesamt?.konservativNetto)} netto</p>
              </div>
              <div className="rounded-xl border border-accent bg-accent/5 p-4">
                <p className="text-xs text-accent font-semibold">Realistisch</p>
                <p className="text-xl font-bold text-foreground">{fmt(analysis.kostenGesamt?.realistischBrutto)}</p>
                <p className="text-[10px] text-muted-foreground">brutto · {fmt(analysis.kostenGesamt?.realistischNetto)} netto</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Max (verdeckt)</p>
                <p className="text-xl font-bold text-foreground">{fmt(analysis.kostenGesamt?.maxBrutto)}</p>
                <p className="text-[10px] text-muted-foreground">brutto · {fmt(analysis.kostenGesamt?.maxNetto)} netto</p>
              </div>
            </div>
            {analysis.kostenGesamt?.annahmen && (
              <p className="text-xs text-muted-foreground italic">Annahmen: {analysis.kostenGesamt.annahmen}</p>
            )}

            {analysis.verdeckteSchaeden?.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold mb-2">Mögliche verdeckte Schäden</p>
                <ul className="space-y-1.5 text-xs">
                  {analysis.verdeckteSchaeden.map((v, i) => (
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
                  {analysis.schaeden?.map(s => (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.map((img, i) => (
                <div key={img.id} className="rounded-xl border border-border overflow-hidden bg-card">
                  <div className="relative aspect-[4/3] bg-muted">
                    <img src={img.annotatedBase64 || img.base64} alt={`Bild ${i + 1}`} className="w-full h-full object-cover" />
                    {img.annotatedBase64 && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-accent text-accent-foreground text-[10px] font-semibold rounded">
                        Markiert
                      </span>
                    )}
                  </div>
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Bild {i + 1}</span>
                    {img.annotatedBase64 && (
                      <Button size="sm" variant="ghost" onClick={() => downloadImage(img.annotatedBase64!, `schaden_bild_${i + 1}.png`)} className="gap-1 h-7 text-xs">
                        <Download className="w-3 h-3" /> Markiertes Bild
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="bericht">
            <div className="rounded-xl border border-border bg-card">
              <div className="p-3 flex justify-between items-center border-b border-border">
                <span className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Schadensbericht</span>
                <Button size="sm" variant="outline" onClick={downloadReport} className="gap-1"><Download className="w-3.5 h-3.5" /> Download .md</Button>
              </div>
              <Textarea
                value={analysis.berichtMarkdown}
                readOnly
                className="min-h-[500px] font-mono text-xs border-0 rounded-none resize-y"
              />
            </div>
          </TabsContent>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => { setAnalysis(null); }}>Neue Analyse</Button>
            <Button variant="ghost" onClick={onBack}>Fertig</Button>
          </div>
        </Tabs>
      )}
    </div>
  );
};

export default DamageAnalysisFlow;
