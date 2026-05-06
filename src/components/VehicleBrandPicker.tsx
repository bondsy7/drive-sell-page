import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronRight, Car } from 'lucide-react';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';

interface Props {
  brand: string;
  onBrandChange: (brand: string) => void;
  placeholder?: string;
}

const VehicleBrandPicker: React.FC<Props> = ({ brand, onBrandChange, placeholder = 'Marke wählen...' }) => {
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
  const logoUrl = useMemo(() => getLogoForMake(brand), [brand, getLogoForMake]);

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
        className="flex items-center gap-2 h-9 w-full rounded-md border border-input bg-background px-3 cursor-pointer hover:border-accent transition-colors"
        onClick={() => { setOpen(true); setQuery(''); }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt={brand} className="w-5 h-5 object-contain" />
        ) : (
          <Car className="w-4 h-4 text-muted-foreground" />
        )}
        <span className={`text-sm flex-1 ${brand ? 'text-foreground' : 'text-muted-foreground'}`}>
          {brand || placeholder}
        </span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
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
                placeholder="Marke suchen..."
                className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Keine Marke gefunden</p>
            ) : (
              filtered.map(make => {
                const logo = getLogoForMake(make.key);
                return (
                  <button
                    key={make.key}
                    onClick={() => { onBrandChange(make.key); setOpen(false); setQuery(''); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-accent/10 transition-colors ${
                      brand === make.key ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                    }`}
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
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleBrandPicker;
