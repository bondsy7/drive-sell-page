import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Save, FileJson, FileText, Database, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateVehicle, type Vehicle } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';

/**
 * Structured vehicle data record stored in `vehicles.vehicle_data`.
 * Flat schema → easy to export as CSV / JSON / API payload for DMS systems.
 */
export interface VehicleDataRecord {
  // Identity
  vin?: string;
  brand?: string;
  model?: string;
  variant?: string;
  year?: string;
  color?: string;
  interiorColor?: string;
  hsnTsn?: string;
  licensePlate?: string;
  // Engine / drivetrain
  fuelType?: string;
  transmission?: string;
  driveType?: string;
  power?: string;          // kW (PS)
  displacement?: string;   // ccm
  cylinders?: string;
  topSpeed?: string;
  acceleration?: string;
  // Body / dimensions
  bodyType?: string;
  doors?: string;
  seats?: string;
  curbWeight?: string;
  grossWeight?: string;
  payload?: string;
  trunkVolume?: string;
  // Status
  mileage?: string;
  firstRegistration?: string;
  previousOwners?: string;
  inspectionUntil?: string;
  condition?: string;      // Neu, Gebraucht, ...
  warranty?: string;
  // Pkw-EnVKV
  consumptionCombined?: string;
  consumptionCity?: string;
  consumptionHighway?: string;
  co2Emissions?: string;
  co2Class?: string;
  electricRange?: string;
  consumptionElectric?: string;
  // Commercial
  netPrice?: string;
  grossPrice?: string;
  vatRate?: string;
  internalNumber?: string;
  location?: string;
  // Free notes
  features?: string;       // multiline
  notes?: string;          // multiline
}

const FIELDS: Array<{ section: string; rows: Array<{ key: keyof VehicleDataRecord; label: string; type?: 'text' | 'number' | 'date' | 'textarea' }> }> = [
  {
    section: 'Identität',
    rows: [
      { key: 'vin', label: 'VIN' },
      { key: 'brand', label: 'Marke' },
      { key: 'model', label: 'Modell' },
      { key: 'variant', label: 'Variante / Ausstattung' },
      { key: 'year', label: 'Baujahr' },
      { key: 'color', label: 'Farbe (außen)' },
      { key: 'interiorColor', label: 'Farbe (innen)' },
      { key: 'hsnTsn', label: 'HSN / TSN' },
      { key: 'licensePlate', label: 'Kennzeichen' },
    ],
  },
  {
    section: 'Antrieb & Motor',
    rows: [
      { key: 'fuelType', label: 'Kraftstoffart' },
      { key: 'transmission', label: 'Getriebe' },
      { key: 'driveType', label: 'Antriebsart' },
      { key: 'power', label: 'Leistung (kW / PS)' },
      { key: 'displacement', label: 'Hubraum (ccm)' },
      { key: 'cylinders', label: 'Zylinder' },
      { key: 'topSpeed', label: 'Höchstgeschwindigkeit (km/h)' },
      { key: 'acceleration', label: '0–100 km/h (s)' },
    ],
  },
  {
    section: 'Karosserie & Maße',
    rows: [
      { key: 'bodyType', label: 'Karosserie' },
      { key: 'doors', label: 'Türen' },
      { key: 'seats', label: 'Sitzplätze' },
      { key: 'curbWeight', label: 'Leergewicht (kg)' },
      { key: 'grossWeight', label: 'Zul. Gesamtgewicht (kg)' },
      { key: 'payload', label: 'Zuladung (kg)' },
      { key: 'trunkVolume', label: 'Kofferraum (Liter)' },
    ],
  },
  {
    section: 'Zustand & Historie',
    rows: [
      { key: 'mileage', label: 'Laufleistung (km)' },
      { key: 'firstRegistration', label: 'Erstzulassung' },
      { key: 'previousOwners', label: 'Vorbesitzer' },
      { key: 'inspectionUntil', label: 'HU bis' },
      { key: 'condition', label: 'Zustand' },
      { key: 'warranty', label: 'Garantie' },
    ],
  },
  {
    section: 'Verbrauch & Emissionen (Pkw-EnVKV)',
    rows: [
      { key: 'consumptionCombined', label: 'Verbrauch kombiniert' },
      { key: 'consumptionCity', label: 'Verbrauch innerorts' },
      { key: 'consumptionHighway', label: 'Verbrauch außerorts' },
      { key: 'co2Emissions', label: 'CO₂ (g/km)' },
      { key: 'co2Class', label: 'CO₂-Klasse (A–G)' },
      { key: 'electricRange', label: 'Elektrische Reichweite (km)' },
      { key: 'consumptionElectric', label: 'Stromverbrauch (kWh/100 km)' },
    ],
  },
  {
    section: 'Kommerziell',
    rows: [
      { key: 'netPrice', label: 'Preis netto (€)' },
      { key: 'grossPrice', label: 'Preis brutto (€)' },
      { key: 'vatRate', label: 'MwSt.-Satz (%)' },
      { key: 'internalNumber', label: 'Interne Nummer' },
      { key: 'location', label: 'Standort' },
    ],
  },
  {
    section: 'Notizen',
    rows: [
      { key: 'features', label: 'Ausstattungsmerkmale (eines pro Zeile)', type: 'textarea' },
      { key: 'notes', label: 'Interne Notizen', type: 'textarea' },
    ],
  },
];

