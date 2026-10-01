import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePlaceholderProps {
  label: string;
  ratio?: string;
  className?: string;
}

/** Austauschbarer Bildplatzhalter – wird durch echte App-Ergebnisse ersetzt. */
export default function ImagePlaceholder({ label, ratio = '16/10', className }: ImagePlaceholderProps) {
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
