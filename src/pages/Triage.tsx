import { useState } from 'react';
import { Check, Edit2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTriageQueue, useApproveTriage, useDismissTriage, useModifyTriage, type TriageItem } from '@/hooks/useTriageQueue';
import { useUpdateTask, type Task } from '@/hooks/useTasks';
import { TaskEditModal } from '@/components/TaskEditModal';
import { CategoryBadge, QuadrantBadge } from '@/components/CategoryBadge';

export default function TriagePage() {
  const { data: items, isLoading } = useTriageQueue();
  const approveTriage = useApproveTriage();
  const dismissTriage = useDismissTriage();
  const modifyTriage = useModifyTriage();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editTriageId, setEditTriageId] = useState<string | null>(null);

  const handleEdit = (item: TriageItem) => {
    if (item.task) {
      setEditTask(item.task as unknown as Task);
      setEditTriageId(item.id);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Triage</h1>
        {items && items.length > 0 && (
          <span className="text-sm text-muted-foreground">{items.length} pending</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : !items?.length ? (
        <Card className="border-none shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <p className="font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No tasks need triage right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="border-none shadow-sm overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <p className="font-semibold text-base">{item.task?.name || 'Unknown task'}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground text-xs">Suggested:</span>
                    <CategoryBadge category={item.suggested_category} />
                    <QuadrantBadge quadrant={item.suggested_quadrant} />
                    {item.suggested_est_minutes && (
                      <span className="text-xs text-muted-foreground">{item.suggested_est_minutes}m</span>
                    )}
                  </div>

                  {item.ai_reasoning && (
                    <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2 leading-relaxed">
                      {item.ai_reasoning}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => approveTriage.mutate(item)}
                    disabled={approveTriage.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  >
                    <Check size={14} /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(item)}
                    className="flex-1 border-primary/30 text-primary gap-1"
                  >
                    <Edit2 size={14} /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissTriage.mutate(item)}
                    disabled={dismissTriage.isPending}
                    className="text-muted-foreground gap-1"
                  >
                    <X size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskEditModal
        task={editTask}
        open={!!editTask}
        onOpenChange={(o) => {
          if (!o) {
            setEditTask(null);
            setEditTriageId(null);
          }
        }}
        onModifyTriage={editTriageId ? () => modifyTriage.mutate({ triageId: editTriageId }) : undefined}
      />
    </div>
  );
}
