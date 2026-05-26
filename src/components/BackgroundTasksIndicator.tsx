import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackgroundTasksSafe, type BgTask } from '@/contexts/BackgroundTasksContext';
import { Loader2, Check, Timer, X, AlertCircle, Image as ImageIcon, Video } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const formatElapsed = (ms: number) => {
  if (ms < 0) ms = 0;
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  return min === 0 ? `${sec}s` : `${min}m ${sec % 60}s`;
};

const taskIcon = (t: BgTask) => {
  if (t.status === 'error') return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (t.status === 'done') return <Check className="w-4 h-4 text-accent" />;
  if (t.type === 'video') return <Video className="w-4 h-4 text-accent animate-pulse" />;
  if (t.type === 'banner') return <ImageIcon className="w-4 h-4 text-accent animate-pulse" />;
  return <Loader2 className="w-4 h-4 text-accent animate-spin" />;
};

const TaskCard: React.FC<{ task: BgTask; onClose: () => void; onClick: () => void }> = ({ task, onClose, onClick }) => {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    if (task.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [task.status]);

  const elapsed = (task.finishedAt ?? now) - task.startedAt;
  const derivedPct = task.total > 0 ? (task.completed / task.total) * 100 : (task.status === 'done' ? 100 : 0);
  const percent = Math.min(100, task.percent ?? derivedPct);

  const headline = task.status === 'done'
    ? `${task.label} fertig!`
    : task.status === 'error'
      ? `${task.label} – Fehler`
      : (task.stageLabel || task.label);

  return (
    <div
      className="bg-card border border-border rounded-xl shadow-lg p-3 w-80 cursor-pointer hover:shadow-xl transition-shadow"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {taskIcon(task)}
          <span className="text-xs font-semibold text-foreground truncate">
            {headline}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(percent)}%</span>
          {task.status !== 'running' && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-5 h-5 rounded-full hover:bg-muted flex items-center justify-center"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      {task.currentLabel && task.status === 'running' && (
        <p className="text-[11px] text-muted-foreground truncate mb-1.5">{task.currentLabel}</p>
      )}
      <Progress value={percent} className="h-1.5 mb-1.5" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>
          {task.total > 1 ? `${task.completed}/${task.total}` : task.status === 'running' ? 'läuft…' : task.status === 'done' ? 'fertig' : 'Fehler'}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <Timer className="w-2.5 h-2.5" />
          {formatElapsed(elapsed)}
        </span>
      </div>
      {task.status === 'error' && task.errorMessage && (
        <p className="text-[10px] text-destructive mt-1 line-clamp-2">{task.errorMessage}</p>
      )}
    </div>
  );
};

const BackgroundTasksIndicator: React.FC = () => {
  const ctx = useBackgroundTasksSafe();
  const navigate = useNavigate();

  if (!ctx || ctx.tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
      {ctx.tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onClose={() => ctx.removeTask(task.id)}
          onClick={() => {
            if (task.status === 'done' && task.resultRoute) {
              navigate(task.resultRoute);
              ctx.removeTask(task.id);
            }
          }}
        />
      ))}
    </div>
  );
};

export default BackgroundTasksIndicator;
