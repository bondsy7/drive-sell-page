import React from 'react';
import { Check } from 'lucide-react';

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

/**
 * Kompakte Karten-Auswahl als Ersatz für Dropdowns (z. B. Nummernschild).
 */
const OptionCards: React.FC<OptionCardsProps> = ({ options, value, onChange, columns = 'grid-cols-2 sm:grid-cols-4' }) => (
  <div className={`grid gap-2 ${columns}`}>
    {options.map((opt) => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`relative rounded-lg border px-3 py-2.5 text-left transition-colors ${
            active ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-accent/60 hover:bg-muted/40'
          }`}
        >
          <span className="block pr-5 text-xs font-semibold leading-tight text-foreground">{opt.label}</span>
          {opt.hint && <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{opt.hint}</span>}
          {active && (
            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Check className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default OptionCards;
