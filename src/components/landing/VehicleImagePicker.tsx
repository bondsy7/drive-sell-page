import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface VehicleOption { id: string; label: string }
interface PickerImage { id: string; url: string; perspective: string | null; vehicle_id: string | null }

interface Props {
  defaultVehicleId?: string | null;
  onPick: (url: string) => void;
}

/** Lets the user choose an image already generated in autohaus.ai (gallery of their vehicles). */
export default function VehicleImagePicker({ defaultVehicleId, onPick }: Props) {
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [vehicleId, setVehicleId] = useState<string>(defaultVehicleId || 'all');
  const [images, setImages] = useState<PickerImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('vehicles').select('id, brand, model, title').order('updated_at', { ascending: false }).limit(200)
      .then(({ data }) => setVehicles((data || []).map(v => ({
        id: v.id,
        label: v.title || [v.brand, v.model].filter(Boolean).join(' ') || 'Fahrzeug',
      }))));
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from('project_images')
      .select('id, image_url, perspective, vehicle_id')
      .not('image_url', 'is', null).neq('image_url', '')
      .order('created_at', { ascending: false }).limit(120);
    if (vehicleId !== 'all') q = q.eq('vehicle_id', vehicleId);
    q.then(({ data }) => {
      setImages((data || []).map(i => ({ id: i.id, url: i.image_url as string, perspective: i.perspective, vehicle_id: i.vehicle_id })));
      setLoading(false);
    });
  }, [vehicleId]);

  const vehicleLabel = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v.label])), [vehicles]);

  return (
    <div className="space-y-3">
      <select
        value={vehicleId}
        onChange={e => setVehicleId(e.target.value)}
        className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="all">Alle Fahrzeuge</option>
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : images.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Noch keine generierten Bilder vorhanden.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto pr-1">
          {images.map(img => (
            <button
              key={img.id}
              type="button"
              onClick={() => onPick(img.url)}
              className="group relative aspect-[4/3] rounded-md overflow-hidden border border-border hover:ring-2 hover:ring-primary"
              title={[vehicleLabel[img.vehicle_id || ''], img.perspective].filter(Boolean).join(' · ')}
            >
              <img src={img.url} alt={img.perspective || 'Fahrzeugbild'} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
