import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { resolveProfileCardDesign } from '@/lib/live-inventory';

export function useLiveVehicleCardDesign() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['live-vehicle-card-design', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('profiles').select('ci_settings,email,phone').eq('id', user.id).maybeSingle();
      if (error) throw error;
      const design = resolveProfileCardDesign(user.email, data?.ci_settings);
      return design ? { ...design, contactEmail: data?.email || undefined, contactPhone: data?.phone || undefined } : null;
    },
    staleTime: 60_000,
  });
}