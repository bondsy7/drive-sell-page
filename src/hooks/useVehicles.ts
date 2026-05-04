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
        supabase.from('leads').select('id, vehicle_id').in('vehicle_id', ids),
      ]);

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
      const cL = tally(ld.data as Array<{ vehicle_id: string | null }>);

      return vehicles.map(v => ({
        ...v,
        counts: {
          projects: cP.get(v.id) || 0,
          images: cI.get(v.id) || 0,
          spin360: cS.get(v.id) || 0,
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Fahrzeug gelöscht');
    },
    onError: (e: Error) => toast.error(`Fehler: ${e.message}`),
  });
}
