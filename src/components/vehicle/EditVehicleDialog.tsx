import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { useUpdateVehicle, type Vehicle } from '@/hooks/useVehicles';
import { supabase } from '@/integrations/supabase/client';
import { uploadToGeminiFiles } from '@/lib/gemini-file-upload';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle;
}

const isPlaceholderVin = (v: string | null | undefined) =>
  !!v && /^NOVIN[-_]/i.test(v);

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export default function EditVehicleDialog({ open, onOpenChange, vehicle }: Props) {
  const update = useUpdateVehicle();
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [vin, setVin] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(vehicle.title || '');
      setBrand(vehicle.brand || '');
      setModel(vehicle.model || '');
      setYear(vehicle.year ? String(vehicle.year) : '');
      setColor(vehicle.color || '');
      setVin(isPlaceholderVin(vehicle.vin) ? '' : (vehicle.vin || ''));
    }
  }, [open, vehicle]);

  const handleVinPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (e.target) e.target.value = '';
    setOcrLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const refs = await uploadToGeminiFiles([{ imageBase64: base64 }]);
      const body: any = refs?.[0] ? { imageFileUri: refs[0] } : { imageBase64: base64 };
      const { data, error } = await supabase.functions.invoke('ocr-vin', { body });
      if (data?.error === 'insufficient_credits') {
        toast.error('Nicht genügend Credits für VIN-Erkennung.');
        return;
      }
      if (!error && data?.vin) {
        const recognized = String(data.vin).toUpperCase();
        setVin(recognized);
        toast.success(`VIN erkannt: ${recognized}`);
      } else {
        toast.error('VIN konnte nicht erkannt werden.');
      }
    } catch (err) {
      toast.error(`Fehler: ${(err as Error).message}`);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const yearNum = year.trim() ? parseInt(year, 10) : null;
      if (year.trim() && (Number.isNaN(yearNum!) || yearNum! < 1900 || yearNum! > 2100)) {
        toast.error('Bitte gültiges Jahr eingeben');
        return;
      }
      const trimmedVin = vin.trim().toUpperCase();
      // Validate VIN: empty (keep placeholder) or 17 alphanumeric chars
      if (trimmedVin && trimmedVin !== vehicle.vin && !isPlaceholderVin(trimmedVin)) {
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(trimmedVin)) {
          toast.error('VIN muss 17 Zeichen lang sein (ohne I, O, Q).');
          return;
        }
      }
      const patch: any = {
        title: title.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        year: yearNum,
        color: color.trim() || null,
      };
      // Only update VIN if user provided a real one (replace placeholder) or changed it
      if (trimmedVin && trimmedVin !== vehicle.vin) {
        patch.vin = trimmedVin;
      }
      await update.mutateAsync({ id: vehicle.id, patch });
      toast.success('Fahrzeug aktualisiert');
      onOpenChange(false);
    } catch (e) {
      toast.error(`Fehler: ${(e as Error).message}`);
    }
  };

  const placeholder = isPlaceholderVin(vehicle.vin);

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
            <Label htmlFor="v-vin">VIN</Label>
            <div className="flex gap-2">
              <Input
                id="v-vin"
                value={vin}
                onChange={e => setVin(e.target.value.toUpperCase())}
                placeholder={placeholder ? 'Noch keine VIN – jetzt eingeben oder scannen' : 'VIN eingeben'}
                maxLength={17}
                className="font-mono text-xs uppercase"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                title="VIN per Foto scannen"
              >
                {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleVinPhoto}
              />
            </div>
            {placeholder && (
              <p className="text-xs text-muted-foreground mt-1">
                Aktuell ohne echte VIN gespeichert. Ergänze sie manuell oder scanne den VIN-Aufkleber.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={update.isPending || ocrLoading}>
            {update.isPending ? 'Speichere…' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
