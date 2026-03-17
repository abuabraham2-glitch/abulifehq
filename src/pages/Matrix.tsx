import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveTasks, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { getCategoryColor } from '@/lib/categories';

const quadrants = [
  { key: 'Do Now', label: 'DO NOW', sub: 'Important & Urgent', color: '#EF4444' },
  { key: 'Schedule', label: 'SCHEDULE', sub: 'Important & Not Urgent', color: '#3B82F6' },
  { key: 'Delegate', label: 'DELEGATE', sub: 'Not Important & Urgent', color: '#10B981' },
  { key: 'Delete', label: 'LOW PRIORITY', sub: 'Not Important & Not Urgent', color: '#9CA3AF' },
] as const;

export default function MatrixPage() {
  const { data: tasks, isLoading } = useActiveTasks();
  const [editTask, setEditTask] = useState<Task | null>(null);

  const grouped = {
    'Do Now': tasks?.filter((t) => t.quadrant === 'Do Now') ?? [],
    'Schedule': tasks?.filter((t) => t.quadrant === 'Schedule') ?? [],
    'Delegate': tasks?.filter((t) => t.quadrant === 'Delegate') ?? [],
    'Delete': tasks?.filter((t) => t.quadrant === 'Delete') ?? [],
  };

  const sumHours = (arr: Task[]) => (arr.reduce((s, t) => s + (t.est_minutes || 0), 0) / 60).toFixed(1);

  if (isLoading) {
    return (
      <div className="space-y-5 pb-4">
        <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
        <div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quadrants.map(({ key, label, sub, color }) => {
          const items = grouped[key];
          return (
            <Card key={key} className="border-none shadow-sm rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border" style={{ backgroundColor: `${color}0A` }}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold tracking-wide" style={{ color }}>{label}</span>
                  <span className="text-xs font-bold" style={{ color }}>{items.length}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{sub} · {sumHours(items)}h</p>
              </div>
              <CardContent className="p-3 max-h-60 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                ) : (
                  <div className="space-y-1">
                    {items.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setEditTask(task)}
                        className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCategoryColor(task.category) }}
                        />
                        <span className="text-xs truncate flex-1">{task.name}</span>
                        {task.est_minutes && (
                          <span className="text-[10px] text-muted-foreground">{task.est_minutes}m</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
    </div>
  );
}
