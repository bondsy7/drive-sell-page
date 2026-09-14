import React, { useState } from 'react';
import { Check, ImageOff, MoreHorizontal, Upload } from 'lucide-react';

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
  const primaryOptions = options.filter((option) => /^showroom-[1-4]$/.test(option.value));
  const additionalOptions = options.filter((option) => !primaryOptions.some((primary) => primary.value === option.value));
  const hasAdditionalSelection = additionalOptions.some((option) => option.value === value);
  const [showMore, setShowMore] = useState(hasAdditionalSelection);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {primaryOptions.map((opt) => (
          <Tile key={opt.value} opt={opt} active={value === opt.value} onSelect={() => onChange(opt.value)} />
        ))}
        <button
          type="button"
          onClick={() => setShowMore((current) => !current)}
          aria-expanded={showMore}
          className={`group relative overflow-hidden rounded-lg border text-center transition-all ${
            hasAdditionalSelection ? 'border-accent ring-2 ring-accent/30' : 'border-border hover:border-accent/60'
          }`}
        >
          <span className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-muted-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </span>
          <span className="block truncate px-1 py-1.5 text-[11px] font-semibold text-foreground">Mehr …</span>
        </button>
      </div>

      {showMore && (
        <div className="grid grid-cols-4 gap-1.5 border-t border-border pt-2 sm:grid-cols-5">
          {additionalOptions.map((opt) => (
            <Tile key={opt.value} opt={opt} active={value === opt.value} onSelect={() => onChange(opt.value)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SceneGallery;
