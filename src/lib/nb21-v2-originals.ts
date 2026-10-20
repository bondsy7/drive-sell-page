import { supabase } from '@/integrations/supabase/client';
import type { V2Reference } from '@/prompts/nb21/v2';

/** V2 archives explicit roles and returns durable IDs; legacy uploader stays intact. */
export async function archiveV2Original(userId: string, vehicleId: string, source: V2Reference): Promise<string> {
  const role = source.sourceRole.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const path = `${userId}/${vehicleId}/${Date.now()}-0-${role}-original.jpg`;
  const response = await fetch(source.image);
  const blob = await response.blob();
  const { error } = await supabase.storage.from('originals').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) throw new Error('Originalfoto konnte nicht gesichert werden.');
  return path;
}