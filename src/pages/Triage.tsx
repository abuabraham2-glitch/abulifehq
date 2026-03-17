import { useState } from 'react';
import { Check, Edit, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingTriage, useResolveTriage } from '@/hooks/useTriageQueue';
import { useUpdateTask, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { getCategoryColor, getQuadrantColor } from '@/lib/constants';

export default function Triage() {
  const { data: items, isLoading } = usePendingTriage();
  const resolveTriage = useResolveTriage();
  const updateTask = useUpdateTask();
  const [editTask, setEditTask] = useState<Task | null>(null);

  const handleApprove = async (item: any) => {
    if (item.task_id) {
      await updateTask.mutateAsync({
        id: item.task_id,
        category: item.suggested_category,
        quadrant: item.suggested_quadrant,
        est_minutes: item.suggested_est_minutes,
        needs_triage: false,
      });
    }
    await resolveTriage.mutateAsync({ id: item.id, status: 'approved' });
  };

  const handleDismiss = async (item: any) => {
    if (item.task_id) {
      await updateTask.mutateAsync({ id: item.task_id, status: 'archived' });
    }
    await resolveTriage.mutateAsync({ id: item.id, status: 'dismissed' });
  };

  return (
    <div className="space-y-5 pb-4">
      <h1 className="text-[22px] font-medium text-foreground">Triage</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-[14px]" />)}
        </div>
      ) : !items?.length ? (
        <div className="rounded-[14px] bg-card p-10 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#059669' }}>
            <Check size={24} className="text-white" />
          </div>
          <p className="text-sm font-medium text-foreground">All clear</p>
          <p className="text-xs text-muted-foreground mt-1">Nothing to review right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => {
            const task = item.tasks;
            return (
              <div
                key={item.id}
                className="rounded-[14px] bg-card p-5"
                style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
              >
                <h3 className="text-lg font-medium text-foreground mb-2">{task?.name || 'Unknown task'}</h3>

                <div className="flex items-center gap-2 mb-2">
                  {item.suggested_category && (
                    <span
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${getCategoryColor(item.suggested_category)}15`,
                        color: getCategoryColor(item.suggested_category),
                      }}
                    >
                      {item.suggested_category}
                    </span>
                  )}
                  {item.suggested_quadrant && (
                    <span
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${getQuadrantColor(item.suggested_quadrant)}15`,
                        color: getQuadrantColor(item.suggested_quadrant),
                      }}
                    >
                      {item.suggested_quadrant}
                    </span>
                  )}
                  {item.suggested_est_minutes && (
                    <span className="text-xs text-muted-foreground">{item.suggested_est_minutes}m</span>
                  )}
                </div>

                {item.ai_reasoning && (
                  <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">{item.ai_reasoning}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ backgroundColor: '#059669' }}
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => task && setEditTask(task)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ backgroundColor: '#D97706' }}
                  >
                    <Edit size={16} /> Edit
                  </button>
                  <button
                    onClick={() => handleDismiss(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ backgroundColor: '#9CA3AF' }}
                  >
                    <X size={16} /> Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskEditModal task={editTask} open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} />
    </div>
  );
}
