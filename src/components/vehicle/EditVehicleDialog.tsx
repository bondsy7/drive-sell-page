import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useUpdateVehicle, type Vehicle } from '@/hooks/useVehicles';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
}

export default function EditVehicleDialog({ open, onOpenChange, vehicle }: Props) {
  const update = useUpdateVehicle();
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(vehicle.title || '');
      setBrand(vehicle.brand || '');
      setModel(vehicle.model || '');
      setYear(vehicle.year ? String(vehicle.year) : '');
      setColor(vehicle.color || '');
    }
  }, [open, vehicle]);

  const handleSave = async () => {
    try {
      const yearNum = year.trim() ? parseInt(year, 10) : null;
      if (year.trim() && (Number.isNaN(yearNum!) || yearNum! < 1900 || yearNum! > 2100)) {
        toast.error('Bitte gültiges Jahr eingeben');
        return;
      }
      await update.mutateAsync({
        id: vehicle.id,
        patch: {
          vin: vehicle.vin,
          title: title.trim() || null,
          brand: brand.trim() || null,
          model: model.trim() || null,
          year: yearNum,
          color: color.trim() || null,
        },
      });
      toast.success('Fahrzeug aktualisiert');
      onOpenChange(false);
    } catch (e) {
      toast.error(`Fehler: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fahrzeug bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="v-title">Titel</Label>
            <Input id="v-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={`${brand} ${model}`.trim() || 'Eigener Titel'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="v-brand">Marke</Label>
              <Input id="v-brand" value={brand} onChange={e => setBrand(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="v-model">Modell</Label>
              <Input id="v-model" value={model} onChange={e => setModel(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="v-year">Jahr</Label>
              <Input id="v-year" inputMode="numeric" value={year} onChange={e => setYear(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="v-color">Farbe</Label>
              <Input id="v-color" value={color} onChange={e => setColor(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>VIN</Label>
            <Input value={vehicle.vin} disabled className="font-mono text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? 'Speichere…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