/** Best-effort merge of pre-existing scattered fields into the flat record. */
function seedFromVehicle(vehicle: Vehicle): VehicleDataRecord {
  const data = (vehicle.vehicle_data || {}) as Record<string, unknown>;
  const direct = data as VehicleDataRecord;
  const nested = ((data.vehicle as Record<string, unknown>) || {}) as Record<string, unknown>;
  const consumption = ((data.consumption as Record<string, unknown>) || {}) as Record<string, unknown>;

  const pick = (...vals: unknown[]) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
  };

  return {
    vin: pick(direct.vin, vehicle.vin),
    brand: pick(direct.brand, nested.brand, vehicle.brand),
    model: pick(direct.model, nested.model, vehicle.model),
    variant: pick(direct.variant, nested.variant),
    year: pick(direct.year, nested.year, vehicle.year),
    color: pick(direct.color, nested.color, vehicle.color),
    interiorColor: pick(direct.interiorColor, nested.interiorColor),
    hsnTsn: pick(direct.hsnTsn, consumption.hsnTsn),
    licensePlate: pick(direct.licensePlate),
    fuelType: pick(direct.fuelType, nested.fuelType, consumption.fuelType),
    transmission: pick(direct.transmission, nested.transmission),
    driveType: pick(direct.driveType, consumption.driveType),
    power: pick(direct.power, nested.power, consumption.power),
    displacement: pick(direct.displacement, consumption.displacement),
    cylinders: pick(direct.cylinders),
    topSpeed: pick(direct.topSpeed, consumption.topSpeed),
    acceleration: pick(direct.acceleration, consumption.acceleration),
    bodyType: pick(direct.bodyType),
    doors: pick(direct.doors),
    seats: pick(direct.seats),
    curbWeight: pick(direct.curbWeight, consumption.curbWeight),
    grossWeight: pick(direct.grossWeight, consumption.grossWeight),
    payload: pick(direct.payload),
    trunkVolume: pick(direct.trunkVolume),
    mileage: pick(direct.mileage, consumption.mileage),
    firstRegistration: pick(direct.firstRegistration),
    previousOwners: pick(direct.previousOwners),
    inspectionUntil: pick(direct.inspectionUntil),
    condition: pick(direct.condition),
    warranty: pick(direct.warranty, consumption.warranty),
    consumptionCombined: pick(direct.consumptionCombined, consumption.consumptionCombined),
    consumptionCity: pick(direct.consumptionCity, consumption.consumptionCity),
    consumptionHighway: pick(direct.consumptionHighway, consumption.consumptionHighway),
    co2Emissions: pick(direct.co2Emissions, consumption.co2Emissions),
    co2Class: pick(direct.co2Class, consumption.co2Class),
    electricRange: pick(direct.electricRange, consumption.electricRange),
    consumptionElectric: pick(direct.consumptionElectric, consumption.consumptionElectric),
    netPrice: pick(direct.netPrice),
    grossPrice: pick(direct.grossPrice),
    vatRate: pick(direct.vatRate),
    internalNumber: pick(direct.internalNumber),
    location: pick(direct.location),
    features: pick(direct.features),
    notes: pick(direct.notes),
  };
}

function recordToCsv(rec: VehicleDataRecord): string {
  const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
  const all: Array<[string, string]> = [];
  for (const sec of FIELDS) {
    for (const row of sec.rows) {
      all.push([row.label, String(rec[row.key] ?? '')]);
    }
  }
  return ['Feld;Wert', ...all.map(([k, v]) => `${escape(k)};${escape(v)}`)].join('\n');
}

