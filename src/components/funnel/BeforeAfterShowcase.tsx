import { ArrowRight } from 'lucide-react';
import beforeAsset from '@/assets/funnel/before.webp.asset.json';
import after1Asset from '@/assets/funnel/after1.webp.asset.json';
import after2Asset from '@/assets/funnel/after2.webp.asset.json';
import after3Asset from '@/assets/funnel/after3.webp.asset.json';
import after4Asset from '@/assets/funnel/after4.webp.asset.json';
import after5Asset from '@/assets/funnel/after5.webp.asset.json';

const AFTER_IMAGES = [after1Asset, after2Asset, after3Asset, after4Asset, after5Asset];

interface BeforeAfterShowcaseProps {
  compact?: boolean;
  className?: string;
}

export default function BeforeAfterShowcase({ compact = false, className = '' }: BeforeAfterShowcaseProps) {
  return (
    <div className={`relative grid grid-cols-2 gap-1.5 sm:gap-2 ${className}`}>
      <figure className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <img
          src={beforeAsset.url}
          alt="BMW X7 als ursprüngliches Bestandsfoto vor dem Autohaus"
          className={`w-full object-cover ${compact ? 'aspect-[4/3]' : 'aspect-[1.08]'}`}
          loading={compact ? 'lazy' : 'eager'}
        />
        <figcaption className="absolute left-2 top-2 rounded-md bg-foreground/85 px-2.5 py-1.5 text-[10px] font-semibold leading-tight text-background shadow-card sm:left-3 sm:top-3 sm:text-xs">
          Vorher<br /><span className="font-normal opacity-80">Bestandsfoto</span>
        </figcaption>
      </figure>

      <figure className="relative overflow-hidden rounded-lg border border-accent/50 bg-card shadow-elevated">
        <div className={compact ? 'aspect-[4/3]' : 'aspect-[1.08]'}>
          {AFTER_IMAGES.map((asset, index) => (
            <img
              key={asset.asset_id}
              src={asset.url}
              alt={index === 0 ? 'Dasselbe Fahrzeug als professionelles Showroom-Ergebnis' : ''}
              aria-hidden={index === 0 ? undefined : true}
              className="funnel-after-frame absolute inset-0 h-full w-full object-cover"
              style={{ animationDelay: `${index * 3.4}s` }}
              loading={index === 0 ? (compact ? 'lazy' : 'eager') : 'lazy'}
            />
          ))}
        </div>
        <figcaption className="absolute right-2 top-2 rounded-md bg-accent px-2.5 py-1.5 text-[10px] font-semibold leading-tight text-accent-foreground shadow-card sm:right-3 sm:top-3 sm:text-xs">
          Nachher<br /><span className="font-normal opacity-90">Showroom-Bild</span>
        </figcaption>
      </figure>

      <span className="absolute left-1/2 top-1/2 z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-elevated sm:h-11 sm:w-11">
        <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
      </span>
    </div>
  );
}