import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface BackgroundJobTask {
  key: string;
  label: string;
  prompt: string;
  subIndex?: number;
  status: 'pending' | 'running' | 'done' | 'error';
  result_url?: string;
  error?: string;
}

export interface BackgroundJob {
  id: string;
  user_id: string;
  project_id: string | null;
  job_type: string;
  status: string;
  config: any;
  input_image_urls: string[];
  original_image_urls: string[];
  tasks: BackgroundJobTask[];
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  model_tier: string;
  vehicle_description: string;
  created_at: string;
  updated_at: string;
}

export function useBackgroundJobs() {
  const { user } = useAuth();
  const [activeJobs, setActiveJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    if (!user) { setActiveJobs([]); setLoading(false); return; }
    const { data } = await supabase
      .from('image_generation_jobs' as any)
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false });
    setActiveJobs((data as any) || []);
    setLoading(false);
  }, [user]);

  // Load on mount
  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('bg-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'image_generation_jobs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const job = payload.new as BackgroundJob;
          if (!job) return;
          setActiveJobs(prev => {
            if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
              return prev.filter(j => j.id !== job.id);
            }
            const idx = prev.findIndex(j => j.id === job.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = job;
              return next;
            }
            return [job, ...prev];
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Load completed jobs for a project
  const loadJobsForProject = useCallback(async (projectId: string): Promise<BackgroundJob[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('image_generation_jobs' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    return (data as any) || [];
  }, [user]);

  // Start a new background job
  const startJob = useCallback(async (params: {
    projectId: string | null;
    jobType: 'pipeline' | 'remaster';
    config: any;
    inputImageUrls: string[];
    originalImageUrls?: string[];
    tasks: { key: string; label: string; prompt: string; subIndex?: number }[];
    modelTier: string;
    vehicleDescription: string;
  }): Promise<string | null> => {
    if (!user) return null;

    const taskRows = params.tasks.map(t => ({
      ...t,
      status: 'pending' as const,
      result_url: null,
      error: null,
    }));

    const { data, error } = await supabase
      .from('image_generation_jobs' as any)
      .insert({
        user_id: user.id,
        project_id: params.projectId,
        job_type: params.jobType,
        status: 'pending',
        config: params.config,
        input_image_urls: params.inputImageUrls,
        original_image_urls: params.originalImageUrls || [],
        tasks: taskRows,
        total_tasks: taskRows.length,
        completed_tasks: 0,
        failed_tasks: 0,
        model_tier: params.modelTier,
        vehicle_description: params.vehicleDescription,
      } as any)
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to create job:', error);
      return null;
    }

    const jobId = (data as any).id;

    // Trigger the edge function to start processing
    supabase.functions.invoke('process-pipeline-job', {
      body: { jobId },
    }).catch(console.error);

    return jobId;
  }, [user]);

  // Retry failed tasks in a job
  const retryFailedTasks = useCallback(async (jobId: string) => {
    if (!user) return;
    const { data: job } = await supabase
      .from('image_generation_jobs' as any)
      .select('*')
      .eq('id', jobId)
      .single();

    if (!job) return;
    const tasks = (job as any).tasks as BackgroundJobTask[];
    const updated = tasks.map(t => t.status === 'error' ? { ...t, status: 'pending' as const, error: null } : t);
    const pendingCount = updated.filter(t => t.status === 'pending').length;

    await supabase
      .from('image_generation_jobs' as any)
      .update({
        tasks: updated,
        status: 'running',
        failed_tasks: 0,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', jobId);

    supabase.functions.invoke('process-pipeline-job', {
      body: { jobId },
    }).catch(console.error);
  }, [user]);

  return {
    activeJobs,
    loading,
    loadJobs,
    loadJobsForProject,
    startJob,
    retryFailedTasks,
  };
}
