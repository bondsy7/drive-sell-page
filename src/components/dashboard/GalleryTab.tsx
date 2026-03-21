import { useMemo, useState } from 'react';
import { Image, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { type ProjectImage, getImageSrc } from './types';

interface Props {
  images: ProjectImage[];
  onLightbox: (globalIndex: number) => void;
}

export default function GalleryTab({ images, onLightbox }: Props) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(images.map(i => i.gallery_folder || 'Ohne Ordner'));
  });

  const groupedGallery = useMemo(() => {
    const groups: Record<string, ProjectImage[]> = {};
    for (const img of images) {
      const folder = img.gallery_folder || 'Ohne Ordner';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(img);
    }
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Ohne Ordner') return 1;
      if (b === 'Ohne Ordner') return -1;
      if (a.startsWith('NO_VIN') && !b.startsWith('NO_VIN')) return 1;
      if (!a.startsWith('NO_VIN') && b.startsWith('NO_VIN')) return -1;
      return a.localeCompare(b);
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
    <div className="space-y-4">
      {groupedGallery.map(({ folder, images: folderImages }) => {
        const isExpanded = expandedFolders.has(folder);
        const isVin = folder !== 'Ohne Ordner' && !folder.startsWith('NO_VIN');
        return (
          <div key={folder} className="bg-card rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleFolder(folder)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              <FolderOpen className="w-4 h-4 text-accent shrink-0" />
              <span className={`font-display font-semibold text-sm ${isVin ? 'font-mono' : ''}`}>{folder}</span>
              <span className="text-xs text-muted-foreground ml-auto">{folderImages.length} Bild{folderImages.length !== 1 ? 'er' : ''}</span>
            </button>
            {isExpanded && (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 p-3 pt-0">
                {folderImages.map((img) => {
                  const globalIdx = images.findIndex(i => i.id === img.id);
                  return (
                    <div key={img.id} className="bg-muted rounded-lg overflow-hidden group relative cursor-pointer" onClick={() => onLightbox(globalIdx)}>
                      <div className="aspect-video">
                        <img src={getImageSrc(img)} alt={img.perspective || 'Fahrzeugbild'} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-sm font-medium text-background">Öffnen</span>
                      </div>
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
  );
}
