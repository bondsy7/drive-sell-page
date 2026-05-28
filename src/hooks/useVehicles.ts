import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

/** List of vehicles with aggregated asset counts. */
export function useVehicles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['vehicles', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<VehicleWithCounts[]> => {
      if (!user) return [];

      const { data: vs, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const vehicles = (vs || []) as Vehicle[];
      if (vehicles.length === 0) return [];

      const ids = vehicles.map(v => v.id);

      const [pr, pi, sp, ld] = await Promise.all([
        supabase.from('projects').select('id, vehicle_id').in('vehicle_id', ids),
        supabase.from('project_images').select('id, vehicle_id').in('vehicle_id', ids),
        supabase.from('spin360_jobs').select('id, vehicle_id').in('vehicle_id', ids),
        supabase.from('leads').select('id, vehicle_id, project_id').eq('dealer_user_id', user.id),
      ]);

      // Banner counts via storage list per vehicle (parallel)
      const bannerEntries = await Promise.all(
        ids.map(async (vid) => {
          const { data } = await supabase.storage
            .from('banners')
            .list(`${user.id}/${vid}`, { limit: 200 });
          const count = (data || []).filter(f => f.name && !f.name.startsWith('.') && !f.name.startsWith('state-')).length;
          return [vid, count] as const;
        })
      );
      const cB = new Map<string, number>(bannerEntries);

      const tally = (rows: Array<{ vehicle_id: string | null }> | null) => {
        const map = new Map<string, number>();
        for (const r of rows || []) {
          if (!r.vehicle_id) continue;
          map.set(r.vehicle_id, (map.get(r.vehicle_id) || 0) + 1);
        }
        return map;
      };

      const cP = tally(pr.data as Array<{ vehicle_id: string | null }>);
      const cI = tally(pi.data as Array<{ vehicle_id: string | null }>);
      const cS = tally(sp.data as Array<{ vehicle_id: string | null }>);
      const projectToVehicle = new Map<string, string>();
      for (const row of (pr.data as Array<{ id: string; vehicle_id: string | null }>) || []) {
        if (row.vehicle_id) projectToVehicle.set(row.id, row.vehicle_id);
      }
      const cL = new Map<string, number>();
      for (const row of (ld.data as Array<{ vehicle_id: string | null; project_id: string | null }>) || []) {
        const vehicleId = row.vehicle_id || (row.project_id ? projectToVehicle.get(row.project_id) : null);
        if (vehicleId) cL.set(vehicleId, (cL.get(vehicleId) || 0) + 1);
      }

      return vehicles.map(v => ({
        ...v,
        counts: {
          projects: cP.get(v.id) || 0,
          images: cI.get(v.id) || 0,
          spin360: cS.get(v.id) || 0,
          banners: cB.get(v.id) || 0,
          leads: cL.get(v.id) || 0,
        },
      }));
    },
  });
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
