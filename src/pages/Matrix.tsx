import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { getCategoryColor, QUADRANT_LABELS } from '@/lib/constants';
import { useIsMobile } from '@/hooks/use-mobile';

const QUADS = [
  { key: 'Do Now', color: '#DC2626' },
  { key: 'Schedule', color: '#2563EB' },
  { key: 'Delegate', color: '#059669' },
  { key: 'Delete', color: '#9CA3AF' },
] as const;

export default function Matrix() {
  const { data: tasks, isLoading } = useTasks({ status: 'Active' });
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Do Now');
  const isMobile = useIsMobile();

  const grouped = QUADS.map((q) => ({
    ...q,
    tasks: tasks?.filter((t) => t.quadrant === q.key) ?? [],
  }));

  const sumHours = (arr: Task[]) => {
    const mins = arr.reduce((s, t) => s + (t.est_minutes || 0), 0);
    return (mins / 60).toFixed(1);
  };

  const activeQuad = grouped.find((g) => g.key === activeTab)!;

  return (
    <div className="space-y-4 md:space-y-5 pb-4 md:-mx-5">
      <h1 className="text-[22px] md:text-[26px] font-medium text-foreground md:px-5">Priority Matrix</h1>

      {isLoading ? (
        isMobile ? (
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-64 rounded-[14px]" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[350px] rounded-[14px]" />)}
          </div>
        )
      ) : isMobile ? (
        /* ── Mobile: Tabbed view ── */
        <div>
          {/* Tab bar */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
            {grouped.map(({ key, color, tasks: qTasks }) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className="flex-shrink-0 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors min-h-[44px]"
                  style={
                    isActive
                      ? { backgroundColor: color, color: '#FFFFFF' }
                      : { backgroundColor: 'transparent', color, border: `1.5px solid ${color}` }
                  }
                >
                  {key} ({qTasks.length})
                </button>
              );
            })}
          </div>

          {/* Quadrant info */}
          <div className="flex items-center justify-between mt-3 mb-2 px-0.5">
            <p className="text-[13px] font-medium text-muted-foreground">{QUADRANT_LABELS[activeTab]}</p>
            <p className="text-[13px] font-medium" style={{ color: activeQuad.color }}>
              {sumHours(activeQuad.tasks)}h est.
            </p>
          </div>

          {/* Task list */}
          <div className="space-y-1.5">
            {activeQuad.tasks.length === 0 ? (
              <div className="rounded-[14px] bg-card p-8 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
                <p className="text-[14px] text-muted-foreground">No tasks in {activeTab}</p>
              </div>
            ) : (
              activeQuad.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setEditTask(task)}
                  className="w-full flex items-center gap-3 text-left p-3.5 rounded-[14px] bg-card transition-colors active:opacity-80 min-h-[48px]"
                  style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(task.category) }}
                  />
                  <span className="text-[15px] flex-1 matrix-task-name">{task.name || 'Untitled task'}</span>
                  {task.est_minutes && (
                    <span className="text-[13px] flex-shrink-0 matrix-minutes">{task.est_minutes}m</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        /* ── Desktop: 2×2 grid ── */
        <div className="grid grid-cols-2 gap-2">
          {grouped.map(({ key, color, tasks: qTasks }) => (
            <div
              key={key}
              className="rounded-[14px] p-5 min-h-[280px] max-h-[300px] flex flex-col matrix-quad"
              style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
            >
              <div className="mb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold" style={{ color }}>{key}</p>
                  <span className="text-sm font-medium" style={{ color }}>{qTasks.length}</span>
                </div>
                <p className="text-xs matrix-sub">{QUADRANT_LABELS[key]}</p>
                <p className="text-xs matrix-sub">{sumHours(qTasks)}h est.</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {qTasks.length === 0 ? (
                  <p className="text-sm matrix-sub">No tasks</p>
                ) : (
                  qTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setEditTask(task)}
                      className="w-full flex items-center gap-3 text-left p-2.5 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
                    >
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(task.category) }} />
                      <span className="text-[15px] whitespace-normal flex-1 matrix-task-name">{task.name || 'Untitled task'}</span>
                      {task.est_minutes && (
                        <span className="text-[14px] flex-shrink-0 matrix-minutes">{task.est_minutes}m</span>
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
