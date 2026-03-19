import { useState, useMemo } from 'react';
import { Search, X, Plus, Trash2, Save, Hash, Tag, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BRAND_ALIAS_MAP, normalizeBrand } from '@/lib/brand-aliases';

// Import the WMI data directly from the lookup module
import { lookupBrandFromVin, WMI3_MAP, WMI2_MAP } from '@/lib/vin-wmi-lookup';

const WMI3_DISPLAY = WMI3_MAP;
const WMI2_DISPLAY = WMI2_MAP;

export default function AdminWmiCodes() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('wmi3');
  const [vinTest, setVinTest] = useState('');
  const [vinResult, setVinResult] = useState<string | null>(null);

  // WMI 3-char codes sorted
  const wmi3Entries = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(WMI3_DISPLAY)
      .filter(([code, brand]) => !q || code.toLowerCase().includes(q) || brand.toLowerCase().includes(q))
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  }, [search]);

  // WMI 2-char codes sorted
  const wmi2Entries = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(WMI2_DISPLAY)
      .filter(([code, brand]) => !q || code.toLowerCase().includes(q) || brand.toLowerCase().includes(q))
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  }, [search]);

  // Alias entries sorted
  const aliasEntries = useMemo(() => {
    const q = search.toLowerCase();
    return Object.entries(BRAND_ALIAS_MAP)
      .filter(([canonical, aliases]) =>
        !q || canonical.toLowerCase().includes(q) || aliases.some(a => a.toLowerCase().includes(q))
      )
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [search]);

  // Unique brand count
  const uniqueBrands3 = useMemo(() => new Set(Object.values(WMI3_DISPLAY)).size, []);
  const uniqueBrands2 = useMemo(() => new Set(Object.values(WMI2_DISPLAY)).size, []);

  const testVin = () => {
    if (!vinTest || vinTest.length < 3) {
      toast.error('Bitte mindestens 3 Zeichen eingeben.');
      return;
    }
    const result = lookupBrandFromVin(vinTest);
    setVinResult(result);
    if (result) toast.success(`Marke erkannt: ${result}`);
    else toast.warning('Keine Marke gefunden für diesen VIN-Prefix.');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">WMI-Codes & Marken-Aliase</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {Object.keys(WMI3_DISPLAY).length} WMI-3 Codes · {uniqueBrands3} Marken · {Object.keys(WMI2_DISPLAY).length} WMI-2 Codes · {uniqueBrands2} Marken · {aliasEntries.length} Alias-Gruppen
          </p>
        </div>
      </div>

      {/* VIN Test Tool */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Search className="w-4 h-4 text-accent" /> VIN-Prefix testen
        </h2>
        <div className="flex gap-2 items-center max-w-lg">
          <Input
            value={vinTest}
            onChange={e => { setVinTest(e.target.value.toUpperCase()); setVinResult(null); }}
            placeholder="VIN eingeben (z.B. WVW...)"
            className="font-mono text-sm"
            maxLength={17}
          />
          <Button size="sm" onClick={testVin} className="shrink-0 gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Prüfen
          </Button>
        </div>
        {vinResult !== null && (
          <div className={`text-sm font-medium px-3 py-2 rounded-lg inline-flex items-center gap-2 ${
            vinResult ? 'bg-green-500/10 text-green-600' : 'bg-orange-500/10 text-orange-500'
          }`}>
            {vinResult ? (
              <><Car className="w-4 h-4" /> Erkannt: <span className="font-bold">{vinResult}</span></>
            ) : (
              <><X className="w-4 h-4" /> Keine Zuordnung gefunden</>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Code oder Marke suchen..."
          className="pl-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="wmi3" className="gap-1.5">
            <Hash className="w-3.5 h-3.5" /> WMI 3-Zeichen ({wmi3Entries.length})
          </TabsTrigger>
          <TabsTrigger value="wmi2" className="gap-1.5">
            <Hash className="w-3.5 h-3.5" /> WMI 2-Zeichen ({wmi2Entries.length})
          </TabsTrigger>
          <TabsTrigger value="aliases" className="gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Marken-Aliase ({aliasEntries.length})
          </TabsTrigger>
        </TabsList>

        {/* WMI 3-char tab */}
        <TabsContent value="wmi3" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {wmi3Entries.map(([code, brand]) => (
              <div key={code} className="bg-card border border-border rounded-lg p-3 flex flex-col items-center gap-1.5">
                <span className="font-mono text-sm font-bold text-accent">{code}</span>
                <span className="text-[11px] text-foreground text-center truncate w-full" title={brand}>{brand}</span>
              </div>
            ))}
          </div>
          {wmi3Entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Keine Einträge gefunden.</p>
          )}
        </TabsContent>

        {/* WMI 2-char tab */}
        <TabsContent value="wmi2" className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {wmi2Entries.map(([code, brand]) => (
              <div key={code} className="bg-card border border-border rounded-lg p-3 flex flex-col items-center gap-1.5">
                <span className="font-mono text-sm font-bold text-accent">{code}</span>
                <span className="text-[11px] text-foreground text-center truncate w-full" title={brand}>{brand}</span>
              </div>
            ))}
          </div>
          {wmi2Entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Keine Einträge gefunden.</p>
          )}
        </TabsContent>

        {/* Aliases tab */}
        <TabsContent value="aliases" className="mt-4">
          <div className="space-y-2">
            {aliasEntries.map(([canonical, aliases]) => (
              <div key={canonical} className="bg-card border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-2 min-w-[160px]">
                  <Car className="w-4 h-4 text-accent shrink-0" />
                  <span className="font-medium text-sm text-foreground capitalize">{canonical}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {aliases.map(alias => (
                    <span key={alias} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-mono">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {aliasEntries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Keine Einträge gefunden.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
