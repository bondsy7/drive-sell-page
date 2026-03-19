import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VehicleData } from '@/types/vehicle';
import type { VinFieldDiff } from '@/components/VinDataDialog';

interface OutVinVehicle {
  brand: string;
  model: string;
  variant: string;
  year: number | null;
  fuelType: string;
  transmission: string;
  power: string;
  color: string;
  displacement: string;
  driveType: string;
  bodyType: string;
  doors: number | null;
  seats: number | null;
  equipment: string[];
  _raw: Record<string, unknown>;
}

const FIELD_MAP: { field: string; label: string; getOutvin: (v: OutVinVehicle) => string; getCurrent: (d: VehicleData) => string }[] = [
  { field: 'brand', label: 'Marke', getOutvin: v => v.brand, getCurrent: d => d.vehicle.brand },
  { field: 'model', label: 'Modell', getOutvin: v => v.model, getCurrent: d => d.vehicle.model },
  { field: 'variant', label: 'Variante', getOutvin: v => v.variant, getCurrent: d => d.vehicle.variant },
  { field: 'year', label: 'Baujahr', getOutvin: v => v.year ? String(v.year) : '', getCurrent: d => String(d.vehicle.year || '') },
  { field: 'fuelType', label: 'Kraftstoff', getOutvin: v => v.fuelType, getCurrent: d => d.vehicle.fuelType },
  { field: 'transmission', label: 'Getriebe', getOutvin: v => v.transmission, getCurrent: d => d.vehicle.transmission },
  { field: 'power', label: 'Leistung', getOutvin: v => v.power, getCurrent: d => d.vehicle.power },
  { field: 'color', label: 'Farbe', getOutvin: v => v.color, getCurrent: d => d.vehicle.color },
  { field: 'displacement', label: 'Hubraum', getOutvin: v => v.displacement, getCurrent: d => d.consumption?.displacement || '' },
  { field: 'driveType', label: 'Antriebsart', getOutvin: v => v.driveType, getCurrent: d => d.consumption?.driveType || '' },
];

export function useVinLookup() {
  const [loading, setLoading] = useState(false);
  const [diffs, setDiffs] = useState<VinFieldDiff[]>([]);
  const [outvinData, setOutvinData] = useState<OutVinVehicle | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [equipment, setEquipment] = useState<string[]>([]);

  const lookup = useCallback(async (vin: string, currentData: VehicleData) => {
    if (!vin || vin.length !== 17) {
      toast.error('Ungültige VIN (17 Zeichen erforderlich).');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lookup-vin', { body: { vin } });
      if (error || data?.error) {
        toast.error(data?.error || 'VIN-Abfrage fehlgeschlagen.');
        return;
      }

      const vehicle = data.vehicle as OutVinVehicle;
      setOutvinData(vehicle);
      setEquipment(vehicle.equipment || []);

      // Build diffs
      const foundDiffs: VinFieldDiff[] = [];
      for (const fm of FIELD_MAP) {
        const outvinVal = fm.getOutvin(vehicle).trim();
        const currentVal = fm.getCurrent(currentData).trim();
        if (outvinVal && outvinVal !== currentVal) {
          foundDiffs.push({ label: fm.label, field: fm.field, currentValue: currentVal, outvinValue: outvinVal });
        }
      }

      setDiffs(foundDiffs);
      setDialogOpen(true);

      const equipCount = (vehicle.equipment || []).length;
      if (foundDiffs.length === 0 && equipCount === 0) {
        toast.success('VIN-Daten stimmen überein!');
      } else {
        const parts: string[] = [];
        if (foundDiffs.length > 0) parts.push(`${foundDiffs.length} Abweichung${foundDiffs.length > 1 ? 'en' : ''}`);
        if (equipCount > 0) parts.push(`${equipCount} Ausstattungsmerkmale`);
        toast.info(`${parts.join(' & ')} gefunden.`);
      }
    } catch (e) {
      console.error('VIN lookup error:', e);
      toast.error('VIN-Abfrage fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }, []);

  const applyFields = useCallback((selectedFields: string[], currentData: VehicleData, replaceEquipment?: boolean, selectedEquipment?: string[]): VehicleData => {
    if (!outvinData) return currentData;
    let updated = { ...currentData, vehicle: { ...currentData.vehicle }, consumption: { ...currentData.consumption } };

    for (const field of selectedFields) {
      const fm = FIELD_MAP.find(f => f.field === field);
      if (!fm) continue;
      const val = fm.getOutvin(outvinData);

      switch (field) {
        case 'brand': updated.vehicle.brand = val; break;
        case 'model': updated.vehicle.model = val; break;
        case 'variant': updated.vehicle.variant = val; break;
        case 'year': updated.vehicle.year = parseInt(val) || updated.vehicle.year; break;
        case 'fuelType':
          updated.vehicle.fuelType = val;
          updated.consumption.fuelType = val;
          break;
        case 'transmission': updated.vehicle.transmission = val; break;
        case 'power': updated.vehicle.power = val; break;
        case 'color': updated.vehicle.color = val; break;
        case 'displacement': updated.consumption.displacement = val; break;
        case 'driveType': updated.consumption.driveType = val; break;
      }
    }

    // Replace features with selected equipment if requested
    if (replaceEquipment && selectedEquipment && selectedEquipment.length > 0) {
      updated.vehicle.features = selectedEquipment;
    }

    return updated;
  }, [outvinData]);

  return { loading, diffs, equipment, outvinData, dialogOpen, setDialogOpen, lookup, applyFields };
}
