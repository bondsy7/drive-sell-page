import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, FolderPlus, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

const GalleryLightbox: React.FC<GalleryLightboxProps> = ({ images, initialIndex, open, onClose, onAssigned }) => {
  const [index, setIndex] = useState(initialIndex);
  const [assignOpen, setAssignOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <span className="text-sm text-background/70">{index + 1} / {images.length}</span>
          <Button variant="secondary" size="sm" onClick={download} className="gap-1.5">
            <Download className="w-4 h-4" /> Download
          </Button>
          <Button variant="secondary" size="sm" onClick={loadProjects} className="gap-1.5">
            <FolderPlus className="w-4 h-4" /> Projekt zuordnen
          </Button>
          <button onClick={onClose} className="text-background hover:text-background/80 transition-colors ml-2">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        {index > 0 && (
          <button
            onClick={() => setIndex(i => i - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-background" />
          </button>
        )}
        {index < images.length - 1 && (
          <button
            onClick={() => setIndex(i => i + 1)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur rounded-full p-2 transition-colors"
          >
            <ChevronRight className="w-8 h-8 text-background" />
          </button>
        )}

        {/* Image */}
        <img
          src={current.src}
          alt={current.perspective || 'Fahrzeugbild'}
          className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        />

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
    </div>
  );
};

export default GalleryLightbox;
