// Opt-in durable capture delivery; all writes use the authenticated user client.
export interface RemasterGalleryTarget {
  id: string;
  vehicleId: string;
  projectId?: string | null;
  folder: string;
  slotKey: string;
  perspective: string;
  sortOrder: number;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateGalleryTarget(value: unknown): RemasterGalleryTarget {
  const t = value as Partial<RemasterGalleryTarget> | null;
  if (!t || typeof t.id !== 'string' || !UUID.test(t.id)
    || typeof t.vehicleId !== 'string' || !UUID.test(t.vehicleId)
    || (t.projectId != null && (typeof t.projectId !== 'string' || !UUID.test(t.projectId)))
    || typeof t.folder !== 'string' || !t.folder || t.folder.length > 150
    || typeof t.slotKey !== 'string' || !/^[a-z0-9-]{1,80}$/.test(t.slotKey)
    || typeof t.perspective !== 'string' || !t.perspective || t.perspective.length > 150
    || !Number.isInteger(t.sortOrder) || Number(t.sortOrder) < 0) {
    throw new Error('Ungültiges Speicherziel für das Remasterbild.');
  }
  return t as RemasterGalleryTarget;
}
// Structural client type keeps this helper directly testable without Deno imports.
export async function verifyGalleryOwnership(client: any, userId: string, target: RemasterGalleryTarget) {
  const { data, error } = await client.from('vehicles').select('id').eq('id', target.vehicleId).eq('user_id', userId).maybeSingle();
  if (error || !data) throw new Error('Fahrzeug gehört nicht zum angemeldeten Konto.');
  if (target.projectId) {
    const { data: project, error: e } = await client.from('projects').select('id').eq('id', target.projectId).eq('user_id', userId).maybeSingle();
    if (e || !project) throw new Error('Projekt gehört nicht zum angemeldeten Konto.');
  }
}
export async function persistRemasterGallery(client: any, userId: string, target: RemasterGalleryTarget, image: string) {
  const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/s);
  if (!match) throw new Error('Remasterbild kann nicht gespeichert werden.');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const path = `${userId}/remaster/${target.vehicleId}/${target.id}.png`;
  const { error: uploadError } = await client.storage.from('vehicle-images').upload(path, bytes, { contentType: match[1], upsert: true });
  if (uploadError) throw new Error('Remasterbild konnte nicht dauerhaft gespeichert werden.');
  const { data: url } = client.storage.from('vehicle-images').getPublicUrl(path);
  const { error } = await client.from('project_images').upsert({
    id: target.id, user_id: userId, vehicle_id: target.vehicleId,
    project_id: target.projectId || null, image_url: url.publicUrl, image_base64: '',
    gallery_folder: target.folder, perspective: target.perspective, sort_order: target.sortOrder,
  }, { onConflict: 'id' });
  if (error) throw new Error('Remasterbild konnte nicht in der Galerie gesichert werden.');
  return { id: target.id, imageUrl: url.publicUrl };
}