import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, RotateCcw, Loader2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PreviewImage {
  id: string;
  src: string;
  label?: string;
  originalSrc?: string;
}

interface ImagePreviewLightboxProps {
  images: PreviewImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onRegenerate?: (id: string) => void;
  regeneratingIds?: Set<string>;
}

const ImagePreviewLightbox: React.FC<ImagePreviewLightboxProps> = ({
  images, initialIndex, open, onClose, onRegenerate, regeneratingIds,
}) => {
  const [index, setIndex] = useState(initialIndex);

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

  const isRegenerating = regeneratingIds?.has(current.id) ?? false;

  const download = () => {
    const a = document.createElement('a');
    a.href = current.src;
    a.download = `${current.label || 'bild'}.png`;
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
          {onRegenerate && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRegenerate(current.id)}
              disabled={isRegenerating}
              className="gap-1.5"
            >
              {isRegenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generiere…</>
              ) : (
                <><RotateCcw className="w-4 h-4" /> Neu generieren</>
              )}
            </Button>
          )}
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
        <div className="relative">
          <img
            src={current.src}
            alt={current.label || 'Vorschau'}
            className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
          {isRegenerating && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-sm font-medium text-foreground">Wird neu generiert…</span>
              </div>
            </div>
          )}
        </div>

        {current.label && (
          <p className="text-sm text-background/70 mt-3">{current.label}</p>
        )}

        {/* Comparison: original vs remastered */}
        {current.originalSrc && (
          <div className="flex gap-4 mt-3 items-end">
            <div className="text-center">
              <p className="text-[10px] text-background/50 mb-1">Original</p>
              <img src={current.originalSrc} alt="Original" className="w-24 h-18 object-cover rounded-lg border border-background/20" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-background/50 mb-1">Remastered</p>
              <img src={current.src} alt="Remastered" className="w-24 h-18 object-cover rounded-lg border border-accent" />
            </div>
          </div>
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
    </div>
  );
};

export default ImagePreviewLightbox;
