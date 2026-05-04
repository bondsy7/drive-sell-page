import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export interface LightboxItem {
  src: string;
  label?: string;
  filename?: string;
}

interface Props {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

const OneShotLightbox: React.FC<Props> = ({ items, index, onClose, onIndexChange }) => {
  const current = items[index];

  const next = useCallback(() => {
    if (items.length <= 1) return;
    onIndexChange((index + 1) % items.length);
  }, [index, items.length, onIndexChange]);

  const prev = useCallback(() => {
    if (items.length <= 1) return;
    onIndexChange((index - 1 + items.length) % items.length);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, next, prev]);

  if (!current) return null;

  const download = () => {
    const a = document.createElement('a');
    a.href = current.src;
    a.download = current.filename || 'image.png';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 text-white/90">
        <div className="text-sm font-medium truncate max-w-[60%]">
          {current.label}
          {items.length > 1 && (
            <span className="ml-2 text-white/60 text-xs">{index + 1} / {items.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); download(); }}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2"
            title="Herunterladen"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="rounded-full bg-white/10 hover:bg-white/20 p-2"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Prev / Next */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-3 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Image */}
      <img
        src={current.src}
        alt={current.label || 'Vorschau'}
        className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default OneShotLightbox;