function downloadBlob(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

interface Props { vehicle: Vehicle; }

/** Map a loose source object (from PDF/Datenblatt/VIN-Lookup) onto our flat record. */
function mapSourceToRecord(src: Record<string, unknown>): Partial<VehicleDataRecord> {
  const v = ((src.vehicle as Record<string, unknown>) || src) as Record<string, unknown>;
  const c = ((src.consumption as Record<string, unknown>) || {}) as Record<string, unknown>;
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = (v[k] ?? c[k] ?? (src as Record<string, unknown>)[k]);
      if (val != null && String(val).trim() !== '') return String(val);
    }
    return '';
  };
  const equipment = (v.equipment as unknown) || (v.features as unknown) || (src.equipment as unknown);
  const eqStr = Array.isArray(equipment) ? (equipment as string[]).join('\n') : (typeof equipment === 'string' ? equipment : '');
  return {
    vin: get('vin'),
    brand: get('brand', 'make'),
    model: get('model'),
    variant: get('variant', 'trim'),
    year: get('year', 'modelYear'),
    color: get('color', 'paintColor', 'exteriorColor'),
    interiorColor: get('interiorColor'),
    hsnTsn: get('hsnTsn'),
    licensePlate: get('licensePlate'),
    fuelType: get('fuelType'),
    transmission: get('transmission', 'gearboxType'),
    driveType: get('driveType'),
    power: get('power', 'electricMotorPower'),
    displacement: get('displacement'),
    cylinders: get('cylinders'),
    topSpeed: get('topSpeed'),
    acceleration: get('acceleration'),
    bodyType: get('bodyType'),
    doors: get('doors'),
    seats: get('seats'),
    curbWeight: get('curbWeight'),
    grossWeight: get('grossWeight'),
    payload: get('payload'),
    trunkVolume: get('trunkVolume'),
    mileage: get('mileage'),
    firstRegistration: get('firstRegistration'),
    previousOwners: get('previousOwners'),
    inspectionUntil: get('inspectionUntil'),
    condition: get('condition'),
    warranty: get('warranty'),
    consumptionCombined: get('consumptionCombined'),
    consumptionCity: get('consumptionCity'),
    consumptionHighway: get('consumptionHighway'),
    co2Emissions: get('co2Emissions'),
    co2Class: get('co2Class'),
    electricRange: get('electricRange'),
    consumptionElectric: get('consumptionElectric'),
    netPrice: get('netPrice'),
    grossPrice: get('grossPrice', 'price'),
    vatRate: get('vatRate'),
    internalNumber: get('internalNumber'),
    location: get('location'),
    features: eqStr,
  };
}

