import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Project, ProjectImage, Lead, VideoFile, BannerFile, Spin360Job } from '@/components/dashboard/types';

const PAGE_SIZE = 50;

// ─── Projects ────────────────────────────────────────────────

export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('projects')
        .select('id, title, template_id, vehicle_data, main_image_base64, main_image_url, html_content, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      return (data as Project[]) || [];
    },
    enabled: !!user,
  });
}

// ─── Gallery (paginated) ─────────────────────────────────────

export function useGallery(enabled: boolean, page = 0) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['gallery', user?.id, page],
    queryFn: async () => {
      if (!user) return { items: [] as ProjectImage[], total: 0 };
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from('project_images')
        .select('id, project_id, image_base64, image_url, perspective, gallery_folder, created_at', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);
      return { items: (data as ProjectImage[]) || [], total: count ?? 0 };
    },
    enabled: enabled && !!user,
  });
}

// ─── Leads (paginated) ──────────────────────────────────────

export function useLeads(enabled: boolean, page = 0) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['leads', user?.id, page],
    queryFn: async () => {
      if (!user) return { items: [] as Lead[], total: 0 };
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
      return { items: (data as Lead[]) || [], total: count ?? 0 };
    },
    enabled: enabled && !!user,
  });
}

// ─── Videos ─────────────────────────────────────────────────

export function useVideos(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['videos', user?.id],
    queryFn: async () => {
      if (!user) return [] as VideoFile[];
      const { data: files, error } = await supabase.storage
        .from('vehicle-images')
        .list(`${user.id}/videos`, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !files) return [];
      return files.filter(f => f.name.endsWith('.mp4')).map(f => {
        const { data: urlData } = supabase.storage.from('vehicle-images').getPublicUrl(`${user.id}/videos/${f.name}`);
        return { name: f.name, url: urlData.publicUrl, created_at: f.created_at };
      });
    },
    enabled: enabled && !!user,
  });
}

// ─── Banners ────────────────────────────────────────────────

export function useBanners(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['banners', user?.id],
    queryFn: async () => {
      if (!user) return [] as BannerFile[];
      const { data: files, error } = await supabase.storage
        .from('banners')
        .list(user.id, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
      if (error || !files) return [];
      return files.filter(f => f.name.endsWith('.png')).map(f => {
        const { data: urlData } = supabase.storage.from('banners').getPublicUrl(`${user.id}/${f.name}`);
        return { name: f.name, url: urlData.publicUrl, created_at: f.created_at, fullPath: `${user.id}/${f.name}` };
      });
    },
    enabled: enabled && !!user,
  });
}

// ─── Spin 360 ───────────────────────────────────────────────

export function useSpin360(enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['spin360', user?.id],
    queryFn: async () => {
      if (!user) return [] as Spin360Job[];
      const { data } = await supabase
        .from('spin360_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const now = Date.now();
      const staleMs = 5 * 60 * 1000;
      return (data || []).map((job): Spin360Job => {
        const updatedAt = job.updated_at ? new Date(job.updated_at).getTime() : 0;
        const isStale = job.status !== 'completed' && job.status !== 'failed' && updatedAt > 0 && now - updatedAt > staleMs;
        return {
          id: job.id,
          status: job.status,
          created_at: job.created_at,
          updated_at: job.updated_at,
          error_message: job.error_message,
          manifest: job.manifest as Spin360Job['manifest'],
          displayStatus: isStale ? 'failed' : job.status,
          displayError: isStale ? (job.error_message || 'Pipeline wurde abgebrochen, weil sie nicht weitergelaufen ist.') : job.error_message,
        };
      });
    },
    enabled: enabled && !!user,
  });
}

// ─── Counts (lightweight) ───────────────────────────────────

