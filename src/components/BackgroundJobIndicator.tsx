import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, AlertCircle, X, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useBackgroundJobs, type BackgroundJob } from '@/hooks/useBackgroundJobs';

const BackgroundJobIndicator: React.FC = () => {
  const { activeJobs } = useBackgroundJobs();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const visibleJobs = activeJobs.filter(j => !dismissed.has(j.id));
  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {visibleJobs.map(job => (
        <JobCard
          key={job.id}
          job={job}
          onDismiss={() => setDismissed(prev => new Set(prev).add(job.id))}
          onNavigate={() => job.project_id && navigate(`/project/${job.project_id}`)}
        />
      ))}
    </div>
  );
};

const JobCard: React.FC<{
  job: BackgroundJob;
  onDismiss: () => void;
  onNavigate: () => void;
}> = ({ job, onDismiss, onNavigate }) => {
  const total = job.total_tasks;
  const done = job.completed_tasks + job.failed_tasks;
  const percent = total > 0 ? (done / total) * 100 : 0;
  const isRunning = job.status === 'running' || job.status === 'pending';

  // Find current running task
  const currentTask = (job.tasks as any[]).find(t => t.status === 'running');
  const currentLabel = currentTask?.label || 'Wird vorbereitet…';

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 animate-in slide-in-from-right-5 duration-300">
      <div className="flex items-start gap-2">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center shrink-0
          ${isRunning ? 'bg-primary text-primary-foreground' : 'bg-accent/10 text-accent'}
        `}>
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground truncate">
              {job.job_type === 'pipeline' ? 'Pipeline' : 'Remastering'} läuft…
            </p>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {isRunning ? currentLabel : `${job.completed_tasks} erstellt, ${job.failed_tasks} fehlgeschlagen`}
          </p>
          <div className="mt-1.5">
            <Progress value={percent} className="h-1" />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">
              {done}/{total} Bilder
            </span>
            {job.project_id && (
              <button
                onClick={onNavigate}
                className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
              >
                Details <ChevronRight className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackgroundJobIndicator;
