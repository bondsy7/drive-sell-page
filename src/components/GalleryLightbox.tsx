import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, RotateCcw, Loader2, Trash2, ImageIcon, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { useDeleteGalleryImage } from '@/hooks/useDashboardData';
import { PIPELINE_JOBS } from '@/lib/pipeline-jobs';

interface LightboxImage {
  id: string;
  src: string;
  perspective?: string | null;
  project_id?: string;
}

interface GalleryLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onAssigned?: () => void;
  onRegenerated?: () => void;
  onDeleted?: () => void;
  vehicleId?: string;
}

const GalleryLightbox: React.FC<GalleryLightboxProps> = ({ images, initialIndex, open, onClose, onRegenerated, onDeleted, vehicleId }) => {
  const { user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickerTab, setPickerTab] = useState<'originals' | 'gallery'>('originals');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [selectedRef, setSelectedRef] = useState<string | null>(null);

  const deleteImage = useDeleteGalleryImage();

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  const goPrev = () => setIndex(i => (i <= 0 ? images.length - 1 : i - 1));
  const goNext = () => setIndex(i => (i >= images.length - 1 ? 0 : i + 1));
  const swipeHandlers = useSwipeNavigation({
    enabled: open && images.length > 1,
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  });

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, images.length, onClose]);

  // Load originals for this vehicle
  const prefix = user && vehicleId ? `${user.id}/${vehicleId}` : '';
  const { data: originals = [], isLoading: loadingOriginals } = useQuery({
    queryKey: ['originals-picker', user?.id, vehicleId],
    enabled: !!user && !!vehicleId && pickerOpen,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from('originals')
        .list(prefix, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });
      return await Promise.all(
        (data || [])
          .filter(f => f.name && !f.name.startsWith('.'))
          .map(async f => {
            const fullPath = `${prefix}/${f.name}`;
            const { data: signed } = await supabase.storage
              .from('originals')
              .createSignedUrl(fullPath, 60 * 60);
            return { name: f.name, url: signed?.signedUrl || '' };
          }),
      );
    },
  });

  const current = images[index];
  if (!open || !current) return null;

  const download = () => {
    const a = document.createElement('a');
    a.href = current.src;
    a.download = `${current.perspective || 'bild'}.png`;
    a.click();
  };

  const handleDelete = () => {
    deleteImage.mutate(current.id, {
      onSuccess: () => {
        toast.success('Bild gelöscht');
        setConfirmDelete(false);
        if (images.length <= 1) onClose();
        else if (index >= images.length - 1) setIndex(0);
        onDeleted?.();
      },
      onError: () => {
        toast.error('Fehler beim Löschen');
        setConfirmDelete(false);
      },
    });
  };

  // Find matching pipeline job prompt based on perspective label
  // current.perspective looks like "Pipeline: Felge" or "Pipeline: Rücklicht (Regen)"
  const pipelineJob = (() => {
    const persp = current?.perspective || '';
    const match = persp.match(/Pipeline:\s*([^()]+?)(?:\s*\(.*\))?$/i);
    const label = match?.[1]?.trim();
    if (!label) return null;
    return PIPELINE_JOBS.find(j => j.labelDe.toLowerCase() === label.toLowerCase()) || null;
  })();

  const fetchAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const runRegenerate = async (referenceUrl: string | null) => {
    setPickerOpen(false);
    setRegenerating(true);
    try {
      // Main image = the CURRENT generated image (we improve it)
      const mainBase64 = await fetchAsBase64(current.src);

      // Reference image = additional input (only as detail/quality reference)
      const additionalImages: string[] = [];
      if (referenceUrl) {
        const refBase64 = await fetchAsBase64(referenceUrl);
        additionalImages.push(refBase64);
      }

      // Build dynamic prompt: pipeline-specific prompt + user's extra instruction
      let dynamicPrompt: string | undefined;
      const trimmed = extraPrompt.trim();
      if (pipelineJob) {
        let p = pipelineJob.prompt;
        if (trimmed) {
          p += `\n\n<USER_REFINEMENT>\nThe previous generation had issues. Apply these targeted corrections WITHOUT changing perspective, framing, or composition:\n${trimmed}\n</USER_REFINEMENT>`;
        }
        if (referenceUrl) {
          p += `\n\n<REFERENCE_USAGE>\nThe additional reference photo is provided ONLY to correct specific details (e.g. interior parts, textures, badges, controls) that were wrong in the previous generation. Do NOT copy its perspective, camera angle, framing, or composition – keep the perspective defined above.\n</REFERENCE_USAGE>`;
        }
        dynamicPrompt = p;
      } else if (trimmed) {
        dynamicPrompt = `Improve the provided image. Apply these corrections WITHOUT changing perspective, framing, or composition:\n${trimmed}`;
      }

      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: mainBase64,
        vehicleDescription: current.perspective || '',
        modelTier: 'standard',
        dynamicPrompt,
        additionalImages: additionalImages.length ? additionalImages : undefined,
      });

      if (error || !data?.imageBase64) {
        toast.error(data?.error || error?.message || 'Fehler beim Regenerieren');
      } else {
        const { error: updateError } = await supabase
          .from('project_images')
          .update({ image_url: data.imageBase64, image_base64: '' } as any)
          .eq('id', current.id);

        if (updateError) toast.error('Bild generiert, aber Speichern fehlgeschlagen');
        else {
          toast.success('Bild erfolgreich neu generiert');
          setExtraPrompt('');
          setSelectedRef(null);
          onRegenerated?.();
        }
      }
    } catch {
      toast.error('Netzwerkfehler beim Regenerieren');
    }
    setRegenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <span className="text-sm text-background/70">{index + 1} / {images.length}</span>
          <Button variant="secondary" size="sm" onClick={download} className="gap-1.5">
            <Download className="w-4 h-4" /> Download
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPickerOpen(true)}
            disabled={regenerating}
            className="gap-1.5"
          >
            {regenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generiere…</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> Neu generieren</>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" /> Löschen
          </Button>
          <button onClick={onClose} className="text-background hover:text-background/80 transition-colors ml-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 transition-colors"
            >
              <ChevronLeft className="w-8 h-8 text-background" />
            </button>
            <button
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 transition-colors"
            >
              <ChevronRight className="w-8 h-8 text-background" />
            </button>
          </>
        )}

        <div className="relative">
          <img
            src={current.src}
            alt={current.perspective || 'Fahrzeugbild'}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            {...swipeHandlers}
          />
          {regenerating && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-sm font-medium text-foreground">Wird neu generiert…</span>
              </div>
            </div>
          )}
        </div>

        {current.perspective && (
          <p className="text-sm text-background/70 mt-3">{current.perspective}</p>
        )}

        {images.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto max-w-[90vw] pb-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setIndex(i)}
                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  i === index ? 'border-accent scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Picker dialog: pipeline prompt + reference + extra prompt */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Bild verbessern</DialogTitle>
            <DialogDescription>
              {pipelineJob ? (
                <>Pipeline-Prompt: <span className="font-medium">{pipelineJob.labelDe}</span> wird automatisch verwendet. Optional: Referenzbild und Hinweise auswählen.</>
              ) : (
                <>Wähle optional ein Referenzbild und beschreibe, was verbessert werden soll.</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">Verbesserungs-Hinweise (optional)</label>
            <Textarea
              value={extraPrompt}
              onChange={e => setExtraPrompt(e.target.value)}
              placeholder={pipelineJob ? `z.B. „Lenkrad-Logo korrekt darstellen, Knöpfe schärfer"` : `z.B. „mehr Kontrast, Spiegelungen entfernen"`}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Perspektive und Bildausschnitt bleiben gleich – nur Details werden verbessert.
            </p>
          </div>

          <Tabs value={pickerTab} onValueChange={(v) => { setPickerTab(v as any); setSelectedRef(null); }}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="originals">Originale</TabsTrigger>
              <TabsTrigger value="gallery">Galerie</TabsTrigger>
            </TabsList>

            <TabsContent value="originals" className="mt-3">
              {!vehicleId ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Kein Fahrzeug-Kontext verfügbar.</div>
              ) : loadingOriginals ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
              ) : originals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Keine Originalbilder vorhanden.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                  {originals.map(o => (
                    <button
                      key={o.name}
                      onClick={() => setSelectedRef(o.url)}
                      className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedRef === o.url ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:border-accent/60'}`}
                    >
                      <img src={o.url} alt={o.name} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="gallery" className="mt-3">
              {images.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Keine Galeriebilder vorhanden.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[40vh] overflow-y-auto">
                  {images.filter(i => i.id !== current.id).map(img => (
                    <button
                      key={img.id}
                      onClick={() => setSelectedRef(img.src)}
                      className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedRef === img.src ? 'border-accent ring-2 ring-accent/40' : 'border-transparent hover:border-accent/60'}`}
                    >
                      <img src={img.src} alt={img.perspective || ''} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Abbrechen</Button>
            <Button onClick={() => runRegenerate(selectedRef)} className="gap-1.5">
              <Wand2 className="w-4 h-4" />
              {selectedRef ? 'Mit Referenz verbessern' : 'Ohne Referenz verbessern'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Bild löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieses Bild wird unwiderruflich gelöscht. Möchtest du fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GalleryLightbox;
