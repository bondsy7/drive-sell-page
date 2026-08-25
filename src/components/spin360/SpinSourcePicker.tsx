import React, { useMemo, useState } from 'react';
import { Check, ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useVehicleAssets, type VehicleAsset } from '@/hooks/useVehicleAssets';

/** Mindestanzahl echter Quellwinkel für den 48-Frame-Produktionslauf. */
export const MIN_REQUIRED_ANGLES = 4;

/** Sonderslot: bindende Felgenreferenz (kein Turntable-Winkel). */
export const WHEEL_REFERENCE_ANGLE = -1;

/** Winkelkonvention: 0 = Front, 90 = linke Seite, 180 = Heck, 270 = rechte Seite. */
export const SPIN_ANGLE_SLOTS: { angle: number; label: string; hint: string; required?: boolean }[] = [
  { angle: 0, label: 'Front', hint: 'Direkte Frontansicht', required: true },
  { angle: 45, label: '3/4 vorne links', hint: 'Schräg von vorne links (optional, erhöht die Qualität)' },
  { angle: 90, label: 'Seite links', hint: 'Komplette linke Seite', required: true },
  { angle: 135, label: '3/4 hinten links', hint: 'Schräg von hinten links (optional, erhöht die Qualität)' },
  { angle: 180, label: 'Heck', hint: 'Direkte Heckansicht', required: true },
  { angle: 225, label: '3/4 hinten rechts', hint: 'Schräg von hinten rechts (optional, erhöht die Qualität)' },
  { angle: 270, label: 'Seite rechts', hint: 'Komplette rechte Seite', required: true },
  { angle: 315, label: '3/4 vorne rechts', hint: 'Schräg von vorne rechts' },
  { angle: WHEEL_REFERENCE_ANGLE, label: 'Felgenreferenz', hint: 'Nahaufnahme der Felge (bindend)' },
];

/** Abdeckungsbewertung: wie identitätstreu wird der Spin voraussichtlich? */
export function evaluateCoverage(angles: number[]): { score: number; label: string; tone: string } {
  const real = angles.filter((a) => a >= 0);
  const has = (a: number) => real.includes(a);
  let score = Math.round((real.length / 8) * 100);
  if (has(0) && has(180)) score += 5;
  if (has(90) && has(270)) score += 5;
  score = Math.min(100, score);
  if (score >= 85) return { score, label: 'Sehr hohe Identitätstreue', tone: 'text-green-600' };
  if (score >= 55) return { score, label: 'Gute Identitätstreue', tone: 'text-accent' };
  if (score >= 30) return { score, label: 'Eingeschränkte Identitätstreue', tone: 'text-amber-600' };
  return { score, label: 'Sehr wenig Quellmaterial', tone: 'text-destructive' };
}


export interface SpinSourceSelection {
  angle: number;
  url: string;
  assetKind: string;
  assetId?: string;
  storagePath?: string;
}

interface Props {
  vehicleId: string;
  onConfirm: (selection: SpinSourceSelection[]) => void;
  onSwitchToUpload: () => void;
  disabled?: boolean;
}

