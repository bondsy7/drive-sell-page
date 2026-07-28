import React from 'react';
import { Card } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { getActiveProfiles } from '@/config/vehicle-classes';
import type { ActiveVehicleClassKey } from '@/config/vehicle-class-types';
import { TruckSketch } from './TruckSketch';

const CLASS_SKETCH: Record<string, string> = {
  car: 'cab_34_front_left',
  truck: 'semi_truck',
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
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Fahrzeugart auswählen</h2>
        <p className="text-sm text-muted-foreground">
          Die Fahrzeugart bestimmt Aufnahmen, Prüfungen und Aufbereitungslogik.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {profiles.map((p) => {
          const active = value === p.key;
          return (
            <Card
              key={p.key}
              role="button"
              tabIndex={0}
              onClick={() => onChange(p.key as ActiveVehicleClassKey)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(p.key as ActiveVehicleClassKey);
                }
              }}
              className={`relative cursor-pointer p-4 transition-all ${
                active
                  ? 'border-accent ring-2 ring-accent/40 bg-accent/5'
                  : 'hover:border-accent/50'
              }`}
            >
              {active && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-accent">
                  <Check className="h-3 w-3 text-accent-foreground" />
                </span>
              )}
              <TruckSketch
                id={CLASS_SKETCH[p.key]}
                className="mb-3 h-14 w-full text-foreground/70"
              />
              <div className="text-sm font-semibold text-foreground">{p.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default VehicleClassPicker;
