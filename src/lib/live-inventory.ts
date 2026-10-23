/**
 * Shared logic for the "Live-Fahrzeuge" landing-page block.
 *
 * The landing page never stores vehicle data itself – it stores only the rule
 * (LiveInventoryConfig). The actual vehicles are re-resolved from the connected
 * Auto3/Indicar dealer stock every time the page is shown, so sold cars
 * disappear and new matching cars appear automatically.
 */
import { supabase } from '@/integrations/supabase/client';

export interface LiveVehicle {
  externalVehicleId: string;
  internalNumber?: string | null;
  brand: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  used: boolean | null;
  thumbnail: string | null;
  priceEur: number | null;
  monthlyRate: number | null;
  mileage: number | null;
  firstRegistration?: string | null;
  fuelType?: string | null;
  powerKw?: number | null;
  powerPs?: number | null;
  emissionText?: string | null;
}

/** Saved rule: the renderer (and later the website plugin) re-resolves live vehicles from this. */
export interface LiveInventoryConfig {
  enabled: boolean;
  mode: 'filter' | 'manual';
  brand: string; // '' = alle
  model: string; // '' = alle
  condition: 'all' | 'new' | 'used';
  selectedIds: string[];
  maxItems: number;
  layout: 'slider' | 'grid';
  title: string;
}

export const DEFAULT_LIVE_INVENTORY: LiveInventoryConfig = {
  enabled: false, mode: 'filter', brand: '', model: '', condition: 'all',
  selectedIds: [], maxItems: 8, layout: 'slider', title: 'Aktuelle Fahrzeuge aus unserem Bestand',
};

export function isLiveInventoryConfig(v: unknown): v is LiveInventoryConfig {
  return !!v && typeof v === 'object' && 'mode' in (v as any) && 'layout' in (v as any);
}

export function matchesLiveFilter(v: LiveVehicle, c: LiveInventoryConfig): boolean {
  if (c.brand && (v.brand || '').toLowerCase() !== c.brand.toLowerCase()) return false;
  if (c.model && (v.model || '').toLowerCase() !== c.model.toLowerCase()) return false;
  if (c.condition === 'new' && v.used !== false) return false;
  if (c.condition === 'used' && v.used !== true) return false;
  return true;
}

/** Vehicles that the block shows for this rule. Nothing is frozen – always resolved from the current stock. */
export function resolveLiveVehicles(items: LiveVehicle[], c: LiveInventoryConfig): LiveVehicle[] {
  if (!c.enabled) return [];
  if (c.mode === 'manual') {
    const wanted = new Set(c.selectedIds);
    return items.filter(v => wanted.has(v.externalVehicleId));
  }
  return items.filter(v => matchesLiveFilter(v, c)).slice(0, Math.max(1, c.maxItems));
}

/** Loads the current dealer stock for the connected Auto3/Indicar URL. */
export async function fetchLiveInventory(): Promise<{ items: LiveVehicle[]; inventoryUrl: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('auto3-inventory', { body: { action: 'live_list' } });
  if (error || data?.error) {
    let msg = data?.error as string | undefined;
    try { msg = msg || (await (error as any)?.context?.json?.())?.error; } catch { /* ignore */ }
    return { items: [], inventoryUrl: '', error: msg || 'Der Live-Bestand konnte nicht geladen werden.' };
  }
  return {
    items: (data?.items || []) as LiveVehicle[],
    inventoryUrl: typeof data?.tenantUrl === 'string' ? data.tenantUrl : '',
  };
}

/* ─── formatting (identical in editor preview and exported HTML) ─── */

export const livePriceLabel = (v: LiveVehicle) =>
  v.priceEur ? `${v.priceEur.toLocaleString('de-DE')} €` : 'Preis auf Anfrage';

export const liveTitleLabel = (v: LiveVehicle) => [v.brand, v.model].filter(Boolean).join(' ') || 'Fahrzeug';

export const liveSpecLabel = (v: LiveVehicle) => [
  v.used === false ? 'Neuwagen' : v.used ? 'Gebrauchtwagen' : null,
  v.year ? `${v.year}` : null,
  v.mileage != null ? `${v.mileage.toLocaleString('de-DE')} km` : null,
].filter(Boolean).join(' · ');
