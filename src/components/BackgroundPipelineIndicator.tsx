import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePipeline } from '@/contexts/PipelineContext';
import { Loader2, Check, Timer, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const BackgroundPipelineIndicator: React.FC = () => {
  const pipeline = usePipeline();
  const navigate = useNavigate();
  const location = useLocation();

  if (pipeline.status === 'idle') return null;

  // Hide on generator page – PipelineRunner handles display there
  if (location.pathname === '/generator') return null;

  const doneImages = Object.values(pipeline.jobs).reduce((s, j) => s + j.results.length, 0);
  const total = pipeline.totalImages;
  const percent = total > 0 ? (doneImages / total) * 100 : 0;

  const formatElapsed = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    return min === 0 ? `${sec}s` : `${min}m ${sec % 60}s`;
  };

  const elapsed = pipeline.endTime && pipeline.startTime
    ? pipeline.endTime - pipeline.startTime
    : pipeline.elapsedMs;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-xl shadow-lg p-3 w-64 cursor-pointer hover:shadow-xl transition-shadow"
      onClick={() => navigate('/generator')}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {pipeline.isRunning ? (
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
          ) : (
            <Check className="w-4 h-4 text-accent" />
          )}
          <span className="text-xs font-semibold text-foreground">
            {pipeline.isRunning ? 'Pipeline läuft…' : 'Pipeline fertig!'}
          </span>
        </div>
        {pipeline.isFinished && (
          <button
            onClick={(e) => { e.stopPropagation(); pipeline.clearPipeline(); }}
            className="w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center"
          >
            <X className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
      <Progress value={percent} className="h-1 mb-1.5" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{doneImages}/{total} Bilder</span>
        <span className="flex items-center gap-1 font-mono">
          <Timer className="w-2.5 h-2.5" />
          {formatElapsed(elapsed)}
        </span>
      </div>
    </div>
  );
};

export default BackgroundPipelineIndicator;
