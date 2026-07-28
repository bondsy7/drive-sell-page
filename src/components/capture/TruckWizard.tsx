import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ChevronLeft } from 'lucide-react';
import {
  CARGO_STATES,
  TRUCK_BODY_TYPES,
  TRUCK_CONFIGURATIONS,
  getTruckConfiguration,
  needsBodyTypeStep,
  needsCargoStep,
  resolveSubjectScope,
} from '@/config/truck-workflow';
import type {
  CargoStateKey,
  TruckBodyTypeKey,
  TruckConfigurationKey,
  TruckWorkflowSelection,
} from '@/config/vehicle-class-types';
import { TruckSketch } from './TruckSketch';

interface TruckWizardProps {
  selection: Partial<TruckWorkflowSelection>;
  onChange: (selection: Partial<TruckWorkflowSelection>) => void;
  /** Wird aufgerufen, sobald alle nötigen Schritte beantwortet sind. */
  onComplete: (selection: TruckWorkflowSelection) => void;
  onBack?: () => void;
}

interface OptionCardProps {
  active: boolean;
  sketch?: string;
  label: string;
  description: string;
  onSelect: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({ active, sketch, label, description, onSelect }) => (
  <Card
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    }}
    className={`relative cursor-pointer rounded-2xl border-2 border-dashed px-5 py-6 text-center shadow-none transition-all ${
      active
        ? 'border-accent border-solid bg-accent/5'
        : 'border-border bg-muted/20 hover:border-accent/60 hover:bg-muted/40'
    }`}
  >
    {active && (
      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent">
        <Check className="h-3.5 w-3.5 text-accent-foreground" />
      </span>
    )}
    {sketch && <TruckSketch id={sketch} className="mx-auto mb-5 h-20 w-full max-w-[260px] text-foreground/70" />}
    <div className="text-base font-semibold text-foreground">{label}</div>
    <div className="mt-1 text-sm text-muted-foreground">{description}</div>
  </Card>
);


/**
 * Lkw-Schritte 1–3: Konfiguration → Aufbau-/Anhängerart → Ladebereich.
 * Nicht zutreffende Schritte werden automatisch übersprungen.
 */
const TruckWizard: React.FC<TruckWizardProps> = ({ selection, onChange, onComplete, onBack }) => {
  const cfg = getTruckConfiguration(selection.truckConfiguration);
  const showBodyStep = needsBodyTypeStep(selection.truckConfiguration);
  const showCargoStep = needsCargoStep(selection);

  const emit = (next: Partial<TruckWorkflowSelection>) => {
    const merged: Partial<TruckWorkflowSelection> = {
      ...selection,
      ...next,
      subjectScope: resolveSubjectScope(next.truckConfiguration ?? selection.truckConfiguration),
    };
    onChange(merged);

    const cfgNext = getTruckConfiguration(merged.truckConfiguration);
    if (!cfgNext) return;
    const bodyNeeded = needsBodyTypeStep(merged.truckConfiguration);
    if (bodyNeeded && !merged.truckBodyType) return;
    const cargoNeeded = needsCargoStep(merged);
    if (cargoNeeded && !merged.cargoState) return;

    onComplete({
      truckConfiguration: merged.truckConfiguration as TruckConfigurationKey,
      truckBodyType: bodyNeeded ? (merged.truckBodyType as TruckBodyTypeKey) : null,
      cargoState: cargoNeeded ? (merged.cargoState as CargoStateKey) : 'not_applicable',
      subjectScope: merged.subjectScope ?? null,
    });
  };

  return (
    <div className="space-y-8">
      {onBack && (
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Fahrzeugart ändern
        </Button>
      )}

      {/* Schritt 1 */}
      <section className="space-y-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            Schritt 1
          </span>
          <h2 className="text-lg font-semibold text-foreground">Konfiguration auswählen</h2>
          <p className="text-sm text-muted-foreground">
            Welche Einheiten gehören zum Fahrzeug? Diese Angabe legt verbindlich fest, was später
            im Bild zu sehen sein muss.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRUCK_CONFIGURATIONS.map((o) => (
            <OptionCard
              key={o.key}
              active={selection.truckConfiguration === o.key}
              sketch={o.sketch}
              label={o.label}
              description={o.description}
              onSelect={() =>
                emit({
                  truckConfiguration: o.key,
                  truckBodyType: null,
                  cargoState: null,
                })
              }
            />
          ))}
        </div>
      </section>

      {/* Schritt 2 */}
      {cfg && showBodyStep && (
        <section className="space-y-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Schritt 2
            </span>
            <h2 className="text-lg font-semibold text-foreground">Aufbau- oder Anhängerart</h2>
            <p className="text-sm text-muted-foreground">
              Bestimmt, welche Bauteile erhalten bleiben müssen und niemals umgedeutet werden
              dürfen.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUCK_BODY_TYPES.map((o) => (
              <OptionCard
                key={o.key}
                active={selection.truckBodyType === o.key}
                sketch={o.sketch}
                label={o.label}
                description={o.description}
                onSelect={() => emit({ truckBodyType: o.key, cargoState: null })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Schritt 3 */}
      {cfg && showCargoStep && (
        <section className="space-y-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              Schritt 3
            </span>
            <h2 className="text-lg font-semibold text-foreground">Ladebereich prüfen</h2>
            <p className="text-sm text-muted-foreground">
              Ein nicht einsehbarer Ladebereich wird niemals erfunden oder generiert.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CARGO_STATES.map((o) => (
              <OptionCard
                key={o.key}
                active={selection.cargoState === o.key}
                sketch={`cargo_${o.key}`}
                label={o.label}
                description={o.description}
                onSelect={() => emit({ cargoState: o.key })}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default TruckWizard;
