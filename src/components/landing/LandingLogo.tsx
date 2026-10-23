import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { resolveLandingLogoHeight, type LandingLogoId, type LandingLogoSizes } from '@/lib/landing-logo-size';

interface Props {
  id: LandingLogoId;
  src: string;
  alt: string;
  sizes?: LandingLogoSizes;
  editable?: boolean;
  onResize?: (id: LandingLogoId, height: number) => void;
}

export default function LandingLogo({ id, src, alt, sizes, editable = false, onResize }: Props) {
  const height = resolveLandingLogoHeight(sizes, id);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(height);
  useEffect(() => { setDraft(height); }, [height]);
  const image = <img className="lp-logo-image" src={src} alt={alt} style={{ height: editable ? draft : height }} />;
  return (
    <div className={`lp-logo${id === 'contact.dealer' ? ' lp-contact-logo' : ''}`} data-logo-id={id}>
      {editable ? (
        <Button variant="ghost" className="h-auto max-w-full p-0 rounded-none hover:bg-transparent" aria-label={`${alt} – Logogröße ändern`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
          {image}
        </Button>
      ) : image}
      {editable && open && (
        <div className="mt-3 w-40 max-w-full space-y-3 rounded-md border border-border bg-background p-3 text-foreground" onPointerDown={event => event.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 text-xs"><span>Logogröße</span><span>{draft} px</span></div>
          <Slider aria-label={`${alt} – Logogröße`} min={16} max={160} step={1} value={[draft]}
            onValueChange={values => { const next = values[0]; if (next !== undefined) setDraft(next); }}
            onValueCommit={values => { const next = values[0]; if (next !== undefined) onResize?.(id, next); }} />
        </div>
      )}
    </div>
  );
}