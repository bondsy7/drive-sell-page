import { useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CAR_CAPTURE_SLOTS } from '@/config/profiles/car-profile';

// 3/4 Heck rechts kommt jetzt direkt aus CAR_CAPTURE_SLOTS (gespiegeltes Icon).
const perspectives = CAR_CAPTURE_SLOTS.filter(slot => !slot.isVin)
  .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99));

interface BackgroundSwapUploadGridProps {
  images: { id: string; slotKey: string; originalBase64: string }[];
  disabled: boolean;
  uploadingSlot: string | null;
  onUpload: (slotKey: string, file: File) => Promise<void>;
  onRemove: (id: string) => void;
}

export default function BackgroundSwapUploadGrid({
  images, disabled, uploadingSlot, onUpload, onRemove,
}: BackgroundSwapUploadGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedSlot = useRef<string | null>(null);

  return (
    <section className="space-y-3" aria-label="Original-Fahrzeugfotos">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Original-Fahrzeugfotos</h3>
        <span className="text-xs text-muted-foreground">{images.length} Fotos · max. 12 MB pro Bild</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Perspektiv-Foto auswählen"
        className="hidden"
        onChange={async event => {
          const file = event.target.files?.[0];
          const slotKey = selectedSlot.current;
          event.target.value = '';
          if (file && slotKey) await onUpload(slotKey, file);
        }}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {perspectives.map(slot => {
          const image = images.find(item => item.slotKey === slot.key);
          const uploading = uploadingSlot === slot.key;
          return (
            <div key={slot.key} className="relative min-w-0">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || uploadingSlot !== null}
                aria-label={`${image ? 'Ändern' : 'Hochladen'}: ${slot.label}`}
                onClick={() => {
                  selectedSlot.current = slot.key;
                  inputRef.current?.click();
                }}
                className="flex h-auto w-full flex-col gap-0 overflow-hidden rounded-lg border-dashed p-0 text-foreground hover:border-solid hover:border-input hover:bg-background hover:text-foreground"
              >
                <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-muted/30">
                  <img
                    src={image?.originalBase64 ?? slot.icon}
                    alt={slot.label}
                    className={image
                      ? 'h-full w-full object-contain'
                      : `h-16 w-[88%] object-contain ${slot.iconFlip ? '-scale-x-100' : ''}`}
                  />
                  {uploading && <Loader2 className="absolute h-6 w-6 animate-spin text-accent" />}
                </div>
                <div className="flex min-h-16 w-full flex-col items-start justify-center gap-1 whitespace-normal px-3 py-2 text-left">
                  <span className="text-xs font-semibold">{slot.label}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    {image ? 'Original gespeichert' : <><Upload className="h-3 w-3" /> Optional</>}
                  </span>
                </div>
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={disabled || uploadingSlot !== null}
                  aria-label={`Entfernen: ${slot.label}`}
                  title={`Entfernen: ${slot.label}`}
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={() => onRemove(image.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}