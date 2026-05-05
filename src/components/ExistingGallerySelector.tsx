import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  images: { url: string; perspective?: string | null; folder?: string | null }[];
  onCancel: () => void;
  onConfirm: (selected: string[]) => void;
}

const ExistingGallerySelector: React.FC<Props> = ({ open, images, onCancel, onConfirm }) => {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(images.map(i => i.url)));

  // Reset when images change
  React.useEffect(() => {
    setSelected(new Set(images.map(i => i.url)));
  }, [images]);

  const toggle = (url: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(url)) n.delete(url); else n.add(url);
      return n;
    });
  };

  const allOn = selected.size === images.length;
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(images.map(i => i.url)));

  // Group by folder for clarity
  const groups = images.reduce<Record<string, typeof images>>((acc, img) => {
    const f = img.folder || 'Galerie';
    (acc[f] ||= []).push(img);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vorhandene Bilder verwenden</DialogTitle>
          <DialogDescription>
            Wähle die Bilder aus deiner Galerie aus, die für die Landing Page verwendet werden sollen. Das erste ausgewählte Bild wird das Hauptbild.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-muted-foreground">
            {selected.size} von {images.length} ausgewählt
          </p>
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allOn ? 'Alle abwählen' : 'Alle auswählen'}
          </Button>
        </div>

        <div className="space-y-6">
          {Object.entries(groups).map(([folder, imgs]) => (
            <div key={folder}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{folder}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {imgs.map((img) => {
                  const isSel = selected.has(img.url);
                  return (
                    <button
                      key={img.url}
                      type="button"
                      onClick={() => toggle(img.url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isSel ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <img src={img.url} alt={img.perspective || ''} className="w-full h-full object-cover" loading="lazy" />
                      {isSel && (
                        <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {img.perspective && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <p className="text-[10px] text-white truncate">{img.perspective}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />Abbrechen
          </Button>
          <Button
            onClick={() => onConfirm(Array.from(selected))}
            disabled={selected.size === 0}
          >
            <Check className="w-4 h-4 mr-1" />
            {selected.size} Bild{selected.size === 1 ? '' : 'er'} übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExistingGallerySelector;
