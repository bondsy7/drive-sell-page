import React from 'react';
import { Check } from 'lucide-react';
import { getActiveProfiles } from '@/config/vehicle-classes';
import type { ActiveVehicleClassKey } from '@/config/vehicle-class-types';
import carLine from '@/assets/class-car-line.png';
import truckLine from '@/assets/class-truck-line.png';
import motorcycleLine from '@/assets/class-motorcycle-line.png';

const CLASS_VISUAL: Record<string, { image: string; title: string; examples: string }> = {
  car: { image: carLine, title: 'PKW', examples: 'Limousine, Kombi, SUV, Coupé' },
  truck: { image: truckLine, title: 'LKW', examples: 'über 7,5 t, Sattelzug' },
  motorcycle: { image: motorcycleLine, title: 'Motorrad', examples: 'Naked Bike, Tourer, Chopper' },
};

interface VehicleClassStripProps {
  value: ActiveVehicleClassKey | null;
  onChange: (value: ActiveVehicleClassKey) => void;
  disabled?: boolean;
}

/**
 * Kompakte, horizontale Fahrzeugart-Auswahl für die Ein-Seiten-Aufnahme.
 * Datengetrieben aus der Fahrzeugklassen-Registry – keine neuen Klassen.
 */
const VehicleClassStrip: React.FC<VehicleClassStripProps> = ({ value, onChange, disabled }) => {
  const profiles = getActiveProfiles();

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
      {profiles.map((p) => {
        const visual = CLASS_VISUAL[p.key] ?? { image: carLine, title: p.label, examples: p.description };
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.key as ActiveVehicleClassKey)}
            className={`relative flex min-w-[170px] flex-1 items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors ${
              active ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-muted/40'
            } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <img
              src={visual.image}
              alt={`${visual.title} Strichzeichnung`}
              loading="lazy"
              className="h-10 w-16 shrink-0 object-contain opacity-80"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{visual.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{visual.examples}</span>
            </span>
            {active && (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Check className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default VehicleClassStrip;
