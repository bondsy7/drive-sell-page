import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Vehicle {
  id: string;
  user_id: string;
  vin: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  title: string | null;
  vehicle_data: Record<string, unknown>;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleWithCounts extends Vehicle {
  counts: {
    projects: number;
    images: number;
    spin360: number;
    banners: number;
    leads: number;
  };
}

interface VehiclesPage {
  items: VehicleWithCounts[];
  total: number;
}

const VEHICLES_PAGE_SIZE = 24;

type VehicleDashboardPageRow = Vehicle & {
  projects_count: number | null;
  images_count: number | null;
  spin360_count: number | null;
  banners_count: number | null;
  leads_count: number | null;
  cover_fallback: string | null;
  total_count: number | null;
};

/** List of vehicles with aggregated asset counts, loaded page-by-page for a fast first paint. */
export function useVehicles(options: { autoLoadAll?: boolean } = {}) {
  const { user } = useAuth();
  const autoLoadAll = options.autoLoadAll ?? true;

  const query = useInfiniteQuery({
    queryKey: ['vehicles', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<VehiclesPage> => {
      if (!user) return { items: [], total: 0 };

      const { data, error } = await supabase.rpc('get_vehicle_dashboard_page', {
        _limit: VEHICLES_PAGE_SIZE,
        _offset: Number(pageParam) || 0,
      });

      if (error) throw error;

      const rows = (data || []) as VehicleDashboardPageRow[];
      const total = rows[0]?.total_count ?? rows.length;

      return {
        total,
        items: rows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          vin: row.vin,
          brand: row.brand,
          model: row.model,
          year: row.year,
          color: row.color,
          title: row.title,
          vehicle_data: row.vehicle_data,
          cover_image_url: row.cover_image_url || row.cover_fallback || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
          counts: {
            projects: row.projects_count || 0,
            images: row.images_count || 0,
            spin360: row.spin360_count || 0,
            banners: row.banners_count || 0,
            leads: row.leads_count || 0,
          },
        })),
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    select: (data) => data.pages.flatMap((page) => page.items),
  });

  useEffect(() => {
    if (!autoLoadAll || !query.hasNextPage || query.isFetchingNextPage) return;
    const id = window.setTimeout(() => {
      query.fetchNextPage();
    }, 80);
    return () => window.clearTimeout(id);
  }, [autoLoadAll, query.data?.length, query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage]);

  return query;
}

/** Single vehicle by id. */
export function useVehicle(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vehicle', id],
    enabled: !!user && !!id,
    queryFn: async (): Promise<Vehicle | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as Vehicle) || null;
    },
  });
}

export interface UpsertVehicleInput {
  vin: string;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  title?: string | null;
  vehicle_data?: Record<string, unknown>;
  cover_image_url?: string | null;
}

/**
 * Upsert vehicle by (user_id, vin). Returns the resulting row.
 * Use this from PDFUpload / VIN-lookup flows so every generated asset
 * can attach its vehicle_id.
 */
export function useUpsertVehicle() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertVehicleInput): Promise<Vehicle> => {
      if (!user) throw new Error('Nicht eingeloggt');
      const payload = {
        user_id: user.id,
        vin: input.vin,
        brand: input.brand ?? null,
        model: input.model ?? null,
        year: input.year ?? null,
        color: input.color ?? null,
        title: input.title ?? null,
        vehicle_data: (input.vehicle_data ?? {}) as never,
        cover_image_url: input.cover_image_url ?? null,
      };
      const { data, error } = await supabase
        .from('vehicles')
        .upsert([payload], { onConflict: 'user_id,vin' })
        .select()
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<UpsertVehicleInput> }) => {
      const { data, error } = await supabase
        .from('vehicles')
        .update(patch as never)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Vehicle;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['vehicle', v.id] });
    },
  });
}

export function useDeleteVehicle() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Nicht eingeloggt');

      // Read VIN BEFORE deleting so we can also purge legacy storage
      // folders keyed by VIN (older code paths used VIN-prefixed paths).
      const { data: vRow } = await supabase
        .from('vehicles')
        .select('vin')
        .eq('id', id)
        .maybeSingle();
      const vin = ((vRow as { vin?: string } | null)?.vin || '').trim().toUpperCase();

      // Recursively list every file under a given storage prefix.
      const listRecursive = async (bucket: string, prefix: string): Promise<string[]> => {
        const out: string[] = [];
        const walk = async (p: string) => {
          const { data } = await supabase.storage.from(bucket).list(p, { limit: 1000 });
          for (const entry of data || []) {
            if (!entry.name || entry.name.startsWith('.')) continue;
            // Folders have null id/metadata in Supabase storage listings.
            const isFolder = !(entry as { id?: string | null }).id;
            const full = `${p}/${entry.name}`;
            if (isFolder) await walk(full);
            else out.push(full);
          }
        };
        await walk(prefix);
        return out;
      };

      // 1) Storage cleanup across all per-vehicle prefixes (recursive)
      const prefixes: Array<{ bucket: string; path: string }> = [
        { bucket: 'originals', path: `${user.id}/${id}` },
        { bucket: 'banners', path: `${user.id}/${id}` },
        { bucket: 'vehicle-images', path: `${user.id}/${id}` },
      ];
      if (vin) {
        prefixes.push(
          { bucket: 'vehicle-images', path: `${user.id}/${vin}` },
          { bucket: 'banners', path: `${user.id}/${vin}` },
          { bucket: 'originals', path: `${user.id}/${vin}` },
        );
      }
      for (const p of prefixes) {
        try {
          const files = await listRecursive(p.bucket, p.path);
          for (let i = 0; i < files.length; i += 100) {
            const chunk = files.slice(i, i + 100);
            if (chunk.length) await supabase.storage.from(p.bucket).remove(chunk);
          }
        } catch (e) {
          console.warn('[deleteVehicle] storage cleanup failed', p, e);
        }
      }

      // 2) DB cleanup (RLS-protected; user_id check enforced by policies)
      await Promise.all([
        supabase.from('project_images').delete().eq('vehicle_id', id),
        supabase.from('leads').delete().eq('vehicle_id', id),
        supabase.from('spin360_jobs').delete().eq('vehicle_id', id),
        supabase.from('projects').delete().eq('vehicle_id', id),
      ]);

      // 3) Finally the vehicle row itself
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['vehicle'] });
      qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      toast.success('Fahrzeug und alle zugehörigen Daten gelöscht');
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });
}
