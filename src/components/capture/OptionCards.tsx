import React from 'react';
import { Check } from 'lucide-react';
import keepPlateAsset from '@/assets/license-plates/behalten.webp.asset.json';
import removePlateAsset from '@/assets/license-plates/entfernen.webp.asset.json';
import neutralPlateAsset from '@/assets/license-plates/neutralisieren.webp.asset.json';
import customPlateAsset from '@/assets/license-plates/eigenes.webp.asset.json';

export interface CardOption {
  value: string;
  label: string;
  hint?: string;
}

interface OptionCardsProps {
  options: readonly CardOption[];
  value?: string | null;
  onChange: (value: string) => void;
  columns?: string;
}

const PLATE_PREVIEWS: Record<string, string> = {
  keep: keepPlateAsset.url,
  remove: removePlateAsset.url,
  blur: neutralPlateAsset.url,
  custom: customPlateAsset.url,
};

/**
 * Kompakte Karten-Auswahl als Ersatz für Dropdowns (z. B. Nummernschild).
 */
const OptionCards: React.FC<OptionCardsProps> = ({ options, value, onChange, columns = 'grid-cols-4' }) => (
  <div className={`grid gap-1.5 ${columns}`}>
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative min-w-0 overflow-hidden rounded-lg border p-1.5 text-center transition-colors ${
            active ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/60 hover:bg-muted/40'
          }`}
        >
          <span className="block truncate text-[9px] font-semibold leading-tight text-foreground sm:text-[10px]">{opt.label}</span>
          {PLATE_PREVIEWS[opt.value] && (
            <span className="mt-1 flex h-8 w-full items-center justify-center overflow-hidden rounded bg-muted/30">
              <img src={PLATE_PREVIEWS[opt.value]} alt="" className="h-full w-full object-contain" />
            </span>
          )}
          {active && (
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default OptionCards;
