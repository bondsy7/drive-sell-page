import React from 'react';
import { Check } from 'lucide-react';
import { getActiveProfiles } from '@/config/vehicle-classes';
import type { ActiveVehicleClassKey } from '@/config/vehicle-class-types';
import carAsset from '@/assets/vehicle-classes/car.png.asset.json';
import truckAsset from '@/assets/vehicle-classes/truck.png.asset.json';
import motorcycleAsset from '@/assets/vehicle-classes/motorcycle.png.asset.json';

const CLASS_VISUAL: Record<string, { image: string; title: string; examples: string }> = {
  car: { image: carAsset.url, title: 'PKW', examples: 'Limousine, Kombi, SUV, Coupé' },
  truck: { image: truckAsset.url, title: 'LKW', examples: 'über 7,5 t, Sattelzug' },
  motorcycle: { image: motorcycleAsset.url, title: 'Motorrad', examples: 'Naked Bike, Tourer, Chopper' },
};

interface VehicleClassStripProps {
  value: ActiveVehicleClassKey | null;
  onChange: (value: ActiveVehicleClassKey) => void;
  disabled?: boolean;
}

/**
 * Kompakte Fahrzeugart-Auswahl für die Ein-Seiten-Aufnahme.
 * Datengetrieben aus der Fahrzeugklassen-Registry – keine neuen Klassen.
 */
const VehicleClassStrip: React.FC<VehicleClassStripProps> = ({ value, onChange, disabled }) => {
  const profiles = getActiveProfiles();

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {profiles.map((p) => {
        const visual = CLASS_VISUAL[p.key] ?? { image: carAsset.url, title: p.label, examples: p.description };
        const active = value === p.key;
        return (
          <button
            key={p.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p.key as ActiveVehicleClassKey)}
            className={`relative flex w-full min-w-0 items-center gap-3 rounded-lg border bg-card p-2.5 text-left transition-colors sm:flex-col sm:items-start sm:gap-1.5 ${
              active ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/60 hover:bg-muted/40'
            } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          >
            <span className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/40 sm:h-24 sm:w-full">
              <img
                src={visual.image}
                alt={visual.title}
                loading="lazy"
                className="h-full w-full object-contain p-1.5"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{visual.title}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{visual.examples}</span>
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
