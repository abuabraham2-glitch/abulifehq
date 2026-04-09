import { useState, useMemo } from 'react';
import { Check, X, RotateCcw, Clock, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePlanItemsByDate, useUpdatePlanItem, todayStr, yesterdayStr, type PlanItem } from '@/hooks/useDailyPlan';
import { useCompleteTask } from '@/hooks/useTasks';
import { formatTime12h, getCategoryColor } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { FocusTimer } from '@/components/FocusTimer';
import { SkipReasonModal } from '@/components/SkipReasonModal';

export function TodaysSchedule() {
  const [viewYesterday, setViewYesterday] = useState(false);
  const dateString = viewYesterday ? yesterdayStr() : todayStr();
  const { data: planItems, isLoading } = usePlanItemsByDate(dateString);
  const updatePlanItem = useUpdatePlanItem();
  const completeTask = useCompleteTask();
  const queryClient = useQueryClient();

  const [doneItem, setDoneItem] = useState<PlanItem | null>(null);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [skipItem, setSkipItem] = useState<PlanItem | null>(null);
  const [bulkSkipOpen, setBulkSkipOpen] = useState(false);
  const [bulkSkipReason, setBulkSkipReason] = useState('');
  const [bulkSkipping, setBulkSkipping] = useState(false);

  const nowTime = useMemo(() => {
    const pac = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const h = String(pac.getHours()).padStart(2, '0');
    const m = String(pac.getMinutes()).padStart(2, '0');
    return `${h}:${m}:00`;
  }, []);

  // Sort items by start_time
  const sortedItems = useMemo(() => {
    return [...(planItems ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [planItems]);

  // Find the "active" item: first pending item with start_time >= now, or first pending if all past
  const activeItemId = useMemo(() => {
    if (viewYesterday) return null;
    const pending = sortedItems.filter((i) => i.status !== 'completed' && i.status !== 'skipped');
    if (pending.length === 0) return null;
    const upcoming = pending.find((i) => i.start_time >= nowTime);
    return upcoming?.id ?? pending[0]?.id ?? null;
  }, [sortedItems, nowTime, viewYesterday]);

  const activeItem = useMemo(() => sortedItems.find((i) => i.id === activeItemId) ?? null, [sortedItems, activeItemId]);
  const activeIsOverdue = useMemo(() => {
    if (!activeItem || viewYesterday) return false;
    return activeItem.start_time < nowTime;
  }, [activeItem, nowTime, viewYesterday]);

  const pastPendingItems = useMemo(() => {
    if (viewYesterday) return [];
    return sortedItems.filter(
      (i) => i.status !== 'completed' && i.status !== 'skipped' && i.end_time < nowTime
    );
  }, [sortedItems, nowTime, viewYesterday]);

  const handleRemove = async (item: PlanItem) => {
    await supabase.from('plan_items').delete().eq('id', item.id);
    fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_item_id: item.id, calendar_event_id: item.calendar_event_id }),
    }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['daily-plan'] });
  };

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
    fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_item_id: doneItem.id, calendar_event_id: doneItem.calendar_event_id }),
    }).catch(() => {});
    setDoneItem(null);
  };

  const handleSkip = async (item: PlanItem, reason?: string) => {
    await updatePlanItem.mutateAsync({
      id: item.id,
      status: 'skipped',
      skip_reason: reason,
      task_id: item.task_id,
    });
    if (item.calendar_event_id) {
      fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_item_id: item.id, calendar_event_id: item.calendar_event_id }),
      }).catch(() => {});
    }
    setSkipItem(null);
  };

  const handleUndo = async (item: PlanItem) => {
    await updatePlanItem.mutateAsync({ id: item.id, status: 'pending' });
  };

  const handleBulkSkip = async () => {
    setBulkSkipping(true);
    const reason = bulkSkipReason.trim() || null;
    try {
      await Promise.all(
        pastPendingItems.map(async (item) => {
          await updatePlanItem.mutateAsync({
            id: item.id,
            status: 'skipped',
            skip_reason: reason,
          });
          if (item.calendar_event_id) {
            fetch('https://bottlesandprint.app.n8n.cloud/webhook/life-hq-skip-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan_item_id: item.id, calendar_event_id: item.calendar_event_id }),
            }).catch(() => {});
          }
        })
      );
    } finally {
      setBulkSkipping(false);
      setBulkSkipOpen(false);
      setBulkSkipReason('');
    }
  };

  const isOverdue = (item: PlanItem) => !viewYesterday && item.end_time < nowTime;

  if (isLoading) return null;
  if (!sortedItems.length) {
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

  return (
    <div>
      <Header
        viewYesterday={viewYesterday}
        onToggle={() => setViewYesterday(!viewYesterday)}
        showBulkSkip={pastPendingItems.length > 0}
        onBulkSkip={() => setBulkSkipOpen(true)}
      />
      <div className="space-y-2">
        {sortedItems.map((item) => {
          const isActive = item.id === activeItemId;
          const isCompleted = item.status === 'completed';
          const isSkipped = item.status === 'skipped';
          const isPending = !isCompleted && !isSkipped;
          const overdue = isPending && (viewYesterday || isOverdue(item));

          if (isActive) {
            return (
              <div
                key={item.id}
                className="rounded-[14px] p-4 md:p-5"
                style={{
                  backgroundColor: 'hsl(var(--card))',
                  borderLeft: '4px solid #B8906C',
                  border: '1.5px solid #B8906C',
                  borderLeftWidth: '4px',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(item.category) }} />
                  <span className="text-[11px] font-medium" style={{ color: getCategoryColor(item.category) }}>
                    {item.category || 'Buffer'}
                  </span>
                  {activeIsOverdue && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground ml-1">
                      Overdue
                    </span>
                  )}
                </div>
                <h2 className="text-[16px] md:text-lg font-medium text-foreground mb-0.5 break-words">{item.title}</h2>
                <p className="text-[13px] text-muted-foreground mb-3">
                  {formatTime12h(item.start_time)} — {formatTime12h(item.end_time)}
                  {!item.is_calendar_event && ` · ${item.est_minutes || 0}m`}
                </p>

                <FocusTimer />

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setSkipItem(item)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px] bg-secondary text-muted-foreground"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => openDoneDialog(item)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-[14px] font-medium min-h-[44px]"
                    style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
                  >
                    ✓ Done
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[14px] p-3.5 min-h-[52px]"
              style={{
                backgroundColor: (isCompleted || isSkipped) ? 'hsl(var(--secondary))' : 'hsl(var(--card))',
                border: '0.5px solid rgba(0,0,0,0.04)',
              }}
            >
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

              <span className="text-[12px] font-medium flex-shrink-0" style={{ color: getCategoryColor(item.category) }}>
                {item.is_calendar_event ? 'G.Cal' : `${item.est_minutes || 0}m`}
              </span>

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
                      onClick={() => setSkipItem(item)}
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
                {isPending && !item.is_calendar_event && (
                  <button
                    onClick={() => handleRemove(item)}
                    className="p-1 rounded-full hover:bg-secondary transition-colors"
                    aria-label="Remove item"
                  >
                    <X size={14} style={{ color: '#94a3b8' }} />
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

      {/* Skip reason modal */}
      <SkipReasonModal
        open={!!skipItem}
        onOpenChange={(o) => !o && setSkipItem(null)}
        taskTitle={skipItem?.title || ''}
        onSkipWithReason={(reason) => skipItem && handleSkip(skipItem, reason)}
        onSkipWithoutReason={() => skipItem && handleSkip(skipItem)}
      />

      {/* Bulk Skip Modal */}
      <Dialog open={bulkSkipOpen} onOpenChange={(o) => { if (!o) { setBulkSkipOpen(false); setBulkSkipReason(''); } }}>
        <DialogContent className="max-w-[380px] rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[16px]">Skip past events?</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              {pastPendingItems.length} overdue item{pastPendingItems.length !== 1 ? 's' : ''} will be marked as skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="text-[13px] text-muted-foreground mb-1.5 block">Reason (optional)</label>
            <Textarea
              value={bulkSkipReason}
              onChange={(e) => setBulkSkipReason(e.target.value)}
              placeholder="e.g. ran out of time, priorities changed..."
              className="min-h-[70px] text-[14px] rounded-xl resize-none"
            />
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => { setBulkSkipOpen(false); setBulkSkipReason(''); }}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkSkip}
              disabled={bulkSkipping}
              className="flex-1 rounded-xl"
              style={{ backgroundColor: 'hsl(var(--foreground))', color: 'hsl(var(--background))' }}
            >
              {bulkSkipping ? 'Skipping...' : 'Skip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header({ viewYesterday, onToggle, showBulkSkip, onBulkSkip }: { viewYesterday: boolean; onToggle: () => void; showBulkSkip?: boolean; onBulkSkip?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] md:text-[13px] text-muted-foreground font-medium tracking-wider">
        {viewYesterday ? "YESTERDAY'S SCHEDULE" : "TODAY'S SCHEDULE"}
      </p>
      <div className="flex items-center gap-3">
        {showBulkSkip && (
          <button
            onClick={onBulkSkip}
            className="text-[12px] font-medium text-destructive"
          >
            Skip past events
          </button>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={viewYesterday ? onToggle : undefined}
            className="flex items-center gap-1.5 text-[14px] font-bold rounded-full px-4 py-2 transition-colors"
            style={{
              backgroundColor: !viewYesterday ? '#B8906C' : '#E8E0D4',
              color: !viewYesterday ? '#fff' : '#3D3225',
              border: '1.5px solid #B8906C',
            }}
          >
            <Clock size={13} />
            Today
          </button>
          <button
            onClick={!viewYesterday ? onToggle : undefined}
            className="flex items-center gap-1.5 text-[14px] font-bold rounded-full px-4 py-2 transition-colors"
            style={{
              backgroundColor: viewYesterday ? '#B8906C' : '#E8E0D4',
              color: viewYesterday ? '#fff' : '#3D3225',
              border: '1.5px solid #B8906C',
            }}
          >
            <Clock size={13} />
            Yesterday
          </button>
        </div>
      </div>
    </div>
  );
}
