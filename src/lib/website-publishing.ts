import { supabase } from '@/integrations/supabase/client';

/** Additive website publishing layer. Never touches pipeline/remaster state. */
export type CoverMode = 'auto3' | 'ai';
export type GalleryMode = 'auto3' | 'append' | 'replace';
export type PublicationStatus = 'draft' | 'live' | 'disabled';

export interface PublicationItem {
  assetId: string;
  url: string;
  sortOrder: number;
}

export interface LiveSnapshot {
  coverMode: CoverMode;
  galleryMode: GalleryMode;
  coverImageUrl: string | null;
  images: { url: string; sortOrder: number }[];
}

export interface WebsitePublication {
  id: string;
  user_id: string;
  vehicle_id: string;
  target: string;
  source_system: string;
  external_vehicle_id: string;
  status: PublicationStatus;
  cover_mode: CoverMode;
  gallery_mode: GalleryMode;
  cover_asset_id: string | null;
  draft_items: PublicationItem[];
  live_snapshot: LiveSnapshot | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_TARGET = 'autoschmitt';
export const AUTO3_SOURCE = 'auto3';

/** Only public http(s) URLs may be published (no data:, no signed private URLs). */
export function isPublishableUrl(url: string): boolean {
  return /^https:\/\//i.test(url) && !/\/object\/sign\//.test(url) && !/[?&]token=/.test(url);
}

export function buildSnapshot(input: {
  coverMode: CoverMode;
  galleryMode: GalleryMode;
  coverUrl: string | null;
  items: PublicationItem[];
}): LiveSnapshot {
  if (input.coverUrl && input.coverMode === 'ai' && !isPublishableUrl(input.coverUrl)) throw new Error('Cover hat keine dauerhafte öffentliche Adresse.');
  if (input.galleryMode !== 'auto3' && input.items.some((it) => !isPublishableUrl(it.url))) throw new Error('Nur Bilder mit dauerhafter öffentlicher Adresse können veröffentlicht werden.');
  const images = input.galleryMode === 'auto3'
    ? []
    : [...input.items].sort((a, b) => a.sortOrder - b.sortOrder).map((it, i) => ({ url: it.url, sortOrder: i }));
  return {
    coverMode: input.coverMode,
    galleryMode: input.galleryMode,
    coverImageUrl: input.coverMode === 'ai' ? input.coverUrl : null,
    images,
  };
}

export function publicationStatusLabel(p: Pick<WebsitePublication, 'status' | 'live_snapshot'> | null | undefined): string {
  if (!p || p.status === 'disabled' || !p.live_snapshot) return 'Auto3';
  const s = p.live_snapshot;
  if (s.galleryMode === 'replace') return 'Nur AI';
  if (s.galleryMode === 'append') return 'AI+Auto3';
  if (s.coverMode === 'ai') return 'AI Cover';
  return 'Auto3';
}

/** Real VIN = present, not an internal AUTO3- fallback, 5-17 alphanumeric chars. */
export function isRealVin(vin: string | null | undefined): boolean {
  const v = (vin || '').trim().toUpperCase();
  return !!v && !v.startsWith('AUTO3-') && /^[A-Z0-9]{5,17}$/.test(v);
}

export interface ImportExternalVehicleInput {
  externalVehicleId: string;
  vin?: string | null;
  internalNumber?: string | null;
  imageUrls?: string[];
  title?: string | null;
}

/**
 * Assigns an Auto3 vehicle to an existing or new vehicle record.
 * Order: match by (source, external id) → match by VIN → create.
 * Without VIN the external id serves as internal technical VIN fallback.
 */
export async function importExternalVehicle(userId: string, input: ImportExternalVehicleInput) {
  const extId = input.externalVehicleId.trim();
  if (!extId) throw new Error('Auto3-ID fehlt');
  const vin = (input.vin || '').trim().toUpperCase();
  if (!isRealVin(vin)) throw new Error('Ohne gültige VIN wird kein Import durchgeführt.');
  const images = (input.imageUrls || []).map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u));
  const externalImages = images.map((url, i) => ({ url, sortOrder: i }));

  const patch = {
    source_system: AUTO3_SOURCE,
    external_vehicle_id: extId,
    external_internal_number: input.internalNumber?.trim() || null,
    external_images: externalImages as never,
  };

  const { data: byExt } = await supabase.from('vehicles').select('id')
    .eq('user_id', userId).eq('source_system', AUTO3_SOURCE).eq('external_vehicle_id', extId).maybeSingle();
  let id = byExt?.id as string | undefined;

  if (!id && vin) {
    const { data: byVin } = await supabase.from('vehicles').select('id, external_vehicle_id')
      .eq('user_id', userId).eq('vin', vin).maybeSingle();
    if (byVin) {
      if (byVin.external_vehicle_id && byVin.external_vehicle_id !== extId) {
        throw new Error('Diese VIN ist bereits einer anderen Auto3-ID zugeordnet.');
      }
      id = byVin.id;
    }
  }

  if (id) {
    const { error } = await supabase.from('vehicles').update(patch).eq('id', id);
    if (error) throw error;
    return id;
  }

  const { data, error } = await supabase.from('vehicles').insert([{
    user_id: userId,
    vin,
    title: input.title?.trim() || null,
    vehicle_data: {} as never,
    cover_image_url: images[0] || null,
    ...patch,
  }]).select('id').single();
  if (error) throw error;
  return data.id as string;
}

/** Gallery assets with a durable public URL. Banners/videos/spins/originals are never part of it. */
export interface GalleryAssetLike { id: string; url: string; label?: string | null }

const ONESHOT_ORDER = [
  'master', 'ext_34_front_right', 'ext_34_front_left', 'ext_front', 'ext_side_left', 'ext_side_right',
  'ext_34_rear_left', 'ext_34_rear_right', 'ext_rear', 'int_dashboard', 'int_front_seats', 'int_rear_seats',
];

/** Vehicle images from one Auto3 OneShot run (stored under auto3-jobs/<vehicle>/<job>/<slot>.png). */
export function selectAuto3JobImages<T extends GalleryAssetLike>(assets: T[], vehicleId: string, jobId: string): T[] {
  const marker = `/auto3-jobs/${vehicleId}/${jobId}/`;
  const slot = (u: string) => (u.split(marker)[1] || '').split(/[?#]/)[0].replace(/\.(png|jpe?g|webp)$/i, '');
  const rank = (u: string) => { const i = ONESHOT_ORDER.indexOf(slot(u)); return i < 0 ? ONESHOT_ORDER.length : i; };
  return assets
    .filter((a) => isPublishableUrl(a.url) && a.url.includes(marker) && /\.(png|jpe?g|webp)(\?|$)/i.test(a.url))
    .sort((a, b) => rank(a.url) - rank(b.url));
}

/** Default draft for a finished Auto3 OneShot run: AI cover + "Nur AI" gallery. Never publishes. */
export function buildAuto3JobDraft(images: GalleryAssetLike[]) {
  return {
    coverMode: 'ai' as CoverMode,
    galleryMode: 'replace' as GalleryMode,
    coverId: images[0]?.id ?? null,
    items: images.map((a, i) => ({ assetId: a.id, url: a.url, sortOrder: i })) as PublicationItem[],
  };
}
