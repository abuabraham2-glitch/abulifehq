import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { getCategoryColor, QUADRANT_LABELS } from '@/lib/constants';

const QUADS = [
  { key: 'Do Now', color: '#DC2626' },
  { key: 'Schedule', color: '#2563EB' },
  { key: 'Delegate', color: '#059669' },
  { key: 'Delete', color: '#9CA3AF' },
] as const;

export default function Matrix() {
  const { data: tasks, isLoading } = useTasks({ status: 'Active' });
  const [editTask, setEditTask] = useState<Task | null>(null);

  const grouped = QUADS.map((q) => ({
    ...q,
    tasks: tasks?.filter((t) => t.quadrant === q.key) ?? [],
  }));

  const sumHours = (arr: Task[]) => {
    const mins = arr.reduce((s, t) => s + (t.est_minutes || 0), 0);
    return (mins / 60).toFixed(1);
  };

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-[22px] font-medium text-foreground">Priority Matrix</h1>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-[14px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {grouped.map(({ key, color, tasks: qTasks }) => (
            <div
              key={key}
              className="rounded-[14px] p-3.5 min-h-[200px] flex flex-col matrix-quad"
              style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color }}>{key}</p>
                  <span className="text-xs font-medium" style={{ color }}>{qTasks.length}</span>
                </div>
                <p className="text-[10px] matrix-sub">{QUADRANT_LABELS[key]}</p>
                <p className="text-[10px] matrix-sub">{sumHours(qTasks)}h est.</p>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[300px]">
                {qTasks.length === 0 ? (
                  <p className="text-xs matrix-sub">No tasks</p>
                ) : (
                  qTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setEditTask(task)}
                      className="w-full flex items-center gap-2 text-left p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(task.category) }} />
                      <span className="text-sm truncate flex-1 matrix-task-name">{task.name || 'Untitled task'}</span>
                      {task.est_minutes && (
                        <span className="text-[11px] flex-shrink-0 matrix-minutes">{task.est_minutes}m</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
    </div>
  );
}
