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

  return (
    <BackgroundTasksContext.Provider value={{ tasks, addTask, updateTask, removeTask, clearFinished }}>
      {children}
    </BackgroundTasksContext.Provider>
  );
};
