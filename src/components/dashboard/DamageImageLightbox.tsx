import React, { useState } from 'react';
import { X, Loader2, Sparkles, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DamageImage {
  base64: string;             // original upload
  annotatedBase64?: string | null;
  repairedBase64?: string | null;
}

interface Props {
  images: DamageImage[];
  schaeden?: any[]; // damage list to send to repair
  initialIndex: number;
  open: boolean;
  reportId?: string;
  onClose: () => void;
  onUpdate?: (next: DamageImage[]) => void;
}

const DamageImageLightbox: React.FC<Props> = ({
  images, schaeden = [], initialIndex, open, reportId, onClose, onUpdate,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [repairing, setRepairing] = useState(false);
  const [tab, setTab] = useState('annotated');

  React.useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  if (!open || !images[index]) return null;
  const current = images[index];

  const goPrev = () => setIndex(i => Math.max(0, i - 1));
  const goNext = () => setIndex(i => Math.min(images.length - 1, i + 1));

  const download = (src: string, name: string) => {
    const a = document.createElement('a');
    a.href = src; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Nicht eingeloggt');
      const damagesForImage = (schaeden || []).filter((s: any) => s.bildIndex === index);

      // Try uploading via Gemini File API to reduce payload
      const { uploadToGeminiFiles } = await import('@/lib/gemini-file-upload');
      const refs = await uploadToGeminiFiles([{ id: 'main', imageBase64: current.base64 }]);
      const imageFileUri = refs && refs[0] ? refs[0] : null;

      const { data, error } = await supabase.functions.invoke('repair-damage-image', {
        body: imageFileUri
          ? { imageFileUri, schaeden: damagesForImage }
          : { image: current.base64, schaeden: damagesForImage },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.repaired) throw new Error(data?.error || error?.message || 'Reparatur fehlgeschlagen');
      const next = images.map((img, i) => i === index ? { ...img, repairedBase64: data.repaired } : img);
      onUpdate?.(next);
      if (reportId) {
        await supabase.from('damage_reports').update({ images: next as any }).eq('id', reportId);
      }
      toast.success('Repariertes Bild erstellt');
      setTab('repair');
    } catch (e: any) {
      toast.error(e?.message || 'Fehler bei der Reparatur');
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/85 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-8" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2 z-10">
          <span className="text-xs text-background/70">{index + 1} / {images.length}</span>
          <button onClick={onClose} className="text-background hover:text-background/80 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Nav arrows */}
        {index > 0 && (
          <button onClick={goPrev} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 z-10">
            <ChevronLeft className="w-7 h-7 text-background" />
          </button>
        )}
        {index < images.length - 1 && (
          <button onClick={goNext} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 z-10">
            <ChevronRight className="w-7 h-7 text-background" />
          </button>
        )}

        <div className="w-full max-w-5xl">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-3">
              <TabsTrigger value="annotated">Markiert</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="repair">Vorher / Nachher</TabsTrigger>
            </TabsList>

            <TabsContent value="annotated" className="mt-0">
              <div className="rounded-xl overflow-hidden bg-muted max-h-[75vh] flex items-center justify-center">
                <img
                  src={current.annotatedBase64 || current.base64}
                  alt="Markierung"
                  className="max-h-[75vh] w-auto object-contain"
                />
              </div>
              <div className="flex justify-center mt-3">
                <Button size="sm" variant="secondary" onClick={() => download(current.annotatedBase64 || current.base64, `markiert-${index + 1}.png`)}>
                  <Download className="w-4 h-4 mr-1.5" /> Download
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="original" className="mt-0">
              <div className="rounded-xl overflow-hidden bg-muted max-h-[75vh] flex items-center justify-center">
                <img src={current.base64} alt="Original" className="max-h-[75vh] w-auto object-contain" />
              </div>
              <div className="flex justify-center mt-3">
                <Button size="sm" variant="secondary" onClick={() => download(current.base64, `original-${index + 1}.png`)}>
                  <Download className="w-4 h-4 mr-1.5" /> Download
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="repair" className="mt-0">
              {current.repairedBase64 ? (
                <>
                  <BeforeAfterSlider
                    beforeSrc={current.base64}
                    afterSrc={current.repairedBase64}
                    beforeLabel="Schaden"
                    afterLabel="Repariert"
                    className="max-h-[75vh]"
                  />
                  <div className="flex justify-center gap-2 mt-3">
                    <Button size="sm" variant="secondary" onClick={() => download(current.repairedBase64!, `repariert-${index + 1}.png`)}>
                      <Download className="w-4 h-4 mr-1.5" /> Download
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleRepair} disabled={repairing}>
                      {repairing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      Neu generieren
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-card border border-border p-8 text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Reparatur-Visualisierung</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                      KI generiert eine fotorealistische Vorschau, wie das Fahrzeug nach professioneller Reparatur aussehen würde.
                      Per Slider vergleichst du Vorher / Nachher direkt.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">Kosten: 2 Credits</p>
                  </div>
                  <Button onClick={handleRepair} disabled={repairing} className="gradient-accent text-accent-foreground font-semibold">
                    {repairing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generiere…</> : <><Sparkles className="w-4 h-4 mr-2" /> Reparatur generieren</>}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2 justify-center">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === index ? 'border-accent scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img.annotatedBase64 || img.base64} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DamageImageLightbox;
