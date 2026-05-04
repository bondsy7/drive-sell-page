import { supabase } from '@/integrations/supabase/client';
import type { VehicleData } from '@/types/vehicle';

/**
 * Upsert a vehicle row by (user_id, vin) and return its id.
 * Returns null if no usable VIN is provided — callers should treat
 * a null vehicle_id as "unassigned" rather than failing.
 */
export async function ensureVehicle(
  userId: string,
  vin: string | null | undefined,
  vehicleData?: VehicleData | Record<string, unknown> | null,
  coverImageUrl?: string | null,
): Promise<string | null> {
  const cleanVin = (vin || '').trim().toUpperCase();
  if (!cleanVin || cleanVin.length < 5) return null;

  const v: any = (vehicleData as any)?.vehicle || {};
  const title =
    [v.brand, v.model, v.variant].filter(Boolean).join(' ').trim() || null;

  const payload: any = {
    user_id: userId,
    vin: cleanVin,
    brand: v.brand || null,
    model: v.model || null,
    year: typeof v.year === 'number' ? v.year : (parseInt(v.year, 10) || null),
    color: v.color || null,
    title,
    vehicle_data: (vehicleData as any) || {},
    cover_image_url: coverImageUrl || null,
  };

  const { data, error } = await supabase
    .from('vehicles')
    .upsert([payload], { onConflict: 'user_id,vin' })
    .select('id')
    .single();

  if (error) {
    console.error('[ensureVehicle] upsert failed:', error);
    return null;
  }
  return (data as { id: string }).id;
}
