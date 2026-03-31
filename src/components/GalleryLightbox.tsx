import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, FolderPlus, RotateCcw, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invokeRemasterVehicleImage } from '@/lib/remaster-invoke';
import { useDeleteGalleryImage } from '@/hooks/useDashboardData';

interface LightboxImage {
  id: string;
  src: string;
  perspective?: string | null;
  project_id?: string;
}

interface Project {
  id: string;
  title: string;
  vehicle_data: any;
}

interface GalleryLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onAssigned?: () => void;
  onRegenerated?: () => void;
  onDeleted?: () => void;
}

const GalleryLightbox: React.FC<GalleryLightboxProps> = ({ images, initialIndex, open, onClose, onAssigned, onRegenerated, onDeleted }) => {
  const [index, setIndex] = useState(initialIndex);
  const [assignOpen, setAssignOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteImage = useDeleteGalleryImage();

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  // Wrap-around navigation
  const goPrev = () => setIndex(i => (i <= 0 ? images.length - 1 : i - 1));
  const goNext = () => setIndex(i => (i >= images.length - 1 ? 0 : i + 1));

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

  const current = images[index];
  if (!open || !current) return null;

  const loadProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, title, vehicle_data')
      .order('updated_at', { ascending: false });
    setProjects((data as Project[]) || []);
    setAssignOpen(true);
  };

  const assignToProject = async (projectId: string) => {
    setAssigning(true);
    try {
      const { error } = await supabase
        .from('project_images')
        .update({ project_id: projectId } as any)
        .eq('id', current.id);
      if (error) throw error;
      toast.success('Bild wurde dem Projekt zugeordnet');
      setAssignOpen(false);
      onAssigned?.();
    } catch {
      toast.error('Fehler beim Zuordnen');
    }
    setAssigning(false);
  };

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
        // If last image in folder, close lightbox
        if (images.length <= 1) {
          onClose();
        } else if (index >= images.length - 1) {
          setIndex(0);
        }
        onDeleted?.();
      },
      onError: () => {
        toast.error('Fehler beim Löschen');
        setConfirmDelete(false);
      },
    });
  };

  const regenerateImage = async () => {
    setRegenerating(true);
    try {
      const response = await fetch(current.src);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const { data, error } = await invokeRemasterVehicleImage({
        imageBase64: base64,
        vehicleDescription: current.perspective || '',
        modelTier: 'standard',
      });

      if (error || !data?.imageBase64) {
        toast.error(data?.error || error?.message || 'Fehler beim Regenerieren');
      } else {
        const { error: updateError } = await supabase
          .from('project_images')
          .update({ image_url: data.imageBase64, image_base64: '' } as any)
          .eq('id', current.id);

        if (updateError) {
          toast.error('Bild generiert, aber Speichern fehlgeschlagen');
        } else {
          toast.success('Bild erfolgreich neu generiert');
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
            onClick={regenerateImage}
            disabled={regenerating}
            className="gap-1.5"
          >
            {regenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generiere…</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> Neu generieren</>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={loadProjects} className="gap-1.5">
            <FolderPlus className="w-4 h-4" /> Projekt zuordnen
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

        {/* Navigation – always show, wrap around */}
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

        {/* Image */}
        <div className="relative">
          <img
            src={current.src}
            alt={current.perspective || 'Fahrzeugbild'}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
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

        {/* Thumbnail strip */}
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

      {/* Assign to project dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent onClick={e => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Projekt zuordnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Projekte vorhanden. Erstelle zuerst ein Projekt.</p>
            ) : (
              <Select onValueChange={assignToProject} disabled={assigning}>
                <SelectTrigger>
                  <SelectValue placeholder="Projekt auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => {
                    const vd = p.vehicle_data as any;
                    const label = `${vd?.vehicle?.brand || ''} ${vd?.vehicle?.model || ''} – ${p.title}`.trim();
                    return <SelectItem key={p.id} value={p.id}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
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
