import React from 'react';
import { Check, ImageOff, Upload } from 'lucide-react';

export interface SceneTileOption {
  value: string;
  label: string;
  preview?: string;
  group: 'none' | 'indoor' | 'outdoor';
}

interface SceneGalleryProps {
  options: readonly SceneTileOption[];
  value?: string | null;
  onChange: (value: string) => void;
}

const GROUP_TITLES: Record<string, string> = {
  none: 'Ohne Änderung',
  indoor: 'Innen',
  outdoor: 'Außen',
};

const Tile: React.FC<{ opt: SceneTileOption; active: boolean; onSelect: () => void }> = ({ opt, active, onSelect }) => {
  const [short, sub] = opt.label.split('–').map((s) => s.trim());
  return (
    <button
      type="button"
      onClick={onSelect}
      title={opt.label}
      className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
        active ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-accent/60'
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-muted">
        {opt.preview ? (
          <img src={opt.preview} alt={opt.label} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            {opt.value === 'custom-showroom' ? <Upload className="h-5 w-5" /> : opt.value === 'none' ? <ImageOff className="h-5 w-5" /> : null}
          </span>
        )}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="px-2 py-1.5">
        <span className="block truncate text-[11px] font-semibold text-foreground">{short}</span>
        {sub && <span className="block truncate text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </button>
  );
};

/**
 * Visuelle Szenen-Auswahl statt Dropdown.
 * Rein darstellend – Werte und Logik bleiben unverändert.
 */
const SceneGallery: React.FC<SceneGalleryProps> = ({ options, value, onChange }) => {
  const groups: Array<'none' | 'indoor' | 'outdoor'> = ['none', 'indoor', 'outdoor'];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible">
      {groups.map((g) => {
        const items = options.filter((o) => o.group === g);
        if (!items.length) return null;
        return (
          <div key={g} className="contents">
            <p className="sr-only">{GROUP_TITLES[g]}</p>
            <div className="contents">
              {items.map((opt) => (
                <div key={opt.value} className="w-[88px] shrink-0 sm:w-auto">
                  <Tile opt={opt} active={value === opt.value} onSelect={() => onChange(opt.value)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SceneGallery;