export function useDashboardCounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-counts', user?.id],
    queryFn: async () => {
      const userId = user?.id;
      const [imgRes, leadsRes, videosRes, bannersRes, spinRes] = await Promise.all([
        supabase.from('project_images').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        userId ? supabase.storage.from('vehicle-images').list(`${userId}/videos`, { limit: 200 }) : Promise.resolve({ data: null }),
        userId ? supabase.storage.from('banners').list(userId, { limit: 200 }) : Promise.resolve({ data: null }),
        supabase.from('spin360_jobs').select('id', { count: 'exact', head: true }),
      ]);
      return {
        gallery: imgRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        videos: videosRes.data?.filter(f => f.name.endsWith('.mp4')).length ?? 0,
        banners: bannersRes.data?.filter(f => f.name.endsWith('.png')).length ?? 0,
        spin360: spinRes.count ?? 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────

const runMutations = async (ops: Array<PromiseLike<{ error: { message: string } | null }>>) => {
  const results = await Promise.all(ops);
  const failed = results.find(r => r.error);
  if (failed?.error) throw failed.error;
};

const loadConversationIds = async (leadIds: string[], projectId?: string) => {
  const ids = new Set<string>();
  if (projectId) {
    const { data, error } = await supabase.from('sales_assistant_conversations').select('id').eq('project_id', projectId);
    if (error) throw error;
    data?.forEach(row => ids.add(row.id));
  }
  if (leadIds.length > 0) {
    const { data, error } = await supabase.from('sales_assistant_conversations').select('id').in('lead_id', leadIds);
    if (error) throw error;
    data?.forEach(row => ids.add(row.id));
  }
  return Array.from(ids);
};

const deleteConversationRelations = async (convIds: string[]) => {
  if (convIds.length === 0) return;
  await runMutations([
    supabase.from('sales_assistant_messages').delete().in('conversation_id', convIds),
    supabase.from('sales_assistant_tasks').delete().in('conversation_id', convIds),
    supabase.from('conversation_stage_log').delete().in('conversation_id', convIds),
    supabase.from('sales_email_outbox').delete().in('conversation_id', convIds),
    supabase.from('crm_manual_notes').delete().in('conversation_id', convIds),
    supabase.from('sales_notifications').delete().in('related_conversation_id', convIds),
    supabase.from('sales_quotes').delete().in('conversation_id', convIds),
    supabase.from('test_drive_bookings').delete().in('conversation_id', convIds),
    supabase.from('trade_in_valuations').delete().in('conversation_id', convIds),
  ]);
  await runMutations([supabase.from('sales_assistant_conversations').delete().in('id', convIds)]);
};

const deleteLeadRelations = async (leadIds: string[]) => {
  if (leadIds.length === 0) return;
  await runMutations([
    supabase.from('sales_email_outbox').delete().in('lead_id', leadIds),
    supabase.from('crm_manual_notes').delete().in('lead_id', leadIds),
    supabase.from('sales_notifications').delete().in('related_lead_id', leadIds),
    supabase.from('sales_quotes').delete().in('lead_id', leadIds),
    supabase.from('test_drive_bookings').delete().in('lead_id', leadIds),
    supabase.from('trade_in_valuations').delete().in('lead_id', leadIds),
  ]);
};

const deleteStorageFolder = async (bucket: 'vehicle-images' | 'banners', prefix: string) => {
  const files: string[] = [];
  const walk = async (path: string) => {
    const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const item of data || []) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      if ((item as { id?: string | null }).id) files.push(fullPath);
      else await walk(fullPath);
    }
  };
  await walk(prefix);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from(bucket).remove(files.slice(i, i + 100));
    if (error) throw error;
  }
};

export function useDeleteProject() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      const { data: leadRows, error: leadError } = await supabase.from('leads').select('id').eq('project_id', id);
      if (leadError) throw leadError;
      const leadIds = leadRows?.map(r => r.id) || [];
      const convIds = await loadConversationIds(leadIds, id);
      await deleteConversationRelations(convIds);
      await deleteLeadRelations(leadIds);
      if (leadIds.length > 0) await runMutations([supabase.from('leads').delete().in('id', leadIds)]);
      await runMutations([
        supabase.from('image_generation_jobs').delete().eq('project_id', id),
        supabase.from('project_images').delete().eq('project_id', id),
        supabase.from('sales_quotes').delete().eq('project_id', id),
        supabase.from('test_drive_bookings').delete().eq('project_id', id),
        supabase.from('projects').delete().eq('id', id),
      ]);
      await deleteStorageFolder('vehicle-images', `${user.id}/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['gallery'] });
      qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      toast.success('Projekt vollständig gelöscht');
    },
    onError: (err) => {
      console.error('Delete project error:', err);
      toast.error('Projekt konnte nicht vollständig gelöscht werden');
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const convIds = await loadConversationIds([id]);
      await deleteConversationRelations(convIds);
      await deleteLeadRelations([id]);
      await runMutations([supabase.from('leads').delete().eq('id', id)]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      toast.success('Anfrage vollständig gelöscht');
    },
    onError: (err) => {
      console.error('Delete lead error:', err);
      toast.error('Anfrage konnte nicht vollständig gelöscht werden');
    },
  });
}

export function useDeleteVideo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.storage.from('vehicle-images').remove([`${user.id}/videos/${name}`]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      toast.success('Video gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fullPath: string) => {
      const { error } = await supabase.storage.from('banners').remove([fullPath]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      qc.invalidateQueries({ queryKey: ['dashboard-counts'] });
      toast.success('Banner gelöscht');
    },
    onError: () => toast.error('Fehler beim Löschen'),
  });
}

export { PAGE_SIZE };
