import { useState, useMemo } from 'react';
import { Check, X, RotateCcw, Clock, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePlanItemsByDate, useUpdatePlanItem, todayStr, yesterdayStr, type PlanItem } from '@/hooks/useDailyPlan';
import { useCompleteTask } from '@/hooks/useTasks';
import { formatTime12h, getCategoryColor } from '@/lib/constants';

export function FullSchedule() {
  const [viewYesterday, setViewYesterday] = useState(false);
  const dateString = viewYesterday ? yesterdayStr() : todayStr();
  const { data: planItems, isLoading } = usePlanItemsByDate(dateString);
  const updatePlanItem = useUpdatePlanItem();
  const completeTask = useCompleteTask();

  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [bulkSkipOpen, setBulkSkipOpen] = useState(false);
  const [bulkSkipReason, setBulkSkipReason] = useState('');
  const [bulkSkipping, setBulkSkipping] = useState(false);

  const nowTime = useMemo(() => {
    const pac = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const h = String(pac.getHours()).padStart(2, '0');
    const m = String(pac.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }, []);

  if (isLoading) return null;
  if (!planItems?.length) {
    if (viewYesterday) {
      return (
        <div>
          <Header viewYesterday={viewYesterday} onToggle={() => setViewYesterday(!viewYesterday)} />
          <p className="text-[13px] text-muted-foreground text-center py-4">No plan found for yesterday.</p>
        </div>
      );
    }
    return null;
  }

  const openDoneDialog = (item: PlanItem) => {
    setActualMinutes(item.actual_minutes ?? item.est_minutes ?? 25);
    setDoneItem(item);
  };

  const handleSaveDone = async () => {
    if (!doneItem) return;
    await updatePlanItem.mutateAsync({
      id: doneItem.id,
      status: 'completed',
      actual_minutes: actualMinutes,
    });
    if (doneItem.task_id) {
      await completeTask.mutateAsync(doneItem.task_id);
    }
    setDoneItem(null);
  };

  const handleSkip = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({ id: item.id, status: 'skipped' });
    if (item.calendar_event_id) {
      fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_item_id: item.id, calendar_event_id: item.calendar_event_id }),
      }).catch(() => {});
    }
  };

  const handleUndo = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({ id: item.id, status: 'pending' });
  };

  const isOverdue = (item: PlanItem) => !viewYesterday && item.end_time < nowTime;

  return (
    <div>
      <Header viewYesterday={viewYesterday} onToggle={() => setViewYesterday(!viewYesterday)} />
      <div className="space-y-2">
        {planItems.map((item) => {
          const isCompleted = item.status === 'completed';
          const isSkipped = item.status === 'skipped';
          const isPending = !isCompleted && !isSkipped;
          const overdue = isPending && (viewYesterday || isOverdue(item));

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[14px] p-3.5 min-h-[52px]"
              style={{
                backgroundColor: (isCompleted || isSkipped) ? 'hsl(var(--secondary))' : 'hsl(var(--card))',
                border: '0.5px solid rgba(0,0,0,0.04)',
              }}
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                {isCompleted && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#059669' }}>
                    <Check size={12} className="text-white" />
                  </div>
                )}
                {isSkipped && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-muted-foreground">
                    <X size={12} className="text-white" />
                  </div>
                )}
                {isPending && (
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(item.category) }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-[14px] md:text-[13px] ${(isCompleted || isSkipped) ? 'line-through' : ''}`}
                    style={{ color: isSkipped ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))' }}
                  >
                    {item.title}
                  </p>
                  {overdue && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground">
                      Overdue
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
                  {isCompleted && item.actual_minutes != null && ` · ${item.actual_minutes}m actual`}
                </p>
              </div>

              {/* Est minutes badge */}
              <span className="text-[12px] font-medium flex-shrink-0" style={{ color: getCategoryColor(item.category) }}>
                {item.is_calendar_event ? 'G.Cal' : `${item.est_minutes || 0}m`}
              </span>

              {/* Action buttons */}
              <div className="flex gap-1.5 flex-shrink-0">
                {isPending && (
                  <>
                    <button
                      onClick={() => openDoneDialog(item)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[36px] md:min-h-0"
                      style={{ backgroundColor: '#059669', color: '#fff' }}
                    >
                      ✓ Done
                    </button>
                    <button
                      onClick={() => handleSkip(item)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[36px] md:min-h-0 bg-secondary text-muted-foreground"
                    >
                      Skip
                    </button>
                  </>
                )}
                {isCompleted && (
                  <button
                    onClick={() => openDoneDialog(item)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[36px] md:min-h-0 flex items-center gap-1 bg-secondary text-muted-foreground"
                  >
                    <Pencil size={11} /> Edit Time
                  </button>
                )}
                {isSkipped && (
                  <button
                    onClick={() => handleUndo(item)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium min-h-[36px] md:min-h-0 flex items-center gap-1 bg-secondary text-muted-foreground"
                  >
                    <RotateCcw size={11} /> Undo
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Done / Edit Time dialog */}
      <Dialog open={!!doneItem} onOpenChange={(o) => !o && setDoneItem(null)}>
        <DialogContent className="max-w-[340px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">How long did this actually take?</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <p className="text-[13px] text-muted-foreground mb-2">{doneItem?.title}</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={actualMinutes}
                onChange={(e) => setActualMinutes(Number(e.target.value))}
                className="w-24 text-center"
              />
              <span className="text-[13px] text-muted-foreground">minutes</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveDone}
              disabled={updatePlanItem.isPending}
              className="w-full rounded-xl"
              style={{ backgroundColor: '#059669' }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header({ viewYesterday, onToggle }: { viewYesterday: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] md:text-[13px] text-muted-foreground font-medium tracking-wider">
        {viewYesterday ? "YESTERDAY'S SCHEDULE" : "TODAY'S FULL SCHEDULE"}
      </p>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 text-[12px] font-medium"
        style={{ color: '#B8906C' }}
      >
        <Clock size={12} />
        {viewYesterday ? 'View Today' : 'View Yesterday'}
      </button>
    </div>
  );
}
