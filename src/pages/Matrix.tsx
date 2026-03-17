import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { getCategoryColor, QUADRANT_LABELS } from '@/lib/constants';

const QUADS = [
  { key: 'Do Now', color: '#DC2626', bg: '#FEF2F2', darkBg: '#2A1515' },
  { key: 'Schedule', color: '#2563EB', bg: '#EFF6FF', darkBg: '#151D2A' },
  { key: 'Delegate', color: '#059669', bg: '#F0FDF4', darkBg: '#152A1D' },
  { key: 'Delete', color: '#9CA3AF', bg: '#F9FAFB', darkBg: '#1F1F1F' },
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
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-[14px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {grouped.map(({ key, color, bg, tasks: qTasks }) => (
            <div
              key={key}
              className="rounded-[14px] p-3.5 min-h-[200px] flex flex-col"
              style={{ backgroundColor: bg, border: '0.5px solid rgba(0,0,0,0.04)' }}
            >
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color }}>{key}</p>
                  <span className="text-xs font-medium" style={{ color }}>{qTasks.length}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{QUADRANT_LABELS[key]}</p>
                <p className="text-[10px] text-muted-foreground">{sumHours(qTasks)}h est.</p>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[300px]">
                {qTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tasks</p>
                ) : (
                  qTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setEditTask(task)}
                      className="w-full flex items-center gap-2 text-left p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(task.category) }} />
                      <span className="text-sm text-foreground truncate flex-1">{task.name}</span>
                      {task.est_minutes && (
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">{task.est_minutes}m</span>
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
