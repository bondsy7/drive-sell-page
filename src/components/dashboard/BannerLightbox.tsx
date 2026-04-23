import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { type BannerFile } from './types';

interface Props {
  banners: BannerFile[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onDownload: (banner: BannerFile) => void;
  onDelete: (fullPath: string, name: string) => void;
}

const BannerLightbox: React.FC<Props> = ({ banners, initialIndex, open, onClose, onDownload, onDelete }) => {
  const [index, setIndex] = useState(initialIndex);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);

  const goPrev = () => setIndex(i => (i <= 0 ? banners.length - 1 : i - 1));
  const goNext = () => setIndex(i => (i >= banners.length - 1 ? 0 : i + 1));
  const swipeHandlers = useSwipeNavigation({
    enabled: open && banners.length > 1,
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
  }, [open, banners.length, onClose]);

  const current = banners[index];
  if (!open || !current) return null;

  const download = () => {
    const a = document.createElement('a');
    a.href = current.url;
    a.download = current.name;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full h-full flex flex-col items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        {/* Top bar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <span className="text-sm text-background/70">{index + 1} / {banners.length}</span>
          <Button variant="secondary" size="sm" onClick={download} className="gap-1.5">
            <Download className="w-4 h-4" /> Download
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

        {/* Navigation */}
        {banners.length > 1 && (
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
        <img
          src={current.url}
          alt={current.name}
          className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
        {...swipeHandlers}
        />

        <p className="text-sm text-background/70 mt-3">
          {current.created_at
            ? new Date(current.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : current.name}
        </p>

        {/* Thumbnail strip */}
        {banners.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto max-w-[90vw] pb-2">
            {banners.map((b, i) => (
              <button
                key={b.name}
                onClick={() => setIndex(i)}
                className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  i === index ? 'border-accent scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={b.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onClick={e => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Banner löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieses Banner wird unwiderruflich gelöscht. Möchtest du fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(current.fullPath, current.name);
                setConfirmDelete(false);
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BannerLightbox;
