import { useMemo, useState } from 'react';
import { Image, FolderOpen, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { type ProjectImage, getImageSrc } from './types';
import { useDeleteGalleryImage, useDeleteGalleryFolder } from '@/hooks/useDashboardData';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  images: ProjectImage[];
  onLightbox: (globalIndex: number) => void;
}

export default function GalleryTab({ images, onLightbox }: Props) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(images.map(i => i.gallery_folder || 'Ohne Ordner'));
  });

  const [confirmDeleteImage, setConfirmDeleteImage] = useState<string | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<{ folder: string; count: number } | null>(null);

  const deleteImage = useDeleteGalleryImage();
  const deleteFolder = useDeleteGalleryFolder();

  const groupedGallery = useMemo(() => {
    const groups: Record<string, ProjectImage[]> = {};
    for (const img of images) {
      const folder = img.gallery_folder || 'Ohne Ordner';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(img);
    }
    // Sort folders by newest image first
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Ohne Ordner') return 1;
      if (b === 'Ohne Ordner') return -1;
      // Compare by most recent image date in each folder
      const latestA = Math.max(...groups[a].map(i => new Date(i.created_at || 0).getTime()));
      const latestB = Math.max(...groups[b].map(i => new Date(i.created_at || 0).getTime()));
      return latestB - latestA; // newest first
    });
    return sortedKeys.map(key => ({ folder: key, images: groups[key] }));
  }, [images]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder); else next.add(folder);
      return next;
    });
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <Image className="w-12 h-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Noch keine Bilder generiert.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {groupedGallery.map(({ folder, images: folderImages }) => {
          const isExpanded = expandedFolders.has(folder);
          const isVin = folder !== 'Ohne Ordner' && !folder.startsWith('NO_VIN');
          return (
            <div key={folder} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="flex items-center">
                <button
                  onClick={() => toggleFolder(folder)}
                  className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <FolderOpen className="w-4 h-4 text-accent shrink-0" />
                  <span className={`font-display font-semibold text-sm ${isVin ? 'font-mono' : ''}`}>{folder}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{folderImages.length} Bild{folderImages.length !== 1 ? 'er' : ''}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteFolder({ folder, count: folderImages.length }); }}
                  className="p-3 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Ordner löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {isExpanded && (
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 p-3 pt-0">
                  {folderImages.map((img) => {
                    const globalIdx = images.findIndex(i => i.id === img.id);
                    return (
                      <div key={img.id} className="bg-muted rounded-lg overflow-hidden group relative">
                        <div className="cursor-pointer" onClick={() => onLightbox(globalIdx)}>
                          <div className="aspect-video">
                            <img src={getImageSrc(img)} alt={img.perspective || 'Fahrzeugbild'} className="w-full h-full object-cover" />
                          </div>
                          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                            <span className="text-sm font-medium text-background">Öffnen</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteImage(img.id); }}
                          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background transition-colors opacity-0 group-hover:opacity-100 z-10"
                          title="Bild löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {img.perspective && <p className="text-xs text-muted-foreground p-2">{img.perspective}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm delete single image */}
      <AlertDialog open={!!confirmDeleteImage} onOpenChange={() => setConfirmDeleteImage(null)}>
        <AlertDialogContent>
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
              onClick={() => { if (confirmDeleteImage) deleteImage.mutate(confirmDeleteImage); setConfirmDeleteImage(null); }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete folder */}
      <AlertDialog open={!!confirmDeleteFolder} onOpenChange={() => setConfirmDeleteFolder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ordner löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Ordner „{confirmDeleteFolder?.folder}" mit {confirmDeleteFolder?.count} Bild{(confirmDeleteFolder?.count ?? 0) !== 1 ? 'ern' : ''} wird unwiderruflich gelöscht. Möchtest du fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteFolder) deleteFolder.mutate(confirmDeleteFolder.folder); setConfirmDeleteFolder(null); }}
            >
              Ordner löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
