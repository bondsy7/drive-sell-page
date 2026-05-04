import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Check } from 'lucide-react';
import { useUpdateVehicle } from '@/hooks/useVehicles';
import { getImageSrc } from '@/components/dashboard/types';
import type { ProjectImage } from '@/components/dashboard/types';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  currentCover: string | null;
  images: ProjectImage[];
}

export default function CoverPickerDialog({ open, onOpenChange, vehicleId, currentCover, images }: Props) {
  const update = useUpdateVehicle();

  const pick = async (url: string | null) => {
    try {
      await update.mutateAsync({ id: vehicleId, patch: { cover_image_url: url } });
      toast.success(url ? 'Cover aktualisiert' : 'Cover entfernt');
      onOpenChange(false);
    } catch (e) {
      toast.error(`Fehler: ${(e as Error).message}`);
    }
  };

  // Only images that already have a public URL (Base64 covers would bloat the table)
  const candidates = images.filter(i => !!i.image_url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cover-Bild wählen</DialogTitle>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Noch keine generierten Bilder mit URL vorhanden.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto">
            {candidates.map(img => {
              const src = getImageSrc(img);
              const isCurrent = img.image_url === currentCover;
              return (
                <button
                  key={img.id}
                  onClick={() => pick(img.image_url!)}
                  disabled={update.isPending}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                    isCurrent ? 'border-accent ring-2 ring-accent/30' : 'border-transparent hover:border-accent/50'
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  {isCurrent && (
                    <span className="absolute top-1 right-1 bg-accent text-accent-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {currentCover && (
          <Button variant="outline" size="sm" onClick={() => pick(null)} disabled={update.isPending}>
            Cover entfernen
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
