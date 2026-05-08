import { supabase } from '@/integrations/supabase/client';
import type { VehicleData } from '@/types/vehicle';
import { generatePlaceholderVin } from '@/lib/vehicle-data-utils';

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

  // Read existing row (if any) so we can MERGE vehicle_data instead of overwriting.
  const { data: existing } = await supabase
    .from('vehicles')
    .select('id, vehicle_data, brand, model, year, color, title, cover_image_url')
    .eq('user_id', userId)
    .eq('vin', cleanVin)
    .maybeSingle();

  const existingData = (existing?.vehicle_data || {}) as Record<string, unknown>;
  const incomingData = (vehicleData as Record<string, unknown>) || {};

  // Deep-ish merge: keep existing keys, but overlay any non-empty incoming keys.
  const mergedData: Record<string, unknown> = { ...existingData };
  for (const [k, val] of Object.entries(incomingData)) {
    if (val == null) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      const prev = (existingData[k] as Record<string, unknown>) || {};
      const next: Record<string, unknown> = { ...prev };
      for (const [kk, vv] of Object.entries(val as Record<string, unknown>)) {
        const cur = (prev as Record<string, unknown>)[kk];
        const curStr = cur == null ? '' : String(cur).trim();
        const incStr = vv == null ? '' : String(vv).trim();
        // Fill empties; keep arrays/objects as-is when incoming is non-empty
        if (Array.isArray(vv) ? vv.length > 0 : incStr !== '') {
          if (Array.isArray(vv) || typeof vv === 'object' || curStr === '') {
            next[kk] = vv;
          }
        }
      }
      mergedData[k] = next;
    } else {
      const cur = (existingData[k] as unknown);
      const curStr = cur == null ? '' : String(cur).trim();
      const incStr = String(val).trim();
      if (incStr && (curStr === '' || k === 'category')) mergedData[k] = val;
      else if (curStr === '' && incStr) mergedData[k] = val;
    }
  }

  const payload: any = {
    user_id: userId,
    vin: cleanVin,
    brand: v.brand || existing?.brand || null,
    model: v.model || existing?.model || null,
    year: typeof v.year === 'number' ? v.year : (parseInt(v.year, 10) || existing?.year || null),
    color: v.color || existing?.color || null,
    title: title || existing?.title || null,
    vehicle_data: mergedData,
    cover_image_url: coverImageUrl || existing?.cover_image_url || null,
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
  return (data?.id as string) || null;
}

/**
 * Merge incoming vehicle data into a known vehicle row by id.
 * Used for deep-linked flows where the user's selected dashboard vehicle is
 * authoritative, even if the PDF does not contain a VIN.
 */
export async function mergeVehicleById(
  userId: string,
  vehicleId: string,
  vehicleData?: VehicleData | Record<string, unknown> | null,
  coverImageUrl?: string | null,
): Promise<string | null> {
  const { data: existing, error: readError } = await supabase
    .from('vehicles')
    .select('id, vin, vehicle_data, brand, model, year, color, title, cover_image_url')
    .eq('user_id', userId)
    .eq('id', vehicleId)
    .maybeSingle();

  if (readError || !existing) {
    console.error('[mergeVehicleById] vehicle not found:', readError);
    return null;
  }

  const incomingData = (vehicleData as Record<string, unknown>) || {};
  const existingData = (existing.vehicle_data || {}) as Record<string, unknown>;
  const mergedData: Record<string, unknown> = { ...existingData };

  for (const [k, val] of Object.entries(incomingData)) {
    if (val == null) continue;
    if (typeof val === 'object' && !Array.isArray(val)) {
      const prev = (existingData[k] as Record<string, unknown>) || {};
      const next: Record<string, unknown> = { ...prev };
      for (const [kk, vv] of Object.entries(val as Record<string, unknown>)) {
        const cur = prev[kk];
        const curStr = cur == null ? '' : String(cur).trim();
        const incStr = vv == null ? '' : String(vv).trim();
        if (Array.isArray(vv) ? vv.length > 0 : incStr !== '') {
          if (Array.isArray(vv) || typeof vv === 'object' || curStr === '') next[kk] = vv;
        }
      }
      mergedData[k] = next;
    } else {
      const cur = existingData[k];
      const curStr = cur == null ? '' : String(cur).trim();
      const incStr = String(val).trim();
      if (incStr && (curStr === '' || k === 'category')) mergedData[k] = val;
    }
  }

  const incomingVehicle = vehicleData && typeof vehicleData === 'object' && 'vehicle' in vehicleData
    ? (vehicleData as { vehicle?: Partial<VehicleData['vehicle']> }).vehicle || {}
    : {};
  const title = [existing.brand || v.brand, existing.model || v.model, v.variant].filter(Boolean).join(' ').trim() || existing.title || null;
  const { error } = await supabase
    .from('vehicles')
    .update({
      vehicle_data: mergedData,
      brand: existing.brand || incomingVehicle.brand || null,
      model: existing.model || incomingVehicle.model || null,
      year: existing.year || (typeof incomingVehicle.year === 'number' ? incomingVehicle.year : (parseInt(String(incomingVehicle.year || ''), 10) || null)),
      color: existing.color || incomingVehicle.color || null,
      title,
      cover_image_url: coverImageUrl || existing.cover_image_url || null,
    } as never)
    .eq('user_id', userId)
    .eq('id', vehicleId);

  if (error) {
    console.error('[mergeVehicleById] update failed:', error);
    return null;
  }

  return vehicleId;
}

/**
 * Like `ensureVehicle`, but generates a stable `NOVIN-…` placeholder VIN
 * when none is known yet. This guarantees that uploads/originals/banners are
 * always attached to a vehicle row, even before VIN lookup. The placeholder
 * can later be replaced once the real VIN is detected.
 */
export async function ensureVehicleAuto(
  userId: string,
  vin: string | null | undefined,
  vehicleData?: VehicleData | Record<string, unknown> | null,
  coverImageUrl?: string | null,
): Promise<string | null> {
  const cleanVin = (vin || '').trim().toUpperCase();
  if (cleanVin && cleanVin.length >= 5) {
    return ensureVehicle(userId, cleanVin, vehicleData, coverImageUrl);
  }
  const v: any = (vehicleData as any)?.vehicle || {};
  const placeholder = generatePlaceholderVin({
    brand: v.brand,
    model: v.model,
    title: v.variant,
  });
  return ensureVehicle(userId, placeholder, vehicleData, coverImageUrl);
}
