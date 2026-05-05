import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec.toString().padStart(2, '0')}s`;
}

/** Hook: returns elapsed ms while running; freezes value when stopped. */
export function useProcessTimer(running: boolean) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (running) {
      const start = Date.now();
      setStartedAt(start);
      setElapsed(0);
      const id = setInterval(() => setElapsed(Date.now() - start), 200);
      return () => clearInterval(id);
    }
  }, [running]);

  return { elapsed, startedAt, reset: () => { setStartedAt(null); setElapsed(0); } };
}

interface ProcessTimerProps {
  running: boolean;
  /** Optional fixed elapsed (ms) – used when parent tracks total time */
  elapsedMs?: number;
  label?: string;
  className?: string;
}

/** Live-ticking timer chip shown next to running/finished generation steps. */
const ProcessTimer: React.FC<ProcessTimerProps> = ({ running, elapsedMs, label, className }) => {
  const tracker = useProcessTimer(running && elapsedMs === undefined);
  const value = elapsedMs !== undefined ? elapsedMs : tracker.elapsed;

  return (
    <span
      className={
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground text-[11px] font-mono ' +
        (running ? 'animate-pulse ' : '') +
        (className || '')
      }
      title={label || 'Dauer'}
    >
      <Timer className="w-3 h-3" />
      {label ? <span className="font-sans font-medium">{label}:</span> : null}
      {formatDuration(value)}
    </span>
  );
};

export default ProcessTimer;
