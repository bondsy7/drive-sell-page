import React from 'react';
import { ArrowRight } from 'lucide-react';
import { getActiveProfiles } from '@/config/vehicle-classes';
import type { ActiveVehicleClassKey } from '@/config/vehicle-class-types';
import carLine from '@/assets/class-car-line.png';
import truckLine from '@/assets/class-truck-line.png';
import motorcycleLine from '@/assets/class-motorcycle-line.png';

const CLASS_VISUAL: Record<string, { image: string; title: string; examples: string }> = {
  car: {
    image: carLine,
    title: 'PKW',
    examples: 'z. B. Limousine, Kombi, SUV, Coupé, Cabrio',
  },
  truck: {
    image: truckLine,
    title: 'LKW',
    examples: 'z. B. LKW über 7,5 t, Sattelzug',
  },
  motorcycle: {
    image: motorcycleLine,
    title: 'MOTORRAD',
    examples: 'z. B. Naked Bike, Tourer, Chopper, Roller',
  },
};

interface VehicleClassPickerProps {
  value: ActiveVehicleClassKey | null;
  onChange: (value: ActiveVehicleClassKey) => void;
}

/**
 * Schritt 1.1 – Fahrzeugart auswählen.
 * Rein datengetrieben aus der Fahrzeugklassen-Registry.
 */
const VehicleClassPicker: React.FC<VehicleClassPickerProps> = ({ value, onChange }) => {
  const profiles = getActiveProfiles();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Fahrzeugart auswählen</h2>
        <p className="text-sm text-muted-foreground">
          Die Fahrzeugart bestimmt Aufnahmen, Prüfungen und Aufbereitungslogik.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {profiles.map((p) => {
          const visual = CLASS_VISUAL[p.key] ?? {
            image: carLine,
            title: p.label,
            examples: p.description,
          };
          const active = value === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.key as ActiveVehicleClassKey)}
              className={`group flex flex-col items-center rounded-2xl border-2 border-dashed bg-card px-6 py-8 transition-all ${
                active
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-accent/60 hover:bg-muted/40'
              }`}
            >
              <img
                src={visual.image}
                alt={`${visual.title} Strichzeichnung`}
                loading="lazy"
                width={1024}
                height={640}
                className="h-32 w-full max-w-[320px] object-contain opacity-80 transition-opacity group-hover:opacity-100 sm:h-40"
              />
              <div className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
                {visual.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{visual.examples}</p>
              <span
                className={`mt-5 flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                  active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground group-hover:border-accent/60 group-hover:text-accent'
                }`}
              >
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default VehicleClassPicker;
