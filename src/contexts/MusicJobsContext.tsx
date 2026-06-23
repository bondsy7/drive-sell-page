import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type MusicJobStatus = 'running' | 'done' | 'error';

export interface MusicJob {
  id: string;            // local id
  title: string;
  model: 'lyria-3-pro-preview' | 'lyria-3-clip-preview';
  startTime: number;
  endTime?: number;
  estDurationMs: number; // for progress estimation
  status: MusicJobStatus;
  error?: string;
}

interface MusicJobsContextValue {
  jobs: MusicJob[];
  activeJob: MusicJob | null;
  elapsedMs: number;
  addJob: (job: Omit<MusicJob, 'id' | 'startTime' | 'status'>) => string;
  clearJob: (id: string) => void;
  clearAll: () => void;
}

const MusicJobsContext = createContext<MusicJobsContextValue | null>(null);

export const useMusicJobs = () => {
  const ctx = useContext(MusicJobsContext);
  if (!ctx) throw new Error('useMusicJobs must be used within MusicJobsProvider');
  return ctx;
};

export const useMusicJobsSafe = () => useContext(MusicJobsContext);

// Rough server-side durations observed for Lyria 3
const EST_DURATION: Record<MusicJob['model'], number> = {
  'lyria-3-pro-preview': 110_000, // ~1:50 for full song
  'lyria-3-clip-preview': 35_000, // ~0:35 for clip
};

export const MusicJobsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<MusicJob[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRunning = jobs.some((j) => j.status === 'running');
  const activeJob = jobs.find((j) => j.status === 'running') || jobs[0] || null;

  // Live timer
  useEffect(() => {
    if (hasRunning) {
      tickRef.current = setInterval(() => setElapsedMs((v) => v + 500), 500);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [hasRunning]);

  // Poll user_songs for completion of any running job
  useEffect(() => {
    if (!hasRunning) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    const poll = async () => {
      const earliest = Math.min(...jobs.filter((j) => j.status === 'running').map((j) => j.startTime));
      const sinceIso = new Date(earliest - 1000).toISOString();
      const { data, error } = await supabase
        .from('user_songs')
        .select('id, title, created_at, model')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true });
      if (error || !data) return;
      setJobs((prev) => {
        const runningJobs = prev.filter((j) => j.status === 'running');
        if (runningJobs.length === 0) return prev;
        const next = [...prev];
        const usedSongIds = new Set<string>();
        for (const job of runningJobs) {
          const match = data.find(
            (s: any) =>
              !usedSongIds.has(s.id) &&
              s.model === job.model &&
              new Date(s.created_at).getTime() >= job.startTime - 1000,
          );
          if (match) {
            usedSongIds.add(match.id);
            const idx = next.findIndex((j) => j.id === job.id);
            if (idx >= 0) {
              next[idx] = { ...next[idx], status: 'done', endTime: Date.now() };
              toast.success(`"${match.title}" ist fertig – im Dashboard verfügbar`);
            }
          }
        }
        return next;
      });
    };
    pollRef.current = setInterval(poll, 4000);
    poll();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasRunning, jobs]);

  const addJob = useCallback<MusicJobsContextValue['addJob']>((job) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newJob: MusicJob = {
      id,
      startTime: Date.now(),
      status: 'running',
      estDurationMs: job.estDurationMs || EST_DURATION[job.model],
      ...job,
    };
    setJobs((prev) => [newJob, ...prev]);
    return id;
  }, []);

  const clearJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const clearAll = useCallback(() => setJobs([]), []);

  return (
    <MusicJobsContext.Provider value={{ jobs, activeJob, elapsedMs, addJob, clearJob, clearAll }}>
      {children}
    </MusicJobsContext.Provider>
  );
};

export { EST_DURATION as MUSIC_EST_DURATION };
