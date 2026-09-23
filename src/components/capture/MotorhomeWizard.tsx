import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { MOTORHOME_BODY_TYPES } from '@/config/motorhome-workflow';
import type { MotorhomeBodyTypeKey } from '@/config/vehicle-class-types';

interface MotorhomeWizardProps {
  value: MotorhomeBodyTypeKey | null;
  onSelect: (bodyType: MotorhomeBodyTypeKey) => void;
}

/**
 * Reisemobil-Schritt 1: Aufbautyp.
 * Bestimmt Aufnahme-Slots (Wohnwagen ohne Cockpit) und die Prompt-Regeln.
 * Vollständig getrennt vom Lkw-Wizard.
 */
const MotorhomeWizard: React.FC<MotorhomeWizardProps> = ({ value, onSelect }) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {MOTORHOME_BODY_TYPES.map((o) => {
      const active = value === o.key;
      return (
        <Button
          key={o.key}
          type="button"
          variant="outline"
          onClick={() => onSelect(o.key)}
          className={`relative h-auto min-h-[152px] min-w-0 whitespace-normal rounded-lg p-2 text-center shadow-none transition-colors sm:min-h-[190px] ${
            active
              ? 'border-accent bg-accent/5 ring-1 ring-accent'
              : 'border-border bg-card hover:border-accent/60 hover:bg-muted/30'
          }`}
        >
          {active && (
            <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
              <Check className="h-3 w-3 text-accent-foreground" />
            </span>
          )}
          <span className="flex min-w-0 flex-col items-center justify-center gap-1.5">
            <img
              src={o.image}
              alt={o.label}
              className="h-20 w-full object-contain sm:h-28"
              loading="lazy"
            />
            <span className="line-clamp-2 w-full break-words text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
              {o.label}
            </span>
            <span className="line-clamp-3 w-full break-words text-[9px] font-normal leading-tight text-muted-foreground sm:text-[10px]">
              {o.description}
            </span>
          </span>
        </Button>
      );
    })}
  </div>
);

export default MotorhomeWizard;
