import { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { usePlanItemsByDate, useUpdatePlanItem, todayStr, tomorrowStr, type PlanItem } from '@/hooks/useDailyPlan';
import { useCompleteTask } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { SkipReasonModal } from '@/components/SkipReasonModal';
import { FocusCard } from '@/components/FocusCard';
import { Timeline } from '@/components/Timeline';
import { ProgressBar } from '@/components/ProgressBar';

interface Props {
  viewTomorrow: boolean;
  onToggleTab: () => void;
}

export function TodaysSchedule({ viewTomorrow, onToggleTab }: Props) {
  const dateString = viewTomorrow ? tomorrowStr() : todayStr();
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

  const sortedItems = useMemo(() => {
    return [...(planItems ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [planItems]);

  const activeItemId = useMemo(() => {
    if (viewTomorrow) {
      // For tomorrow, first item is "FIRST UP"
      const first = sortedItems[0];
      return first?.id ?? null;
    }
    const pending = sortedItems.filter((i) => i.status !== 'completed' && i.status !== 'skipped');
    if (pending.length === 0) return null;
    const upcoming = pending.find((i) => i.start_time >= nowTime);
    return upcoming?.id ?? pending[0]?.id ?? null;
  }, [sortedItems, nowTime, viewTomorrow]);

  const activeItem = useMemo(() => sortedItems.find((i) => i.id === activeItemId) ?? null, [sortedItems, activeItemId]);
  const activeIsOverdue = useMemo(() => {
    if (!activeItem || viewTomorrow) return false;
    return activeItem.start_time < nowTime;
  }, [activeItem, nowTime, viewTomorrow]);

  const pastPendingItems = useMemo(() => {
    if (viewTomorrow) return [];
    return sortedItems.filter(
      (i) => i.status !== 'completed' && i.status !== 'skipped' && i.end_time < nowTime
    );
  }, [sortedItems, nowTime, viewTomorrow]);

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

  if (isLoading) return null;

  // Tomorrow with no plan
  if (viewTomorrow && !sortedItems.length) {
    return (
      <div className="space-y-4">
        <TabToggle viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        <div className="rounded-[14px] bg-card p-6 text-center" style={{ border: '1px solid hsl(var(--border))' }}>
          <p className="text-[14px] text-muted-foreground">Tomorrow's plan hasn't been generated yet.</p>
          <p className="text-[13px] text-muted-foreground mt-1">It will arrive at 9pm tonight.</p>
        </div>
      </div>
    );
  }

  if (!sortedItems.length) return null;

  return (
    <div className="space-y-4">
      {/* Tab toggle + bulk skip */}
      <div className="flex items-center justify-between">
        <TabToggle viewTomorrow={viewTomorrow} onToggle={onToggleTab} />
        {!viewTomorrow && pastPendingItems.length > 0 && (
          <button
            onClick={() => setBulkSkipOpen(true)}
            className="text-[12px] font-medium text-destructive"
          >
            Skip past events
          </button>
        )}
      </div>

      {/* Progress bar — only today */}
      {!viewTomorrow && (
        <ProgressBar planItems={sortedItems} activeItemId={activeItemId} />
      )}

      {/* Focus Card */}
      {activeItem && (
        <FocusCard
          item={activeItem}
          isOverdue={activeIsOverdue}
          isTomorrow={viewTomorrow}
          onSkip={(item) => setSkipItem(item)}
          onDone={openDoneDialog}
        />
      )}

      {/* Timeline */}
      <Timeline
        items={sortedItems}
        activeItemId={activeItemId}
        nowTime={nowTime}
        isTomorrow={viewTomorrow}
        onRemove={handleRemove}
        onDone={openDoneDialog}
        onSkip={(item) => setSkipItem(item)}
        onUndo={handleUndo}
      />

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
              style={{ backgroundColor: 'hsl(var(--sage-success))' }}
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

function TabToggle({ viewTomorrow, onToggle }: { viewTomorrow: boolean; onToggle: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button
        onClick={viewTomorrow ? onToggle : undefined}
        className="flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 transition-colors"
        style={{
          backgroundColor: !viewTomorrow ? 'hsl(var(--sage-amber))' : 'hsl(var(--secondary))',
          color: !viewTomorrow ? '#fff' : 'hsl(var(--foreground))',
        }}
      >
        <Clock size={13} />
        Today
      </button>
      <button
        onClick={!viewTomorrow ? onToggle : undefined}
        className="flex items-center gap-1.5 text-[13px] font-semibold rounded-full px-4 py-2 transition-colors"
        style={{
          backgroundColor: viewTomorrow ? 'hsl(var(--sage-amber))' : 'hsl(var(--secondary))',
          color: viewTomorrow ? '#fff' : 'hsl(var(--foreground))',
        }}
      >
        <Clock size={13} />
        Tomorrow
      </button>
    </div>
  );
}
