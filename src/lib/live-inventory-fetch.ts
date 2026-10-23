/**
 * Network access for the live-stock block. Kept separate from the pure
 * rule/filter logic in `live-inventory.ts` so the logic stays testable
 * without a backend client.
 */
import { supabase } from '@/integrations/supabase/client';
import type { LiveVehicle } from '@/lib/live-inventory';

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
