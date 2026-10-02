import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AI_DISCLOSURE_OVERLAY_CLASS,
  getAiDisclosureLabelAlt,
  getAiDisclosureLabelVector,
  getAiDisclosureText,
  type AiDisclosureContext,
} from '@/lib/ai-disclosure';

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
  /** KI-pflichtiges Bild: setzt das zentrale Kennzeichnungs-Overlay oben rechts. */
  aiContext?: AiDisclosureContext;
}

/** Bildplatzhalter – wird durch echte App-Ergebnisse ersetzt, sobald src gesetzt ist. */
export default function ImagePlaceholder({
  label,
  ratio = '16/10',
  className,
  src,
  alt,
  objectPosition,
  aiContext,
}: ImagePlaceholderProps) {
  if (src) {
    return (
      <div
        className={cn('relative overflow-hidden rounded-lg border border-border bg-secondary/70', className)}
        style={{ aspectRatio: ratio }}
      >
        <img
          src={src}
          alt={alt ?? label}
          loading="lazy"
          className="h-full w-full object-cover"
          style={objectPosition ? { objectPosition } : undefined}
        />
        {aiContext ? (
          <img
            src={getAiDisclosureLabelAsset(aiContext)}
            alt={getAiDisclosureLabelAlt(aiContext)}
            title={getAiDisclosureText(aiContext)}
            className="pointer-events-none absolute right-2 top-2 h-[0.9rem] w-auto sm:right-3 sm:top-3 sm:h-[1.125rem]"
          />
        ) : null}
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
