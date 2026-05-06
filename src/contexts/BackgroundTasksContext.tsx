import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export type BgTaskType = 'banner' | 'video' | 'other';
export type BgTaskStatus = 'running' | 'done' | 'error';

export interface BgTask {
  id: string;
  type: BgTaskType;
  label: string;
  total: number;
  completed: number;
  status: BgTaskStatus;
  startedAt: number;
  finishedAt?: number;
  /** Route to navigate to when user clicks the indicator after completion */
  resultRoute?: string;
  errorMessage?: string;
}

interface BgTasksContextValue {
  tasks: BgTask[];
  addTask: (task: Omit<BgTask, 'startedAt' | 'completed' | 'status'> & Partial<Pick<BgTask, 'completed' | 'status'>>) => void;
  updateTask: (id: string, patch: Partial<BgTask>) => void;
  removeTask: (id: string) => void;
  clearFinished: () => void;
  /** Start a video polling job that survives page navigation. */
  startVideoPolling: (params: {
    operationName: string;
    vehicleId?: string | null;
    onDone?: (result: { videoUrl?: string; videoBase64?: string; videoUri?: string; error?: string }) => void;
  }) => string;
}

const BackgroundTasksContext = createContext<BgTasksContextValue | null>(null);

export const useBackgroundTasks = (): BgTasksContextValue => {
  const ctx = useContext(BackgroundTasksContext);
  if (!ctx) throw new Error('useBackgroundTasks must be used within BackgroundTasksProvider');
  return ctx;
};

export const useBackgroundTasksSafe = (): BgTasksContextValue | null => {
  return useContext(BackgroundTasksContext);
};

export const BackgroundTasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<BgTask[]>([]);
  const tasksRef = useRef<BgTask[]>([]);
  tasksRef.current = tasks;

  const addTask: BgTasksContextValue['addTask'] = useCallback((task) => {
    setTasks((prev) => {
      // Replace if same id exists
      const filtered = prev.filter((t) => t.id !== task.id);
      return [
        ...filtered,
        {
          completed: 0,
          status: 'running',
          startedAt: Date.now(),
          ...task,
        } as BgTask,
      ];
    });
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<BgTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === 'running'));
  }, []);

  // Warn before unloading the page while tasks are running
  useEffect(() => {
    const hasRunning = tasks.some((t) => t.status === 'running');
    if (!hasRunning) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [tasks]);

  // Active video poll intervals (kept in provider scope so they survive page navigation)
  const videoPollsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const startVideoPolling: BgTasksContextValue['startVideoPolling'] = useCallback(({ operationName, vehicleId, onDone }) => {
    const taskId = `video-${Date.now()}`;
    setTasks((prev) => [
      ...prev,
      {
        id: taskId,
        type: 'video',
        label: 'Video wird erstellt',
        total: 1,
        completed: 0,
        status: 'running',
        startedAt: Date.now(),
      },
    ]);

    let attempts = 0;
    const maxAttempts = 90; // ~7.5 min
    // Lazy import to avoid circular deps
    import('@/integrations/supabase/client').then(({ supabase }) => {
      const interval = setInterval(async () => {
        attempts += 1;
        try {
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: { action: 'poll', operationName, vehicleId: vehicleId || undefined },
          });
          if (error) return;
          if (data?.done) {
            clearInterval(interval);
            delete videoPollsRef.current[taskId];
            const videoSrc = data.videoUrl || data.videoBase64 || data.videoUri;
            if (videoSrc) {
              setTasks((prev) => prev.map((t) => t.id === taskId ? {
                ...t,
                status: 'done',
                completed: 1,
                finishedAt: Date.now(),
                resultRoute: vehicleId ? `/vehicle/${vehicleId}` : '/dashboard?tab=videos',
              } : t));
              onDone?.({ videoUrl: data.videoUrl, videoBase64: data.videoBase64, videoUri: data.videoUri });
            } else {
              setTasks((prev) => prev.map((t) => t.id === taskId ? {
                ...t,
                status: 'error',
                finishedAt: Date.now(),
                errorMessage: data.error || 'Video-Generierung fehlgeschlagen',
              } : t));
              onDone?.({ error: data.error || 'Fehler' });
            }
            return;
          }
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            delete videoPollsRef.current[taskId];
            setTasks((prev) => prev.map((t) => t.id === taskId ? {
              ...t,
              status: 'error',
              finishedAt: Date.now(),
              errorMessage: 'Zeitüberschreitung',
            } : t));
            onDone?.({ error: 'Zeitüberschreitung' });
          }
        } catch (e) {
          // ignore transient errors
        }
      }, 5000);
      videoPollsRef.current[taskId] = interval;
    });

    return taskId;
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => () => {
    Object.values(videoPollsRef.current).forEach((id) => clearInterval(id));
  }, []);

  return (
    <BackgroundTasksContext.Provider value={{ tasks, addTask, updateTask, removeTask, clearFinished, startVideoPolling }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
};