export default function DataTab({ vehicle }: Props) {
  const update = useUpdateVehicle();
  const initial = useMemo(() => seedFromVehicle(vehicle), [vehicle]);
  const [rec, setRec] = useState<VehicleDataRecord>(initial);
  const [dirty, setDirty] = useState(false);
  const [vinLoading, setVinLoading] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string>('');
  const autoRanRef = useRef(false);

  useEffect(() => {
    setRec(initial);
    setDirty(false);
  }, [initial]);

  const set = <K extends keyof VehicleDataRecord>(key: K, val: string) => {
    setRec(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  /** Merge a partial record into state — only fills currently empty fields. */
  const mergeIntoRec = (partial: Partial<VehicleDataRecord>): number => {
    let count = 0;
    setRec(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(partial)) {
        const key = k as keyof VehicleDataRecord;
        const cur = (prev[key] || '').toString().trim();
        const incoming = (v || '').toString().trim();
        if (incoming && !cur) {
          next[key] = incoming;
          count++;
        }
      }
      if (count > 0) setDirty(true);
      return next;
    });
    return count;
  };

  /** VIN lookup — fills empty fields only. */
  const fillFromOutvin = async (silent = false): Promise<number> => {
    const vin = (rec.vin || vehicle.vin || '').trim().toUpperCase();
    if (vin.length !== 17) {
      if (!silent) toast.error('Bitte zuerst eine gültige 17-stellige VIN eintragen.');
      return 0;
    }
    setVinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-vin', { body: { vin } });
      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'VIN-Lookup fehlgeschlagen');
      }
      const partial = mapSourceToRecord({ ...(data.vehicle || {}), vin });
      const filled = mergeIntoRec(partial);
      if (!silent) {
        if (filled === 0) toast.info('Keine neuen Daten — alle Felder sind bereits gefüllt.');
        else toast.success(`${filled} Feld${filled !== 1 ? 'er' : ''} aus VIN-Lookup befüllt.`);
      }
      return filled;
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'VIN-Lookup fehlgeschlagen');
      return 0;
    } finally {
      setVinLoading(false);
    }
  };

  /** Pull data from all related projects (PDF / Landing Page) of this vehicle. */
  const fillFromProjects = async (silent = false): Promise<number> => {
    const { data } = await supabase
      .from('projects')
      .select('vehicle_data, updated_at')
      .eq('vehicle_id', vehicle.id)
      .order('updated_at', { ascending: false });
    if (!data?.length) return 0;
    let total = 0;
    for (const row of data) {
      const vd = (row.vehicle_data || {}) as Record<string, unknown>;
      const partial = mapSourceToRecord(vd);
      total += mergeIntoRec(partial);
    }
    if (!silent && total > 0) toast.success(`${total} Feld${total !== 1 ? 'er' : ''} aus PDF / Landing Pages übernommen.`);
    return total;
  };

  // Hinweis: Daten werden NICHT beim Öffnen des Tabs geladen.
  // Sie werden beim Generieren (One-Shot, Remaster, PDF, Landing Page) der VIN zugeordnet abgelegt.

  const save = async () => {
    const merged = { ...(vehicle.vehicle_data || {}), ...rec };
    await update.mutateAsync({
      id: vehicle.id,
      patch: {
        vehicle_data: merged as Record<string, unknown>,
        brand: rec.brand || null,
        model: rec.model || null,
        year: rec.year ? Number(rec.year) || null : null,
        color: rec.color || null,
      },
    });
    setDirty(false);
    toast.success('Fahrzeugdaten gespeichert');
  };

  const baseName = [rec.brand, rec.model, vehicle.vin].filter(Boolean).join('-').replace(/\s+/g, '_') || 'fahrzeug';

  const exportCsv = () => downloadBlob(`${baseName}.csv`, 'text/csv;charset=utf-8', recordToCsv(rec));
  const exportJson = () => downloadBlob(`${baseName}.json`, 'application/json', JSON.stringify(rec, null, 2));
  const exportTxt = () => {
    const txt = FIELDS.map(sec =>
      `## ${sec.section}\n` +
      sec.rows.map(r => `${r.label}: ${rec[r.key] || '-'}`).join('\n')
    ).join('\n\n');
    downloadBlob(`${baseName}.txt`, 'text/plain;charset=utf-8', txt);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="w-4 h-4" />
          {autoStatus || 'Strukturierte Fahrzeugdaten — werden beim Generieren (One-Shot, Remaster, PDF, Landing Page) automatisch der VIN zugeordnet.'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => fillFromOutvin(false)} disabled={vinLoading}>
            {vinLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {vinLoading ? 'VIN-Lookup…' : 'VIN-Lookup starten'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fillFromProjects(false)}>
            <FileText className="w-4 h-4 mr-1.5" /> Aus PDF/Landing übernehmen
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportJson}>
            <FileJson className="w-4 h-4 mr-1.5" /> JSON
          </Button>
          <Button size="sm" variant="outline" onClick={exportTxt}>
            <FileText className="w-4 h-4 mr-1.5" /> Text
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {update.isPending ? 'Speichern…' : dirty ? 'Speichern' : 'Gespeichert'}
          </Button>
        </div>
      </div>

      {FIELDS.map(sec => (
        <section key={sec.section} className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{sec.section}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sec.rows.map(row => (
              <div key={row.key} className={row.type === 'textarea' ? 'sm:col-span-2 lg:col-span-3' : ''}>
                <Label htmlFor={`f-${row.key}`} className="text-xs text-muted-foreground">
                  {row.label}
                </Label>
                {row.type === 'textarea' ? (
                  <Textarea
                    id={`f-${row.key}`}
                    rows={4}
                    value={rec[row.key] || ''}
                    onChange={(e) => set(row.key, e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    id={`f-${row.key}`}
                    value={rec[row.key] || ''}
                    onChange={(e) => set(row.key, e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="text-xs text-muted-foreground p-3 rounded-md border border-dashed">
        Geplant: PDF-Datenblatt &amp; REST-API-Endpoint, damit DMS-Systeme der Händler
        diese Daten direkt per VIN abrufen können.
      </div>
    </div>
  );
}
