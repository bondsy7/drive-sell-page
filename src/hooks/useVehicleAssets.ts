import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AssetKind = 'original' | 'gallery' | 'spin360' | 'banner' | 'video';

export interface VehicleAsset {
  /** Stable id (storage path or row id). */
  id: string;
  kind: AssetKind;
  /** Public URL (image src or video src). */
  url: string;
  /** Optional thumbnail (videos). */
  thumbnailUrl?: string;
  /** Display label / perspective / folder. */
  label?: string;
  /** Folder/group inside the kind (e.g. gallery folder, spin job id). */
  group?: string;
  /** Created timestamp. */
  createdAt?: string;
  /** Storage path or DB id for delete operations. */
  storagePath?: string;
  /** Bucket name when applicable. */
  bucket?: string;
}

export interface VehicleAssetBundle {
  original: VehicleAsset[];
  gallery: VehicleAsset[];
  spin360: VehicleAsset[];
  banner: VehicleAsset[];
  video: VehicleAsset[];
  /** Total count across all kinds. */
  total: number;
}

/**
 * Collects every asset attached to a single vehicle from DB + Storage.
 * Used by VehicleAssetPicker so any generator (Banner, Video, LP, PDF flow)
 * can offer existing material as input instead of forcing a fresh upload.
 */
export function useVehicleAssets(vehicleId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vehicle-assets', user?.id, vehicleId],
    enabled: !!user && !!vehicleId,
    queryFn: async (): Promise<VehicleAssetBundle> => {
      if (!user || !vehicleId) {
        return { original: [], gallery: [], spin360: [], banner: [], video: [], total: 0 };
      }

      const prefix = `${user.id}/${vehicleId}`;

      // ── Originals (storage: originals/<user>/<vehicle>/...) ──
      const originalsP = supabase.storage
        .from('originals')
        .list(prefix, { limit: 200, sortBy: { column: 'created_at', order: 'asc' } })
        .then(async ({ data }) => {
          const files = (data || []).filter(f => f.name && !f.name.startsWith('.') && /\.(jpe?g|png|webp)$/i.test(f.name));
          if (files.length === 0) return [] as VehicleAsset[];
          // Originals bucket is PRIVATE → use signed URLs (1h) so the picker can preview them.
          const paths = files.map(f => `${prefix}/${f.name}`);
          const { data: signed } = await supabase.storage.from('originals').createSignedUrls(paths, 60 * 60);
          return files.map<VehicleAsset>((f, i) => {
            const path = paths[i];
            return {
              id: `orig:${path}`,
              kind: 'original',
              url: signed?.[i]?.signedUrl || '',
              label: f.name,
              createdAt: f.created_at,
              storagePath: path,
              bucket: 'originals',
            };
          }).filter(a => a.url);
        });

      // ── Gallery / Remastered (DB: project_images.vehicle_id) ──
      const galleryP = supabase
        .from('project_images')
        .select('id, image_url, image_base64, perspective, gallery_folder, created_at')
        .eq('user_id', user.id)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .then(({ data }) => (data || []).map<VehicleAsset>(r => ({
          id: `gal:${r.id}`,
          kind: 'gallery',
          url: r.image_url || (r.image_base64 ? `data:image/png;base64,${r.image_base64}` : ''),
          label: r.perspective || r.gallery_folder || 'Galerie',
          group: r.gallery_folder || undefined,
          createdAt: r.created_at,
        })).filter(a => a.url));

      // ── Spin360 frames (DB: spin360_jobs + canonical_images) ──
      const spinP = (async () => {
        const { data: jobs } = await supabase
          .from('spin360_jobs')
          .select('id')
          .eq('user_id', user.id)
          .eq('vehicle_id', vehicleId);
        const jobIds = (jobs || []).map(j => j.id);
        if (jobIds.length === 0) return [] as VehicleAsset[];
        const { data: frames } = await supabase
          .from('spin360_canonical_images')
          .select('id, job_id, perspective, image_url, sort_order, created_at')
          .in('job_id', jobIds)
          .order('sort_order', { ascending: true });
        return (frames || []).map<VehicleAsset>(f => ({
          id: `spin:${f.id}`,
          kind: 'spin360',
          url: f.image_url,
          label: f.perspective,
          group: f.job_id,
          createdAt: f.created_at,
        }));
      })();

      // ── Banners (storage: banners/<user>/<vehicle>/...) ──
      const bannersP = supabase.storage
        .from('banners')
        .list(prefix, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
        .then(({ data }) => {
          const files = (data || []).filter(f => f.name && !f.name.startsWith('.') && f.name.endsWith('.png'));
          return files.map<VehicleAsset>(f => {
            const path = `${prefix}/${f.name}`;
            const { data: pub } = supabase.storage.from('banners').getPublicUrl(path);
            return {
              id: `ban:${path}`,
              kind: 'banner',
              url: pub.publicUrl,
              label: f.name,
              createdAt: f.created_at,
              storagePath: path,
              bucket: 'banners',
            };
          });
        });

      // ── Videos (storage: vehicle-images/<user>/<vehicle>/videos/...) ──
      const videosP = supabase.storage
        .from('vehicle-images')
        .list(`${prefix}/videos`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
        .then(({ data }) => {
          const files = (data || []).filter(f => f.name && f.name.endsWith('.mp4'));
          return files.map<VehicleAsset>(f => {
            const path = `${prefix}/videos/${f.name}`;
            const { data: pub } = supabase.storage.from('vehicle-images').getPublicUrl(path);
            return {
              id: `vid:${path}`,
              kind: 'video',
              url: pub.publicUrl,
              label: f.name,
              createdAt: f.created_at,
              storagePath: path,
              bucket: 'vehicle-images',
            };
          });
        });

      const [original, gallery, spin360, banner, video] = await Promise.all([
        originalsP, galleryP, spinP, bannersP, videosP,
      ]);

      return {
        original,
        gallery,
        spin360,
        banner,
        video,
        total: original.length + gallery.length + spin360.length + banner.length + video.length,
      };
    },
  });
}
