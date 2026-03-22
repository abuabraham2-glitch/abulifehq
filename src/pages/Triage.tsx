import { useState } from 'react';
import { Check, Edit, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePendingTriage, useResolveTriage, type UnifiedTriageItem } from '@/hooks/useTriageQueue';
import { useUpdateTask, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { getCategoryColor, getQuadrantColor } from '@/lib/constants';

export default function Triage() {
  const { data: items, isLoading } = usePendingTriage();
  const resolveTriage = useResolveTriage();
  const updateTask = useUpdateTask();
  const [editTask, setEditTask] = useState<Task | null>(null);

  const handleApprove = async (item: UnifiedTriageItem) => {
    if (item.task_id) {
      const task = item.tasks;
      await updateTask.mutateAsync({
        id: item.task_id,
        category: item.suggested_category ?? task?.category ?? null,
        importance: task?.importance ?? null,
        urgency: task?.urgency ?? null,
        quadrant: item.suggested_quadrant ?? task?.quadrant ?? null,
        est_minutes: item.suggested_est_minutes ?? task?.est_minutes ?? null,
        notes: task?.notes ?? null,
        needs_triage: false,
      });
    }
    await resolveTriage.mutateAsync({ id: item.id, status: 'approved' });
  };

  const handleDismiss = async (item: UnifiedTriageItem) => {
    if (item.task_id) {
      await updateTask.mutateAsync({ id: item.task_id, status: 'archived', needs_triage: false });
    }
    await resolveTriage.mutateAsync({ id: item.id, status: 'dismissed' });
  };

  return (
    <div className="space-y-4 md:space-y-5 pb-4">
      <h1 className="text-[22px] md:text-[26px] font-medium text-foreground">Triage</h1>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-[14px]" />)}
        </div>
      ) : !items?.length ? (
        <div className="rounded-[14px] bg-card p-10 text-center" style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}>
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#059669' }}>
            <Check size={24} className="text-white" />
          </div>
          <p className="text-[14px] font-medium text-foreground">All clear</p>
          <p className="text-[13px] text-muted-foreground mt-1">Nothing to review right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const task = item.tasks;
            const isOrphan = item.source === 'orphan_task';
            return (
              <div
                key={item.id}
                className="rounded-[14px] bg-card p-4 md:p-5"
                style={{ border: '0.5px solid rgba(0,0,0,0.04)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[16px] md:text-lg font-medium text-foreground">{task?.name || 'Unknown task'}</h3>
                  {isOrphan && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Needs review
                    </span>
                  )}
                </div>

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
                    <span className="text-[13px] text-muted-foreground">{item.suggested_est_minutes}m</span>
                  )}
                </div>

                {item.ai_reasoning && (
                  <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">{item.ai_reasoning}</p>
                )}

                <div className="flex flex-col md:flex-row gap-2">
                  <button
                    onClick={() => handleApprove(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 md:py-2.5 rounded-xl text-[14px] md:text-sm font-medium text-white min-h-[48px]"
                    style={{ backgroundColor: '#059669' }}
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => task && setEditTask(task)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 md:py-2.5 rounded-xl text-[14px] md:text-sm font-medium text-white min-h-[48px]"
                    style={{ backgroundColor: '#D97706' }}
                  >
                    <Edit size={16} /> Edit
                  </button>
                  <button
                    onClick={() => handleDismiss(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 md:py-2.5 rounded-xl text-[14px] md:text-sm font-medium text-white min-h-[48px]"
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
