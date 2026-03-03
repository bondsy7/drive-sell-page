import React from 'react';
import type { ConsumptionData } from '@/types/vehicle';
import { getCO2LabelPath, isPluginHybrid } from '@/lib/co2-utils';

const CO2_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

const CLASS_COLORS: Record<string, string> = {
  A: '#00a651',
  B: '#50b848',
  C: '#bdd62e',
  D: '#fff200',
  E: '#fdb913',
  F: '#f37021',
  G: '#ed1c24',
};

const BAR_WIDTHS: Record<string, string> = {
  A: '30%',
  B: '40%',
  C: '50%',
  D: '60%',
  E: '70%',
  F: '80%',
  G: '90%',
};

interface CO2LabelSelectorProps {
  consumption: ConsumptionData;
  onClassChange: (cls: string) => void;
  onDischargedClassChange?: (cls: string) => void;
}

const CO2LabelSelector: React.FC<CO2LabelSelectorProps> = ({
  consumption,
  onClassChange,
  onDischargedClassChange,
}) => {
  const currentClass = (consumption.co2Class || 'A').toUpperCase();
  const phev = isPluginHybrid(consumption);
  const dischargedClass = (consumption.co2ClassDischarged || currentClass).toUpperCase();
  const [editingDischarged, setEditingDischarged] = React.useState(false);

  const activeClass = editingDischarged ? dischargedClass : currentClass;
  const handleSelect = (cls: string) => {
    if (editingDischarged && onDischargedClassChange) {
      onDischargedClassChange(cls);
    } else {
      onClassChange(cls);
    }
  };

  const src = getCO2LabelPath(consumption);

  return (
    <div className="w-full max-w-[320px]">
      {/* Label image preview */}
      <div className="mb-3">
        <img
          src={src}
          alt="CO₂-Effizienzlabel"
          className="w-full h-auto rounded-lg border border-border"
        />
      </div>

      {/* Class selector */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-foreground">
          {phev && editingDischarged
            ? 'CO₂-Klasse (entladene Batterie)'
            : 'CO₂-Klasse wählen'}
        </div>

        <div className="space-y-1">
          {CO2_CLASSES.map((cls) => {
            const isActive = cls === activeClass;
            return (
              <button
                key={cls}
                onClick={() => handleSelect(cls)}
                className="w-full flex items-center gap-2 group transition-all duration-150"
              >
                {/* Color bar */}
                <div
                  className="h-7 rounded-r-md flex items-center px-2.5 transition-all duration-200 relative"
                  style={{
                    width: BAR_WIDTHS[cls],
                    backgroundColor: CLASS_COLORS[cls],
                    opacity: isActive ? 1 : 0.5,
                    transform: isActive ? 'scaleX(1.02)' : 'scaleX(1)',
                  }}
                >
                  <span
                    className="text-xs font-bold leading-none"
                    style={{ color: cls === 'D' || cls === 'C' ? '#333' : '#fff' }}
                  >
                    {cls}
                  </span>
                </div>

                {/* Active indicator arrow */}
                {isActive && (
                  <div
                    className="flex items-center justify-center w-8 h-8 text-xs font-bold rounded transition-transform animate-in fade-in zoom-in-75 duration-200"
                    style={{
                      backgroundColor: '#1a1a1a',
                      color: '#fff',
                      clipPath:
                        'polygon(25% 0%, 100% 0%, 100% 100%, 25% 100%, 0% 50%)',
                    }}
                  >
                    <span className="ml-1">{cls}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* PHEV toggle */}
        {phev && onDischargedClassChange && (
          <div className="flex items-center gap-2 pt-2 border-t border-border mt-2">
            <button
              onClick={() => setEditingDischarged(false)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                !editingDischarged
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Gewichtet: {currentClass}
            </button>
            <button
              onClick={() => setEditingDischarged(true)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                editingDischarged
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Entladen: {dischargedClass}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CO2LabelSelector;
