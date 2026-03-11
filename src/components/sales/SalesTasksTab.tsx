import React from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, XCircle, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSalesAssistant } from '@/hooks/useSalesAssistant';
import { TASK_TYPE_LABELS, PRIORITY_LABELS, type TaskType, type TaskPriority } from '@/types/sales-assistant';

export default function SalesTasksTab() {
  const { tasks, tasksLoading, updateTaskStatus } = useSalesAssistant();

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await updateTaskStatus(taskId, newStatus);
    toast.success(newStatus === 'done' ? 'Aufgabe erledigt!' : 'Status aktualisiert.');
  };

  const priorityColors: Record<string, string> = {
    low: 'text-muted-foreground',
    medium: 'text-blue-600',
    high: 'text-orange-600',
    urgent: 'text-red-600',
  };

  const openTasks = tasks.filter(t => t.status === 'open');
  const doneTasks = tasks.filter(t => t.status === 'done');

  if (tasksLoading) return <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      {/* Open Tasks */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3">
          Offene Aufgaben ({openTasks.length})
        </h3>
        {openTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Keine offenen Aufgaben.</p>
            <p className="text-xs mt-1">Der Assistent schlägt nach jeder Generierung nächste Schritte vor.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border bg-card p-3 flex items-start gap-3">
                <button onClick={() => handleStatusChange(task.id, 'done')} className="mt-0.5 shrink-0">
                  <Circle className="w-5 h-5 text-muted-foreground hover:text-accent transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground">{task.title}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                      {TASK_TYPE_LABELS[task.task_type as TaskType] || task.task_type}
                    </span>
                    <span className={`text-[10px] font-bold ${priorityColors[task.priority] || ''}`}>
                      {PRIORITY_LABELS[task.priority as TaskPriority] || task.priority}
                    </span>
                  </div>
                  {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                  {task.due_at && <p className="text-xs text-muted-foreground mt-1">Fällig: {new Date(task.due_at).toLocaleDateString('de-DE')}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(task.id, 'cancelled')} title="Abbrechen">
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Done Tasks */}
      {doneTasks.length > 0 && (
        <div>
          <h3 className="font-semibold text-muted-foreground text-sm mb-3">Erledigte Aufgaben ({doneTasks.length})</h3>
          <div className="space-y-1">
            {doneTasks.slice(0, 10).map((task) => (
              <div key={task.id} className="rounded-lg border border-border/50 bg-muted/20 p-3 flex items-center gap-3 opacity-60">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <span className="text-sm text-foreground line-through">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
