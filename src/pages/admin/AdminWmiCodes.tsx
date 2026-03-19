import { useState, useMemo } from 'react';
import { Search, X, Plus, Trash2, Save, Hash, Tag, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BRAND_ALIAS_MAP, normalizeBrand } from '@/lib/brand-aliases';

// Import the WMI data from vin-wmi-lookup to display
// We re-export the maps so the admin can see them
import { lookupBrandFromVin } from '@/lib/vin-wmi-lookup';

// We need the raw maps – re-create them here for display (they're const in the module)
// In a real scenario these would come from a DB, but for now we keep them in-memory
const WMI3_DISPLAY: Record<string, string> = {
  ZAR: 'Alfa Romeo', ZD4: 'Aprilia', WAU: 'Audi', TRU: 'Audi', WUA: 'Audi',
  WBA: 'BMW', WBS: 'BMW', WBY: 'BMW', WB1: 'BMW',
  VF7: 'Citroën', VR7: 'Citroën', KLY: 'Daewoo', JDA: 'Daihatsu',
  WDD: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDB: 'Mercedes-Benz', W1K: 'Mercedes-Benz', W1N: 'Mercedes-Benz', WMX: 'Mercedes-Benz',
  WXF: 'Fendt', ZFF: 'Ferrari', ZDF: 'Ferrari', ZFA: 'Fiat',
  WFO: 'Ford', WF0: 'Ford', VS6: 'Ford',
  WHB: 'Hobby', SHS: 'Honda', ZDC: 'Honda', JH2: 'Honda', JHM: 'Honda', LUC: 'Honda',
  KMH: 'Hyundai', TMA: 'Hyundai', ZCF: 'Iveco', SAJ: 'Jaguar',
  KNE: 'Kia', KNA: 'Kia', U5Y: 'Kia', U6Z: 'Kia',
  SAL: 'Land Rover', SCC: 'Lotus', JT1: 'Toyota',
  WMA: 'MAN', ZMA: 'Maserati', ZAM: 'Maserati',
  JM2: 'Mazda', JMZ: 'Mazda',
  JMB: 'Mitsubishi', XMC: 'Mitsubishi', MMB: 'Mitsubishi',
  SJN: 'Nissan', JN1: 'Nissan', VSK: 'Nissan',
  WOL: 'Opel', W0L: 'Opel', W0V: 'Opel', VXK: 'Opel', W0S: 'Opel',
  VF3: 'Peugeot', VR3: 'Peugeot',
  WPO: 'Porsche', WP0: 'Porsche', WP1: 'Porsche',
  PL1: 'Proton', VF1: 'Renault', VF6: 'Renault', VFA: 'Alpine',
  SAR: 'Rover', SAX: 'Rover', YS3: 'Saab', YK1: 'Saab',
  VSS: 'Seat', TMB: 'Škoda', KPT: 'Ssangyong', WTA: 'Tabbert',
  JTF: 'Toyota', VNK: 'Toyota',
  WVW: 'Volkswagen', WV2: 'Volkswagen', WV1: 'Volkswagen', WVG: 'Volkswagen', WVM: 'Volkswagen',
  YV1: 'Volvo', B7J: 'Chrysler', S2D: 'Chrysler',
  VR1: 'DS', WME: 'Smart', WMW: 'MINI',
  ZHW: 'Lamborghini', ZLA: 'Lancia', WAP: 'Alpina', WAG: 'Neoplan',
  WEB: 'EvoBus', WSM: 'Schmitz Cargobull',
  LC0: 'BYD', LFV: 'Volkswagen', LSV: 'Volkswagen', LPS: 'Polestar',
  LRW: 'Tesla', XP7: 'Tesla', SUU: 'Solaris', CL9: 'Wallyscar',
  '1C3': 'Chrysler', '1C4': 'Chrysler', '1J4': 'Jeep',
  '1FM': 'Ford', '2FM': 'Ford', '1HF': 'Honda',
  '1VW': 'Volkswagen', '3VW': 'Volkswagen', '9BW': 'Volkswagen',
  '4US': 'BMW', '5YJ': 'Tesla', '6T1': 'Toyota', '6MM': 'Mitsubishi',
  '2HM': 'Hyundai', '1YV': 'Mazda',
};

const WMI2_DISPLAY: Record<string, string> = {
  JA: 'Isuzu', JF: 'Subaru', JH: 'Honda', JM: 'Mazda', JN: 'Nissan',
  JS: 'Suzuki', JT: 'Toyota', KL: 'Daewoo', KN: 'Kia', UU: 'Dacia',
  '1C': 'Chrysler', '1F': 'Ford', '1G': 'General Motors', '1H': 'Honda',
  '1J': 'Jeep', '1L': 'Lincoln', '1M': 'Mercury', '1N': 'Nissan',
  '2F': 'Ford', '2G': 'General Motors', '2M': 'Mercury',
  '3F': 'Ford', '3G': 'General Motors', '3H': 'Honda',
  '4F': 'Mazda', '4M': 'Mercury', '4S': 'Subaru',
  '5L': 'Lincoln', '6F': 'Ford', '6H': 'Holden',
};

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
