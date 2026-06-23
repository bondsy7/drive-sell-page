import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMusicJobsSafe } from '@/contexts/MusicJobsContext';
import { Loader2, Check, Timer, X, Music } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const BackgroundMusicIndicator: React.FC = () => {
  const ctx = useMusicJobsSafe();
  const navigate = useNavigate();
  const location = useLocation();

  if (!ctx || ctx.jobs.length === 0) return null;
  const job = ctx.activeJob;
  if (!job) return null;

  // Don't double-render on music studio itself
  if (location.pathname === '/generator/music-studio') return null;

  const isRunning = job.status === 'running';
  const elapsed = isRunning ? Date.now() - job.startTime : (job.endTime || Date.now()) - job.startTime;
  // Cap progress at 95% until completion confirmed
  const rawPct = (elapsed / job.estDurationMs) * 100;
  const percent = isRunning ? Math.min(95, rawPct) : 100;

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    return min === 0 ? `${sec}s` : `${min}m ${sec % 60}s`;
  };
  const estRemaining = Math.max(0, job.estDurationMs - elapsed);

  // Offset above pipeline indicator if both present
  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-xl shadow-lg p-3 w-64 cursor-pointer hover:shadow-xl transition-shadow"
      style={{ marginBottom: 0 }}
      onClick={() => {
        if (!isRunning) {
          navigate('/dashboard?tab=songs');
          ctx.clearJob(job.id);
        } else {
          navigate('/dashboard?tab=songs');
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning ? (
            <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-accent shrink-0" />
          )}
          <Music className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate">
            {isRunning ? 'Song wird erstellt…' : 'Song fertig!'}
          </span>
        </div>
        {!isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); ctx.clearJob(job.id); }}
            className="w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground truncate mb-1.5">{job.title}</p>
      <Progress value={percent} className="h-1 mb-1.5" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="truncate">
          {isRunning ? `noch ~${formatElapsed(estRemaining)}` : 'Im Dashboard verfügbar'}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <Timer className="w-2.5 h-2.5" />
          {formatElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
};

export default BackgroundMusicIndicator;
