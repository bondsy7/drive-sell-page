import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronRight, Car } from 'lucide-react';
import { useVehicleMakes } from '@/hooks/useVehicleMakes';
import { Input } from '@/components/ui/input';

interface VehicleBrandModelPickerProps {
  brand: string;
  model: string;
  onBrandChange: (brand: string) => void;
  onModelChange: (model: string) => void;
  /** Compact mode for inline forms */
  compact?: boolean;
}

const VehicleBrandModelPicker: React.FC<VehicleBrandModelPickerProps> = ({
  brand, model, onBrandChange, onModelChange, compact = false,
}) => {
  const { makes, loading, getModelsForMake, getLogoForMake, filterMakes } = useVehicleMakes();
  const [brandQuery, setBrandQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [showBrandList, setShowBrandList] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) setShowBrandList(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setShowModelList(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredMakes = useMemo(() => filterMakes(brandQuery), [filterMakes, brandQuery]);

  const models = useMemo(() => {
    if (!brand) return [];
    const all = getModelsForMake(brand);
    if (!modelQuery) return all;
    const q = modelQuery.toLowerCase();
    return all.filter(m => m.toLowerCase().includes(q));
  }, [brand, modelQuery, getModelsForMake]);

  const logoUrl = useMemo(() => getLogoForMake(brand), [brand, getLogoForMake]);

  const selectBrand = (makeKey: string) => {
    onBrandChange(makeKey);
    onModelChange('');
    setBrandQuery('');
    setModelQuery('');
    setShowBrandList(false);
    // Auto-open model list
    setTimeout(() => setShowModelList(true), 100);
  };

  const selectModel = (modelKey: string) => {
    onModelChange(modelKey);
    setModelQuery('');
    setShowModelList(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
        Marken werden geladen...
      </div>
    );
  }

  return (
    <div className={`grid ${compact ? 'grid-cols-2 gap-3' : 'grid-cols-1 sm:grid-cols-2 gap-4'}`}>
      {/* Brand Picker */}
      <div ref={brandRef} className="relative">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Marke</label>
        <div
          className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-background px-3 cursor-pointer hover:border-accent transition-colors"
          onClick={() => { setShowBrandList(true); setBrandQuery(''); }}
        >
          {logoUrl ? (
            <img src={logoUrl} alt={brand} className="w-5 h-5 object-contain" />
          ) : (
            <Car className="w-4 h-4 text-muted-foreground" />
          )}
          <span className={`text-sm flex-1 ${brand ? 'text-foreground' : 'text-muted-foreground'}`}>
            {brand || 'Marke wählen...'}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>

        {showBrandList && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 px-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={brandQuery}
                  onChange={e => setBrandQuery(e.target.value)}
                  placeholder="Marke suchen..."
                  className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredMakes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Keine Marke gefunden</p>
              ) : (
                filteredMakes.map(make => {
                  const logo = getLogoForMake(make.key);
                  return (
                    <button
                      key={make.key}
                      onClick={() => selectBrand(make.key)}
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
                      <span className="text-[10px] text-muted-foreground ml-auto">{make.models.filter(m => m.key !== 'ANDERE').length} Modelle</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Model Picker */}
      <div ref={modelRef} className="relative">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Modell</label>
        <div
          className={`flex items-center gap-2 h-10 w-full rounded-md border border-input bg-background px-3 transition-colors ${
            brand ? 'cursor-pointer hover:border-accent' : 'opacity-50 cursor-not-allowed'
          }`}
          onClick={() => { if (brand) { setShowModelList(true); setModelQuery(''); } }}
        >
          <span className={`text-sm flex-1 ${model ? 'text-foreground' : 'text-muted-foreground'}`}>
            {model || (brand ? 'Modell wählen...' : 'Erst Marke wählen')}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>

        {showModelList && brand && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-border">
              <div className="flex items-center gap-2 px-2">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={modelQuery}
                  onChange={e => setModelQuery(e.target.value)}
                  placeholder="Modell suchen..."
                  className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {models.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Kein Modell gefunden</p>
              ) : (
                models.map(m => (
                  <button
                    key={m}
                    onClick={() => selectModel(m)}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-accent/10 transition-colors ${
                      model === m ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleBrandModelPicker;
