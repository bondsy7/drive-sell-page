import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronRight, Car, X, Check } from 'lucide-react';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import { cn } from '@/lib/utils';
import { normalizeBrand } from '@/lib/brand-aliases';

interface Props {
  brands: string[];
  onChange: (brands: string[]) => void;
  placeholder?: string;
  className?: string;
}

/** Mehrfachauswahl von Marken: wie VehicleBrandPicker, bleibt aber nach jedem Klick offen. */
const VehicleBrandMultiPicker: React.FC<Props> = ({ brands, onChange, placeholder = 'Marken wählen...', className }) => {
  const { loading, getLogoForMake, filterMakes } = useVehicleMakes();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = useMemo(() => filterMakes(query), [filterMakes, query]);
  const selectedKeys = useMemo(() => new Set(brands.map(b => normalizeBrand(b))), [brands]);

  const toggle = (make: string) => {
    const key = normalizeBrand(make);
    if (selectedKeys.has(key)) onChange(brands.filter(b => normalizeBrand(b) !== key));
    else onChange([...brands, make]);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <div className="animate-spin w-3 h-3 border-2 border-accent border-t-transparent rounded-full" />
        Marken werden geladen...
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div
        className={cn("flex items-center gap-2 min-h-10 w-full rounded-md border border-input bg-background px-2 py-1 cursor-pointer hover:border-accent transition-colors", className)}
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        {brands.length === 0 ? (
          <span className="text-sm flex-1 px-1 text-muted-foreground">{placeholder}</span>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {brands.map(b => {
              const logo = getLogoForMake(b);
              return (
                <span key={b} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 py-0.5 pl-1.5 pr-1 text-xs">
                  {logo ? (
                    <img src={logo} alt={b} className="w-3.5 h-3.5 object-contain" />
                  ) : (
                    <Car className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className="text-foreground">{b}</span>
                  <button
                    type="button"
                    aria-label={`${b} entfernen`}
                    onClick={e => { e.stopPropagation(); toggle(b); }}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
        <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-border">
            <div className="flex items-center gap-2 px-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Marken suchen..."
                className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Keine Marke gefunden</p>
            ) : (
              filtered.map(make => {
                const selected = selectedKeys.has(normalizeBrand(make.key));
                const logo = getLogoForMake(make.key);
                return (
                  <button
                    key={make.key}
                    type="button"
                    onClick={() => toggle(make.key)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent/10 transition-colors",
                      selected ? "bg-accent/10 text-accent font-medium" : "text-foreground",
                    )}
                  >
                    {logo ? (
                      <img src={logo} alt={make.key} className="w-5 h-5 object-contain" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
                        <span className="text-[8px] font-bold text-muted-foreground">{make.key.charAt(0)}</span>
                      </div>
                    )}
                    <span>{make.key}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {make.models.filter(m => m.key !== 'ANDERE').length} Modelle
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          {brands.length > 0 && (
            <div className="flex items-center justify-between gap-2 border-t border-border p-2">
              <span className="text-[10px] text-muted-foreground">
                {brands.length} {brands.length === 1 ? 'Marke' : 'Marken'} gewählt
              </span>
              <button type="button" onClick={() => onChange([])} className="text-[10px] text-muted-foreground underline hover:text-foreground">
                Alle entfernen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VehicleBrandMultiPicker;
