import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface FunnelImageLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  title: string;
}

/** Vollständige Bildansicht ohne Beschnitt (object-contain). Fokus, Escape und Fokus-Rückgabe übernimmt der Dialog. */
export default function FunnelImageLightbox({ open, onOpenChange, src, alt, title }: FunnelImageLightboxProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-6xl gap-3 border-border bg-card p-3 sm:p-4">
        <DialogTitle className="pr-8 text-sm font-semibold">{title}</DialogTitle>
        <DialogDescription className="sr-only">Vollständige Ansicht des Fahrzeugbildes</DialogDescription>
        <div className="flex max-h-[80vh] items-center justify-center overflow-auto rounded-md bg-secondary">
          <img src={src} alt={alt} className="max-h-[80vh] w-full object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
