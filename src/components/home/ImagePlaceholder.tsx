import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePlaceholderProps {
  label: string;
  ratio?: string;
  className?: string;
  /** Echte Bild-URL. Ist sie gesetzt, wird das Bild statt des Platzhalters gezeigt. */
  src?: string;
  /** Alternativtext für echte Bilder (sonst wird label verwendet). */
  alt?: string;
  /** Position des Bildausschnitts, z. B. 'center 62%'. */
  objectPosition?: string;
}

/** Bildplatzhalter – wird durch echte App-Ergebnisse ersetzt, sobald src gesetzt ist. */
export default function ImagePlaceholder({ label, ratio = '16/10', className, src, alt, objectPosition }: ImagePlaceholderProps) {
  if (src) {
    return (
      <div
        className={cn('overflow-hidden rounded-lg border border-border bg-secondary/70', className)}
        style={{ aspectRatio: ratio }}
      >
        <img
          src={src}
          alt={alt ?? label}
          loading="lazy"
          className="h-full w-full object-cover"
          style={objectPosition ? { objectPosition } : undefined}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed border-border bg-secondary/70 p-3 text-center text-muted-foreground',
        className,
      )}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={`Platzhalter: ${label}`}
    >
      <ImageIcon className="h-5 w-5 opacity-60" />
      <span className="text-xs font-medium leading-tight">{label}</span>
      <span className="text-[10px] opacity-70">Platzhalter · {ratio.replace('/', ':')}</span>
    </div>
  );
}
