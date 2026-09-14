import React from 'react';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
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
}

interface OptionCardProps {
  active: boolean;
  sketch?: string;
  label: string;
  description: string;
  onSelect: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({ active, sketch, label, description, onSelect }) => (
  <Button
    type="button"
    variant="outline"
    onClick={onSelect}
    className={`relative aspect-[4/3] h-auto min-w-0 whitespace-normal rounded-lg p-2 text-center shadow-none transition-colors ${
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
    <span className="flex min-w-0 flex-col items-center justify-center gap-1">
      {sketch && <TruckSketch id={sketch} className="h-10 w-full max-w-24 shrink-0 text-foreground/70 sm:h-12" />}
      <span className="line-clamp-2 w-full break-words text-[10px] font-semibold leading-tight text-foreground sm:text-[11px]">
        {label}
      </span>
      <span className="line-clamp-2 w-full break-words text-[9px] font-normal leading-tight text-muted-foreground sm:text-[10px]">
        {description}
      </span>
    </span>
  </Button>
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
      subjectScope: resolveSubjectScope(
        'truckConfiguration' in next ? next.truckConfiguration : selection.truckConfiguration
      ),
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
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TRUCK_CONFIGURATIONS.map((o) => (
            <OptionCard
              key={o.key}
              active={selection.truckConfiguration === o.key}
              sketch={o.sketch}
              label={o.label}
              description={o.description}
              onSelect={() =>
                emit(
                  selection.truckConfiguration === o.key
                    ? { truckConfiguration: null, truckBodyType: null, cargoState: null }
                    : { truckConfiguration: o.key, truckBodyType: null, cargoState: null }
                )
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TRUCK_BODY_TYPES.map((o) => (
              <OptionCard
                key={o.key}
                active={selection.truckBodyType === o.key}
                sketch={o.sketch}
                label={o.label}
                description={o.description}
                onSelect={() =>
                  emit(
                    selection.truckBodyType === o.key
                      ? { truckBodyType: null, cargoState: null }
                      : { truckBodyType: o.key, cargoState: null }
                  )
                }
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CARGO_STATES.map((o) => (
              <OptionCard
                key={o.key}
                active={selection.cargoState === o.key}
                sketch={`cargo_${o.key}`}
                label={o.label}
                description={o.description}
                onSelect={() =>
                  emit({ cargoState: selection.cargoState === o.key ? null : o.key })
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default TruckWizard;