const SpinSourcePicker: React.FC<Props> = ({ vehicleId, onConfirm, onSwitchToUpload, disabled }) => {
  const { data: bundle, isLoading } = useVehicleAssets(vehicleId);
  const [activeAngle, setActiveAngle] = useState<number>(0);
  const [selection, setSelection] = useState<Record<number, SpinSourceSelection>>({});

  const assets: VehicleAsset[] = useMemo(() => {
    if (!bundle) return [];
    // Identitätswahrheit: NUR echte Fotos. Bereits generierte Spin-Frames
    // dürfen niemals als Quelle zurückgespielt werden (Drift-Verstärkung).
    return [...bundle.original, ...bundle.gallery];
  }, [bundle]);

  const usedUrls = useMemo(
    () => new Set(Object.values(selection).map((s) => s.url)),
    [selection],
  );

  const chosenAngles = Object.values(selection).map((s) => s.angle);
  const chosenCount = chosenAngles.filter((a) => a >= 0).length;
  const hasRequired = SPIN_ANGLE_SLOTS.filter((s) => s.required).every((s) => !!selection[s.angle]);
  const coverage = evaluateCoverage(chosenAngles);

  const pick = (asset: VehicleAsset) => {
    const isWheel = activeAngle === WHEEL_REFERENCE_ANGLE;
    setSelection((prev) => ({
      ...prev,
      [activeAngle]: {
        angle: activeAngle,
        url: asset.url,
        assetKind: isWheel ? 'wheel_reference' : asset.kind,
        assetId: asset.id,
        storagePath: asset.storagePath,
      },
    }));
    const next = SPIN_ANGLE_SLOTS.find((s) => !selection[s.angle] && s.angle !== activeAngle && s.angle >= 0);
    if (next) setActiveAngle(next.angle);
  };


  const clear = (angle: number) => {
    setSelection((prev) => {
      const copy = { ...prev };
      delete copy[angle];
      return copy;
    });
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <h3 className="font-display font-semibold text-foreground">Vorhandene Fahrzeugbilder verwenden</h3>
        <p className="text-xs text-muted-foreground max-w-lg mx-auto">
          Ordne den Perspektiven deine bereits vorhandenen Fotos zu. Pflicht sind die vier Kardinalansichten
          Front (0°), Seite links (90°), Heck (180°) und Seite rechts (270°). Die vier Diagonalen sind optional
          und erhöhen die Identitätstreue. Es können nur Originale und Galeriebilder gewählt werden –
          bereits generierte Spin-Frames sind als Quelle ausgeschlossen.
        </p>
      </div>

      {/* Winkel-Slots */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SPIN_ANGLE_SLOTS.map((slot) => {
          const chosen = selection[slot.angle];
          const isActive = activeAngle === slot.angle;
          return (
            <button
              key={slot.angle}
              type="button"
              disabled={disabled}
              onClick={() => setActiveAngle(slot.angle)}
              className={cn(
                'relative rounded-xl border p-2 text-left transition-colors',
                isActive ? 'border-accent ring-1 ring-accent bg-accent/5' : 'border-border bg-card hover:border-accent/50',
              )}
            >
              <div className="aspect-video rounded-lg bg-muted overflow-hidden flex items-center justify-center mb-1.5">
                {chosen ? (
                  <img src={chosen.url} alt={slot.label} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                )}
              </div>
              <p className="text-[11px] font-semibold text-foreground leading-tight">
                {slot.label}
                {slot.required && <span className="text-accent"> *</span>}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {slot.angle >= 0 ? `${slot.angle}°` : 'optional, bindend'}
              </p>

              {chosen && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); clear(slot.angle); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); clear(slot.angle); } }}
                  className="absolute top-1 right-1 bg-background/90 rounded-full p-1 border border-border"
                >
                  <X className="w-3 h-3 text-destructive" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Asset-Auswahl */}
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs font-medium text-foreground mb-2">
          Bild für <span className="text-accent">{SPIN_ANGLE_SLOTS.find((s) => s.angle === activeAngle)?.label}</span> wählen
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Fahrzeugbilder werden geladen…
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">Für dieses Fahrzeug sind noch keine Bilder gespeichert.</p>
            <Button variant="outline" size="sm" onClick={onSwitchToUpload}>
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Fotos hochladen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 max-h-72 overflow-auto">
            {assets.map((asset) => {
              const used = usedUrls.has(asset.url);
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(asset)}
                  className={cn(
                    'relative aspect-video rounded-lg overflow-hidden border transition-all',
                    used ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent/60',
                  )}
                >
                  <img src={asset.url} alt={asset.label || asset.kind} className="w-full h-full object-cover" loading="lazy" />
                  {used && (
                    <span className="absolute top-1 right-1 bg-accent text-accent-foreground rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-foreground/60 text-[9px] text-background px-1 py-0.5 truncate">
                    {asset.kind === 'original' ? 'Original' : 'Galerie'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Abdeckungs-Score */}
      <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-foreground">Winkelabdeckung</span>
          <span className={cn('font-semibold', coverage.tone)}>{coverage.score}% · {coverage.label}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${coverage.score}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Vier Kardinalwinkel sind Pflicht. Je mehr der 8 Winkel belegt sind, desto weniger muss die KI erfinden.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button variant="ghost" size="sm" onClick={onSwitchToUpload} disabled={disabled}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Stattdessen neue Fotos hochladen
        </Button>
        <Button
          disabled={disabled || !hasRequired || chosenCount < MIN_REQUIRED_ANGLES}
          onClick={() => onConfirm(Object.values(selection).sort((a, b) => a.angle - b.angle))}
        >
          {chosenCount} Perspektive{chosenCount === 1 ? '' : 'n'} übernehmen
        </Button>
      </div>
      {(!hasRequired || chosenCount < MIN_REQUIRED_ANGLES) && (
        <p className="text-center text-[11px] text-muted-foreground">
          Erforderlich sind die vier Kardinalansichten: Front (0°), Seite links (90°), Heck (180°) und Seite rechts (270°).
        </p>
      )}

    </div>
  );
};

export default SpinSourcePicker;
